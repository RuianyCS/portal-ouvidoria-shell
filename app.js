// Portal da Ouvidoria — bootstrap público (v2026-10-27b)
// Este arquivo substitui o antigo bundle OAuth que vivia na raiz.
// Objetivo: quem tiver o index.html antigo em cache também é levado ao portal público.
(function () {
  try {
    Object.keys(localStorage).forEach(function (k) {
      if (/^sb-|supabase|portal_login_at|portal_/i.test(k)) localStorage.removeItem(k);
    });
    sessionStorage.clear();
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
    }
  } catch (e) {}
  var base = '/portal-ouvidoria-shell/p/index.html';
  var q = location.search || '';
  location.replace(base + q + (q ? '&' : '?') + 'v=20261027b');
})();
