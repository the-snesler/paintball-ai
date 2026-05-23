import { useEffect, useRef } from "react";

interface InkDropGridProps {
  cellSize?: number;
  decay?: number;
  diffusion?: number;
  dropsPerSecond?: number;
  cursorRadius?: number;
  cursorStrength?: number;
  className?: string;
}

export function InkDropGrid({
  cellSize = 8,
  decay = 0.985,
  diffusion = 0.32,
  dropsPerSecond = 4,
  cursorRadius = 7,
  cursorStrength = 0.045,
  className = "",
}: InkDropGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let cols = 0;
    let rows = 0;
    let intensity = new Float32Array(0);
    let scratch = new Float32Array(0);
    let hue = new Float32Array(0);
    // per-cell flow vector in [-1, 1]; biases which neighbors receive intensity
    let flowX = new Float32Array(0);
    let flowY = new Float32Array(0);
    let rafId = 0;

    const computeFlowField = () => {
      // smooth low-freq noise via summed sines — gives curling, river-like field
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const fx =
            Math.sin(x * 0.07 + y * 0.13) * 0.7 + Math.sin(x * 0.23 - y * 0.05 + 1.3) * 0.35;
          const fy =
            Math.cos(x * 0.11 + y * 0.07 + 2.1) * 0.7 + Math.cos(x * 0.05 + y * 0.21) * 0.35;
          // clamp to roughly [-0.95, 0.95] so weights stay positive
          flowX[i] = Math.max(-0.95, Math.min(0.95, fx));
          flowY[i] = Math.max(-0.95, Math.min(0.95, fy));
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nextCols = Math.max(1, Math.ceil(rect.width / cellSize));
      const nextRows = Math.max(1, Math.ceil(rect.height / cellSize));
      if (nextCols === cols && nextRows === rows) return;

      const nextI = new Float32Array(nextCols * nextRows);
      const nextH = new Float32Array(nextCols * nextRows);
      const copyCols = Math.min(cols, nextCols);
      const copyRows = Math.min(rows, nextRows);
      for (let y = 0; y < copyRows; y++) {
        for (let x = 0; x < copyCols; x++) {
          nextI[y * nextCols + x] = intensity[y * cols + x];
          nextH[y * nextCols + x] = hue[y * cols + x];
        }
      }
      cols = nextCols;
      rows = nextRows;
      intensity = nextI;
      scratch = new Float32Array(cols * rows);
      hue = nextH;
      flowX = new Float32Array(cols * rows);
      flowY = new Float32Array(cols * rows);
      computeFlowField();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    type ActiveDrop = {
      cx: number;
      cy: number;
      radius: number;
      peak: number;
      hue: number;
      age: number;
      lifetime: number;
    };
    const activeDrops: ActiveDrop[] = [];

    const spawnDrop = (cx: number, cy: number, baseHue: number) => {
      // each spawn produces 1-3 splats clustered around (cx, cy), each growing in independently
      const splats = 1 + Math.floor(Math.random() * 3);
      for (let s = 0; s < splats; s++) {
        const ox = s === 0 ? 0 : Math.floor((Math.random() - 0.5) * 7);
        const oy = s === 0 ? 0 : Math.floor((Math.random() - 0.5) * 7);
        activeDrops.push({
          cx: cx + ox,
          cy: cy + oy,
          radius: s === 0 ? 5 + Math.floor(Math.random() * 3) : 1,
          peak: s === 0 ? 0.9 + Math.random() * 0.4 : 0.5 + Math.random() * 0.3,
          hue: baseHue,
          // staggered start so splats don't all bloom in lockstep
          age: s === 0 ? 0 : -Math.random() * 0.4,
          lifetime: 0.7 + Math.random() * 0.6,
        });
      }
    };

    const advanceDrops = (dt: number) => {
      for (let k = activeDrops.length - 1; k >= 0; k--) {
        const d = activeDrops[k];
        d.age += dt;
        if (d.age < 0) continue;
        // dose this frame: a slice of the total peak distributed across lifetime
        // sin-curve eases the rate (slow start, peak middle, slow finish)
        const tNorm = Math.min(1, d.age / d.lifetime);
        const rate = Math.sin(tNorm * Math.PI) * (Math.PI / 2);
        const dose = (d.peak / d.lifetime) * rate * dt;
        const r = d.radius;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > r + 0.4) continue;
            const x = d.cx + dx;
            const y = d.cy + dy;
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
            const idx = y * cols + x;
            const falloff = 1 - dist / (r + 1);
            const add = dose * falloff;
            const prev = intensity[idx];
            intensity[idx] = Math.min(1.6, prev + add);
            const w = add / Math.max(0.001, prev + add);
            hue[idx] = hue[idx] * (1 - w) + d.hue * w;
          }
        }
        if (d.age >= d.lifetime) activeDrops.splice(k, 1);
      }
    };

    const cursor = {
      x: -1,
      y: -1,
      inside: false,
      lastMoveMs: 0,
      speed: 0,
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const cx = Math.floor(lx / cellSize);
      const cy = Math.floor(ly / cellSize);
      const inside = lx >= 0 && lx < rect.width && ly >= 0 && ly < rect.height;
      if (inside) {
        if (cursor.inside) {
          const dx = cx - cursor.x;
          const dy = cy - cursor.y;
          cursor.speed = Math.min(8, Math.sqrt(dx * dx + dy * dy));
        }
        cursor.x = cx;
        cursor.y = cy;
        cursor.inside = true;
        cursor.lastMoveMs = performance.now();
      } else {
        cursor.inside = false;
      }
    };
    const onPointerLeave = () => {
      cursor.inside = false;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);

    // pre-seed: spawn drops and advance them most of the way so the canvas isn't empty on first paint
    for (let i = 0; i < 10; i++) {
      spawnDrop(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows), Math.random());
    }
    for (let step = 0; step < 30; step++) advanceDrops(1 / 60);

    let last = performance.now();
    let dropAccum = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // random ambient drops
      dropAccum += dt * dropsPerSecond;
      while (dropAccum >= 1) {
        dropAccum -= 1;
        spawnDrop(
          Math.floor(Math.random() * cols),
          Math.floor(Math.random() * rows),
          Math.random()
        );
      }
      advanceDrops(dt);

      // cursor brush: continuous soft paint while inside, boosted by motion
      if (cursor.inside) {
        const motionBoost = 1 + Math.min(2.5, cursor.speed * 0.6);
        const r = cursorRadius;
        const cx = cursor.x;
        const cy = cursor.y;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
            const idx = y * cols + x;
            const falloff = 1 - dist / r;
            const add = cursorStrength * falloff * falloff * motionBoost;
            const prev = intensity[idx];
            intensity[idx] = Math.min(1.6, prev + add);
            const w = add / Math.max(0.001, prev + add);
            // cursor paints toward magenta
            hue[idx] = hue[idx] * (1 - w) + 0.85 * w;
          }
        }
        // decay speed each frame so brush calms when mouse stops
        cursor.speed *= 0.7;
      }

      // anisotropic diffusion: each cell pushes intensity to its 4 neighbors
      // weighted by its flow vector. mass-conserving (until decay).
      scratch.fill(0);
      const total = cols * rows;
      for (let i = 0; i < total; i++) {
        const v = intensity[i];
        if (v < 0.0008) {
          scratch[i] += v;
          continue;
        }
        const x = i % cols;
        const y = (i - x) / cols;
        const fx = flowX[i];
        const fy = flowY[i];
        // direction weights >= 0, summing to 4 — flow biases push direction
        const wL = 1 - fx;
        const wR = 1 + fx;
        const wU = 1 - fy;
        const wD = 1 + fy;
        const out = diffusion * v;
        const toL = (out * wL) / 4;
        const toR = (out * wR) / 4;
        const toU = (out * wU) / 4;
        const toD = (out * wD) / 4;
        scratch[i] += v - (toL + toR + toU + toD);
        if (x > 0) scratch[i - 1] += toL;
        else scratch[i] += toL;
        if (x < cols - 1) scratch[i + 1] += toR;
        else scratch[i] += toR;
        if (y > 0) scratch[i - cols] += toU;
        else scratch[i] += toU;
        if (y < rows - 1) scratch[i + cols] += toD;
        else scratch[i] += toD;
      }
      // decay and swap
      for (let i = 0; i < total; i++) {
        scratch[i] *= decay;
      }
      const swap = intensity;
      intensity = scratch;
      scratch = swap;

      // render
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const draw = cellSize - 1;
      for (let i = 0; i < total; i++) {
        const v = intensity[i];
        if (v < 0.025) continue;
        const x = i % cols;
        const y = (i - x) / cols;
        // hue 0..1 lerps violet → purple → magenta
        const h = hue[i];
        let r: number, g: number, b: number;
        if (h < 0.5) {
          const t = h / 0.5;
          r = Math.round(124 + (168 - 124) * t);
          g = Math.round(58 + (85 - 58) * t);
          b = Math.round(237 + (247 - 237) * t);
        } else {
          const t = (h - 0.5) / 0.5;
          r = Math.round(168 + (217 - 168) * t);
          g = Math.round(85 + (70 - 85) * t);
          b = Math.round(247 + (239 - 247) * t);
        }
        const a = Math.min(1, v) * 0.9;
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.fillRect(x * cellSize, y * cellSize, draw, draw);
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [cellSize, decay, diffusion, dropsPerSecond, cursorRadius, cursorStrength]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
