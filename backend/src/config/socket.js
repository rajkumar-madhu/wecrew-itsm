// ═══════════════════════════════════════════════════════════
// LinkedEye ITSM — Socket.IO Setup
// ═══════════════════════════════════════════════════════════

const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');

let io = null;

function initSocket(httpServer, corsOrigins) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = verifyAccessToken(token);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(`user:${id}`);
    socket.join(`role:${role}`);
    console.log(`[WS] User ${id} connected`);

    socket.on('join:team', (teamId) => socket.join(`team:${teamId}`));
    socket.on('leave:team', (teamId) => socket.leave(`team:${teamId}`));
    socket.on('join:incident', (incId) => socket.join(`incident:${incId}`));
    socket.on('leave:incident', (incId) => socket.leave(`incident:${incId}`));

    // Real-time team chat (persist via REST; this is typing + optional echo)
    socket.on('chat:typing', ({ teamId, typing }) => {
      if (!teamId) return;
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

function emitToAll(event, data) {
  if (io) io.emit(event, data);
}

function emitToIncident(incidentId, event, data) {
  if (io) io.to(`incident:${incidentId}`).emit(event, data);
}

module.exports = { initSocket, getIO, emitToUser, emitToTeam, emitToAll, emitToIncident };
