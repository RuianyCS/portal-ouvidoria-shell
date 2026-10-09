#!/usr/bin/env python3
"""Gate de segurança: bloqueia publicação se houver padrão sensível no repo ou no dist."""
import base64,json,re,sys
from pathlib import Path
FORBIDDEN=[
 (r"service_role","service_role"),
 (r"sb_secret_","secret do projeto"),
 (r"SUPABASE_SERVICE_ROLE","service_role env"),
 (r"BEGIN [A-Z ]*PRIVATE KEY","chave privada"),
 (r"nfp_[A-Za-z0-9]{10}","token Netlify"),
 (r"netlify_[A-Za-z0-9]{10}","token Netlify"),
 (r"Authorization:\s*Basic\s+[A-Za-z0-9+/=]{16,}","credencial Basic"),
 (r"(?i)password\s*[=:]\s*\S{8,}","senha"),
 (r"\.env\b","arquivo .env"),
]
ALLOWED_DIST={"index.html","app.js"}
skip_dirs={'.git','node_modules','dist','scripts'}
fail=[]
for p in sorted(Path('.').rglob('*')):
    if not p.is_file(): continue
    if any(part in skip_dirs for part in p.parts): continue
    t=p.read_text(errors='ignore')
    for rx,label in FORBIDDEN:
        if re.search(rx,t): fail.append(f"{p}: padrão proibido [{label}]")
    for m in re.finditer(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",t):
        try:
            payload=m.group(0).split('.')[1]+'=='
            d=json.loads(base64.urlsafe_b64decode(payload))
            if d.get('role')!='anon': fail.append(f"{p}: JWT role={d.get('role')} (só anon é público)")
        except Exception: pass
dist=sorted(str(f) for f in Path('dist').glob('*'))
extra=[f for f in dist if f not in ["dist/"+a for a in ALLOWED_DIST]]
if extra: fail.append(f"dist contém arquivos fora da allowlist: {extra}")
if fail:
    print("GATE: FALHOU — publicação bloqueada")
    [print(" -",f) for f in fail]; sys.exit(1)
print(f"GATE: OK — 0 padrões sensíveis; dist = {dist}")
