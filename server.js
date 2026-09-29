/**
 * STEERING COMMITTEE — Express & Socket.io Server
 * "Everyone steers. Nobody agrees."
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

const RoomManager = require('./game/RoomManager');
const { GAME_STATES } = require('./game/constants');

// Default to production if deployed on Render without explicit NODE_ENV
if (process.env.RENDER && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const app = express();
const server = http.createServer(app);

// Attach Socket.io with permissive CORS for cross-device mobile play
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// Room Manager instance
const roomManager = new RoomManager({ io });

// Simple token bucket rate limiter: Max 10 events per rolling 1000ms per socket
const rateLimits = new Map();
function isRateLimited(socketId) {
  const now = Date.now();
  let limit = rateLimits.get(socketId);
  if (!limit) {
    limit = { count: 1, resetTime: now + 1000 };
    rateLimits.set(socketId, limit);
    return false;
  }
  
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + 1000;
    return false;
  }
  
  limit.count++;
  return limit.count > 10;
}

// Cleanup rate limits periodically to prevent memory leaks
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, limit] of rateLimits.entries()) {
    if (now > limit.resetTime) rateLimits.delete(id);
  }
}, 60000);
if (rateLimitCleanupInterval.unref) rateLimitCleanupInterval.unref();

// JSON body parser
app.use(express.json());

// Serve static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    nodeEnv: nodeEnv,
    isProduction: isProduction,
    timestamp: new Date().toISOString()
  });
});

// Development / test routes — strictly gated to non-production environments
if (!isProduction) {
  app.use('/tests', express.static(path.join(__dirname, 'tests')));
  app.get('/tests', (req, res) => {
    res.status(200).send('<!DOCTYPE html><html><head><title>Test Suite</title></head><body><h1>STEERING COMMITTEE Test Suite (Dev Mode)</h1><p>Running in development mode.</p></body></html>');
  });
}

// -------------------------------------------------------------
// SOCKET.IO EVENT HANDLERS
// -------------------------------------------------------------
io.on('connection', (socket) => {
  socket.emit('connected', { id: socket.id, timestamp: Date.now() });

  // 1. CREATE ROOM
  socket.on('create-room', (data = {}, callback) => {
    try {
      const playerName = data.playerName || 'Host';
      const timings = (!isProduction && data.timings) ? data.timings : undefined;
      const { room, player } = roomManager.createRoom(socket.id, { playerName, timings });

      socket.join(room.code);

      const response = {
        roomCode: room.code,
        playerId: player.id,
        player,
        players: Array.from(room.players.values()),
        hostId: room.hostId
      };

      if (typeof callback === 'function') callback({ success: true, ...response });
      socket.emit('room-created', response);
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 2. JOIN ROOM (or RECONNECT)
  socket.on('join-room', (data = {}, callback) => {
    try {
      const { roomCode, playerName, playerId } = data;
      const { room, player, isReconnect } = roomManager.joinRoom(roomCode, socket.id, playerName, playerId);

      socket.join(room.code);

      const response = {
        roomCode: room.code,
        playerId: player.id,
        player,
        players: Array.from(room.players.values()),
        hostId: room.hostId,
        isReconnect,
        gameState: room.state
      };

      if (typeof callback === 'function') callback({ success: true, ...response });
      socket.emit('room-joined', response);

      if (isReconnect) {
        // Emit full reconnect snapshot
        const snapshot = room.getReconnectSnapshot(player.id);
        socket.emit('reconnect-state', snapshot);
      } else {
        // Notify others in room
        socket.to(room.code).emit('player-joined', {
          player,
          players: Array.from(room.players.values()),
          hostId: room.hostId
        });
      }
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 3. START GAME (Host only)
  socket.on('start-game', (data = {}, callback) => {
    try {
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');

      room.startGame(playerId);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 4. VOTE
  socket.on('vote', (data = {}, callback) => {
    try {
      if (isRateLimited(socket.id)) {
        socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
        return;
      }
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');

      const { direction } = data;
      room.recordVote(playerId, direction);

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 5. EMOTE
  socket.on('emote', (data = {}, callback) => {
    try {
      if (isRateLimited(socket.id)) {
        socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
        return;
      }
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');

      const { emoteIndex } = data;
      room.recordEmote(playerId, emoteIndex);

      io.to(room.code).emit('emote', {
        playerId,
        emoteIndex
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 6. PING LANDMARK
  socket.on('ping', (data = {}, callback) => {
    try {
      if (isRateLimited(socket.id)) {
        socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
        return;
      }
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');

      const { landmarkId } = data;
      room.recordPing(playerId, landmarkId);

      io.to(room.code).emit('ping', {
        playerId,
        landmarkId
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 7. READY (Debrief skip)
  socket.on('ready', (data = {}, callback) => {
    try {
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');

      room.markPlayerReady(playerId);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 8. ADD BOT
  socket.on('add-bot', (data = {}, callback) => {
    try {
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');
      if (playerId !== room.hostId) throw new Error('Only the host can add bots.');

      const bot = room.addBot();

      io.to(room.code).emit('player-joined', {
        player: bot,
        players: Array.from(room.players.values()),
        hostId: room.hostId
      });

      if (typeof callback === 'function') callback({ success: true, bot });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 9. REMOVE BOT
  socket.on('remove-bot', (data = {}, callback) => {
    try {
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');
      if (playerId !== room.hostId) throw new Error('Only the host can remove bots.');

      const { botId } = data;
      room.removeBot(botId);

      io.to(room.code).emit('player-left', {
        playerId: botId,
        players: Array.from(room.players.values()),
        hostId: room.hostId,
        reason: 'bot-removed'
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 10. KICK PLAYER
  socket.on('kick-player', (data = {}, callback) => {
    try {
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const hostPlayerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');

      const { playerId: targetId } = data;
      const kicked = room.kickPlayer(targetId, hostPlayerId);

      io.to(room.code).emit('player-left', {
        playerId: targetId,
        players: Array.from(room.players.values()),
        hostId: room.hostId,
        reason: 'kicked'
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 11. PLAY AGAIN
  socket.on('play-again', (data = {}, callback) => {
    try {
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);
      const room = roomManager.getRoom(roomCode);

      if (!room) throw new Error('Not currently in a room.');

      room.votePlayAgain(playerId);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 12. LEAVE ROOM
  socket.on('leave-room', (data = {}, callback) => {
    try {
      const roomCode = roomManager.socketToRoom.get(socket.id);
      const playerId = roomManager.socketToPlayer.get(socket.id);

      const { room, player } = roomManager.handleDisconnect(socket.id);

      if (room && player) {
        socket.leave(room.code);
        io.to(room.code).emit('player-left', {
          playerId: player.id,
          players: Array.from(room.players.values()),
          hostId: room.hostId,
          reason: 'left'
        });
      }

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  // 13. DISCONNECT
  socket.on('disconnect', () => {
    rateLimits.delete(socket.id);
    const { room, player, removed } = roomManager.handleDisconnect(socket.id);
    if (room && player) {
      io.to(room.code).emit('player-left', {
        playerId: player.id,
        players: Array.from(room.players.values()),
        hostId: room.hostId,
        reason: removed ? 'disconnected-lobby' : 'disconnected-grace'
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[STEERING COMMITTEE] Server listening on http://${HOST}:${PORT} (NODE_ENV=${nodeEnv})`);
  });
}

function gracefulShutdown(signal) {
  console.log(`\n[STEERING COMMITTEE] Received ${signal}. Shutting down gracefully...`);
  io.emit('error', { message: 'Server is restarting for maintenance. You will be disconnected.' });
  
  // Give clients 1 second to receive the error before killing the process
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io, roomManager };
