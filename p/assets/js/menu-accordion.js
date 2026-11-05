/* Menu lateral em accordion: mantem o grupo da pagina atual aberto, restaura os
   grupos abertos na sessao e mantem o item ativo visivel sem mover a pagina. */
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;
  var KEY = 'portal-menu-grupos';
  var grupos = [].slice.call(nav.querySelectorAll('details.grp'));

  function salvar() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(grupos.map(function (g) {
        return { t: (g.querySelector('.grp-t') || {}).textContent || '', o: g.open };
      })));
    } catch (e) {}
  }

  var salvo = null;
  try { salvo = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}

  var temAtivo = grupos.some(function (g) { return !!g.querySelector('a.item.ativa'); });

  grupos.forEach(function (g) {
    if (g.querySelector('a.item.ativa')) { g.open = true; return; }
    if (!salvo || !temAtivo) return;
    var txt = (g.querySelector('.grp-t') || {}).textContent || '';
    for (var i = 0; i < salvo.length; i++) {
      if (salvo[i] && salvo[i].t === txt) { g.open = !!salvo[i].o; break; }
    }
  });

  // atalho para a visao geral da area nao deve alternar o grupo
  nav.querySelectorAll('.grp-abrir').forEach(function (a) {
    a.addEventListener('click', function (ev) { ev.stopPropagation(); });
  });

  grupos.forEach(function (g) { g.addEventListener('toggle', salvar); });

  // item ativo visivel dentro do menu, sem rolar a pagina
  var ativa = nav.querySelector('a.item.ativa');
  if (ativa) {
    var topoItem = ativa.offsetTop, altura = ativa.offsetHeight;
    if (topoItem < nav.scrollTop || topoItem + altura > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = Math.max(0, topoItem - nav.clientHeight / 2 + altura / 2);
    }
  }
})();
