/* ==========================================================================
   preview.js
   --------------------------------------------------------------------------
   The panel that drops from the top edge while a reel word is hovered, so you
   can see what is behind a link before you commit to it.

   The deck is the 21st.dev stacked carousel with its input inverted. That
   component is drag-driven: a motion value is pushed around by pointer
   velocity. Here nothing is dragged, so the same motion value is stepped by a
   looping GSAP timeline instead, holding on each card before moving to the
   next. The per-card transform maths is the original's, since that is what
   gives the stack its fan.

   Only the lit word is hoverable in the first place, so the panel can never
   be showing one theme while another is highlighted.
   ========================================================================== */

const CARD_X = 74;      // horizontal fan
const CARD_Y = 16;      // how far the outliers sag
const CARD_ROT = 7;     // degrees per step out from centre
const CARD_SCALE = 0.1; // shrink per step out

const OPEN_DELAY = 130; // hover intent in, ms
const CLOSE_DELAY = 90; // and out

export function createPreview({ words, gsap, ScrollTrigger, themes }) {
  if (!words || !words.length || !gsap || !themes) return null;

  /* ---- shell ---------------------------------------------------------- */
  const root = document.createElement('div');
  root.className = 'preview';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML =
    '<div class="preview__panel">' +
      '<div class="preview__inner">' +
      '<div class="preview__deck"></div>' +
      '<div class="preview__info">' +
        '<p class="preview__kicker"></p>' +
        '<h3 class="preview__title"></h3>' +
        '<p class="preview__blurb"></p>' +
        '<ul class="preview__facts"></ul>' +
        '<span class="preview__go">Open <i class="ph ph-arrow-up-right" aria-hidden="true"></i></span>' +
      '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  const panel = root.querySelector('.preview__panel');
  const deck = root.querySelector('.preview__deck');
  const kicker = root.querySelector('.preview__kicker');
  const title = root.querySelector('.preview__title');
  const blurb = root.querySelector('.preview__blurb');
  const facts = root.querySelector('.preview__facts');

  /* Pin the transform channel GSAP will drive. The stylesheet parks the panel
     with translateY(-102%) so it is off-screen before any script runs, but
     GSAP reads that back as a pixel `y`, which leaves a `yPercent` tween with
     nothing to move. Declaring both channels makes the handover explicit. */
  gsap.set(panel, { yPercent: -102, y: 0 });

  let openIndex = -1;
  let inTimer = 0;
  let outTimer = 0;
  let deckLoop = null;
  let cards = [];
  const state = { p: 0 };

  /* Cards only fade where the ring wraps around behind the stack, and only
     over the last half step. A blanket "hide anything past the middle" cuts
     the immediate neighbours out of a short deck: with three cards the first
     one out on each side is already at the halfway mark, so both vanish and
     you are left staring at a single card. Decks shorter than five never wrap
     far enough to need any fade at all. */
  function edgeFade(a, n) {
    if (n < 5) return 1;
    const edge = n / 2;
    if (a >= edge) return 0;
    if (a > edge - 0.5) return (edge - a) / 0.5;
    return 1;
  }

  /* ---- the deck ------------------------------------------------------- */
  function layout() {
    const n = cards.length;
    if (!n) return;
    cards.forEach(function (card, i) {
      let d = (i - state.p) % n;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      const a = Math.abs(d);
      gsap.set(card, {
        x: d * CARD_X,
        y: a * CARD_Y,
        rotate: a < 0.05 ? 0 : d * CARD_ROT,
        scale: 1 - a * CARD_SCALE,
        opacity: edgeFade(a, n),
        zIndex: Math.round(100 - a * 10)
      });
    });
  }

  function buildDeck(images) {
    if (deckLoop) { deckLoop.kill(); deckLoop = null; }
    deck.innerHTML = '';
    cards = [];
    state.p = 0;

    panel.classList.toggle('is-textonly', !images.length);
    if (!images.length) return;

    images.forEach(function (src) {
      const c = document.createElement('div');
      c.className = 'pv-card';
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      // eager: these are built only when a theme actually opens, and a lazy
      // image inside a hidden panel will not have decoded by the time the
      // panel slides into view
      img.loading = 'eager';
      img.decoding = 'async';
      c.appendChild(img);
      deck.appendChild(c);
      cards.push(c);
    });
    layout();

    if (cards.length < 2) return;
    // hold on a card, then move to the next. The original stepped this with
    // drag velocity; a looping timeline is the same value, self-driven.
    deckLoop = gsap.timeline({ repeat: -1, onUpdate: layout });
    for (let i = 0; i < cards.length; i++) {
      deckLoop.to(state, { p: i + 1, duration: 0.72, ease: 'power2.inOut' }, i * 2.1 + 1.1);
    }
  }

  /* ---- content -------------------------------------------------------- */
  function fill(i) {
    const t = themes[i];
    if (!t) return false;
    kicker.textContent = t.kicker;
    title.textContent = t.title;
    blurb.textContent = t.blurb;
    facts.innerHTML = '';
    (t.facts || []).forEach(function (f) {
      const li = document.createElement('li');
      li.textContent = f;
      facts.appendChild(li);
    });
    buildDeck(t.images || []);
    return true;
  }

  /* ---- open / close --------------------------------------------------- */
  function open(i) {
    clearTimeout(outTimer);
    if (openIndex === i) return;
    if (!fill(i)) return;
    openIndex = i;

    root.classList.add('is-open');
    gsap.killTweensOf(panel);
    gsap.to(panel, { yPercent: 0, duration: 0.55, ease: 'expo.out', overwrite: true });

    const bits = root.querySelectorAll('.preview__kicker, .preview__title, .preview__blurb, .preview__facts, .preview__go');
    gsap.fromTo(bits,
      { y: -12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.42, ease: 'power3.out', stagger: 0.045, delay: 0.08, overwrite: true });
    if (cards.length) {
      gsap.fromTo(cards,
        { yPercent: -26, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05, delay: 0.06,
          onComplete: layout, overwrite: 'auto' });
    }
  }

  function close() {
    clearTimeout(inTimer);
    if (openIndex === -1) return;
    openIndex = -1;
    gsap.killTweensOf(panel);
    gsap.to(panel, {
      yPercent: -102,
      duration: 0.34,
      ease: 'power3.in',
      overwrite: true,
      onComplete: function () {
        root.classList.remove('is-open');
        if (deckLoop) { deckLoop.kill(); deckLoop = null; }
      }
    });
  }

  /* ---- wiring --------------------------------------------------------- */
  const handlers = [];
  words.forEach(function (li, i) {
    const link = li.querySelector('.reel__link');
    if (!link) return;
    const enter = function () {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
      inTimer = setTimeout(function () { open(i); }, OPEN_DELAY);
    };
    const leave = function () {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
      outTimer = setTimeout(close, CLOSE_DELAY);
    };
    link.addEventListener('pointerenter', enter);
    link.addEventListener('pointerleave', leave);
    link.addEventListener('focus', enter);
    link.addEventListener('blur', leave);
    handlers.push([link, enter, leave]);
  });

  // Scrolling changes which word is lit underneath the pointer. Leaving the
  // panel up through that would flash a preview of a link nobody is pointing
  // at any more, so any scroll dismisses it.
  let onScrollStart = null;
  if (ScrollTrigger) {
    onScrollStart = function () { clearTimeout(inTimer); close(); };
    ScrollTrigger.addEventListener('scrollStart', onScrollStart);
  }

  return {
    close,
    dispose() {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
      if (deckLoop) deckLoop.kill();
      if (onScrollStart) ScrollTrigger.removeEventListener('scrollStart', onScrollStart);
      handlers.forEach(function (h) {
        h[0].removeEventListener('pointerenter', h[1]);
        h[0].removeEventListener('pointerleave', h[2]);
        h[0].removeEventListener('focus', h[1]);
        h[0].removeEventListener('blur', h[2]);
      });
      root.remove();
    }
  };
}
