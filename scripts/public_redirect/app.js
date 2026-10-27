// Portal da Ouvidoria — bootstrap público (v2026-10-27c)
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
  location.replace('/portal-ouvidoria-shell/p/index.html?v=20261027c');
})();
