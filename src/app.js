import {createClient} from '@supabase/supabase-js';
const auth=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
const $=id=>document.getElementById(id),frame=$('view');let session=null,generation=0,current='index.html',channel='';
function clear(message=''){session=null;generation++;frame.srcdoc='';$('internal').hidden=true;$('login').hidden=false;$('error').textContent=message;}
async function resource(path){
 const r=await fetch(SUPABASE_URL+'/functions/v1/portal-content',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({path})});
 if(r.status===401||r.status===403){clear('Sessão ausente, expirada ou acesso não autorizado.');throw Error('login_required');}
 if(!r.ok)throw Error('Conteúdo temporariamente indisponível ('+r.status+').');
 const result=await r.json();return {mime:result.mime,text:new TextDecoder().decode(Uint8Array.from(atob(result.body),c=>c.charCodeAt(0)))};
}
function route(){const q=new URLSearchParams(location.search);return {page:q.get('page')||'index.html',q:q.get('q')||'',hash:location.hash};}
async function navigate(page,q='',hash='',push=true){
 if(!session)return;const gen=++generation;current=page;channel=crypto.randomUUID();const active=channel;$('status').textContent='Carregando conteúdo protegido…';
 try{const data=await resource(page);if(gen!==generation||!session)return;
 const bootstrap=`<base href="https://portal.invalid/${page}"><script>(function(){const ch=${JSON.stringify(active)},page=${JSON.stringify(page)},query=${JSON.stringify(q)},pending={};let seq=0;window.PORTAL_QUERY=query;window.addEventListener('message',e=>{if(e.source!==parent||e.data?.channel!==ch)return;const p=pending[e.data.id];if(p){delete pending[e.data.id];e.data.error?p.reject(Error(e.data.error)):p.resolve(new Response(e.data.text,{headers:{'Content-Type':e.data.mime}}));}});window.fetch=(input)=>new Promise((resolve,reject)=>{const id=++seq,u=new URL(input,document.baseURI);pending[id]={resolve,reject};parent.postMessage({channel:ch,type:'resource',id,path:u.pathname.slice(1)},'*');});function go(url){const u=new URL(url,document.baseURI);if(u.host!=='portal.invalid')return false;parent.postMessage({channel:ch,type:'navigate',path:u.pathname.slice(1),q:u.searchParams.get('q')||'',hash:u.hash},'*');return true;}document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;if(a.getAttribute('href')?.startsWith('#'))return;if(go(a.href))e.preventDefault();});document.addEventListener('submit',e=>{const f=e.target;const u=new URL(f.action,document.baseURI);for(const [k,v] of new FormData(f))u.searchParams.set(k,v);if(go(u.href))e.preventDefault();});})()<\/script>`;
 const html=data.text.replace('new URLSearchParams(location.search).get("q")','window.PORTAL_QUERY').replace(/<head([^>]*)>/i,'<head$1>'+bootstrap);
 frame.srcdoc=html;$('status').textContent='';$('login').hidden=true;$('internal').hidden=false;
 if(push){const u=new URL(location.href);u.search='';u.searchParams.set('page',page);if(q)u.searchParams.set('q',q);u.hash=hash;history.pushState({},'',u);}
 }catch(e){if(session)$('status').textContent=e.message;}
}
window.addEventListener('message',async e=>{if(e.source!==frame.contentWindow||e.data?.channel!==channel||!session)return;const d=e.data,active=channel;if(d.type==='navigate')navigate(d.path,d.q,d.hash);else if(d.type==='resource'){try{const r=await resource(d.path);if(active===channel&&session)frame.contentWindow.postMessage({channel:active,id:d.id,...r},'*');}catch(err){if(active===channel&&session)frame.contentWindow.postMessage({channel:active,id:d.id,error:err.message},'*');}}});
$('enter').onclick=async()=>{const redirect=new URL(location.href);redirect.search='';redirect.hash='';const {error}=await auth.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect.href,queryParams:{hd:'arrobabandalarga.com.br',prompt:'select_account'}}});if(error)$('error').textContent=error.message;};
$('exit').onclick=async()=>{clear();await auth.auth.signOut({scope:'global'});};
auth.auth.onAuthStateChange((event,s)=>{if(!s){clear();return;}session=s;if(event!=='TOKEN_REFRESHED'){const r=route();setTimeout(()=>navigate(r.page,r.q,r.hash,false),0);}});
window.addEventListener('popstate',()=>{const r=route();navigate(r.page,r.q,r.hash,false);});
setInterval(()=>{if(session&&session.expires_at*1000<=Date.now())clear('Sessão expirada. Entre novamente.');},1000);
