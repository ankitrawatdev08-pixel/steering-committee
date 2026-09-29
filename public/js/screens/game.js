/**
 * Game Screen Controller
 * Orchestrates:
 * - Top Info Bar (round, fuel budget, gavels, chair, heading, mute)
 * - Canvas Map Renderer
 * - Vote Roster Strip
 * - D-Pad & Emote Controls
 * - Reveal Phase Overlay with Server-Synced Countdown
 */

import { MapRenderer } from '../components/map.js';
import { DPad } from '../components/dpad.js';
import { VoteRoster } from '../components/voteRoster.js';
import { EmoteManager } from '../components/emotes.js';

export class GameScreen {
  constructor(app) {
    this.app = app;
    this.screenEl = document.getElementById('screen-game');

    // Info Bar Elements
    this.roundIndicator = document.getElementById('game-round-indicator');
    this.fuelCountText = document.getElementById('fuel-count-text');
    this.fuelBarFill = document.getElementById('fuel-bar-fill');
    this.gavelsContainer = document.getElementById('gavels-container');
    this.chairBadge = document.getElementById('chair-indicator-badge');
    this.chairNameText = document.getElementById('chair-name-text');
    this.headingArrow = document.getElementById('heading-arrow-display');
    this.muteToggleBtn = document.getElementById('btn-mute-toggle');

    // Reveal Overlay Elements
    this.revealOverlay = document.getElementById('game-reveal-overlay');
    this.revealShapePreview = document.getElementById('reveal-landmark-shape');
    this.revealLandmarkName = document.getElementById('reveal-landmark-name');
    this.revealRoundInfo = document.getElementById('reveal-round-info');
    this.revealChairInfo = document.getElementById('reveal-chair-info');
    this.revealTimerText = document.getElementById('reveal-countdown-timer');

    // Canvas & Components
    this.canvas = document.getElementById('game-canvas');
    this.mapRenderer = new MapRenderer(this.canvas, {
      onLandmarkClick: (landmarkId) => this.handleLandmarkTap(landmarkId)
    });

    this.voteRoster = new VoteRoster(document.getElementById('vote-roster-strip'));

    this.dpad = new DPad((direction) => {
      this.app.sendVote(direction);
    });

    this.emoteManager = new EmoteManager(
      document.getElementById('emote-bar'),
      (emoteIndex) => this.app.sendEmote(emoteIndex),
      (landmarkId) => this.app.sendPing(landmarkId)
    );

    this.revealRafId = null;

    this._bindEvents();
    this._renderGavels(3);
  }

  _bindEvents() {
    if (this.muteToggleBtn) {
      this.muteToggleBtn.addEventListener('click', () => {
        const isMuted = this.app.toggleAudioMute();
        this.muteToggleBtn.textContent = isMuted ? '🔇' : '🔊';
      });
    }
  }

  handleLandmarkTap(landmarkId) {
    this.emoteManager.triggerPing(landmarkId);
  }

  _renderGavels(remainingGavels = 3) {
    if (!this.gavelsContainer) return;
    this.gavelsContainer.innerHTML = '';

    for (let i = 0; i < 3; i++) {
      const isConsumed = i >= remainingGavels;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', `gavel-icon-svg ${isConsumed ? 'consumed' : ''}`);
      svg.innerHTML = `
        <path d="M4 14l3.5-3.5 1.5 1.5L5.5 15.5z"/>
        <path d="M12 6l4-4 4 4-4 4z" />
        <path d="M8 10l6 6-2 2-6-6z" />
        <path d="M2 20l4-4 2 2-4 4z" />
      `;
      this.gavelsContainer.appendChild(svg);
    }
  }

  setMap(mapData) {
    this.mapRenderer.setMapData(mapData);
    if (mapData && mapData.landmarks) {
      this.voteRoster.setLandmarks(mapData.landmarks);
    }
  }

  startReveal(data) {
    const { round, totalRounds = 3, destination, chairId, serverTime, phaseEndTime } = data;

    // Reset dpad active vote for the new round
    this.dpad.resetVote();
    this.dpad.updateTick(0);

    // Update vote roster immediately so directors appear
    this.voteRoster.update({
      players: this.app.state.players,
      votes: {},
      chairId: chairId || this.app.state.chairId,
      localPlayerId: this.app.state.playerId
    });

    // Update map with player's destination
    if (destination) {
      this.mapRenderer.setOwnDestination(destination.id);
    }
    this.mapRenderer.setRevealAll(false);

    // Find chairperson
    const chairPlayer = (this.app.state.players || []).find(p => p.id === chairId);
    const chairName = chairPlayer ? chairPlayer.name : 'Director';

    // Populate reveal overlay
    if (this.revealRoundInfo) this.revealRoundInfo.textContent = `${round} of ${totalRounds}`;
    if (this.revealChairInfo) this.revealChairInfo.textContent = chairName;

    const lmName = destination
      ? (destination.name || `${destination.shape ? destination.shape.toUpperCase() : 'SECRET'} LANDMARK`)
      : 'Confidential Landmark';
    if (this.revealLandmarkName) {
      this.revealLandmarkName.textContent = lmName;
    }

    // Render destination preview icon
    if (this.revealShapePreview && destination) {
      this.revealShapePreview.innerHTML = '';
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = 60;
      previewCanvas.height = 60;
      const pCtx = previewCanvas.getContext('2d');
      const color = destination.colour || destination.color || '#38A169';
      this.mapRenderer._drawShape(pCtx, destination.shape, 30, 30, 44, color);
      this.revealShapePreview.appendChild(previewCanvas);
    }

    // Show overlay
    if (this.revealOverlay) {
      this.revealOverlay.classList.add('active');
    }

    // Server-synced countdown timer
    if (this.revealRafId) cancelAnimationFrame(this.revealRafId);

    const clockDelta = Date.now() - (serverTime || Date.now());
    const localEndTime = (phaseEndTime || (Date.now() + 5000)) + clockDelta;

    const tickRevealTimer = () => {
      const remainingMs = Math.max(0, localEndTime - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);

      if (this.revealTimerText) {
        this.revealTimerText.textContent = remainingSec;
      }

      if (remainingMs <= 0) {
        this.endReveal();
      } else {
        this.revealRafId = requestAnimationFrame(tickRevealTimer);
      }
    };

    this.revealRafId = requestAnimationFrame(tickRevealTimer);
  }

  endReveal() {
    if (this.revealRafId) {
      cancelAnimationFrame(this.revealRafId);
      this.revealRafId = null;
    }
    if (this.revealOverlay) {
      this.revealOverlay.classList.remove('active');
    }
  }

  updateTick(data) {
    this.endReveal(); // Ensure overlay is dismissed when ticks arrive

    const {
      tick = 0,
      votes = {},
      carPos,
      heading = null,
      fuel = 20,
      gavels = 3,
      route = [],
      result,
      winningDirection
    } = data;

    // 1. Update Map
    if (carPos) {
      this.mapRenderer.updateCar(carPos, heading, route);
    }

    // 2. Update D-Pad
    this.dpad.updateTick(tick);

    // 3. Update Vote Roster
    this.voteRoster.update({
      players: this.app.state.players,
      votes,
      chairId: this.app.state.chairId,
      localPlayerId: this.app.state.playerId
    });

    // 4. Update Info Bar
    if (this.roundIndicator) {
      const totalRounds = this.app.state.totalRounds || 3;
      this.roundIndicator.textContent = `Rd ${this.app.state.round || 1}/${totalRounds}`;
    }

    if (this.fuelCountText) {
      this.fuelCountText.textContent = `${fuel}/20`;
    }

    if (this.fuelBarFill) {
      const pct = Math.max(0, Math.min(100, (fuel / 20) * 100));
      this.fuelBarFill.style.width = `${pct}%`;
      this.fuelBarFill.classList.remove('warn', 'danger');
      if (fuel <= 2) {
        this.fuelBarFill.classList.add('danger');
      } else if (fuel <= 5) {
        this.fuelBarFill.classList.add('warn');
      }
    }

    this._renderGavels(gavels);

    // Chairperson badge
    const chairPlayer = (this.app.state.players || []).find(p => p.id === this.app.state.chairId);
    if (this.chairNameText && chairPlayer) {
      this.chairNameText.textContent = chairPlayer.name;
    }
    if (this.chairBadge) {
      if (this.app.state.playerId === this.app.state.chairId) {
        this.chairBadge.classList.add('is-you');
      } else {
        this.chairBadge.classList.remove('is-you');
      }
    }

    // Heading arrow
    if (this.headingArrow) {
      let arrowChar = '-';
      if (heading === 'UP') arrowChar = '▲';
      else if (heading === 'DOWN') arrowChar = '▼';
      else if (heading === 'LEFT') arrowChar = '◀';
      else if (heading === 'RIGHT') arrowChar = '▶';
      this.headingArrow.textContent = arrowChar;
    }
  }

  showIncomingEmote(playerId, emoteIndex) {
    const text = ['Deal?', 'Deal!', 'No way', 'Follow me', 'Trust me', 'Liar!'][emoteIndex];
    if (text) {
      this.voteRoster.showEmote(playerId, text);
    }
  }

  showIncomingPing(landmarkId) {
    this.mapRenderer.triggerPing(landmarkId);
  }

  show() {
    if (this.screenEl) {
      this.screenEl.classList.add('active');
    }
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
  }

  hide() {
    if (this.screenEl) {
      this.screenEl.classList.remove('active');
    }
    this.endReveal();
  }
}
