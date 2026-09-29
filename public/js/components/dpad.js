/**
 * D-Pad Component
 * Directional voting controller with sticky selection,
 * tick 1-5 PARK lockout, and keyboard support.
 */

import { showInfoToast } from './toast.js';

export class DPad {
  constructor(onVote) {
    this.onVote = onVote;
    this.currentVote = null;
    this.currentTick = 0;
    this.parkEnabled = false;

    this.btnUp = document.getElementById('dpad-btn-up');
    this.btnLeft = document.getElementById('dpad-btn-left');
    this.btnPark = document.getElementById('dpad-btn-park');
    this.btnRight = document.getElementById('dpad-btn-right');
    this.btnDown = document.getElementById('dpad-btn-down');

    this.buttons = {
      UP: this.btnUp,
      LEFT: this.btnLeft,
      PARK: this.btnPark,
      RIGHT: this.btnRight,
      DOWN: this.btnDown
    };

    this._bindEvents();
  }

  _bindEvents() {
    Object.entries(this.buttons).forEach(([dir, btn]) => {
      if (!btn) return;

      const trigger = (e) => {
        e.preventDefault();
        this.handleVote(dir);
      };

      btn.addEventListener('click', trigger);
      btn.addEventListener('touchstart', trigger, { passive: false });
    });

    // Keyboard controls for desktop convenience
    window.addEventListener('keydown', (e) => {
      // Only handle if game screen is active and not typing in an input
      if (e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.handleVote('UP');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.handleVote('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.handleVote('RIGHT');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.handleVote('DOWN');
          break;
        case 'p':
        case 'P':
        case ' ':
          this.handleVote('PARK');
          break;
      }
    });
  }

  handleVote(direction) {
    if (direction === 'PARK' && !this.parkEnabled) {
      showInfoToast('PARK proposal locked until Tick 6');
      return;
    }

    this.setActiveVote(direction);

    if (this.onVote) {
      this.onVote(direction);
    }
  }

  setActiveVote(direction) {
    this.currentVote = direction;

    Object.entries(this.buttons).forEach(([dir, btn]) => {
      if (!btn) return;
      if (dir === direction) {
        btn.classList.add('active-vote');
      } else {
        btn.classList.remove('active-vote');
      }
    });
  }

  resetVote() {
    this.currentVote = null;
    Object.values(this.buttons).forEach(btn => {
      if (btn) btn.classList.remove('active-vote');
    });
  }

  updateTick(tick) {
    this.currentTick = tick;
    // TickResolver allows PARK when tick >= 5 (so it resolves on tick 6)
    // Ticks 1-4 completed: tick < 5 -> PARK disabled. Tick 5 completed -> PARK enabled.
    this.parkEnabled = (tick >= 5);

    if (this.btnPark) {
      if (this.parkEnabled) {
        this.btnPark.classList.remove('disabled');
        this.btnPark.classList.add('enabled');
        this.btnPark.title = 'Vote PARK (Freeze car)';
      } else {
        this.btnPark.classList.remove('enabled');
        this.btnPark.classList.add('disabled');
        this.btnPark.title = 'PARK locked (ticks 1-5)';
        if (this.currentVote === 'PARK') {
          this.resetVote();
        }
      }
    }
  }
}
