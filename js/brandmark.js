/* ==========================================================================
   brandmark.js
   --------------------------------------------------------------------------
   The logo flies from the head of the wordmark up into the nav as you leave
   the top of the page, and flies back when you return.

   The logo lives in the markup INSIDE the wordmark, in flow. That is the state
   a visitor gets with no JavaScript and under reduced motion: a logo sitting
   where it belongs. When motion is allowed this module clones it into a fixed
   layer, hides the original (keeping its space so the wordmark does not
   reflow), and drives the clone between two measured rectangles.

   Two details matter:

   1. The hero end of the journey MOVES. It scrolls away at 1:1 while the nav
      end is fixed, so interpolating between two frozen points would leave the
      logo sliding against the very content it is supposed to be leaving. The
      hero anchor is therefore recomputed from live scroll each frame, and only
      the destination is constant.

   2. Docking has to widen the nav without laying it out every frame. Rather
      than animating a spacer's width, the nav row is TRANSLATED right by half
      the logo's footprint while the logo lands to its left. The arithmetic
      works out so the finished group is centred on the same axis the row
      occupied on its own, and nothing but transforms move.
   ========================================================================== */

const NAV_SIZE = 40;    // logo side length once docked
const NAV_GAP = 12;     // space between logo and the Discover me pill

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

export function createBrandmark({ source, navInner, navOuter, gsap, ScrollTrigger }) {
  if (!source || !navInner || !navOuter || !gsap || !ScrollTrigger) return null;

  gsap.registerPlugin(ScrollTrigger);

  // The flying copy is a real button, because once it lands in the nav it is
  // one: a home control sitting among the other nav controls. It is inert and
  // hidden from assistive tech until it docks.
  const mark = document.createElement('button');
  mark.type = 'button';
  mark.className = 'brandmark';
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('tabindex', '-1');
  mark.setAttribute('aria-label', 'Back to top');
  mark.innerHTML = source.innerHTML;
  mark.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  });
  document.body.appendChild(mark);

  function reduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // the original keeps its space so the wordmark does not reflow when the
  // logo leaves; only its ink is hidden
  source.style.visibility = 'hidden';

  const svg = mark.querySelector('.brandmark__svg');
  const glyph = mark.querySelector('.brandmark__glyph');

  const shift = (NAV_SIZE + NAV_GAP) / 2;
  let base = null;
  let trigger = null;
  let isDocked = false;
  let navWatch = null;

  function measure() {
    // Measure the OUTER nav, not the row inside it. The row carries the
    // intro's held transform (translateY(-140%)) and later the docking shift,
    // so reading it can land the destination off the top of the screen. The
    // outer element is never animated, and a child's transform does not move
    // its parent's border box, so this is the row's resting rectangle.
    gsap.set(navInner, { x: 0 });
    const n = navOuter.getBoundingClientRect();
    const h = source.getBoundingClientRect();

    base = {
      heroX: h.left,
      heroDocY: h.top + window.scrollY,
      heroSize: h.width || 1,
      // the group stays centred on the row's own axis: see the header note
      navX: n.left - shift,
      navY: n.top + (n.height - NAV_SIZE) / 2
    };

    gsap.set(mark, { width: base.heroSize, height: base.heroSize });
  }

  function apply(progress, scrolled) {
    if (!base) return;
    const e = smooth(progress);
    const heroY = base.heroDocY - scrolled;

    gsap.set(mark, {
      x: lerp(base.heroX, base.navX, e),
      y: lerp(heroY, base.navY, e),
      scale: lerp(1, NAV_SIZE / base.heroSize, e)
    });
    gsap.set(navInner, { x: shift * e });

    // Only a docked logo is a button. Mid-flight it is decoration, and over
    // the hero it would sit on top of the wordmark it is part of.
    const docked = progress > 0.92;
    if (docked !== isDocked) {
      isDocked = docked;
      mark.classList.toggle('is-docked', docked);
      mark.setAttribute('aria-hidden', docked ? 'false' : 'true');
      mark.setAttribute('tabindex', docked ? '0' : '-1');
    }
  }

  /* Re-read the nav and put the logo back where it belongs. Cheap: one
     getBoundingClientRect on a small fixed element. */
  function resync() {
    if (!trigger) return;
    measure();
    apply(trigger.progress, trigger.scroll());
  }

  let follow = 0;
  let settle = 0;

  function followNav() {
    follow = requestAnimationFrame(followNav);
    resync();
  }

  function onNavEnter() {
    clearTimeout(settle);
    resync();                       // react on the first frame, not the last
    if (!follow) followNav();       // then track the label expanding
  }

  function onNavLeave() {
    cancelAnimationFrame(follow);
    follow = 0;
    // the label collapse is a 450ms transition; catch its resting width
    clearTimeout(settle);
    settle = setTimeout(resync, 520);
  }

  function build() {
    measure();
    if (trigger) trigger.kill();
    trigger = ScrollTrigger.create({
      start: 0,
      end: function () { return Math.round(window.innerHeight * 0.55); },
      onUpdate: function (self) { apply(self.progress, self.scroll()); },
      onRefresh: function (self) { measure(); apply(self.progress, self.scroll()); }
    });
    apply(trigger.progress, trigger.scroll());
  }

  // Size and park the clone immediately. Without this it sits at the SVG's
  // intrinsic 300px at the top-left corner until the first measure, which is
  // exactly what a visitor would see on any path that never reaches
  // activate(). Transforms do not affect layout, so the slot's rect is its
  // resting position whether or not the intro has run.
  measure();
  apply(0, window.scrollY);

  return {
    /* Folded into the intro timeline so the logo assembles alongside the
       letters rather than after them: the disc swings in and scales up while
       the tracking collapses, and the glyph prints onto it as it lands. */
    enter(tl, at) {
      gsap.set(mark, { autoAlpha: 0 });
      gsap.set(svg, { rotate: -170, scale: 0.28, transformOrigin: '50% 50%' });
      gsap.set(glyph, { opacity: 0 });

      tl.to(mark, { autoAlpha: 1, duration: 0.22, ease: 'power2.out' }, at);
      tl.to(svg, {
        rotate: 0, scale: 1,
        duration: 1.15, ease: 'expo.out'
      }, at);
      tl.to(glyph, { opacity: 1, duration: 0.5, ease: 'power2.out' }, at + 0.42);
    },

    /* Only wire the scroll flight once the intro is done. Before that the
       page cannot scroll anyway, and measuring mid-animation would read the
       wordmark's transformed position rather than its resting one. */
    activate() {
      build();
      window.addEventListener('resize', build, { passive: true });

      /* The nav row grows when a nav icon expands its label on hover, and the
         row is centred, so its left edge moves out from under the logo. The
         cached destination has to be refreshed while that happens.

         Two mechanisms, because neither alone is enough. A ResizeObserver
         catches any width change whatever caused it, but its callbacks are
         delivered on the rendering lifecycle, so it is silent in a tab that
         is not painting. Pointer enter/leave on the nav gives an immediate
         re-measure plus a follow loop for the 450ms the label takes to
         expand, which no observer timing can miss. */
      if ('ResizeObserver' in window) {
        navWatch = new ResizeObserver(resync);
        navWatch.observe(navOuter);
      }

      navOuter.addEventListener('pointerenter', onNavEnter);
      navOuter.addEventListener('pointerleave', onNavLeave);
    },

    dispose() {
      if (trigger) trigger.kill();
      if (navWatch) navWatch.disconnect();
      cancelAnimationFrame(follow);
      clearTimeout(settle);
      navOuter.removeEventListener('pointerenter', onNavEnter);
      navOuter.removeEventListener('pointerleave', onNavLeave);
      window.removeEventListener('resize', build);
      gsap.set(navInner, { x: 0 });
      source.style.visibility = '';
      mark.remove();
    }
  };
}
