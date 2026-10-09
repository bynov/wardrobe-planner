/* Static-site behaviour: theme toggle (shared with the app via localStorage) and the FAQ accordion.
   The no-flash inline script in each <head> applies a stored theme before first paint; this file
   only wires the toggle button and keeps the theme-color metas in step with the effective theme. */
(function () {
  var KEY = 'wardrobe-planner:theme';
  var CYCLE = [null, 'light', 'dark']; // auto -> light -> dark -> auto
  var COLOR = { light: '#fefefd', dark: '#2a2927' }; // = --surface in each theme
  var root = document.documentElement;
  var metas = Array.prototype.slice.call(document.querySelectorAll('meta[name="theme-color"]'));
  var originals = metas.map(function (m) { return m.getAttribute('content'); });

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function write(v) {
    try {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  function apply(v) {
    if (v) root.dataset.theme = v;
    else delete root.dataset.theme;
    metas.forEach(function (m, i) {
      m.setAttribute('content', v ? COLOR[v] : originals[i]);
    });
    Array.prototype.forEach.call(document.querySelectorAll('button.theme'), function (b) {
      var label = b.getAttribute('data-' + (v || 'auto'));
      var span = b.querySelector('.theme-label');
      if (span && label) span.textContent = label;
    });
  }

  apply(read());

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button.theme');
    if (!b) return;
    var next = CYCLE[(CYCLE.indexOf(read()) + 1) % CYCLE.length];
    write(next);
    apply(next);
  });

  Array.prototype.forEach.call(document.querySelectorAll('.faq details'), function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      Array.prototype.forEach.call(d.parentNode.querySelectorAll('details'), function (o) {
        if (o !== d) o.open = false;
      });
    });
  });
})();
