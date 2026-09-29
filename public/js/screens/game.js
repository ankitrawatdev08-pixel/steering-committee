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

    // Onboarding Tooltip Elements
    this.tooltipEl = document.getElementById('onboarding-tooltip');
    this.tooltipTextEl = document.getElementById('tooltip-text');
    this.tooltipDismissBtn = document.getElementById('tooltip-dismiss');
    this.tooltipTimer = null;

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

    if (this.tooltipDismissBtn) {
      this.tooltipDismissBtn.addEventListener('click', () => {
        this.hideTooltip();
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
    if (this.revealRoundInfo) {
      if (round === 0) {
        this.revealRoundInfo.textContent = 'PRACTICE';
      } else {
        this.revealRoundInfo.textContent = `${round} of ${totalRounds}`;
      }
    }
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

    // Round 0 Onboarding Tooltip: Reveal Phase
    if (round === 0 || this.app.state.round === 0) {
      setTimeout(() => {
        const target = document.querySelector('.game-map-container') || document.querySelector('.reveal-target-card');
        this.showTooltip("This is your secret destination. Don't tell anyone!", target, 'center');
      }, 300);
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
    const isRound0 = (this.app.state.round === 0);
    if (this.roundIndicator) {
      if (isRound0) {
        this.roundIndicator.textContent = 'PRACTICE';
      } else {
        const totalRounds = this.app.state.totalRounds || 3;
        this.roundIndicator.textContent = `Rd ${this.app.state.round || 1}/${totalRounds}`;
      }
    }

    const maxFuel = isRound0 ? 5 : 20;

    if (this.fuelCountText) {
      this.fuelCountText.textContent = `${fuel}/${maxFuel}`;
    }

    if (this.fuelBarFill) {
      const pct = Math.max(0, Math.min(100, (fuel / maxFuel) * 100));
      this.fuelBarFill.style.width = `${pct}%`;
      this.fuelBarFill.classList.remove('warn', 'danger');
      if (isRound0) {
        if (fuel <= 1) {
          this.fuelBarFill.classList.add('danger');
        } else if (fuel <= 2) {
          this.fuelBarFill.classList.add('warn');
        }
      } else {
        if (fuel <= 2) {
          this.fuelBarFill.classList.add('danger');
        } else if (fuel <= 5) {
          this.fuelBarFill.classList.add('warn');
        }
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

    // Tooltip logic for Round 0 ONLY
    if (isRound0) {
      if (tick === 1) {
        this.showTooltip("Vote to steer the car! The most votes wins.", '.dpad-container', 'top');
      } else if (tick === 2) {
        this.showTooltip("You can see everyone's votes, but not their goals.", '#vote-roster-strip', 'bottom');
      }
    }
  }

  showTooltip(text, targetElOrSelector, placement = 'center') {
    if (!this.tooltipEl || !this.tooltipTextEl) return;
    this.hideTooltip();

    this.tooltipTextEl.textContent = text;
    this.tooltipEl.classList.remove('hidden');

    const targetEl = typeof targetElOrSelector === 'string'
      ? document.querySelector(targetElOrSelector)
      : targetElOrSelector;

    if (targetEl && this.screenEl) {
      const targetRect = targetEl.getBoundingClientRect();
      const screenRect = this.screenEl.getBoundingClientRect();

      const relativeTop = targetRect.top - screenRect.top;
      const relativeLeft = targetRect.left - screenRect.left;

      if (placement === 'top') {
        this.tooltipEl.style.top = `${Math.max(10, relativeTop - 12)}px`;
        this.tooltipEl.style.left = `${relativeLeft + targetRect.width / 2}px`;
        this.tooltipEl.style.transform = 'translate(-50%, -100%)';
      } else if (placement === 'bottom') {
        this.tooltipEl.style.top = `${relativeTop + targetRect.height + 8}px`;
        this.tooltipEl.style.left = `${relativeLeft + targetRect.width / 2}px`;
        this.tooltipEl.style.transform = 'translate(-50%, 0)';
      } else {
        // center
        this.tooltipEl.style.top = `${relativeTop + targetRect.height / 2}px`;
        this.tooltipEl.style.left = `${relativeLeft + targetRect.width / 2}px`;
        this.tooltipEl.style.transform = 'translate(-50%, -50%)';
      }
    } else {
      this.tooltipEl.style.top = '50%';
      this.tooltipEl.style.left = '50%';
      this.tooltipEl.style.transform = 'translate(-50%, -50%)';
    }

    this.tooltipTimer = setTimeout(() => {
      this.hideTooltip();
    }, 4000);
  }

  hideTooltip() {
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    if (this.tooltipEl) {
      this.tooltipEl.classList.add('hidden');
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
    this.hideTooltip();
  }
}
