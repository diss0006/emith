/* ==========================================================================
   text-rotate.js
   --------------------------------------------------------------------------
   The "Polymath" box in the hero.

   Adapted from the 21st.dev TextRotate component with one deliberate change:
   the word never changes. Only the typeface does. The roll-out / roll-in
   choreography, the per-character stagger from the last letter, and the box
   resizing to fit are all kept; the rotating array is a list of fonts rather
   than a list of words.

   That is the whole point of the word: one idea spoken in five different
   voices. Interface sans, monospace, editorial serif, condensed display,
   geometric. It is the tagline arguing for itself.

   Two things the original gets for free from Framer Motion and this has to do
   by hand: the `layout` box resize (measured, then tweened) and the spring
   (approximated with GSAP back eases).
   ========================================================================== */

const WORD = 'Polymath';

/* class -> the face it selects. Cap heights differ a lot between these, so
   each is normalised at runtime rather than with hand-guessed multipliers. */
const FACES = ['poly-f0', 'poly-f1', 'poly-f2', 'poly-f3', 'poly-f4'];

const INTERVAL = 2200;

export function createTextRotate({ box, mask, gsap }) {
  if (!box || !mask || !gsap) return null;

  const measure = document.createElement('span');
  measure.className = 'polybox__measure';
  measure.setAttribute('aria-hidden', 'true');
  measure.textContent = WORD;
  box.appendChild(measure);

  let index = 0;
  let widths = [];
  let timer = 0;
  let tl = null;
  let disposed = false;

  /* ---- normalise cap height across the five faces ---------------------- */
  function normaliseScales() {
    const probe = document.createElement('canvas').getContext('2d');
    const cs = getComputedStyle(mask);
    const size = 100;
    const caps = FACES.map((cls) => {
      measure.className = 'polybox__measure ' + cls;
      const ms = getComputedStyle(measure);
      probe.font = ms.fontWeight + ' ' + size + 'px ' + ms.fontFamily;
      const m = probe.measureText('P');
      return m.actualBoundingBoxAscent || size * 0.7;
    });
    const ref = caps[0];
    FACES.forEach((cls, i) => {
      // every face ends up with the same cap height, so the word reads as one
      // size in five voices instead of five different sizes
      box.style.setProperty('--cap-' + i, (ref / caps[i]).toFixed(4));
    });
    measure.className = 'polybox__measure';
    void cs;
  }

  function measureWidths() {
    widths = FACES.map((cls, i) => {
      measure.className = 'polybox__measure ' + cls;
      measure.style.fontSize = 'calc(1em * var(--cap-' + i + ', 1))';
      return measure.getBoundingClientRect().width;
    });
    measure.className = 'polybox__measure';
    measure.style.fontSize = '';
  }

  function paint(i) {
    mask.className = 'polybox__mask ' + FACES[i];
    mask.style.fontSize = 'calc(1em * var(--cap-' + i + ', 1))';
    mask.textContent = '';
    const frag = document.createDocumentFragment();
    const chars = [];
    for (const ch of WORD) {
      const s = document.createElement('span');
      s.className = 'polychar';
      s.textContent = ch;
      frag.appendChild(s);
      chars.push(s);
    }
    mask.appendChild(frag);
    return chars;
  }

  function sizeBox(i, animate) {
    const w = widths[i];
    if (!w) return;
    if (animate) {
      // width, not a transform: this box is one small element resized once
      // every couple of seconds, and scaleX would distort its corner radius
      gsap.to(box, { width: w, duration: 0.55, ease: 'back.out(1.5)' });
    } else {
      gsap.set(box, { width: w });
    }
  }

  function step() {
    if (disposed) return;
    const nextIndex = (index + 1) % FACES.length;
    const current = mask.querySelectorAll('.polychar');

    tl = gsap.timeline();

    // roll the current face out, last letter first
    tl.to(current, {
      yPercent: -120,
      opacity: 0,
      duration: 0.4,
      ease: 'back.in(1.1)',
      stagger: { each: 0.025, from: 'last' }
    }, 0);

    // the box resizes while the letters are still leaving
    tl.add(function () { sizeBox(nextIndex, true); }, 0.12);

    tl.add(function () {
      index = nextIndex;
      const chars = paint(index);
      gsap.set(chars, { yPercent: 100, opacity: 0 });
      gsap.to(chars, {
        yPercent: 0,
        opacity: 1,
        duration: 0.55,
        ease: 'back.out(1.6)',
        stagger: { each: 0.025, from: 'last' }
      });
    }, 0.42);
  }

  function onResize() {
    measureWidths();
    sizeBox(index, false);
  }
  let resizeTimer = 0;
  function debouncedResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 180);
  }

  return {
    /* Render the first face and lock the box to its width. Safe to call even
       when the rotation itself will never start. */
    prime() {
      normaliseScales();
      measureWidths();
      paint(index);
      sizeBox(index, false);
      window.addEventListener('resize', debouncedResize, { passive: true });
    },
    start() {
      if (disposed || timer) return;
      timer = setInterval(step, INTERVAL);
    },
    dispose() {
      disposed = true;
      clearInterval(timer);
      clearTimeout(resizeTimer);
      if (tl) tl.kill();
      window.removeEventListener('resize', debouncedResize);
      measure.remove();
    }
  };
}
