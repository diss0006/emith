/* ==========================================================================
   buttons.js
   --------------------------------------------------------------------------
   Splits each 3D button's two labels into per-character spans and stamps the
   stagger index on them, which is what the hover animation in the stylesheet
   animates against.

   Done here rather than in the markup so the HTML carries plain readable
   labels: without JavaScript the button still says what it does, it simply
   does not swap text on hover.
   ========================================================================== */

function split(host, label) {
  host.textContent = '';
  const chars = Array.from(label);
  chars.forEach(function (ch, i) {
    const s = document.createElement('span');
    // a space collapses to nothing inside an inline-block, so keep it hard
    s.textContent = ch === ' ' ? ' ' : ch;
    s.style.setProperty('--i', String(i + 1));
    host.appendChild(s);
  });
}

export function initButtons(root) {
  const scope = root || document;
  const buttons = Array.prototype.slice.call(scope.querySelectorAll('.btn3d'));

  buttons.forEach(function (btn) {
    const a = btn.querySelector('.btn3d__chars--a');
    const b = btn.querySelector('.btn3d__chars--b');
    if (!a) return;

    const labelA = (a.dataset.label || a.textContent || '').trim();
    const labelB = (btn.dataset.alt || '').trim();

    split(a, labelA);
    if (b && labelB) {
      b.setAttribute('aria-hidden', 'true');
      split(b, labelB);
    } else if (b) {
      b.remove();
    }
  });

  return buttons.length;
}
