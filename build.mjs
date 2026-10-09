import {build} from 'esbuild';import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
const cfg=JSON.parse(readFileSync('public-config.json','utf8'));
const url=cfg.supabase_url,key=cfg.supabase_anon_key;
if(!url||!key)throw Error('Missing public Supabase config');
await mkdir('dist',{recursive:true});await copyFile('index.html','dist/index.html');
await build({entryPoints:['app.js'],bundle:true,minify:true,outfile:'dist/app.js',define:{SUPABASE_URL:JSON.stringify(url),SUPABASE_PUBLIC_KEY:JSON.stringify(key)}});
console.log('dist: index.html + app.js (chave anon pública embutida)');
