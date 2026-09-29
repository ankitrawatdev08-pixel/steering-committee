/**
 * Landing Screen Controller
 * Handles director name entry, room creation, and room joining.
 */

import { showErrorToast } from '../components/toast.js';

export class LandingScreen {
  constructor(app) {
    this.app = app;
    this.screenEl = document.getElementById('screen-landing');
    this.nameInput = document.getElementById('player-name-input');
    this.createBtn = document.getElementById('btn-create-room');
    this.showJoinBtn = document.getElementById('btn-show-join');
    this.joinSection = document.getElementById('join-room-section');
    this.roomCodeInput = document.getElementById('room-code-input');
    this.joinBtn = document.getElementById('btn-join-room');

    this._bindEvents();
  }

  _bindEvents() {
    if (this.showJoinBtn && this.joinSection) {
      this.showJoinBtn.addEventListener('click', () => {
        const isHidden = this.joinSection.style.display === 'none';
        this.joinSection.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && this.roomCodeInput) {
          this.roomCodeInput.focus();
        }
      });
    }

    if (this.createBtn) {
      this.createBtn.addEventListener('click', () => this.handleCreate());
    }

    if (this.joinBtn) {
      this.joinBtn.addEventListener('click', () => this.handleJoin());
    }

    if (this.roomCodeInput) {
      this.roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      });
      this.roomCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleJoin();
      });
    }

    if (this.nameInput) {
      this.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (this.joinSection && this.joinSection.style.display !== 'none') {
            this.handleJoin();
          } else {
            this.handleCreate();
          }
        }
      });
    }
  }

  handleCreate() {
    const name = (this.nameInput.value || '').trim();
    if (!name) {
      showErrorToast('Please enter your Director title or name.');
      this.nameInput.focus();
      return;
    }

    this.app.createRoom(name);
  }

  handleJoin() {
    const name = (this.nameInput.value || '').trim();
    if (!name) {
      showErrorToast('Please enter your Director title or name.');
      this.nameInput.focus();
      return;
    }

    const code = (this.roomCodeInput.value || '').trim().toUpperCase();
    if (code.length !== 4) {
      showErrorToast('Please enter a valid 4-character room code.');
      this.roomCodeInput.focus();
      return;
    }

    this.app.joinRoom(code, name);
  }

  show() {
    if (this.screenEl) {
      this.screenEl.classList.add('active');
    }
    // Prefill name if stored
    const savedName = sessionStorage.getItem('steering_player_name');
    if (savedName && this.nameInput) {
      this.nameInput.value = savedName;
    }
    if (this.nameInput) {
      this.nameInput.focus();
    }
  }

  hide() {
    if (this.screenEl) {
      this.screenEl.classList.remove('active');
    }
  }
}
