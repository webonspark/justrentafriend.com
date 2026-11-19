/**
 * The Socket.IO server, reachable from anywhere without import cycles.
 * server.js attaches it at boot; services call emitTo() and it is a no-op
 * until then (scripts, seeds).
 */
let io = null;

const attach = (server) => { io = server; };
const emitTo = (userId, event, payload) => { if (io) io.to(`user:${userId}`).emit(event, payload); };

module.exports = { attach, emitTo };
