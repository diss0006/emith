/* ==========================================================================
   page.js
   --------------------------------------------------------------------------
   The subpage counterpart to main.js. About and Contact share the nav, the
   footer and the stylesheet with the homepage, but none of its opening
   sequence, so they load this instead: scroll reveals, the 3D button labels,
   and the contact form's mail handoff.

   Everything here is enhancement. Without it the pages still read, still
   navigate and still send mail; the reveals just show up already revealed,
   which is exactly what the `html.js` scoping gives a visitor with no
   JavaScript.
   ========================================================================== */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Every `.reveal` starts at opacity 0, scoped to html.js. On the homepage a
     watchdog in main.js strips that class if the intro ever stalls; these
     pages had no such net, so an IntersectionObserver that never delivered
     would leave the whole page blank with no way back. Four seconds without a
     single reveal firing is not a slow page, it is a broken one. */
  function watchdog() {
    setTimeout(function () {
      var items = document.querySelectorAll('.reveal');
      if (!items.length) return;
      var anyShown = Array.prototype.some.call(items, function (n) {
        return n.classList.contains('is-in');
      });
      if (!anyShown) document.documentElement.classList.remove('js');
    }, 4000);
  }

  /* ---- scroll reveals -------------------------------------------------- */
  function initReveals() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }

    watchdog();

    document.querySelectorAll('section').forEach(function (sec) {
      sec.querySelectorAll('.reveal').forEach(function (n, i) {
        n.style.setProperty('--d', Math.min(i, 5) * 80 + 'ms');
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    items.forEach(function (n) { io.observe(n); });
  }

  /* ---- 3D button labels ------------------------------------------------ */
  function initButtons() {
    if (!document.querySelector('.btn3d')) return;
    import('./buttons.js')
      .then(function (m) { m.initButtons(document); })
      .catch(function () { /* plain labels, no hover swap */ });
  }

  /* ---- contact form ----------------------------------------------------
     This is a static site with no backend, so the form composes a message and
     hands it to the visitor's mail client rather than pretending to submit.
     The form still degrades: with JS off it is a labelled set of fields above
     a plain mailto link that works on its own. */
  function initForm() {
    var form = document.querySelector('.cform');
    if (!form) return;
    var to = form.dataset.to;
    if (!to) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var from = (data.get('email') || '').toString().trim();
      var subject = (data.get('subject') || '').toString().trim() || 'Hello from emith.ca';
      var message = (data.get('message') || '').toString().trim();

      var body = message +
        '\n\n---\n' + (name ? 'From: ' + name + '\n' : '') + (from ? 'Reply to: ' + from : '');

      var href = 'mailto:' + to +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      var note = form.querySelector('.cform__note');
      if (note) note.textContent = 'Opening your mail app with this message ready to send.';
      window.location.href = href;
    });
  }

  function start() {
    initReveals();
    initButtons();
    initForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
