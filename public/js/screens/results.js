/**
 * Results / Game Over Screen Controller
 * Renders executive podium (1st, 2nd, 3rd) and full final standings table.
 * Handles Play Again and Leave Room actions.
 */

export class ResultsScreen {
  constructor(app) {
    this.app = app;
    this.screenEl = document.getElementById('screen-results');
    this.podiumContainer = document.getElementById('podium-container');
    this.standingsTbody = document.getElementById('results-standings-tbody');
    this.playAgainBtn = document.getElementById('btn-play-again');
    this.leaveBtn = document.getElementById('btn-results-leave');

    this.hasVotedPlayAgain = false;

    this._bindEvents();
  }

  _bindEvents() {
    if (this.playAgainBtn) {
      this.playAgainBtn.addEventListener('click', () => {
        if (this.hasVotedPlayAgain) return;
        this.hasVotedPlayAgain = true;
        this.playAgainBtn.disabled = true;
        this.playAgainBtn.textContent = 'VOTED RECONVENE (WAITING...)';
        this.app.playAgain();
      });
    }

    if (this.leaveBtn) {
      this.leaveBtn.addEventListener('click', () => {
        this.app.leaveRoom();
      });
    }
  }

  update(data) {
    const { standings = [] } = data;
    this.hasVotedPlayAgain = false;

    if (this.playAgainBtn) {
      this.playAgainBtn.disabled = false;
      this.playAgainBtn.textContent = 'RECONVENE (PLAY AGAIN)';
    }

    // 1. Render Podium (Rank 2, Rank 1, Rank 3)
    if (this.podiumContainer) {
      this.podiumContainer.innerHTML = '';

      const p1 = standings[0];
      const p2 = standings[1];
      const p3 = standings[2];

      const renderPillar = (player, rank, classSuffix) => {
        if (!player) return null;
        const pillar = document.createElement('div');
        pillar.className = 'podium-pillar';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'podium-name';
        nameDiv.textContent = player.name;
        pillar.appendChild(nameDiv);

        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'podium-score';
        scoreDiv.textContent = `${player.totalScore} pts`;
        pillar.appendChild(scoreDiv);

        const block = document.createElement('div');
        block.className = `podium-block podium-${classSuffix}`;

        const rankDiv = document.createElement('div');
        rankDiv.className = 'podium-rank';
        rankDiv.textContent = rank === 1 ? '🥇 1st' : (rank === 2 ? '🥈 2nd' : '🥉 3rd');
        block.appendChild(rankDiv);

        pillar.appendChild(block);
        return pillar;
      };

      const pillar2 = renderPillar(p2, 2, '2');
      const pillar1 = renderPillar(p1, 1, '1');
      const pillar3 = renderPillar(p3, 3, '3');

      if (pillar2) this.podiumContainer.appendChild(pillar2);
      if (pillar1) this.podiumContainer.appendChild(pillar1);
      if (pillar3) this.podiumContainer.appendChild(pillar3);
    }

    // 2. Render Full Standings Table
    if (this.standingsTbody) {
      this.standingsTbody.innerHTML = '';

      standings.forEach((p, idx) => {
        const isYou = (p.playerId === this.app.state.playerId);
        const rank = p.rank || (idx + 1);

        const tr = document.createElement('tr');
        if (isYou) tr.style.backgroundColor = 'rgba(56, 161, 105, 0.08)';

        const color = p.colour || p.color || '#2C1810';

        tr.innerHTML = `
          <td><strong>#${rank}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="avatar-dot" style="background-color: ${color};"></span>
              <span>${p.name}</span>${isYou ? ' <strong style="color: var(--accent-emerald);">(You)</strong>' : ''}
            </div>
          </td>
          <td class="score-num">${p.totalScore}</td>
          <td>${p.bestRound || 0}</td>
          <td>${p.exactHits || 0}</td>
        `;

        this.standingsTbody.appendChild(tr);
      });
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
