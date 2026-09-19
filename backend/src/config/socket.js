// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Socket.IO Setup
//
// Tenant isolation over WebSockets:
//   - Each socket joins `user:<id>`, `org:<orgId>` and — platform staff only —
//     `platform`. The user is re-read from the DB at connect, so a token
//     minted before a role/org change cannot widen access.
//   - join:team / join:incident only admit rooms the user may read over REST.
//   - emitToAll is kept as the call-site name but is NOT a global broadcast:
//     it resolves the record's organization and emits to that org + platform.
//     An event whose org cannot be resolved goes to platform staff only.
// ═══════════════════════════════════════════════════════════

const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');

let io = null;

// Lazy: config/database must not load at require time (tests import this
// module for emitToUser without a database).
function db() {
  return require('./database').prisma;
}

function isPlatform(user) {
  return user.role === 'ADMIN' && user.isPlatformAdmin === true;
}

async function canJoinTeam(user, teamId) {
  if (typeof teamId !== 'string' || !teamId) return false;
  const team = await db().team.findUnique({
    where: { id: teamId },
    select: { organizationId: true, members: { where: { userId: user.id }, select: { userId: true } } },
  });
  if (!team) return false;
  if (isPlatform(user)) return true;
  if (!user.organizationId || team.organizationId !== user.organizationId) return false;
  // Same rule as chat's assertTeamAccess: ADMIN/MANAGER see every team in their org.
  return user.role === 'ADMIN' || user.role === 'MANAGER' || team.members.length > 0;
}

async function canJoinIncident(user, incidentId) {
  if (typeof incidentId !== 'string' || !incidentId) return false;
  const inc = await db().incident.findUnique({ where: { id: incidentId }, select: { organizationId: true } });
  if (!inc) return false;
  return isPlatform(user) || (!!user.organizationId && inc.organizationId === user.organizationId);
}

function initSocket(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT auth middleware — then load the live user record.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(new Error('Invalid token'));
    }
    try {
      const user = await db().user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, status: true, organizationId: true, isPlatformAdmin: true },
      });
      if (!user || user.status !== 'ACTIVE') return next(new Error('User inactive or not found'));
      socket.user = user;
      return next();
    } catch {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const { id } = user;
    socket.join(`user:${id}`);
    if (user.organizationId) socket.join(`org:${user.organizationId}`);
    if (isPlatform(user)) socket.join('platform');
    console.log(`[WS] User ${id} connected`);

    socket.on('join:team', async (teamId) => {
      try { if (await canJoinTeam(user, teamId)) socket.join(`team:${teamId}`); } catch { /* ignore */ }
    });
    socket.on('leave:team', (teamId) => socket.leave(`team:${teamId}`));
    socket.on('join:incident', async (incId) => {
      try { if (await canJoinIncident(user, incId)) socket.join(`incident:${incId}`); } catch { /* ignore */ }
    });
    socket.on('leave:incident', (incId) => socket.leave(`incident:${incId}`));

    // Real-time team chat (persist via REST; this is typing + optional echo)
    socket.on('chat:typing', ({ teamId, typing } = {}) => {
      // Only relay into a room this socket was admitted to.
      if (!teamId || !socket.rooms.has(`team:${teamId}`)) return;
      socket.to(`team:${teamId}`).emit('chat:typing', {
        teamId,
        userId: id,
        typing: !!typing,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[WS] User ${id} disconnected`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

function emitToUser(userId, event, data) {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

function emitToTeam(teamId, event, data) {
  if (io) io.to(`team:${teamId}`).emit(event, data);
}

function emitToOrg(organizationId, event, data) {
  if (!io) return;
  let target = io.to('platform');
  if (organizationId) target = target.to(`org:${organizationId}`);
  target.emit(event, data); // one emit across both rooms — no duplicates
}

// Event prefix → model whose row the payload's id refers to.
const MODEL_BY_PREFIX = { incident: 'incident', alert: 'alert', change: 'change', problem: 'problem' };

async function resolveEventOrg(event, data) {
  if (!data || typeof data !== 'object') return null;
  if (data.organizationId) return data.organizationId;
  const prefix = String(event).split(':')[0];
  if (prefix === 'voice' && data.callId) {
    const log = await db().voiceCallLog.findUnique({ where: { id: data.callId }, select: { organizationId: true } });
    return log?.organizationId || null;
  }
  const model = MODEL_BY_PREFIX[prefix];
  if (!model || !data.id) return null;
  const row = await db()[model].findUnique({ where: { id: data.id }, select: { organizationId: true } });
  return row?.organizationId || null;
}

/**
 * Historical name, tenant-scoped behaviour: resolve the event's organization
 * and emit to that org plus platform staff. Unresolvable → platform only.
 */
function emitToAll(event, data) {
  if (!io) return;
  resolveEventOrg(event, data)
    .catch(() => null)
    .then((orgId) => emitToOrg(orgId, event, data));
}

function emitToIncident(incidentId, event, data) {
  if (io) io.to(`incident:${incidentId}`).emit(event, data);
}

module.exports = {
  initSocket, getIO, emitToUser, emitToTeam, emitToOrg, emitToAll, emitToIncident,
  // exported for tests
  _internal: { resolveEventOrg, canJoinTeam, canJoinIncident, setIO: (x) => { io = x; } },
};
