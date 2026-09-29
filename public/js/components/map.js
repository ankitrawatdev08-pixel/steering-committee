/**
 * Canvas Map Renderer
 * Handles the 9x9 grid, obstacles with crosshatch, landmarks with shapes,
 * car with smooth slide interpolation and heading indicator,
 * route trail, secret destination glow, and landmark ping tap events.
 */

export class MapRenderer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = options; // e.g. onLandmarkClick

    this.gridSize = 9;
    this.mapData = null; // { grid, landmarks, obstacles }
    this.carPos = { x: 4, y: 4 };
    this.prevCarPos = { x: 4, y: 4 };
    this.heading = null;
    this.route = []; // [{x, y}, ...]
    this.ownDestinationId = null;
    this.revealAllDestinations = false; // true during debrief

    // Car slide animation
    this.animatingCar = false;
    this.carAnimStartTime = 0;
    this.carAnimDuration = 150; // ms

    // Landmark ping flashes: Map of landmarkId -> { startTime, duration: 1500 }
    this.pingFlashes = new Map();

    this._setupResizeHandler();
    this._setupInputHandler();
    this._startRenderLoop();
  }

  _setupResizeHandler() {
    const resize = () => {
      if (!this.canvas || !this.canvas.parentElement) return;
      const container = this.canvas.parentElement;
      const size = Math.min(container.clientWidth - 16, container.clientHeight - 16, 420);
      if (size <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = size * dpr;
      this.canvas.height = size * dpr;
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cssSize = size;
      this.cellSize = size / this.gridSize;
    };

    window.addEventListener('resize', resize);
    setTimeout(resize, 50);
  }

  _setupInputHandler() {
    const handleTap = (clientX, clientY) => {
      if (!this.mapData || !this.mapData.landmarks || !this.cellSize) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const cellX = Math.floor(x / this.cellSize);
      const cellY = Math.floor(y / this.cellSize);

      if (cellX < 0 || cellX >= this.gridSize || cellY < 0 || cellY >= this.gridSize) return;

      const clickedLandmark = this.mapData.landmarks.find(l => {
        const lx = l.col !== undefined ? l.col : l.x;
        const ly = l.row !== undefined ? l.row : l.y;
        return lx === cellX && ly === cellY;
      });

      if (clickedLandmark && this.options.onLandmarkClick) {
        this.options.onLandmarkClick(clickedLandmark.id);
      }
    };

    this.canvas.addEventListener('click', (e) => handleTap(e.clientX, e.clientY));
    this.canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    });
  }

  setMapData(mapData) {
    this.mapData = mapData;
  }

  setOwnDestination(destinationId) {
    this.ownDestinationId = destinationId;
  }

  setRevealAll(reveal) {
    this.revealAllDestinations = reveal;
  }

  updateCar(newPos, heading, route = []) {
    const nx = newPos.x !== undefined ? newPos.x : (newPos.col !== undefined ? newPos.col : 4);
    const ny = newPos.y !== undefined ? newPos.y : (newPos.row !== undefined ? newPos.row : 4);

    if (this.carPos.x !== nx || this.carPos.y !== ny) {
      this.prevCarPos = { ...this.carPos };
      this.carPos = { x: nx, y: ny };
      this.animatingCar = true;
      this.carAnimStartTime = performance.now();
    }
    this.heading = heading;
    this.route = route;
  }

  triggerPing(landmarkId) {
    this.pingFlashes.set(landmarkId, {
      startTime: performance.now(),
      duration: 1200
    });
  }

  _startRenderLoop() {
    const render = (timestamp) => {
      this._draw(timestamp);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  _draw(now) {
    if (!this.cellSize || !this.cssSize) return;
    const ctx = this.ctx;
    const size = this.cssSize;
    const cell = this.cellSize;

    ctx.clearRect(0, 0, size, size);

    // 1. Draw Road background
    ctx.fillStyle = '#FAF3E8'; // Parchment
    ctx.fillRect(0, 0, size, size);

    // 2. Draw Obstacles (Buildings)
    if (this.mapData && this.mapData.obstacles) {
      this.mapData.obstacles.forEach(obs => {
        const col = obs.col !== undefined ? obs.col : obs.x;
        const row = obs.row !== undefined ? obs.row : obs.y;
        const ox = col * cell;
        const oy = row * cell;

        // Dark walnut fill
        ctx.fillStyle = '#4A3728';
        ctx.fillRect(ox, oy, cell, cell);

        // Subtle cross-hatch pattern
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, cell, cell);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        const step = 8;
        for (let i = -cell; i < cell * 2; i += step) {
          ctx.beginPath();
          ctx.moveTo(ox + i, oy);
          ctx.lineTo(ox + i + cell, oy + cell);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // 3. Draw Grid Lines
    ctx.strokeStyle = '#D4C5B2';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= this.gridSize; i++) {
      const p = i * cell;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();

    // 4. Draw Route Trail
    if (this.route && this.route.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 161, 105, 0.45)'; // Accent emerald 45%
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      this.route.forEach((pos, idx) => {
        const cx = ((pos.col !== undefined ? pos.col : pos.x) + 0.5) * cell;
        const cy = ((pos.row !== undefined ? pos.row : pos.y) + 0.5) * cell;
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Landmarks
    if (this.mapData && this.mapData.landmarks) {
      this.mapData.landmarks.forEach(lm => {
        const col = lm.col !== undefined ? lm.col : lm.x;
        const row = lm.row !== undefined ? lm.row : lm.y;
        const lx = (col + 0.5) * cell;
        const ly = (row + 0.5) * cell;
        const color = lm.colour || lm.color || '#38A169';

        const isOwn = (lm.id === this.ownDestinationId);
        const isRevealed = this.revealAllDestinations || isOwn;
        const lmSize = cell * 0.58;

        // Check if pinged
        const ping = this.pingFlashes.get(lm.id);
        let pingPulse = 0;
        if (ping) {
          const elapsed = now - ping.startTime;
          if (elapsed < ping.duration) {
            pingPulse = Math.sin((elapsed / ping.duration) * Math.PI);
          } else {
            this.pingFlashes.delete(lm.id);
          }
        }

        // Draw Ping ripple if active
        if (pingPulse > 0) {
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = pingPulse * 0.9;
          ctx.beginPath();
          ctx.arc(lx, ly, cell * (0.4 + pingPulse * 0.4), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Own destination pulsing glow
        if (isOwn) {
          const pulse = (Math.sin(now / 250) + 1) / 2; // 0..1
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10 + pulse * 8;
          ctx.beginPath();
          ctx.arc(lx, ly, cell * 0.42 + pulse * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Draw the Landmark Shape
        ctx.save();
        ctx.globalAlpha = isRevealed ? 1.0 : 0.45;
        this._drawShape(ctx, lm.shape, lx, ly, lmSize, color);
        ctx.restore();
      });
    }

    // 6. Draw Car with slide interpolation
    let curX = this.carPos.x;
    let curY = this.carPos.y;

    if (this.animatingCar) {
      const elapsed = now - this.carAnimStartTime;
      const t = Math.min(1, elapsed / this.carAnimDuration);
      // Ease-out quad
      const ease = t * (2 - t);
      curX = this.prevCarPos.x + (this.carPos.x - this.prevCarPos.x) * ease;
      curY = this.prevCarPos.y + (this.carPos.y - this.prevCarPos.y) * ease;
      if (t >= 1) this.animatingCar = false;
    }

    const carCenterX = (curX + 0.5) * cell;
    const carCenterY = (curY + 0.5) * cell;
    this._drawCar(ctx, carCenterX, carCenterY, cell * 0.65, this.heading);
  }

  _drawCar(ctx, cx, cy, size, heading) {
    ctx.save();
    ctx.translate(cx, cy);

    let angle = 0;
    if (heading === 'UP') angle = -Math.PI / 2;
    else if (heading === 'DOWN') angle = Math.PI / 2;
    else if (heading === 'LEFT') angle = Math.PI;
    else if (heading === 'RIGHT') angle = 0;

    if (heading) {
      ctx.rotate(angle);
    }

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    // Body (top-down executive sedan)
    const length = size * 0.95;
    const width = size * 0.65;
    const radius = 5;

    ctx.fillStyle = '#1B3B6F'; // Executive navy
    ctx.strokeStyle = '#FAF3E8';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(-length / 2, -width / 2, length, width, radius);
    ctx.fill();
    ctx.stroke();

    // Windshield & roof
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2C1810';
    ctx.fillRect(-length * 0.1, -width * 0.35, length * 0.45, width * 0.7);

    // Front headlights
    ctx.fillStyle = '#FAF089';
    ctx.fillRect(length / 2 - 3, -width / 2 + 2, 2.5, 3.5);
    ctx.fillRect(length / 2 - 3, width / 2 - 5.5, 2.5, 3.5);

    // Heading Arrow on car
    if (heading) {
      ctx.fillStyle = '#FAF3E8';
      ctx.beginPath();
      ctx.moveTo(length * 0.3, 0);
      ctx.lineTo(length * 0.05, -width * 0.2);
      ctx.lineTo(length * 0.05, width * 0.2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  _drawShape(ctx, shape, x, y, size, color) {
    const half = size / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    switch (shape) {
      case 'star': {
        const spikes = 5;
        const outer = half;
        const inner = half * 0.45;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;
        ctx.moveTo(x, y - outer);
        for (let i = 0; i < spikes; i++) {
          ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
          rot += step;
          ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
          rot += step;
        }
        ctx.closePath();
        break;
      }
      case 'diamond': {
        ctx.moveTo(x, y - half);
        ctx.lineTo(x + half, y);
        ctx.lineTo(x, y + half);
        ctx.lineTo(x - half, y);
        ctx.closePath();
        break;
      }
      case 'triangle': {
        ctx.moveTo(x, y - half);
        ctx.lineTo(x + half, y + half * 0.85);
        ctx.lineTo(x - half, y + half * 0.85);
        ctx.closePath();
        break;
      }
      case 'square': {
        ctx.roundRect(x - half * 0.8, y - half * 0.8, half * 1.6, half * 1.6, 3);
        break;
      }
      case 'hexagon': {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const hx = x + half * Math.cos(a);
          const hy = y + half * Math.sin(a);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        break;
      }
      case 'circle':
      default: {
        ctx.arc(x, y, half * 0.85, 0, Math.PI * 2);
        break;
      }
    }

    ctx.fill();
    ctx.stroke();
  }
}
