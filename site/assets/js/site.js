/* Vaneholm: page behaviour that does not draw. Menu, word light, drag reel, film filter, copy buttons, concept form. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function each(sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function safe(name, fn) { try { fn(); } catch (e) { if (window.console) console.warn('vaneholm ' + name + ':', e && e.message); } }
  function data() { try { return JSON.parse(document.getElementById('vh-data').textContent); } catch (e) { return {}; } }

  function menu() {
    var btn = document.querySelector('.menu-btn'), panel = document.getElementById('menu');
    if (!btn || !panel) return;
    function set(open) { panel.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.textContent = open ? btn.dataset.close : btn.dataset.open; }
    btn.addEventListener('click', function () { set(panel.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth > 1100 && !panel.hidden) set(false); });
  }

  /* words go from 0.26 to full opacity as the heading crosses the screen; never hidden */
  function wordLight() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.lightwords'));
    if (!els.length || reduce) return;
    els.forEach(function (el) {
      var text = el.textContent.trim();
      el.setAttribute('aria-label', text);
      el.innerHTML = text.split(/\s+/).map(function (w) { return '<span class="w" aria-hidden="true">' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>'; }).join(' ');
      el._w = Array.prototype.slice.call(el.querySelectorAll('.w'));
    });
    function upd() {
      var vh = window.innerHeight || 800;
      els.forEach(function (el) {
        var b = el.getBoundingClientRect(), p = clamp((vh * 0.88 - b.top) / (vh * 0.5), 0, 1), n = el._w.length;
        el._w.forEach(function (w, i) { var k = clamp(p * (n + 2) - i, 0, 1); w.style.opacity = (0.26 + 0.74 * k).toFixed(3); });
      });
    }
    upd(); window.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd);
  }

  function reels() {
    var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    each('.reel-wrap', function (wrap) {
      var el = wrap.querySelector('.reel'), cur = wrap.querySelector('.dragcur');
      var down = false, sx = 0, sl = 0;
      el.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = el.scrollLeft; el.classList.add('dragging'); });
      window.addEventListener('pointermove', function (e) {
        if (cur && fine) { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }
        if (down) el.scrollLeft = sl - (e.clientX - sx);
      });
      window.addEventListener('pointerup', function () { if (down) { down = false; el.classList.remove('dragging'); } });
      el.addEventListener('dragstart', function (e) { e.preventDefault(); });
      if (cur && fine) {
        el.addEventListener('pointerenter', function () { cur.classList.add('on'); });
        el.addEventListener('pointerleave', function () { cur.classList.remove('on'); });
      }
    });
  }

  function filter() {
    var bar = document.querySelector('.chips'); if (!bar) return;
    var none = document.querySelector('.none');
    each('button', function (b) {
      b.addEventListener('click', function () {
        var t = b.dataset.type, n = 0;
        each('button', function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }, bar);
        each('.films-grid .card', function (c) { var ok = t === 'all' || c.dataset.type === t; c.hidden = !ok; if (ok) n++; });
        each('.archive tbody tr', function (r) { r.hidden = !(t === 'all' || r.dataset.type === t); });
        if (none) none.hidden = n > 0;
      });
    }, bar);
  }

  function copy() {
    var L = data().copy || { copy: 'Copy', copied: 'Copied', select: 'Select it' };
    each('[data-copy]', function (b) {
      b.addEventListener('click', function () {
        var src = document.getElementById(b.dataset.copy); if (!src) return;
        var text = src.textContent.trim();
        function done(ok) { b.textContent = ok ? L.copied : L.select; setTimeout(function () { b.textContent = L.copy; }, 1600); }
        function fallback() { var r = document.createRange(); r.selectNodeContents(src); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); done(false); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
        else fallback();
      });
    });
  }

  function forms() {
    each('form.concept', function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var st = f.querySelector('.status'); if (st) st.textContent = f.dataset.done;
      });
    });
  }

  function start() { [menu, wordLight, reels, filter, copy, forms].forEach(function (fn) { safe(fn.name, fn); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
