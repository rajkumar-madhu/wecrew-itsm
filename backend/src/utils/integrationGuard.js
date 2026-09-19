// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Integration config guard (tenant-set outbound targets)
//
// Integration configs steer where the API reaches out:
//   - serverIp / sshUser / sshPort / accessMethod 'ssh' use WeCrew's SHARED SSH
//     key, authorized on every customer server — a tenant naming another
//     tenant's IP would read that tenant's cluster, Prometheus and logs.
//   - accessMethod 'local' is WeCrew's own cluster via the API pod's account.
//   - *Url fields make the API issue HTTP requests (SSRF into the cluster
//     network, link-local metadata, loopback).
// Platform admins may set anything. Everyone else may only supply public
// http(s) URLs for their own endpoints (direct API mode with their token).
// Residual risk: DNS can change after this check (rebinding) — fetch-time
// pinning would be needed to close that fully.
// ═══════════════════════════════════════════════════════════

const dns = require('dns').promises;
const net = require('net');

const PLATFORM_ONLY_KEYS = ['serverIp', 'sshUser', 'sshPort', 'sshHost', 'orgServerIp'];
const PLATFORM_ONLY_ACCESS = new Set(['ssh', 'local']);

function isPrivateIPv4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0
    || (a === 169 && b === 254)             // link-local / cloud metadata
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)   // CGNAT (also common pod/service CIDRs)
    || a >= 224;                            // multicast / reserved
}

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateIPv4(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd')
    || v6.startsWith('fe80');
}

/** Throws with a user-facing message unless `raw` is an http(s) URL to a public host. */
async function assertPublicUrl(raw, field) {
  let url;
  try { url = new URL(String(raw)); } catch { throw new Error(`${field} is not a valid URL`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${field} must be http(s)`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`${field} host does not resolve`);
  if (addrs.some((a) => isPrivateIP(a.address))) throw new Error(`${field} must point to a public address`);
}

function parseConfig(config) {
  if (config == null || config === '') return {};
  if (typeof config !== 'string') return config;
  try { return JSON.parse(config); } catch { return undefined; }
}

/**
 * Validate a tenant-supplied integration config (JSON string or object).
 * Returns null when acceptable, else an error message for a 400.
 * `existing` is the stored config on update: values a tenant leaves unchanged
 * (e.g. a staff-configured serverIp) are accepted; only CHANGES are policed.
 */
async function checkIntegrationConfig(config, { platformAdmin, existing } = {}) {
  if (platformAdmin || config == null || config === '') return null;
  const cfg = parseConfig(config);
  if (cfg === undefined) return 'config must be valid JSON';
  if (typeof cfg !== 'object' || Array.isArray(cfg)) return 'config must be a JSON object';
  const prev = parseConfig(existing) || {};
  const changed = (k) => cfg[k] != null && cfg[k] !== '' && cfg[k] !== prev[k];

  const locked = PLATFORM_ONLY_KEYS.filter(changed);
  if (locked.length) return `Only WeCrew staff can set ${locked.join(', ')} (server access uses WeCrew credentials)`;
  if (changed('accessMethod') && PLATFORM_ONLY_ACCESS.has(cfg.accessMethod)) {
    return `accessMethod '${cfg.accessMethod}' is managed by WeCrew staff; use 'direct' with your own API URL and token`;
  }
  for (const [k, v] of Object.entries(cfg)) {
    if (/url$/i.test(k) && changed(k)) {
      try { await assertPublicUrl(v, k); } catch (e) { return e.message; }
    }
  }
  return null;
}

module.exports = { checkIntegrationConfig, assertPublicUrl, isPrivateIP };
