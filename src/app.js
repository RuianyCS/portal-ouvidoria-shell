import {createClient} from '@supabase/supabase-js';
const auth=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
const $=id=>document.getElementById(id),frame=$('view');
const PORTAL_LOGIN_AT='portal_login_at',SESSAO_MAX_MS=8*60*60*1000,PREFIX='./__portal/';
const REF=(()=>{try{return new URL(SUPABASE_URL).hostname.split('.')[0]}catch(e){return ''}})();
const CHAVE_TOKEN='sb-'+REF+'-auth-token';
let session=null,sw=null,carregado='',tentativas=0,entrando=false;
const emIframe=(()=>{try{return window.top!==window.self}catch(e){return true}})();

function dentroDaJanela(){const t=Number(localStorage.getItem(PORTAL_LOGIN_AT)||0);if(!t)return true;return Date.now()-t<SESSAO_MAX_MS;}
function rota(){const q=new URLSearchParams(location.search);return {page:q.get('page')||'index.html',q:q.get('q')||''};}
function mostraLogin(msg=''){session=null;frame.removeAttribute('src');frame.hidden=true;$('internal').hidden=true;$('login').hidden=false;$('error').textContent=msg;}

async function registraWorker(){
  if(!('serviceWorker' in navigator))throw Error('Navegador sem suporte ao modo protegido.');
  sw=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  try{sw.update()}catch(e){}
  if(!navigator.serviceWorker.controller){
    await new Promise(ok=>{
      const t=setTimeout(ok,3000);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);ok();},{once:true});
    });
  }
  return sw;
}

function idbGrava(k,v){return new Promise((ok,no)=>{
  const r=indexedDB.open('portal-sw',1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('kv'))r.result.createObjectStore('kv')};
  r.onsuccess=()=>{const db=r.result;
    try{const t=db.transaction('kv','readwrite').objectStore('kv').put(v,k);t.onsuccess=()=>ok();t.onerror=()=>no(t.error)}catch(e){no(e)}};
  r.onerror=()=>no(r.error)})}

async function entregaToken(){
  if(!session)return;
  const token=session.access_token;
  try{await idbGrava('token',token)}catch(e){}
  if(!sw)return;
  const alvo=sw.active||sw.waiting||sw.installing;
  if(alvo)alvo.postMessage({type:'portal-token',token});
}

async function consomeHash(){
  const h=location.hash||'';
  if(h.indexOf('access_token=')<0)return false;
  const p=new URLSearchParams(h.slice(1));
  const at=p.get('access_token'),rt=p.get('refresh_token');
  if(!at||!rt)return false;
  try{
    const {data,error}=await auth.auth.setSession({access_token:at,refresh_token:rt});
    history.replaceState({},'',location.pathname+location.search);
    return !error&&!!data.session;
  }catch(e){return false;}
}

async function aquecerCache(){
  try{
    try{
    const t=frame.contentDocument&&frame.contentDocument.title;
    if(t&&t!==document.title)document.title=t;
  }catch(e){}
  const doc=frame.contentDocument;
    if(!doc)return;
    const alvos=[...new Set([...doc.querySelectorAll('.side a[href]')]
      .map(a=>a.getAttribute('href'))
      .filter(h=>h&&!h.startsWith('#')&&!h.startsWith('http'))
      .map(h=>PREFIX+h.replace(/^\.\//,'')))];
    let i=0;
    const operario=async()=>{
      while(i<alvos.length){
        const u=alvos[i++];
        try{await fetch(u,{cache:'no-store'})}catch(e){}
      }
    };
    await Promise.all([operario(),operario(),operario()]);
  }catch(e){}
}

async function abreConteudo(){
  const r=rota();
  const url=PREFIX+r.page+(r.q?'?q='+encodeURIComponent(r.q):'');
  $('login').hidden=true;$('internal').hidden=false;frame.hidden=false;$('status').textContent='';
  if(carregado===url)return;
  carregado=url;
  frame.src=url;
}

async function fechaPopupSeLogin(){
  if(!(window.opener&&window.opener!==window))return false;
  if(session&&session.access_token){
    // sessao pode ter sido revogada (logout em outra janela): valida antes de repassar
    let valida=true;
    try{
      const {data,error}=await auth.auth.getUser(session.access_token);
      valida=!error&&!!data.user;
    }catch(e){valida=false;}
    if(!valida){
      try{await auth.auth.signOut({scope:'local'})}catch(e){}
      try{localStorage.removeItem(PORTAL_LOGIN_AT)}catch(e){}
      mostraLogin('Sessão anterior encerrada. Entre novamente.');
      return false;
    }
    try{
      window.opener.postMessage({
        type:'portal-sessao',
        access_token:session.access_token,
        refresh_token:session.refresh_token
      },'*');
    }catch(e){}
  }else{
    try{window.opener.postMessage({type:'portal-login-ok'},'*')}catch(e){}
  }
  setTimeout(()=>{try{window.close()}catch(e){}},400);
  return true;
}

async function entra(s){
  if(!s){mostraLogin();return;}
  if(entrando)return;
  entrando=true;
  try{
    if(!localStorage.getItem(PORTAL_LOGIN_AT))localStorage.setItem(PORTAL_LOGIN_AT,String(Date.now()));
    if(!dentroDaJanela()){encerraPorTempo();return;}
    session=s;
    if(await fechaPopupSeLogin())return;
    await registraWorker();
    await entregaToken();
    await abreConteudo();
    setTimeout(aquecerCache,600);
  }catch(e){
    $('status').textContent='Não foi possível abrir o Portal agora. Recarregue a página.';
  }finally{entrando=false;}
}

function encerraPorTempo(){
  try{localStorage.removeItem(PORTAL_LOGIN_AT);}catch(e){}
  mostraLogin('Sessão de 8 horas encerrada. Entre novamente.');
  auth.auth.signOut({scope:'global'}).catch(()=>{});
}

$('enter').onclick=async()=>{
  const redirect=new URL(location.href);redirect.search='';redirect.hash='';
  const opcoes={redirectTo:redirect.href,queryParams:{prompt:'select_account'}};
  if(emIframe){
    opcoes.skipBrowserRedirect=true;
    const {data,error}=await auth.auth.signInWithOAuth({provider:'google',options:opcoes});
    if(error){$('error').textContent=error.message;return;}
    const pop=window.open(data.url,'portal-login','width=520,height=700');
    if(!pop)$('error').textContent='Permita janelas pop-up para entrar.';
    return;
  }
  const {error}=await auth.auth.signInWithOAuth({provider:'google',options:opcoes});
  if(error)$('error').textContent=error.message;
};
$('exit').onclick=async()=>{
  try{localStorage.removeItem(PORTAL_LOGIN_AT);}catch(e){}
  mostraLogin();
  await auth.auth.signOut({scope:'global'});
};

frame.addEventListener('load',()=>{
  try{
    const loc=frame.contentWindow.location;
    if(loc&&loc.pathname.indexOf('/__portal/')>=0){
      const p=loc.pathname.split('/__portal/')[1]||'index.html';
      const u=new URL(location.href);u.search='';u.searchParams.set('page',p);
      const q=new URLSearchParams(loc.search).get('q');if(q)u.searchParams.set('q',q);
      history.replaceState({},'',u);
    }
  }catch(e){}
  const doc=frame.contentDocument;
  const codigo=doc&&doc.body?doc.body.getAttribute('data-portal-erro'):null;
  if(codigo==='401'&&session&&tentativas<2){
    tentativas++;
    entregaToken().then(()=>{carregado='';abreConteudo();});
    return;
  }
  if(codigo){
    mostraLogin(codigo==='403'?'Este e-mail não tem acesso liberado. Entre com uma conta autorizada.':'Sessão expirada. Entre novamente.');
    try{localStorage.removeItem(PORTAL_LOGIN_AT);}catch(e){}
    auth.auth.signOut({scope:'local'}).catch(()=>{});
  }
});

auth.auth.onAuthStateChange((ev,s)=>{
  if(!s){
    if(ev==='SIGNED_OUT'&&!$('error').textContent)mostraLogin();
    return;
  }
  setTimeout(()=>entra(s),0);
});

consomeHash().then(async ok=>{
  if(ok&&await fechaPopupSeLogin())return;
  if(!ok)auth.auth.getSession().then(({data})=>entra(data.session));
});

// A sessao nasce em outra janela (popup de login). O client deste iframe mantem
// a sessao em memoria, entao getSession() continua nulo: precisamos ler o
// localStorage e adotar a sessao explicitamente.
function leSessaoStorage(){
  try{
    const raw=localStorage.getItem(CHAVE_TOKEN);
    if(!raw)return null;
    const d=JSON.parse(raw);
    if(d&&d.access_token&&d.refresh_token)return {access_token:d.access_token,refresh_token:d.refresh_token};
  }catch(e){}
  return null;
}

let adotando=false;
async function adotaSessaoDoStorage(){
  if(session||adotando)return false;
  const s=leSessaoStorage();
  if(!s)return false;
  adotando=true;
  try{
    const {data,error}=await auth.auth.setSession(s);
    if(error||!data.session)return false;
    await entra(data.session);
    return true;
  }catch(e){return false;}finally{adotando=false;}
}

window.addEventListener('message',async e=>{
  const d=e.data||{};
  if(d.type==='portal-sessao'&&d.access_token&&d.refresh_token){
    try{
      const {data,error}=await auth.auth.setSession({access_token:d.access_token,refresh_token:d.refresh_token});
      if(!error&&data.session)await entra(data.session);
    }catch(err){}
    return;
  }
  if(d.type==='portal-login-ok')adotaSessaoDoStorage();
});
window.addEventListener('storage',e=>{
  if(e.key&&e.key.indexOf('-auth-token')>=0&&e.newValue)adotaSessaoDoStorage();
});

setInterval(()=>{
  if(!session){adotaSessaoDoStorage();return;}
  if(!dentroDaJanela()){encerraPorTempo();return;}
  if(session.expires_at*1000<=Date.now())mostraLogin('Sessão expirada. Entre novamente.');
  else entregaToken();
},60000);
