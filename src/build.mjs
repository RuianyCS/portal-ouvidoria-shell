import {build} from 'esbuild';import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
const cfg=JSON.parse(readFileSync(new URL('../public-config.json',import.meta.url),'utf8'));
const url=cfg.supabase_url,key=cfg.supabase_anon_key;
if(!url||!key)throw Error('Missing public Supabase config');
await mkdir('dist',{recursive:true});await copyFile('index.html','dist/index.html');
const swSrc=readFileSync(new URL('./sw.js',import.meta.url),'utf8')
  .replace('__SUPABASE_URL__',url).replace('__SUPABASE_ANON__',key);
await writeFile('dist/sw.js',swSrc);
await build({entryPoints:['app.js'],bundle:true,minify:true,outfile:'dist/app.js',define:{SUPABASE_URL:JSON.stringify(url),SUPABASE_PUBLIC_KEY:JSON.stringify(key)}});
console.log('dist: index.html + app.js (anon pública embutida)');
