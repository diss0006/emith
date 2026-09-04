/* ==========================================================================
   main.js
   --------------------------------------------------------------------------
   Owns the opening sequence and the page's scroll reveals.

   The wordmark entry is pure GSAP on real DOM text. There is no WebGL and no
   canvas: the letters that animate are the same letters a screen reader and a
   crawler see, which is why there is no longer a separate fallback path to
   keep in sync with a 3D one.

   The entry is a tracking collapse behind a rising mask. Each letter sits in
   a clipping slot; the glyph rises out of its slot while the slot itself
   slides inward from a wider spread, and the whole wordmark resolves out of a
   short blur. Two transforms that never fight, because a slot's own overflow
   does not clip its own translation.

   Escape hatches, unchanged in spirit:
     1. no JS       -> every held state is scoped to `html.js`, set only by JS.
                       The page renders finished.
     2. no GSAP     -> bail() strips the held states and the inline styles.
     3. anything else -> a watchdog does the same after 9s.
   ========================================================================== */

(function () {
  'use strict';

  var html = document.documentElement;
  var body = document.body;

  var el = {
    navInner: document.querySelector('.site-nav__inner'),
    hero: document.querySelector('.hero'),
    wordmark: document.querySelector('.wordmark'),
    slots: document.querySelectorAll('.wm-slot'),
    glyphs: document.querySelectorAll('.wm-glyph'),
    rule: document.querySelector('.hero__rule'),
    taglineMask: document.querySelector('.tagline__mask'),
    tagline: document.querySelector('.tagline__mask > span'),
    cue: document.querySelector('.scroll-cue'),
    curtain: document.querySelector('.curtain'),
    mesh: document.getElementById('hero-mesh'),
    polybox: document.querySelector('.polybox'),
    polymask: document.querySelector('.polybox__mask'),
    logoSlot: document.querySelector('.wm-logo')
  };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;
  var mesh = null;
  var rotator = null;
  var reel = null;
  var brand = null;
  var preview = null;
  var timeline = null;
  var finished = false;

  function unlock() { body.classList.remove('is-intro'); }

  /* Hard reset. Removing the class alone is not enough once a timeline has
     been built: GSAP writes its held values as INLINE styles, which outlive
     the class and would leave the nav parked off-screen. None of these
     elements carry author inline styles, so clearing the attribute is safe. */
  function bail() {
    if (finished) return;
    finished = true;

    var animated = [el.navInner, el.rule, el.tagline, el.cue, el.curtain, el.wordmark];
    if (timeline) timeline.kill();
    if (gsap) {
      gsap.killTweensOf(animated);
      gsap.killTweensOf(el.slots);
      gsap.killTweensOf(el.glyphs);
    }
    animated.forEach(function (n) { if (n) n.removeAttribute('style'); });
    Array.prototype.forEach.call(el.slots, function (n) { n.removeAttribute('style'); });
    Array.prototype.forEach.call(el.glyphs, function (n) { n.removeAttribute('style'); });

    if (el.taglineMask) el.taglineMask.classList.add('is-open');
    html.classList.remove('js');
    unlock();

    // The intro failing says nothing about the field or the tagline, and a
    // missing GSAP would otherwise cost the hero its background entirely.
    startMesh();
    startShimmer();
    if (rotator) rotator.start();
    // the logo still has to fly on scroll even when the intro was abandoned
    if (brand) brand.activate();
    initScrollCue();
  }

  function done() {
    if (finished) return;
    finished = true;
    unlock();
    [el.navInner, el.rule, el.tagline, el.cue, el.curtain].forEach(function (n) {
      if (n) n.style.willChange = 'auto';
    });
    Array.prototype.forEach.call(el.slots, function (n) { n.style.willChange = 'auto'; });
    if (el.taglineMask) el.taglineMask.classList.add('is-open');

    startMesh();
    startShimmer();
    if (rotator) rotator.start();
    if (brand) brand.activate();
    initScrollCue();
  }

  /* The shimmer needs text-fill-color to go transparent and the letters to be
     at rest, so the gradient lines up across the whole word. Handing over only
     once the entry has settled keeps those two facts true. */
  function startShimmer() {
    if (reduced || !el.wordmark) return;
    el.wordmark.style.willChange = 'auto';
    el.wordmark.classList.add('is-shimmer');
  }

  /* The mesh is built and running from the very start, underneath the
     curtain. By the time the curtain drops it is already a settled, moving
     field, so the drop uncovers it instead of it arriving afterwards. It
     costs about half a millisecond a frame, against an intro that is only
     transforms, and it is the whole reason the reveal reads at all now that
     the curtain and the page are the same colour.

     `revealStarted` guards the one case this cannot cover: a module slow
     enough to land after the curtain has begun moving. That alone fades. */
  var meshModule = null;
  var revealStarted = false;

  function warmMesh() {
    if (reduced || !el.mesh || meshModule) return;
    meshModule = import('./neon-mesh.js').catch(function () { return null; });
  }

  function startMesh() {
    if (reduced || mesh || !el.mesh) return;
    warmMesh();
    meshModule
      .then(function (mod) {
        if (!mod || !mod.isEligible()) { el.mesh.remove(); return; }
        mesh = mod.createNeonMesh({ canvas: el.mesh, container: el.hero });
        if (!mesh) { el.mesh.remove(); return; }
        if (revealStarted) el.mesh.classList.add('is-late');
        el.mesh.classList.add('is-live');
      })
      .catch(function () { if (el.mesh) el.mesh.remove(); });
  }

  /* The reel is scroll-driven, so it must exist before the visitor can reach
     it, but it is below the fold and must not compete with the intro. Set up
     on idle, or on the next frame where that is unavailable. */
  function initReel() {
    var root = document.querySelector('.reel');
    if (!root || reduced || !gsap || !window.ScrollTrigger) return;
    var go = function () {
      import('./reel.js')
        .then(function (mod) {
          reel = mod.createReel({
            root: root,
            gsap: gsap,
            ScrollTrigger: window.ScrollTrigger,
            reduced: reduced
          });
        })
        .catch(function () { /* the words stay legible at full opacity */ });
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 300);
  }

  /* The buttons only need their labels split into characters; the animation
     itself is all stylesheet. Cheap enough to do straight away. */
  function initButtons() {
    if (!document.querySelector('.btn3d')) return;
    import('./buttons.js')
      .then(function (mod) { mod.initButtons(document); })
      .catch(function () { /* plain labels, no hover swap */ });
  }

  /* The hover preview is desktop-and-pointer only, and pure enhancement: the
     words link exactly the same way without it. */
  function initPreview() {
    var words = document.querySelectorAll('.reel__word');
    if (!words.length || reduced || !gsap) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)').matches) return;

    Promise.all([import('./preview.js'), import('./reel-themes.js')])
      .then(function (m) {
        preview = m[0].createPreview({
          words: Array.prototype.slice.call(words),
          themes: m[1].THEMES,
          gsap: gsap,
          ScrollTrigger: window.ScrollTrigger
        });
      })
      .catch(function () { /* the links still work */ });
  }

  /* The cue scrolls exactly far enough to centre the reel heading and no
     further, and fades out across that same distance so it is gone the moment
     it arrives. One measurement drives both. */
  function initScrollCue() {
    if (!el.cue) return;
    var lead = document.querySelector('.reel__lead');
    if (!lead) return;

    var target = function () {
      var r = lead.getBoundingClientRect();
      var y = r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
      return Math.max(0, Math.round(y));
    };

    el.cue.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: target(), behavior: reduced ? 'auto' : 'smooth' });
    });

    if (reduced || !gsap || !window.ScrollTrigger) return;
    window.ScrollTrigger.create({
      start: 0,
      end: function () { return Math.max(1, target()); },
      onUpdate: function (self) {
        gsap.set(el.cue, { opacity: 1 - self.progress });
        el.cue.style.pointerEvents = self.progress > 0.96 ? 'none' : '';
      }
    });
  }

  function initTagline() {
    if (reduced || !gsap || !el.polybox || !el.polymask) return;
    import('./text-rotate.js')
      .then(function (mod) {
        return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
          .then(function () { return mod; });
      })
      .then(function (mod) {
        rotator = mod.createTextRotate({ box: el.polybox, mask: el.polymask, gsap: gsap });
        if (!rotator) return;
        rotator.prime();
        if (finished) rotator.start();
      })
      .catch(function () { /* the box keeps its static word */ });
  }

  /* ------------------------------------------------------------ sequence */

  /* The clone has to exist before the timeline is built, so its entrance can
     be folded into the same tween sequence as the letters rather than chasing
     it afterwards. */
  function initBrandmark() {
    if (reduced || !gsap || !window.ScrollTrigger || !el.logoSlot || !el.navInner) {
      return Promise.resolve(null);
    }
    return import('./brandmark.js')
      .then(function (mod) {
        return mod.createBrandmark({
          source: el.logoSlot,
          navInner: el.navInner,
          navOuter: document.querySelector('.site-nav'),
          gsap: gsap,
          ScrollTrigger: window.ScrollTrigger
        });
      })
      // the logo simply stays in flow if this fails, which is a fine page
      .catch(function () { return null; });
  }

  function buildTimeline() {
    var tl = gsap.timeline({ onComplete: done });

    // The spread is derived from the rendered type size, so the collapse
    // reads identically at every viewport width instead of being a fixed
    // pixel gesture that looks huge on a phone and timid on a desktop.
    var fontSize = parseFloat(getComputedStyle(el.wordmark).fontSize) || 96;
    var spread = fontSize * 0.44;
    var mid = (el.slots.length - 1) / 2;

    gsap.set(el.wordmark, { filter: 'blur(9px)', opacity: 0 });
    gsap.set(el.slots, { x: function (i) { return (i - mid) * spread; } });
    gsap.set(el.glyphs, { yPercent: 108, opacity: 0 });

    tl.to(el.wordmark, { opacity: 1, duration: 0.30, ease: 'power2.out' }, 0);
    tl.to(el.wordmark, { filter: 'blur(0px)', duration: 0.85, ease: 'power3.out' }, 0);

    tl.to(el.slots, {
      x: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: { each: 0.055, from: 'center' }
    }, 0);

    tl.to(el.glyphs, {
      yPercent: 0,
      opacity: 1,
      duration: 1.0,
      ease: 'expo.out',
      stagger: { each: 0.055, from: 'center' }
    }, 0.04);

    if (brand) brand.enter(tl, 0);

    // The reveal still overlaps the letters landing rather than waiting for
    // them, so the two acts read as one gesture rather than a queue.
    return addReveal(tl, 0.62);
  }

  /* The curtain falls to become the dune, then the rule, the tagline, the nav
     and the scroll cue arrive in that order. Each is a hierarchy cue: the name
     lands first, its supporting line second, navigation last. */
  function addReveal(tl, at) {
    // Pin the transform channels GSAP will drive. The stylesheet expresses the
    // held state in percentages so it survives a font or viewport change
    // before JS runs, but GSAP would parse those back as pixel `y`, leaving a
    // `yPercent` tween with nothing to do. And scaleX(0) computes to
    // matrix(0,0,0,1,0,0), which cannot be decomposed back into a scale, so
    // the rule would read as already full width.
    gsap.set(el.curtain, { yPercent: 0, y: 0 });
    gsap.set(el.tagline, { yPercent: 110, y: 0 });
    gsap.set(el.navInner, { yPercent: -140, y: 0, opacity: 0 });
    gsap.set(el.rule, { scaleX: 0, opacity: 0 });

    // past this point the field is being uncovered, so a mesh that arrives
    // any later has to fade rather than appear
    tl.call(function () { revealStarted = true; }, null, at);

    tl.to(el.curtain, { yPercent: 74, duration: 0.85, ease: 'power4.inOut' }, at);
    tl.to(el.rule, { opacity: 1, scaleX: 1, duration: 0.56, ease: 'expo.out' }, at + 0.36);
    tl.to(el.tagline, { yPercent: 0, duration: 0.56, ease: 'expo.out' }, at + 0.48);
    tl.to(el.navInner, { opacity: 1, yPercent: 0, duration: 0.52, ease: 'expo.out' }, at + 0.60);
    tl.to(el.cue, { opacity: 1, duration: 0.60, ease: 'power2.out' }, at + 0.76);

    return tl;
  }

  /* -------------------------------------------------------------- reveals */

  function initReveals() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }

    document.querySelectorAll('section').forEach(function (sec) {
      sec.querySelectorAll('.reveal').forEach(function (n, i) {
        n.style.setProperty('--d', Math.min(i, 5) * 90 + 'ms');
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    items.forEach(function (n) { io.observe(n); });
  }

  /* ----------------------------------------------------------- skip intro */

  function allowSkip() {
    var events = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

    function skip(e) {
      if (e.type === 'keydown' && e.key === 'Tab') return;   // allow tabbing
      events.forEach(function (t) { window.removeEventListener(t, skip); });
      if (timeline && !finished) timeline.timeScale(4);
    }

    events.forEach(function (t) {
      window.addEventListener(t, skip, { passive: true });
    });
  }

  /* ------------------------------------------------------------------ run */

  function start() {
    initReveals();
    initTagline();
    initReel();
    initButtons();
    initPreview();

    if (reduced) {
      if (el.mesh) el.mesh.remove();
      if (el.taglineMask) el.taglineMask.classList.add('is-open');
      unlock();
      finished = true;
      return;
    }

    if (!gsap) { bail(); return; }

    window.scrollTo(0, 0);
    startMesh();                     // alive behind the curtain from the start
    var watchdog = setTimeout(bail, 9000);

    // The entry animates type, so it must not start against a fallback face
    // and reflow mid-flight. The wordmark is held hidden until then anyway.
    var fonts = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
      : Promise.resolve();
    var cap = new Promise(function (res) { setTimeout(res, 1200); });

    Promise.race([fonts, cap]).then(function () {
      return finished ? null : initBrandmark();
    }).then(function (b) {
      if (finished) return;
      brand = b;
      try {
        timeline = buildTimeline();
        allowSkip();
        timeline.eventCallback('onComplete', function () {
          clearTimeout(watchdog);
          done();
        });
      } catch (err) {
        clearTimeout(watchdog);
        bail();
      }
    }).catch(function () {
      clearTimeout(watchdog);
      bail();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
