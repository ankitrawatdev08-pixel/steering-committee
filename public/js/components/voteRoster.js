/**
 * Vote Roster Strip Component
 * Displays all players (up to 8) horizontally in playerOrder,
 * showing live vote glyphs, chair icon, disconnected state, and emote speech bubbles.
 */

import { showInfoToast } from './toast.js';

export class VoteRoster {
  constructor(containerElement) {
    this.container = containerElement || document.getElementById('vote-roster-strip');
    this.playerMap = new Map();
    this.playerOrder = [];
    this.votes = {};
    this.chairId = null;
    this.localPlayerId = null;
    this.destinations = null; // Map or object of playerId -> landmarkId (during debrief)
    this.landmarks = [];
  }

  setLandmarks(landmarks) {
    this.landmarks = landmarks || [];
  }

  update({ players = [], votes = {}, chairId = null, localPlayerId = null, destinations = null }) {
    this.playerOrder = players;
    this.votes = votes || {};
    this.chairId = chairId;
    this.localPlayerId = localPlayerId;
    this.destinations = destinations;

    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    this.playerOrder.forEach((player) => {
      const isYou = (player.id === this.localPlayerId);
      const isChair = (player.id === this.chairId);
      const isConnected = player.connected !== false;
      const vote = this.votes[player.id];

      // Glyph for vote
      let glyph = '?';
      if (vote === 'UP') glyph = '↑';
      else if (vote === 'DOWN') glyph = '↓';
      else if (vote === 'LEFT') glyph = '←';
      else if (vote === 'RIGHT') glyph = '→';
      else if (vote === 'PARK') glyph = 'P';

      const playerEl = document.createElement('div');
      playerEl.className = 'roster-player';
      playerEl.id = `roster-player-${player.id}`;
      playerEl.title = `${player.name}${isChair ? ' (Chair)' : ''}${isYou ? ' (You)' : ''}`;

      // Tap handler for full name / destination tooltip
      playerEl.addEventListener('click', () => {
        let msg = `${player.name}${isChair ? ' [Chairperson]' : ''}`;
        if (this.destinations && this.destinations[player.id]) {
          const lId = this.destinations[player.id];
          const lm = this.landmarks.find(l => l.id === lId);
          msg += ` &bull; Destination: ${lm ? lm.name : lId}`;
        }
        showInfoToast(msg);
      });

      // Chair Gavel Icon
      if (isChair) {
        const chairIcon = document.createElement('span');
        chairIcon.className = 'roster-chair-icon';
        chairIcon.textContent = '⚖️';
        playerEl.appendChild(chairIcon);
      }

      // Circle avatar with vote glyph
      const circle = document.createElement('div');
      circle.className = 'roster-circle';
      circle.style.backgroundColor = player.color || '#2C1810';
      if (isYou) circle.classList.add('is-you');
      if (!isConnected) circle.classList.add('disconnected');

      circle.textContent = isConnected ? glyph : '...';
      playerEl.appendChild(circle);

      // Truncated Name (max 4 chars)
      const name = document.createElement('div');
      name.className = 'roster-name';
      name.textContent = player.name ? player.name.slice(0, 4) : 'Dir';
      playerEl.appendChild(name);

      this.container.appendChild(playerEl);
    });
  }

  showEmote(playerId, emoteText) {
    const playerEl = document.getElementById(`roster-player-${playerId}`);
    if (!playerEl) return;

    // Remove existing bubble if any
    const existing = playerEl.querySelector('.emote-bubble');
    if (existing) existing.remove();

    const bubble = document.createElement('div');
    bubble.className = 'emote-bubble';
    bubble.textContent = emoteText;

    playerEl.appendChild(bubble);

    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.parentNode.removeChild(bubble);
      }
    }, 2500);
  }
}
