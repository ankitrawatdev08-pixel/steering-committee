/**
 * STEERING COMMITTEE — Client Application Core
 * "Everyone steers. Nobody agrees."
 * Manages Socket.io lifecycle, screen navigation, state store,
 * reconnection handling, and audio effects.
 */

import { audio } from './audio.js';
import { showErrorToast, showInfoToast, showSuccessToast } from './components/toast.js';
import { initHowToPlay } from './components/howToPlay.js';

import { LandingScreen } from './screens/landing.js';
import { LobbyScreen } from './screens/lobby.js';
import { GameScreen } from './screens/game.js';
import { DebriefScreen } from './screens/debrief.js';
import { ResultsScreen } from './screens/results.js';

class App {
  constructor() {
    this.state = {
      playerId: null,
      playerName: null,
      roomCode: null,
      hostId: null,
      players: [],
      round: 1,
      totalRounds: 3,
      chairId: null,
      map: null,
      cumulativeScores: {},
      currentPhase: 'landing'
    };

    // Screens
    this.screens = {};

    // Reconnect overlay element
    this.reconnectOverlay = document.getElementById('reconnect-overlay');

    // Socket instance
    this.socket = null;
  }

  init() {
    // 1. Initialize screens
    this.screens.landing = new LandingScreen(this);
    this.screens.lobby = new LobbyScreen(this);
    this.screens.game = new GameScreen(this);
    this.screens.debrief = new DebriefScreen(this);
    this.screens.results = new ResultsScreen(this);

    // 2. Initialize modal controllers
    initHowToPlay();

    // 3. User interaction audio unlock
    const unlockAudio = () => {
      audio.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // 4. Initialize Socket.io connection
    this.initSocket();

    // 5. Navigate to Landing by default
    this.showScreen('landing');
  }

  showScreen(screenName) {
    if (this.state.currentPhase === screenName && this.screens[screenName]?.screenEl?.classList.contains('active')) {
      return;
    }

    Object.entries(this.screens).forEach(([name, screen]) => {
      if (name === screenName) {
        screen.show();
      } else {
        screen.hide();
      }
    });

    this.state.currentPhase = screenName;
  }

  initSocket() {
    // Connect to same origin
    this.socket = window.io();

    this.socket.on('connect', () => {
      console.log(`[Socket] Connected: ${this.socket.id}`);
      if (this.reconnectOverlay) {
        this.reconnectOverlay.classList.remove('active');
      }

      // Check for saved session reconnect
      this.attemptSessionReconnect();
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[Socket] Disconnected: ${reason}`);
      if (this.state.roomCode && this.reconnectOverlay) {
        this.reconnectOverlay.classList.add('active');
      }
    });

    // -------------------------------------------------------------
    // SERVER EVENT LISTENERS
    // -------------------------------------------------------------

    // Room created
    this.socket.on('room-created', (data) => {
      console.log('[Socket] room-created:', data);
      this.saveSession(data.roomCode, data.playerId, data.player?.name);
      this.state.roomCode = data.roomCode;
      this.state.playerId = data.playerId;
      this.state.playerName = data.player?.name;
      this.state.hostId = data.hostId;
      this.state.players = data.players || [];
      this.state.cumulativeScores = {};

      this.screens.lobby.update(this.state);
      this.showScreen('lobby');
      showSuccessToast(`Meeting Room ${data.roomCode} convened.`);
    });

    // Room joined
    this.socket.on('room-joined', (data) => {
      console.log('[Socket] room-joined:', data);
      this.saveSession(data.roomCode, data.playerId, data.player?.name);
      this.state.roomCode = data.roomCode;
      this.state.playerId = data.playerId;
      this.state.playerName = data.player?.name;
      this.state.hostId = data.hostId;
      this.state.players = data.players || [];

      if (!data.isReconnect) {
        this.state.cumulativeScores = {};
        this.screens.lobby.update(this.state);
        this.showScreen('lobby');
        showSuccessToast(`Entered Meeting Room ${data.roomCode}.`);
      }
    });

    // Player joined room
    this.socket.on('player-joined', (data) => {
      console.log('[Socket] player-joined:', data);
      this.state.players = data.players || [];
      this.state.hostId = data.hostId;

      this.screens.lobby.update(this.state);
      if (this.state.currentPhase === 'game') {
        this.screens.game.voteRoster.update({
          players: this.state.players,
          chairId: this.state.chairId,
          localPlayerId: this.state.playerId
        });
      }

      if (data.player && data.player.id !== this.state.playerId) {
        showInfoToast(`${data.player.name} entered the boardroom.`);
      }
    });

    // Player left room
    this.socket.on('player-left', (data) => {
      console.log('[Socket] player-left:', data);
      this.state.players = data.players || [];
      this.state.hostId = data.hostId;

      this.screens.lobby.update(this.state);
      if (this.state.currentPhase === 'game') {
        this.screens.game.voteRoster.update({
          players: this.state.players,
          chairId: this.state.chairId,
          localPlayerId: this.state.playerId
        });
      }

      if (data.playerId === this.state.playerId) {
        this.clearSession();
        this.showScreen('landing');
        showErrorToast('You were removed from the meeting room.');
      } else {
        const reasonMsg = data.reason === 'kicked' ? 'was dismissed by the Chair.' : 'left the boardroom.';
        showInfoToast(`A director ${reasonMsg}`);
      }
    });

    // Game started
    this.socket.on('game-started', (data) => {
      console.log('[Socket] game-started:', data);
      this.state.round = data.round || 1;
      this.state.totalRounds = data.totalRounds || 3;
      this.state.chairId = data.chairId;
      this.state.map = data.map;
      this.state.cumulativeScores = {};

      this.screens.game.setMap(data.map);
      this.screens.game.voteRoster.update({
        players: this.state.players,
        votes: {},
        chairId: data.chairId,
        localPlayerId: this.state.playerId
      });
      this.showScreen('game');
      audio.playTick();
    });

    // Round reveal (destination assignment)
    this.socket.on('round-reveal', (data) => {
      console.log('[Socket] round-reveal:', data);
      this.state.round = data.round;
      this.state.chairId = data.chairId;

      this.showScreen('game');
      this.screens.game.startReveal(data);
      audio.playTick();
    });

    // Tick update
    this.socket.on('tick-update', (data) => {
      if (this.state.currentPhase !== 'game') {
        this.showScreen('game');
      }

      this.screens.game.updateTick(data);

      // Play audio cues based on result
      if (data.result === 'PARK') {
        audio.playPark();
      } else if (data.result === 'BLOCKED_OBSTACLE' || data.result === 'BLOCKED_BOUNDARY') {
        audio.playBump();
      } else if (data.result === 'MOVE') {
        audio.playMove();
      } else {
        audio.playTick();
      }
    });

    // Round debrief
    this.socket.on('round-debrief', (data) => {
      console.log('[Socket] round-debrief:', data);
      this.screens.debrief.update(data);
      this.showScreen('debrief');
      audio.playRoundEnd();
    });

    // Game over
    this.socket.on('game-over', (data) => {
      console.log('[Socket] game-over:', data);
      this.screens.results.update(data);
      this.showScreen('results');
      audio.playGameOver();
    });

    // Reconnect full snapshot
    this.socket.on('reconnect-state', (snapshot) => {
      console.log('[Socket] reconnect-state:', snapshot);
      this.restoreFromSnapshot(snapshot);
      showSuccessToast('Restored boardroom credentials.');
    });

    // Play again reset
    this.socket.on('play-again-reset', (data) => {
      console.log('[Socket] play-again-reset:', data);
      this.state.players = data.players || [];
      this.state.hostId = data.hostId;
      this.state.cumulativeScores = {};

      this.screens.lobby.update(this.state);
      this.showScreen('lobby');
      showInfoToast('Meeting adjourned. Convened for a new session!');
    });

    // Emote broadcast
    this.socket.on('emote', (data) => {
      this.screens.game.showIncomingEmote(data.playerId, data.emoteIndex);
      audio.playEmote();
    });

    // Ping broadcast
    this.socket.on('ping', (data) => {
      this.screens.game.showIncomingPing(data.landmarkId);
      audio.playTick();
    });

    // Generic error
    this.socket.on('error', (err) => {
      console.error('[Socket] Server Error:', err);
      showErrorToast(err.message || 'Boardroom operation failed.');
    });
  }

  // -------------------------------------------------------------
  // RECONNECTION MANAGEMENT
  // -------------------------------------------------------------

  attemptSessionReconnect() {
    const savedRoomCode = sessionStorage.getItem('steering_room_code');
    const savedPlayerId = sessionStorage.getItem('steering_player_id');
    const savedPlayerName = sessionStorage.getItem('steering_player_name');

    if (savedRoomCode && savedPlayerId) {
      console.log('[Session] Attempting reconnect:', { savedRoomCode, savedPlayerId, savedPlayerName });
      this.socket.emit('join-room', {
        roomCode: savedRoomCode,
        playerName: savedPlayerName || 'Director',
        playerId: savedPlayerId
      });
    }
  }

  saveSession(roomCode, playerId, playerName) {
    if (roomCode) sessionStorage.setItem('steering_room_code', roomCode);
    if (playerId) sessionStorage.setItem('steering_player_id', playerId);
    if (playerName) sessionStorage.setItem('steering_player_name', playerName);
  }

  clearSession() {
    sessionStorage.removeItem('steering_room_code');
    sessionStorage.removeItem('steering_player_id');
  }

  restoreFromSnapshot(snapshot) {
    const {
      gameState,
      round,
      totalRounds,
      map,
      carPos,
      heading,
      fuel,
      gavels,
      votes,
      scores,
      destination,
      players,
      chairId
    } = snapshot;

    this.state.round = round;
    this.state.totalRounds = totalRounds;
    this.state.map = map;
    this.state.players = players;
    this.state.chairId = chairId;

    if (map) {
      this.screens.game.setMap(map);
    }

    if (destination) {
      this.screens.game.mapRenderer.setOwnDestination(destination.id);
    }

    // Restore cumulative scores
    this.state.cumulativeScores = {};
    if (scores) {
      Object.entries(scores).forEach(([pid, list]) => {
        const arr = Array.isArray(list) ? list : [list];
        this.state.cumulativeScores[pid] = arr.reduce((acc, s) => acc + (Number(s) || 0), 0);
      });
    }

    switch (gameState) {
      case 'LOBBY':
        this.screens.lobby.update(this.state);
        this.showScreen('lobby');
        break;

      case 'REVEAL':
        this.showScreen('game');
        this.screens.game.startReveal({
          round,
          totalRounds,
          destination,
          chairId,
          serverTime: Date.now(),
          phaseEndTime: Date.now() + 5000
        });
        break;

      case 'STEERING':
        this.showScreen('game');
        this.screens.game.updateTick({
          tick: snapshot.tick || 0,
          votes,
          carPos,
          heading,
          fuel,
          gavels,
          route: []
        });
        break;

      case 'DEBRIEF':
        this.showScreen('debrief');
        this.screens.debrief.update({
          round,
          destinations: {},
          scores: {},
          serverTime: Date.now(),
          phaseEndTime: Date.now() + 5000
        });
        break;

      case 'GAME_OVER':
        this.showScreen('results');
        break;

      default:
        this.showScreen('landing');
        break;
    }
  }

  // -------------------------------------------------------------
  // OUTBOUND ACTIONS
  // -------------------------------------------------------------

  createRoom(playerName) {
    if (!this.socket?.connected) {
      showErrorToast('Connecting to boardroom server...');
      return;
    }
    this.socket.emit('create-room', { playerName });
  }

  joinRoom(roomCode, playerName) {
    if (!this.socket?.connected) {
      showErrorToast('Connecting to boardroom server...');
      return;
    }
    this.socket.emit('join-room', { roomCode, playerName });
  }

  startGame() {
    this.socket.emit('start-game');
  }

  addBot() {
    this.socket.emit('add-bot');
  }

  removeBot(botId) {
    this.socket.emit('remove-bot', { botId, playerId: botId });
  }

  kickPlayer(playerId) {
    this.socket.emit('kick-player', { playerId });
  }

  sendVote(direction) {
    this.socket.emit('vote', { direction });
  }

  sendEmote(emoteIndex) {
    this.socket.emit('emote', { emoteIndex });
  }

  sendPing(landmarkId) {
    this.socket.emit('ping', { landmarkId });
  }

  sendReady() {
    this.socket.emit('ready');
  }

  playAgain() {
    this.socket.emit('play-again');
  }

  leaveRoom() {
    this.socket.emit('leave-room');
    this.clearSession();
    this.showScreen('landing');
    showInfoToast('You adjourned the meeting.');
  }

  toggleAudioMute() {
    const isMuted = !audio.isMuted;
    audio.setMute(isMuted);
    return isMuted;
  }
}

// Instantiate and initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  window.__STEERING_APP__ = app; // Expose for testing & inspection
});
