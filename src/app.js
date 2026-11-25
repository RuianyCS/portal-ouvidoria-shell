import {createClient} from '@supabase/supabase-js';
const auth=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
const $=id=>document.getElementById(id),frame=$('view');
const PORTAL_LOGIN_AT='portal_login_at',SESSAO_MAX_MS=8*60*60*1000;
let session=null,sw=null,carregado='',tentativas=0;
const PREFIX='./__portal/';

function dentroDaJanela(){const t=Number(localStorage.getItem(PORTAL_LOGIN_AT)||0);if(!t)return true;return Date.now()-t<SESSAO_MAX_MS;}
function rota(){const q=new URLSearchParams(location.search);return {page:q.get('page')||'index.html',q:q.get('q')||''};}

function mostraLogin(msg=''){session=null;frame.removeAttribute('src');frame.hidden=true;$('internal').hidden=true;$('login').hidden=false;$('error').textContent=msg;}

async function registraWorker(){
  if(!('serviceWorker' in navigator))throw Error('Navegador sem suporte ao modo protegido.');
  sw=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller){
    await new Promise(ok=>{
      const t=setTimeout(ok,3000);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);ok();},{once:true});
    });
  }
  return sw;
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

function idbGrava(k,v){return new Promise((ok,no)=>{const r=indexedDB.open('portal-sw',1);
  r.onupgradeneeded=()=>{r.result.createObjectStore('kv')};
  r.onsuccess=()=>{const db=r.result;try{const t=db.transaction('kv','readwrite').objectStore('kv').put(v,k);t.onsuccess=()=>ok();t.onerror=()=>no(t.error)}catch(e){no(e)}};
  r.onerror=()=>no(r.error)})}

async function entregaToken(){
  if(!session)return;
  const token=session.access_token;
  try{await idbGrava('token',token)}catch(e){}
  if(!sw)return;
  const alvo=sw.active||sw.waiting||sw.installing;
  if(alvo)alvo.postMessage({type:'portal-token',token});
}

async function abreConteudo(){
  const r=rota();
  const url=PREFIX+r.page+(r.q?'?q='+encodeURIComponent(r.q):'');
  if(carregado===url)return;
  carregado=url;
  $('login').hidden=true;$('internal').hidden=false;frame.hidden=false;
  $('status').textContent='';
  frame.src=url;
}

let entrando=false;
async function entra(s){
  if(!s){mostraLogin();return;}
  if(entrando)return; entrando=true;
  try{
  if(!localStorage.getItem(PORTAL_LOGIN_AT))localStorage.setItem(PORTAL_LOGIN_AT,String(Date.now()));
  if(!dentroDaJanela()){encerraPorTempo();return;}
  session=s;
  await registraWorker();
  await entregaToken();
  await abreConteudo();
  } finally { entrando=false; }
}

function encerraPorTempo(){try{localStorage.removeItem(PORTAL_LOGIN_AT);}catch(e){}mostraLogin('Sessão de 8 horas encerrada. Entre novamente.');auth.auth.signOut({scope:'global'}).catch(()=>{});}

$('enter').onclick=async()=>{
  const redirect=new URL(location.href);redirect.search='';redirect.hash='';
  const {error}=await auth.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect.href,queryParams:{prompt:'select_account'}}});
  if(error)$('error').textContent=error.message;
};
$('exit').onclick=async()=>{try{localStorage.removeItem(PORTAL_LOGIN_AT);}catch(e){}mostraLogin();await auth.auth.signOut({scope:'global'});};

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
auth.auth.getSession().then(({data,error})=>{
setInterval(()=>{if(!session)return;if(!dentroDaJanela()){encerraPorTempo();return;}if(session.expires_at*1000<=Date.now())mostraLogin('Sessão expirada. Entre novamente.');else entregaToken();},60000);
