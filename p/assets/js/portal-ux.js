/* portal-ux.js - contador "X de Y" das buscas locais e estado da arvore */
(function(){
  function liga(idCampo, idCont){
    var c=document.getElementById(idCampo), o=document.getElementById(idCont);
    if(!c||!o||c.dataset.ux) return; c.dataset.ux='1';
    var txt0=o.textContent.trim(), m=txt0.match(/(\\d[\\d.]*)/g)||[];
    var base=txt0;
    c.addEventListener('input', function(){
      var q=c.value.trim().toLowerCase(), alvos=document.querySelectorAll('.fl,.fcard,.doc-item,.linha,details.fl');
      if(!q){ o.textContent=base; return; }
      var vis=0,tot=0;
      alvos.forEach(function(a){
        var hit=a.textContent.toLowerCase().indexOf(q)>-1;
        a.style.display=hit?'':'none'; tot++; if(hit) vis++;
      });
      o.textContent=vis+' de '+tot+' resultados';
    });
  }
  liga('f-drives','c-drives'); liga('f-trein','c-trein');
})();
