#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Database Health Check
// Outputs Prometheus metrics format for /metrics endpoint
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

async function getConnectionPoolStatus() {
  try {
    const result = await prisma.$queryRaw`
      SELECT
        numbackends AS active_connections,
        xact_commit AS transactions_committed,
        xact_rollback AS transactions_rolled_back,
        blks_read AS blocks_read,
        blks_hit AS blocks_hit,
        tup_returned AS rows_returned,
        tup_fetched AS rows_fetched,
        tup_inserted AS rows_inserted,
        tup_updated AS rows_updated,
        tup_deleted AS rows_deleted,
        deadlocks
      FROM pg_stat_database
      WHERE datname = current_database()
    `;
    return result[0] || {};
  } catch (err) {
    console.error('Connection pool check failed:', err.message);
    return {};
  }
}

async function getTableRowCounts() {
  try {
    const result = await prisma.$queryRaw`
      SELECT
        schemaname,
        relname AS table_name,
        n_live_tup AS row_count,
        n_dead_tup AS dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `;
    return result;
  } catch (err) {
    console.error('Table row count check failed:', err.message);
    return [];
  }
}

async function getIndexUsageStats() {
  try {
    const result = await prisma.$queryRaw`
      SELECT
        schemaname,
        relname AS table_name,
        indexrelname AS index_name,
        idx_scan AS scans,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched,
        pg_relation_size(indexrelid) AS index_size_bytes
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 50
    `;
    return result;
  } catch (err) {
    console.error('Index usage check failed:', err.message);
    return [];
  }
}

async function getLongRunningQueries() {
  try {
    const result = await prisma.$queryRaw`
      SELECT
        pid,
        now() - pg_stat_activity.query_start AS duration,
        EXTRACT(EPOCH FROM (now() - pg_stat_activity.query_start)) AS duration_seconds,
        query,
        state,
        usename,
        application_name
      FROM pg_stat_activity
      WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
        AND state != 'idle'
        AND pid != pg_backend_pid()
      ORDER BY duration DESC
    `;
    return result;
  } catch (err) {
    console.error('Long running query check failed:', err.message);
    return [];
  }
}

async function getReplicationLag() {
  try {
    const result = await prisma.$queryRaw`
      SELECT
        client_addr,
        state,
        sent_lsn,
        write_lsn,
        flush_lsn,
        replay_lsn,
        EXTRACT(EPOCH FROM (now() - write_lag)) AS write_lag_seconds,
        EXTRACT(EPOCH FROM (now() - flush_lag)) AS flush_lag_seconds,
        EXTRACT(EPOCH FROM (now() - replay_lag)) AS replay_lag_seconds
      FROM pg_stat_replication
    `;
    return result;
  } catch (err) {
    // Not an error — may not be a replica setup
    return [];
  }
}

async function getDatabaseSize() {
  try {
    const result = await prisma.$queryRaw`
      SELECT pg_database_size(current_database()) AS size_bytes
    `;
    return result[0]?.size_bytes || 0;
  } catch (err) {
    return 0;
  }
}

function formatPrometheusMetrics(data) {
  const lines = [];
  const ts = Date.now();

  // Connection pool
  if (data.pool) {
    lines.push('# HELP linkedeye_db_active_connections Number of active database connections');
    lines.push('# TYPE linkedeye_db_active_connections gauge');
    lines.push(`linkedeye_db_active_connections ${data.pool.active_connections || 0}`);

    lines.push('# HELP linkedeye_db_transactions_total Total transactions');
    lines.push('# TYPE linkedeye_db_transactions_total counter');
    lines.push(`linkedeye_db_transactions_total{type="committed"} ${data.pool.transactions_committed || 0}`);
    lines.push(`linkedeye_db_transactions_total{type="rolled_back"} ${data.pool.transactions_rolled_back || 0}`);

    lines.push('# HELP linkedeye_db_deadlocks_total Total deadlocks');
    lines.push('# TYPE linkedeye_db_deadlocks_total counter');
    lines.push(`linkedeye_db_deadlocks_total ${data.pool.deadlocks || 0}`);
  }

  // Database size
  lines.push('# HELP linkedeye_db_size_bytes Database size in bytes');
  lines.push('# TYPE linkedeye_db_size_bytes gauge');
  lines.push(`linkedeye_db_size_bytes ${data.dbSize || 0}`);

  // Table row counts
  lines.push('# HELP linkedeye_db_table_rows Number of live rows per table');
  lines.push('# TYPE linkedeye_db_table_rows gauge');
  for (const table of data.tables) {
    lines.push(`linkedeye_db_table_rows{table="${table.table_name}"} ${table.row_count}`);
  }

  lines.push('# HELP linkedeye_db_table_dead_rows Number of dead rows per table');
  lines.push('# TYPE linkedeye_db_table_dead_rows gauge');
  for (const table of data.tables) {
    lines.push(`linkedeye_db_table_dead_rows{table="${table.table_name}"} ${table.dead_rows}`);
  }

  // Index usage
  lines.push('# HELP linkedeye_db_index_scans Total index scans');
  lines.push('# TYPE linkedeye_db_index_scans counter');
  for (const idx of data.indexes) {
    lines.push(`linkedeye_db_index_scans{table="${idx.table_name}",index="${idx.index_name}"} ${idx.scans}`);
  }

  lines.push('# HELP linkedeye_db_index_size_bytes Index size in bytes');
  lines.push('# TYPE linkedeye_db_index_size_bytes gauge');
  for (const idx of data.indexes) {
    lines.push(`linkedeye_db_index_size_bytes{table="${idx.table_name}",index="${idx.index_name}"} ${idx.index_size_bytes}`);
  }

  // Long running queries
  lines.push('# HELP linkedeye_db_long_running_queries Number of queries running > 30s');
  lines.push('# TYPE linkedeye_db_long_running_queries gauge');
  lines.push(`linkedeye_db_long_running_queries ${data.longQueries.length}`);

  // Replication lag
  lines.push('# HELP linkedeye_db_replication_lag_seconds Replication lag in seconds');
  lines.push('# TYPE linkedeye_db_replication_lag_seconds gauge');
  for (const rep of data.replication) {
    lines.push(`linkedeye_db_replication_lag_seconds{client="${rep.client_addr}",type="write"} ${rep.write_lag_seconds || 0}`);
    lines.push(`linkedeye_db_replication_lag_seconds{client="${rep.client_addr}",type="flush"} ${rep.flush_lag_seconds || 0}`);
    lines.push(`linkedeye_db_replication_lag_seconds{client="${rep.client_addr}",type="replay"} ${rep.replay_lag_seconds || 0}`);
  }

  // Health status (1 = healthy, 0 = unhealthy)
  lines.push('# HELP linkedeye_db_health Database health status');
  lines.push('# TYPE linkedeye_db_health gauge');
  const isHealthy = data.pool && data.tables.length > 0 && data.longQueries.length < 10;
  lines.push(`linkedeye_db_health ${isHealthy ? 1 : 0}`);

  return lines.join('\n');
}

async function main() {
  try {
    const [pool, tables, indexes, longQueries, replication, dbSize] = await Promise.all([
      getConnectionPoolStatus(),
      getTableRowCounts(),
      getIndexUsageStats(),
      getLongRunningQueries(),
      getReplicationLag(),
      getDatabaseSize(),
    ]);

    const data = { pool, tables, indexes, longQueries, replication, dbSize };

    // Output format based on CLI args
    const outputFormat = process.argv[2] || 'prometheus';

    if (outputFormat === 'json') {
      console.log(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? Number(value) : value, 2));
    } else {
      console.log(formatPrometheusMetrics(data));
    }

    // Print summary to stderr for logging
    console.error(`[DB Health] Connections: ${pool.active_connections || 0} | Tables: ${tables.length} | Long queries: ${longQueries.length} | Replication: ${replication.length} replicas | DB size: ${(Number(dbSize) / 1024 / 1024).toFixed(1)}MB`);

    if (longQueries.length > 0) {
      console.error('[DB Health] WARNING: Long-running queries detected:');
      for (const q of longQueries) {
        console.error(`  PID ${q.pid}: ${q.duration_seconds?.toFixed(0)}s — ${(q.query || '').substring(0, 100)}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('[DB Health] FATAL:', err.message);
    console.log('linkedeye_db_health 0');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
