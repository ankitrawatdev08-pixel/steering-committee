/**
 * Debrief Screen Controller
 * Shows round results, revealed destinations, distances, round points, and running totals.
 * Handles the "Ready" skip button and server-synced countdown timer.
 */

export class DebriefScreen {
  constructor(app) {
    this.app = app;
    this.screenEl = document.getElementById('screen-debrief');
    this.titleEl = document.getElementById('debrief-title');
    this.subtitleEl = document.getElementById('debrief-subtitle');
    this.scoreTbody = document.getElementById('debrief-score-tbody');
    this.readyBtn = document.getElementById('btn-debrief-ready');
    this.timerBar = document.getElementById('debrief-timer-bar');

    this.timerRafId = null;
    this.isReady = false;

    this._bindEvents();
  }

  _bindEvents() {
    if (this.readyBtn) {
      this.readyBtn.addEventListener('click', () => {
        if (this.isReady) return;
        this.isReady = true;
        this.readyBtn.disabled = true;
        this.readyBtn.textContent = 'READY! WAITING FOR OTHERS...';
        this.app.sendReady();
      });
    }
  }

  update(data) {
    const round = (data.round !== undefined) ? data.round : 1;
    const { destinations = {}, scores = {}, serverTime, phaseEndTime } = data;
    this.isReady = false;

    if (this.readyBtn) {
      this.readyBtn.disabled = false;
      this.readyBtn.textContent = 'CONFIRM & PROCEED';
    }

    if (this.titleEl) {
      if (round === 0) {
        this.titleEl.textContent = 'PRACTICE ROUND COMPLETE';
      } else {
        this.titleEl.textContent = `ROUND ${round} RESULTS`;
      }
    }

    // Update cumulative player scores in global app state
    if (!this.app.state.cumulativeScores) {
      this.app.state.cumulativeScores = {};
    }
    if (round !== 0) {
      Object.entries(scores).forEach(([pid, pts]) => {
        this.app.state.cumulativeScores[pid] = (this.app.state.cumulativeScores[pid] || 0) + pts;
      });
    }

    // Populate score table
    if (this.scoreTbody) {
      this.scoreTbody.innerHTML = '';

      const players = this.app.state.players || [];
      const landmarks = (this.app.state.map && this.app.state.map.landmarks) || [];

      // Sort rows by round score descending, then total descending
      const rows = players.map(p => {
        const roundPts = scores[p.id] || 0;
        const totalPts = this.app.state.cumulativeScores[p.id] || roundPts;
        const landmarkId = destinations[p.id];
        const lm = landmarks.find(l => l.id === landmarkId);
        
        // Road distance estimated from score
        const dist = roundPts === 100 ? 0 : (roundPts > 0 ? (100 - roundPts) / 20 : '3+');

        return {
          player: p,
          landmark: lm,
          roundPts,
          totalPts,
          dist
        };
      });

      rows.sort((a, b) => b.roundPts - a.roundPts || b.totalPts - a.totalPts);

      rows.forEach(r => {
        const tr = document.createElement('tr');
        const isYou = (r.player.id === this.app.state.playerId);
        if (isYou) tr.style.backgroundColor = 'rgba(56, 161, 105, 0.08)';

        const targetName = r.landmark ? r.landmark.name : 'Unknown';
        const targetColor = r.landmark ? r.landmark.color : '#2C1810';

        tr.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="avatar-dot" style="background-color: ${r.player.color || '#2C1810'};"></span>
              <strong>${r.player.name}</strong>${isYou ? ' (You)' : ''}
            </div>
          </td>
          <td>
            <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: ${targetColor};">
              &bull; ${targetName}
            </span>
          </td>
          <td>${r.dist}</td>
          <td class="score-gain">+${r.roundPts}</td>
          <td class="score-num">${r.totalPts}</td>
        `;

        this.scoreTbody.appendChild(tr);
      });
    }

    // Server-synced countdown timer bar
    if (this.timerRafId) cancelAnimationFrame(this.timerRafId);

    const duration = (phaseEndTime && serverTime) ? (phaseEndTime - serverTime) : 8000;
    const clockDelta = Date.now() - (serverTime || Date.now());
    const localEndTime = (phaseEndTime || (Date.now() + duration)) + clockDelta;

    const tickDebriefTimer = () => {
      const remainingMs = Math.max(0, localEndTime - Date.now());
      const pct = Math.max(0, Math.min(100, (remainingMs / duration) * 100));

      if (this.timerBar) {
        this.timerBar.style.width = `${pct}%`;
      }

      const remainingSec = Math.ceil(remainingMs / 1000);
      if (this.readyBtn && !this.isReady) {
        this.readyBtn.textContent = `CONFIRM & PROCEED (${remainingSec}s)`;
      }

      if (remainingMs > 0) {
        this.timerRafId = requestAnimationFrame(tickDebriefTimer);
      }
    };

    this.timerRafId = requestAnimationFrame(tickDebriefTimer);
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
    if (this.timerRafId) {
      cancelAnimationFrame(this.timerRafId);
      this.timerRafId = null;
    }
  }
}
