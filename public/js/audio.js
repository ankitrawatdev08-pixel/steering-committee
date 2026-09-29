/**
 * STEERING COMMITTEE — Web Audio Engine Skeleton
 * Initialized upon first user interaction to satisfy browser autoplay policies.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
  }

  /**
   * Initializes or resumes the AudioContext on user gesture
   */
  init() {
    if (this.initialized && this.ctx && this.ctx.state === 'running') return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.initialized = true;
      console.log('[Audio] AudioContext initialized.');
    } catch (err) {
      console.warn('[Audio] Failed to initialize AudioContext:', err);
    }
  }

  setMute(mute) {
    this.isMuted = Boolean(mute);
    console.log(`[Audio] Mute toggled: ${this.isMuted}`);
  }

  _playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio fallback silent
    }
  }

  playTick() {
    console.log('[Audio] playTick');
    this._playTone(440, 'triangle', 0.05, 0.08); // brief woodblock click
  }

  playMove() {
    console.log('[Audio] playMove');
    this._playTone(330, 'sine', 0.12, 0.12);
  }

  playBump() {
    console.log('[Audio] playBump');
    this._playTone(130, 'square', 0.18, 0.15); // low thud
  }

  playPark() {
    console.log('[Audio] playPark');
    this._playTone(523.25, 'sine', 0.25, 0.2); // high C bell
  }

  playRoundEnd() {
    console.log('[Audio] playRoundEnd');
    this._playTone(392, 'triangle', 0.3, 0.18);
  }

  playGameOver() {
    console.log('[Audio] playGameOver');
    this._playTone(261.63, 'sawtooth', 0.4, 0.15);
  }

  playEmote() {
    console.log('[Audio] playEmote');
    this._playTone(587.33, 'sine', 0.08, 0.1);
  }
}

export const audio = new AudioEngine();
