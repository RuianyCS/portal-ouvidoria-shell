#!/usr/bin/env python3
"""Gate: bloqueia publicação se houver padrão sensível ou arquivo fora da allowlist na raiz."""
import base64,json,re,sys
from pathlib import Path
FORBIDDEN=[(r"service_role","service_role"),(r"sb_secret_","secret projeto"),
 (r"SUPABASE_SERVICE_ROLE","service_role env"),(r"BEGIN [A-Z ]*PRIVATE KEY","chave privada"),
 (r"nfp_[A-Za-z0-9]{10}","token Netlify"),(r"netlify_[A-Za-z0-9]{10}","token Netlify"),
 (r"Authorization:\s*Basic\s+[A-Za-z0-9+/=]{16,}","credencial Basic"),
 (r"(?i)password\s*[=:]\s*\S{8,}","senha")]
ALLOWED_ROOT={"index.html","app.js",".nojekyll","README.md","public-config.json"}
skip={'.git','node_modules'}
fail=[]
for p in sorted(Path('.').rglob('*')):
    if not p.is_file() or any(part in skip for part in p.parts): continue
    t=p.read_text(errors='ignore')
    for rx,label in FORBIDDEN:
        if re.search(rx,t): fail.append(f"{p}: [{label}]")
    for m in re.finditer(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",t):
        try:
            d=json.loads(base64.urlsafe_b64decode(m.group(0).split('.')[1]+'=='))
            if d.get('role')!='anon': fail.append(f"{p}: JWT role={d.get('role')} (só anon)")
        except Exception: pass
root_extra=[f.name for f in Path('.').iterdir() if f.name not in ALLOWED_ROOT and f.name not in skip and f.is_file() and not f.name.startswith('.github') and f.name not in ('src','scripts')]
if root_extra: fail.append(f"raiz com arquivos não permitidos: {root_extra}")
if fail:
    print("GATE: FALHOU — deploy bloqueado"); [print(" -",f) for f in fail]; sys.exit(1)
print("GATE: OK — 0 padrões sensíveis; raiz = apenas artefatos públicos")
