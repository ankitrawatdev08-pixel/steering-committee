/**
 * Emotes & Landmark Ping Controller
 * Handles 6 corporate reaction emotes with a 3s cooldown,
 * and landmark pings with a 5s cooldown.
 */

export const EMOTE_LIST = [
  'Deal?',
  'Deal!',
  'No way',
  'Follow me',
  'Trust me',
  'Liar!'
];

export class EmoteManager {
  constructor(containerElement, onSendEmote, onSendPing) {
    this.container = containerElement || document.getElementById('emote-bar');
    this.onSendEmote = onSendEmote;
    this.onSendPing = onSendPing;

    this.emoteCooldown = 3000; // 3 seconds
    this.pingCooldown = 5000;  // 5 seconds

    this.emoteCooldownEnd = 0;
    this.pingCooldownEnd = 0;

    this.buttons = [];
    this._render();
  }

  _render() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.buttons = [];

    EMOTE_LIST.forEach((text, index) => {
      const btn = document.createElement('button');
      btn.className = 'emote-btn';
      btn.type = 'button';
      btn.textContent = text;
      btn.addEventListener('click', () => this.triggerEmote(index));
      this.container.appendChild(btn);
      this.buttons.push(btn);
    });
  }

  triggerEmote(emoteIndex) {
    const now = Date.now();
    if (now < this.emoteCooldownEnd) return;

    this.emoteCooldownEnd = now + this.emoteCooldown;
    this._startCooldownAnimation();

    if (this.onSendEmote) {
      this.onSendEmote(emoteIndex);
    }
  }

  triggerPing(landmarkId) {
    const now = Date.now();
    if (now < this.pingCooldownEnd) return false;

    this.pingCooldownEnd = now + this.pingCooldown;
    if (this.onSendPing) {
      this.onSendPing(landmarkId);
    }
    return true;
  }

  _startCooldownAnimation() {
    this.buttons.forEach(btn => {
      btn.disabled = true;
    });

    const checkCooldown = () => {
      const remaining = this.emoteCooldownEnd - Date.now();
      if (remaining <= 0) {
        this.buttons.forEach(btn => {
          btn.disabled = false;
        });
      } else {
        requestAnimationFrame(checkCooldown);
      }
    };

    requestAnimationFrame(checkCooldown);
  }
}
