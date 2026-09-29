/**
 * Lobby Screen Controller
 * Handles meeting room display, attendance register, host controls (start game, add/remove bot, kick),
 * tap-to-copy room code, and leaving the room.
 */

import { showSuccessToast, showErrorToast } from '../components/toast.js';

export class LobbyScreen {
  constructor(app) {
    this.app = app;
    this.screenEl = document.getElementById('screen-lobby');

    this.roomCodeBadge = document.getElementById('lobby-room-code-badge');
    this.roomCodeEl = document.getElementById('lobby-room-code');
    this.copyHintEl = document.getElementById('lobby-copy-hint');
    this.playerCountEl = document.getElementById('lobby-player-count');
    this.playerListEl = document.getElementById('lobby-player-list');

    this.hostPanel = document.getElementById('lobby-host-panel');
    this.addBotBtn = document.getElementById('btn-add-bot');
    this.removeBotBtn = document.getElementById('btn-remove-bot');
    this.startGameBtn = document.getElementById('btn-start-game');
    this.leaveRoomBtn = document.getElementById('btn-leave-room');

    this._bindEvents();
  }

  _bindEvents() {
    if (this.roomCodeBadge) {
      this.roomCodeBadge.addEventListener('click', () => this.copyRoomCode());
    }

    if (this.startGameBtn) {
      this.startGameBtn.addEventListener('click', () => {
        this.app.startGame();
      });
    }

    if (this.addBotBtn) {
      this.addBotBtn.addEventListener('click', () => {
        this.app.addBot();
      });
    }

    if (this.removeBotBtn) {
      this.removeBotBtn.addEventListener('click', () => {
        // Find last bot
        const players = this.app.state.players || [];
        const lastBot = [...players].reverse().find(p => p.isBot);
        if (lastBot) {
          this.app.removeBot(lastBot.id);
        }
      });
    }

    if (this.leaveRoomBtn) {
      this.leaveRoomBtn.addEventListener('click', () => {
        this.app.leaveRoom();
      });
    }
  }

  copyRoomCode() {
    const code = this.app.state.roomCode;
    if (!code) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        this.showCopiedHint();
      }).catch(() => {
        this.fallbackCopy(code);
      });
    } else {
      this.fallbackCopy(code);
    }
  }

  fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showCopiedHint();
    } catch (e) {
      showErrorToast(`Room Code: ${text}`);
    }
    document.body.removeChild(ta);
  }

  showCopiedHint() {
    if (this.copyHintEl) {
      const orig = this.copyHintEl.textContent;
      this.copyHintEl.textContent = 'COPIED TO CLIPBOARD!';
      this.copyHintEl.style.color = 'var(--status-success)';
      setTimeout(() => {
        this.copyHintEl.textContent = orig;
        this.copyHintEl.style.color = '';
      }, 2000);
    }
    showSuccessToast('Meeting Room Code copied!');
  }

  update(state) {
    const { roomCode, players = [], hostId, playerId } = state;

    if (this.roomCodeEl) {
      this.roomCodeEl.textContent = roomCode || '----';
    }

    const totalCount = players.length;
    if (this.playerCountEl) {
      this.playerCountEl.textContent = `${totalCount}/8 DIRECTORS PRESENT`;
    }

    // Render attendance register
    if (this.playerListEl) {
      this.playerListEl.innerHTML = '';

      players.forEach(p => {
        const isYou = (p.id === playerId);
        const isHost = (p.id === hostId);
        const isBot = !!p.isBot;

        const card = document.createElement('div');
        card.className = 'player-card';

        const meta = document.createElement('div');
        meta.className = 'player-meta';

        const dot = document.createElement('div');
        dot.className = 'avatar-dot';
        dot.style.backgroundColor = p.color || '#2C1810';
        meta.appendChild(dot);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = p.name;
        meta.appendChild(nameSpan);

        const badges = document.createElement('div');
        badges.className = 'badges-group';

        if (isHost) {
          const b = document.createElement('span');
          b.className = 'badge badge-host';
          b.textContent = 'HOST';
          badges.appendChild(b);
        }

        if (isBot) {
          const b = document.createElement('span');
          b.className = 'badge badge-bot';
          b.textContent = 'BOT';
          badges.appendChild(b);
        }

        if (isYou) {
          const b = document.createElement('span');
          b.className = 'badge badge-you';
          b.textContent = 'YOU';
          badges.appendChild(b);
        }

        meta.appendChild(badges);
        card.appendChild(meta);

        // Host kick button (for other humans)
        const isLocalHost = (playerId === hostId);
        if (isLocalHost && !isYou && !isBot) {
          const kickBtn = document.createElement('button');
          kickBtn.className = 'btn-kick';
          kickBtn.title = 'Remove Director';
          kickBtn.innerHTML = '&times;';
          kickBtn.addEventListener('click', () => {
            this.app.kickPlayer(p.id);
          });
          card.appendChild(kickBtn);
        }

        this.playerListEl.appendChild(card);
      });
    }

    // Host Panel Visibility & Controls
    const isLocalHost = (playerId === hostId);
    if (this.hostPanel) {
      if (isLocalHost) {
        this.hostPanel.classList.remove('is-hidden');
        this.hostPanel.style.display = 'flex';
      } else {
        this.hostPanel.classList.add('is-hidden');
        this.hostPanel.style.display = 'none';
      }
    }

    if (isLocalHost) {
      const botCount = players.filter(p => p.isBot).length;
      const humanCount = players.filter(p => !p.isBot).length;

      if (this.addBotBtn) {
        this.addBotBtn.disabled = (totalCount >= 8);
      }
      if (this.removeBotBtn) {
        this.removeBotBtn.disabled = (botCount <= 0);
      }
      if (this.startGameBtn) {
        // Can start if >= 2 humans (or total players >= 2)
        const canStart = (humanCount >= 2 || totalCount >= 2);
        this.startGameBtn.disabled = !canStart;
        this.startGameBtn.textContent = canStart
          ? `START MEETING (${totalCount} Present)`
          : `START MEETING (Need ≥ 2 Humans)`;
      }
    }
  }

  show() {
    if (this.screenEl) {
      this.screenEl.classList.add('active');
    }
  }

  hide() {
    if (this.screenEl) {
      this.screenEl.classList.remove('active');
    }
  }
}
