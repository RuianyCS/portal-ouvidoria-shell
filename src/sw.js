// Service worker do Portal da Ouvidoria.
// Intercepta /__portal/<caminho> e entrega o arquivo vindo do armazenamento
// privado (edge function portal-content), que exige sessão Google autorizada.
const DB='portal-sw',STORE='kv',KEYNAME='token';
function abre(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore(STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function pega(k){return abre().then(db=>new Promise((ok,no)=>{const t=db.transaction(STORE,'readonly').objectStore(STORE).get(k);t.onsuccess=()=>ok(t.result);t.onerror=()=>no(t.error)}))}
function grava(k,v){return abre().then(db=>new Promise((ok,no)=>{const t=db.transaction(STORE,'readwrite').objectStore(STORE).put(v,k);t.onsuccess=()=>ok();t.onerror=()=>no(t.error)}))}

const PREFIX=new URL('./__portal/',self.registration.scope).pathname;
const SUPA='__SUPABASE_URL__', ANON='__SUPABASE_ANON__';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='portal-token'&&d.token)e.waitUntil(grava(KEYNAME,d.token));
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(!url.pathname.startsWith(PREFIX))return;
  let path=url.pathname.slice(PREFIX.length);
  if(!path)path='index.html';
  event.respondWith(serve(path));
});

async function serve(path){
 try{
  let token=null;
  try{token=await pega(KEYNAME)}catch(e){}
  if(!token)return new Response('login necessario',{status:401,headers:{'content-type':'text/plain; charset=utf-8'}});
  let r;
  try{
    r=await fetch(SUPA+'/functions/v1/portal-content',{method:'POST',
      headers:{'Authorization':'Bearer '+token,apikey:ANON,'Content-Type':'application/json'},
      body:JSON.stringify({path})});
  }catch(e){
    return new Response('sem conexao',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
  }
  if(!r.ok)return new Response('acesso negado ('+r.status+')',{status:r.status,headers:{'content-type':'text/plain; charset=utf-8'}});
  const j=await r.json();
  const bin=atob(j.body),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new Response(bytes,{headers:{'content-type':j.mime||'application/octet-stream','cache-control':'no-store'}});
 }catch(err){
  return new Response('sw-erro: '+(err&&err.message?err.message:String(err)),{status:500,headers:{'content-type':'text/plain; charset=utf-8'}});
 }
}
