import {createClient} from '@supabase/supabase-js';
const auth=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
const $=id=>document.getElementById(id),frame=$('view');
const PORTAL_LOGIN_AT='portal_login_at',SESSAO_MAX_MS=8*60*60*1000,PREFIX='./__portal/';
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
    const doc=frame.contentDocument;
    if(!doc)return;
    const alvos=[...new Set([...doc.querySelectorAll('.side a[href]')]
      .map(a=>a.getAttribute('href'))
      .filter(h=>h&&!h.startsWith('#')&&!h.startsWith('http'))
      .map(h=>PREFIX+h.replace(/^\.\//,'')))];
    for(const u of alvos){
      try{await fetch(u,{cache:'no-store'})}catch(e){}
      await new Promise(r=>setTimeout(r,120));
    }
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

async function entra(s){
  if(!s){mostraLogin();return;}
  if(entrando)return;
  entrando=true;
  try{
    if(!localStorage.getItem(PORTAL_LOGIN_AT))localStorage.setItem(PORTAL_LOGIN_AT,String(Date.now()));
    if(!dentroDaJanela()){encerraPorTempo();return;}
    session=s;
    await registraWorker();
    await entregaToken();
    await abreConteudo();
    setTimeout(aquecerCache,2500);
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

consomeHash().then(ok=>{
  if(ok&&window.opener&&window.opener!==window){
    try{window.opener.postMessage({type:'portal-login-ok'},'*')}catch(e){}
    setTimeout(()=>{try{window.close()}catch(e){}},400);
    return;
  }
  if(!ok)auth.auth.getSession().then(({data})=>entra(data.session));
});

window.addEventListener('message',e=>{
  if(e.data&&e.data.type==='portal-login-ok')auth.auth.getSession().then(({data})=>entra(data.session));
});
window.addEventListener('storage',e=>{
  if(e.key&&e.key.indexOf('-auth-token')>=0&&e.newValue)auth.auth.getSession().then(({data})=>entra(data.session));
});

setInterval(()=>{
  if(!session)return;
  if(!dentroDaJanela()){encerraPorTempo();return;}
  if(session.expires_at*1000<=Date.now())mostraLogin('Sessão expirada. Entre novamente.');
  else entregaToken();
},60000);
