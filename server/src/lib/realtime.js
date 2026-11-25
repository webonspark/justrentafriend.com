/**
 * The Socket.IO server, reachable from anywhere without import cycles.
 * server.js attaches it at boot; services call emitTo() and it is a no-op
 * until then (scripts, seeds).
 *
 * It also knows who is online: a member counts as online while at least one
 * of their tabs holds a socket. When the last tab closes, Profile.lastSeenAt
 * is saved so staff can see "last seen 10 min ago".
 *
 * Presence lives in this process's memory, which is right while the API runs
 * as a single pm2 process. Running several would need a shared store (Redis).
 */
let io = null;
const tabs = new Map(); // userId -> number of open sockets

const attach = (server) => { io = server; };
const emitTo = (userId, event, payload) => { if (io) io.to(`user:${userId}`).emit(event, payload); };

function markSeen(userId) {
  // Lazy require: models load the database, which scripts may not want.
  const { Profile } = require("../models");
  return Profile.update({ lastSeenAt: new Date() }, { where: { userId } }).catch(() => {});
}

function connected(userId) {
  const id = Number(userId);
  const n = (tabs.get(id) || 0) + 1;
  tabs.set(id, n);
  if (n === 1) markSeen(id);
}

function disconnected(userId) {
  const id = Number(userId);
  const n = (tabs.get(id) || 1) - 1;
  if (n > 0) tabs.set(id, n);
  else {
    tabs.delete(id);
    markSeen(id);
  }
}

/**
 * Staff ended this member's sessions: tell every open tab to sign out, then
 * drop the sockets so the member shows offline at once.
 */
function kick(userId, reason = "signed_out") {
  if (!io) return;
  const room = `user:${userId}`;
  io.to(room).emit("session:ended", { reason });
  setTimeout(() => io.in(room).disconnectSockets(true), 300);
}

/** Signs out just one device (its login), not the whole account. */
function kickDevice(familyId, reason = "device_signed_out") {
  if (!io || !familyId) return;
  const room = `fam:${familyId}`;
  io.to(room).emit("session:ended", { reason });
  setTimeout(() => io.in(room).disconnectSockets(true), 300);
}

const isOnline = (userId) => tabs.has(Number(userId));
const onlineIds = () => [...tabs.keys()];

module.exports = { attach, emitTo, connected, disconnected, kick, kickDevice, isOnline, onlineIds };
