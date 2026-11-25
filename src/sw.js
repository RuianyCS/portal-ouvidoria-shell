// Service worker do Portal da Ouvidoria.
// Intercepta /__portal/<caminho> e entrega o arquivo vindo do armazenamento
// privado (edge function portal-content), que exige sessão Google autorizada.
const DB='portal-sw',STORE='kv',KEYNAME='token';
function abre(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore(STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function pega(k){return abre().then(db=>new Promise((ok,no)=>{const t=db.transaction(STORE,'readonly').objectStore(STORE).get(k);t.onsuccess=()=>ok(t.result);t.onerror=()=>no(t.error)}))}
function grava(k,v){return abre().then(db=>new Promise((ok,no)=>{const t=db.transaction(STORE,'readwrite').objectStore(STORE).put(v,k);t.onsuccess=()=>ok();t.onerror=()=>no(t.error)}))}

const PREFIX=new URL('./__portal/',self.registration.scope).pathname;
const SUPA='__SUPABASE_URL__', ANON='__SUPABASE_ANON__';

const CACHE='portal-assets-v2';
const CACHEAVEL=/\.(html|css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|pdf)(\?.*)?$/i;
const TTL=6*3600*1000;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const nomes=await caches.keys();
  await Promise.all(nomes.filter(n=>n!==CACHE).map(n=>caches.delete(n)));
  await self.clients.claim();
})()));
self.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='portal-token'&&d.token)e.waitUntil(grava(KEYNAME,d.token));
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(!url.pathname.startsWith(PREFIX))return;
  let path=url.pathname.slice(PREFIX.length);
  if(!path)path='index.html';
  event.respondWith(serve(path,event.request));
});

function paginaErro(codigo,titulo,texto){
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+titulo+'</title>'
   +'<style>body{margin:0;font:16px/1.5 system-ui,-apple-system,sans-serif;background:#f7f9fb;color:#1d2733;display:grid;place-items:center;height:100vh}'
   +'.c{max-width:420px;padding:28px;background:#fff;border:1px solid #e3e9f0;border-radius:14px;text-align:center}'
   +'h1{font-size:1.1rem;margin:0 0 8px;color:#0f3d63}p{margin:0;color:#5b6b7c;font-size:.92rem}</style></head>'
   +'<body data-portal-erro="'+codigo+'"><div class="c"><h1>'+titulo+'</h1><p>'+texto+'</p></div></body></html>';
  return new Response(html,{status:codigo,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

async function serve(path,req){
 try{
  if(CACHEAVEL.test(path)){
    try{
      const c=await caches.open(CACHE);
      const hit=await c.match(req,{ignoreSearch:true});
      if(hit){
        const idade=Date.now()-Number(hit.headers.get('x-cached-at')||0);
        if(idade<TTL)return hit;
      }
    }catch(e){}
  }
  let token=null;
  try{token=await pega(KEYNAME)}catch(e){}
  if(!token)return paginaErro(401,'Sessao necessaria','Entre com uma conta autorizada.');
  let r;
  try{
    r=await fetch(SUPA+'/functions/v1/portal-content',{method:'POST',
      headers:{'Authorization':'Bearer '+token,apikey:ANON,'Content-Type':'application/json'},
      body:JSON.stringify({path})});
  }catch(e){
    return new Response('sem conexao',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
  }
  if(!r.ok)return paginaErro(r.status,r.status===403?'Acesso nao liberado':'Falha ao carregar',
    r.status===403?'Este e-mail nao esta na lista de acesso do Portal da Ouvidoria.':'Tente novamente em instantes.');
  const j=await r.json();
  const bin=atob(j.body),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const resp=new Response(bytes,{headers:{'content-type':j.mime||'application/octet-stream','cache-control':'no-store'}});
  if(CACHEAVEL.test(path)){
    try{
      const c=await caches.open(CACHE);
      const copia=resp.clone();
      const cab=new Headers(copia.headers);cab.set('x-cached-at',String(Date.now()));
      const corpo=await copia.blob();
      await c.put(new Request(new URL(req.url).origin+'/__portal/'+path),new Response(corpo,{headers:cab}));
    }catch(e){}
  }
  return resp;
 }catch(err){
  return new Response('sw-erro: '+(err&&err.message?err.message:String(err)),{status:500,headers:{'content-type':'text/plain; charset=utf-8'}});
 }
}
