/* ==========================================================================
   reel.js
   --------------------------------------------------------------------------
   "See my [ ... ]" - the scrolling word list below the hero.

   Built on the mechanism from Jhey Tompkins' "you can scroll." pen, which is
   cleverer than it first looks: there is no pinning anywhere. The "See my"
   prefix is `position: sticky` at the vertical middle, and the word list is
   just a naturally tall column beside it. Scrolling carries the words past a
   prefix that stays put.

   The highlight is one scrubbed timeline running two staggered tweens at the
   same time: brighten items 1..n, and dim items 0..n-1. Because they are
   offset by exactly one item, precisely one word is lit at any scroll
   position, and it is the one level with the prefix.

   Two things are layered on top of the original:

     1. A discrete active index, taken from the trigger's own progress rather
        than the eased animation, so the panel and the click target switch
        crisply on the word rather than lagging behind the scrub.
     2. Only the lit word is clickable. The rest are pointer-events: none, so
        a stray click on a dimmed word cannot navigate anywhere. They stay
        keyboard reachable, and focusing one promotes it.
   ========================================================================== */

const DIM = 0.16;

export function createReel({ root, gsap, ScrollTrigger, stage, reduced }) {
  if (!root || !gsap || !ScrollTrigger) return null;

  const items = Array.prototype.slice.call(root.querySelectorAll('.reel__word'));
  if (items.length < 2) return null;

  gsap.registerPlugin(ScrollTrigger);

  const cs = getComputedStyle(document.documentElement);
  const accent = cs.getPropertyValue('--accent').trim() || '#e0663a';
  const rest = cs.getPropertyValue('--text').trim() || '#f2f2f0';

  let active = -1;

  function setActive(i) {
    if (i === active || i < 0 || i >= items.length) return;
    if (items[active]) items[active].classList.remove('is-active');
    active = i;
    items[active].classList.add('is-active');
    if (stage) stage.show(i);
  }

  // opening state: only the first word is lit
  gsap.set(items, {
    opacity: function (idx) { return idx === 0 ? 1 : DIM; },
    color: function (idx) { return idx === 0 ? accent : rest; }
  });
  setActive(0);

  // focusing a word by keyboard promotes it, so tabbing is not a way to reach
  // a link that looks disabled
  items.forEach(function (li, i) {
    const link = li.querySelector('.reel__link');
    if (link) link.addEventListener('focus', function () { setActive(i); });
  });

  if (reduced) {
    // no scrub: every word legible, every word clickable
    gsap.set(items, { opacity: 1, color: rest });
    root.classList.add('is-static');
    return {
      refresh: function () {},
      dispose: function () { root.classList.remove('is-static'); }
    };
  }

  const dimmer = gsap.timeline()
    .to(items.slice(1), { opacity: 1, color: accent, stagger: 0.5 })
    .to(items.slice(0, items.length - 1), { opacity: DIM, color: rest, stagger: 0.5 }, 0);

  // The scrub runs from the first word's centre to the last word's centre, so
  // the list's own height sets the scroll distance. No magic numbers.
  const trigger = ScrollTrigger.create({
    trigger: items[0],
    endTrigger: items[items.length - 1],
    start: 'center center',
    end: 'center center',
    animation: dimmer,
    scrub: 0.25,
    /* Scrolling stays free and smooth; the snap only settles the rest
       position onto a word once the gesture stops. Without it the list can
       come to rest halfway between two words, lit on neither. */
    snap: {
      snapTo: 1 / (items.length - 1),
      duration: { min: 0.12, max: 0.36 },
      delay: 0.04,
      ease: 'power2.inOut'
    },
    onUpdate: function (self) {
      // raw trigger progress, not the eased animation: the click target and
      // the panel should land on the word the moment it is level with the
      // prefix, not a quarter second later
      setActive(Math.round(self.progress * (items.length - 1)));
    }
  });

  return {
    refresh: function () { ScrollTrigger.refresh(); },
    dispose: function () {
      trigger.kill();
      dimmer.kill();
      if (items[active]) items[active].classList.remove('is-active');
      gsap.set(items, { clearProps: 'opacity,color' });
    }
  };
}
