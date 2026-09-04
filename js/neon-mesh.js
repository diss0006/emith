/* ==========================================================================
   neon-mesh.js
   --------------------------------------------------------------------------
   The field that sits behind the curtain: a 3D Verlet-integrated cloth,
   projected through a perspective camera, that reacts to the pointer.

   Ported from the React/TypeScript component to vanilla, because this site is
   static with no build step. Three changes were made on the way over:

     1. Palette. The original ships neon lime on near-black. This uses the
        site's ink canvas with a near-white wireframe at low alpha, and the
        one accent reserved for the hot zone under the cursor. The original's
        light-mode branch is gone, since the page theme is locked dark.
     2. `ctx.scale(dpr, dpr)` in the original compounds on every resize,
        because the context transform is never reset. Uses setTransform here.
     3. It also owns the hand-drawn cursor ring. That needs the same pointer
        position and the same frame loop, so sharing them costs one rAF
        instead of two.

   The whole thing is gated off for coarse pointers and reduced motion: it is
   a pointer-driven effect, so there is nothing to show without a pointer.
   ========================================================================== */

const HOT_RADIUS = 250;
const PERSPECTIVE = 600;
const CAM_DIST = 400;
const ITERATIONS = 3;

const COL_BG = '#0e0e11';        /* --canvas */
const COL_WIRE = '242, 242, 240'; /* --text, held at low alpha */
const COL_HOT = '#e0663a';        /* --accent, only under the cursor */

/* a rough, deliberately uneven ring that overshoots where it closes, so it
   reads as drawn by hand rather than as a geometric circle */
const RING_PATH =
  'M86,24 C68,13 42,17 29,36 C16,55 15,82 29,97 C43,112 70,115 87,104 ' +
  'C104,93 111,70 107,50 C104,34 96,25 88,20 C93,23 96,27 97,33';

export function isEligible() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createNeonMesh({ canvas, container }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  let width = 0;
  let height = 0;
  let points = [];
  let constraints = [];
  let raf = 0;
  let disposed = false;
  let onScreen = true;
  let time = 0;

  const mouse = {
    x: -1000, y: -1000,
    inside: false,
    angleX: 0.2, angleY: -0.3,
    targetAngleX: 0.2, targetAngleY: -0.3
  };

  /* ---- the hand-drawn cursor ring ------------------------------------- */
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 120 120');
  ring.setAttribute('aria-hidden', 'true');
  ring.setAttribute('focusable', 'false');
  ring.classList.add('hero-ring');
  const ringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  ringPath.setAttribute('d', RING_PATH);
  ring.appendChild(ringPath);
  container.appendChild(ring);

  const ringLen = ringPath.getTotalLength();
  ringPath.style.strokeDasharray = ringLen;
  ringPath.style.strokeDashoffset = ringLen;

  const ringPos = { x: -200, y: -200, drawn: 0, spin: 0 };
  /* The ring draws itself on when the pointer arrives and retracts when it
     leaves. That progress is eased inside the render loop below rather than
     on a timer of its own: a second rAF chain would double the frame
     scheduling this module claims to avoid, and would drift against the
     mesh it is drawn over. */
  let ringTarget = 0;

  /* ---- mesh construction ---------------------------------------------- */
  function initMesh() {
    points = [];
    constraints = [];

    // Coarser cells read as a larger field: fewer, bigger quads with more
    // room to flex, rather than a fine net. Also cheaper, since the point and
    // constraint counts fall with the square of the spacing.
    const spacing = width < 900 ? 84 : 76;
    const cols = Math.ceil((width * 1.1) / spacing) + 1;
    const rows = Math.ceil((height * 1.1) / spacing) + 1;

    const grid = [];
    const startX = -(cols * spacing) / 2;
    const startY = -(rows * spacing) / 2;

    for (let j = 0; j < rows; j++) {
      grid[j] = [];
      for (let i = 0; i < cols; i++) {
        const bx = startX + i * spacing;
        const by = startY + j * spacing;
        const isEdge = i === 0 || i === cols - 1 || j === 0 || j === rows - 1;
        const p = {
          x: bx, y: by, z: 0,
          oldX: bx, oldY: by, oldZ: 0,
          pinned: isEdge,
          baseX: bx, baseY: by, baseZ: 0,
          projX: 0, projY: 0, projScale: 1
        };
        points.push(p);
        grid[j][i] = p;
      }
    }

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (i < cols - 1) constraints.push({ p1: grid[j][i], p2: grid[j][i + 1], length: spacing });
        if (j < rows - 1) constraints.push({ p1: grid[j][i], p2: grid[j + 1][i], length: spacing });
      }
    }
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = container.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    // setTransform, not scale: scale would compound across resizes
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initMesh();
  }

  /* ---- pointer --------------------------------------------------------- */
  function onPointerMove(e) {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouse.x = x;
    mouse.y = y;

    const normX = (x / width - 0.5) * 2;
    const normY = (y / height - 0.5) * 2;
    mouse.targetAngleY = normX * 0.45;
    mouse.targetAngleX = -normY * 0.35 + 0.2;

    if (!mouse.inside) {
      mouse.inside = true;
      ringPos.x = x;          // arrive under the pointer, then trail it
      ringPos.y = y;
      ringTarget = 1;
    }
  }

  function onPointerLeave() {
    mouse.x = -1000;
    mouse.y = -1000;
    mouse.targetAngleX = 0.2;
    mouse.targetAngleY = 0;
    if (mouse.inside) {
      mouse.inside = false;
      ringTarget = 0;
    }
  }

  /* ---- frame ----------------------------------------------------------- */
  function render() {
    if (disposed) return;
    raf = requestAnimationFrame(render);
    time += 0.025;

    mouse.angleX += (mouse.targetAngleX - mouse.angleX) * 0.05;
    mouse.angleY += (mouse.targetAngleY - mouse.angleY) * 0.05;

    const cosX = Math.cos(mouse.angleX), sinX = Math.sin(mouse.angleX);
    const cosY = Math.cos(mouse.angleY), sinY = Math.sin(mouse.angleY);

    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, width, height);

    // Verlet integration with an ambient wave along Z
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.pinned) continue;
      const vx = (p.x - p.oldX) * 0.93;
      const vy = (p.y - p.oldY) * 0.93;
      const vz = (p.z - p.oldZ) * 0.93;
      p.oldX = p.x; p.oldY = p.y; p.oldZ = p.z;
      p.x += vx; p.y += vy; p.z += vz;
      const ambientZ = Math.sin(p.baseX * 0.015 + p.baseY * 0.015 + time) * 18;
      p.x += (p.baseX - p.x) * 0.04;
      p.y += (p.baseY - p.y) * 0.04;
      p.z += (p.baseZ + ambientZ - p.z) * 0.04;
    }

    // project, then apply the pointer force in screen space
    const centerX = width / 2;
    const centerY = height / 2;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const rx1 = p.x * cosY + p.z * sinY;
      const ry1 = p.y;
      const rz1 = -p.x * sinY + p.z * cosY;
      const ry2 = ry1 * cosX - rz1 * sinX;
      const rz2 = ry1 * sinX + rz1 * cosX + CAM_DIST;
      const scale = PERSPECTIVE / Math.max(1, rz2);
      p.projScale = scale;
      p.projX = centerX + rx1 * scale;
      p.projY = centerY + ry2 * scale;

      if (!p.pinned) {
        const dx = p.projX - mouse.x;
        const dy = p.projY - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < HOT_RADIUS && dist > 0) {
          const force = (1 - dist / HOT_RADIUS) * 22;
          const angle = Math.atan2(dy, dx);
          p.x += (Math.cos(angle) * force) / p.projScale;
          p.y += (Math.sin(angle) * force) / p.projScale;
          p.z -= (force * 1.5) / p.projScale;
        }
      }
    }

    // relaxation
    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        const dx = c.p2.x - c.p1.x;
        const dy = c.p2.y - c.p1.y;
        const dz = c.p2.z - c.p1.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const delta = (dist - c.length) / (dist || 1);
        if (!c.p1.pinned) { c.p1.x += dx * 0.5 * delta; c.p1.y += dy * 0.5 * delta; c.p1.z += dz * 0.5 * delta; }
        if (!c.p2.pinned) { c.p2.x -= dx * 0.5 * delta; c.p2.y -= dy * 0.5 * delta; c.p2.z -= dz * 0.5 * delta; }
      }
    }

    // wireframe. Cold lines are batched into one path, since they all share a
    // stroke style; only the hot ones near the cursor are stroked individually.
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(' + COL_WIRE + ', 0.13)';
    ctx.beginPath();
    const hot = [];
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      const midX = (c.p1.projX + c.p2.projX) / 2;
      const midY = (c.p1.projY + c.p2.projY) / 2;
      const dx = mouse.x - midX;
      const dy = mouse.y - midY;
      if (dx * dx + dy * dy < HOT_RADIUS * HOT_RADIUS) { hot.push(c); continue; }
      ctx.moveTo(c.p1.projX, c.p1.projY);
      ctx.lineTo(c.p2.projX, c.p2.projY);
    }
    ctx.stroke();

    ctx.strokeStyle = COL_HOT;
    for (let i = 0; i < hot.length; i++) {
      const c = hot[i];
      ctx.lineWidth = 2 * ((c.p1.projScale + c.p2.projScale) / 2);
      ctx.beginPath();
      ctx.moveTo(c.p1.projX, c.p1.projY);
      ctx.lineTo(c.p2.projX, c.p2.projY);
      ctx.stroke();
    }

    // nodes closest to the cursor
    if (mouse.inside) {
      ctx.fillStyle = COL_HOT;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const dx = mouse.x - p.projX;
        const dy = mouse.y - p.projY;
        if (dx * dx + dy * dy < 10000) {
          ctx.beginPath();
          ctx.arc(p.projX, p.projY, 2.5 * p.projScale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // the ring trails the pointer slightly, which is what sells it as drawn
    if (mouse.inside) {
      ringPos.x += (mouse.x - ringPos.x) * 0.18;
      ringPos.y += (mouse.y - ringPos.y) * 0.18;
    }
    ringPos.spin = Math.sin(time * 0.4) * 4;
    ring.style.transform =
      'translate3d(' + (ringPos.x - 33) + 'px,' + (ringPos.y - 33) + 'px,0) rotate(' + ringPos.spin + 'deg)';

    // draw-on / retract, eased on the same clock as everything else
    const dSpeed = ringTarget > ringPos.drawn ? 0.16 : 0.22;
    ringPos.drawn += (ringTarget - ringPos.drawn) * dSpeed;
    if (Math.abs(ringTarget - ringPos.drawn) < 0.002) ringPos.drawn = ringTarget;
    ringPath.style.strokeDashoffset = (ringLen * (1 - ringPos.drawn)).toFixed(2);

    ctx.lineWidth = 0.8;
  }

  function play() {
    if (raf || disposed || document.hidden || !onScreen) return;
    render();
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function onVisibility() { document.hidden ? stop() : play(); }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (!disposed) resize(); }, 160);
  }

  // Build before observing. The observer's callback calls play(), and there
  // must be a mesh and a sized canvas by the time it can fire.
  resize();
  window.addEventListener('resize', onResize, { passive: true });
  container.addEventListener('pointermove', onPointerMove, { passive: true });
  container.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  play();

  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      onScreen ? play() : stop();
    }, { threshold: 0 });
    io.observe(container);
  }

  return {
    dispose() {
      disposed = true;
      stop();
      clearTimeout(resizeTimer);
      if (io) io.disconnect();
      window.removeEventListener('resize', onResize);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      ring.remove();
    }
  };
}
