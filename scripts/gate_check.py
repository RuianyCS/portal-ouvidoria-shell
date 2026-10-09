#!/usr/bin/env python3
"""Gate: bloqueia publicacao se houver credencial real (formato), .env, ou arquivo interno."""
import base64,json,re,sys
from pathlib import Path
CRED=[("sb_secret_[A-Za-z0-9]{16,}","secret de projeto"),
 ("GOCSPX-[A-Za-z0-9_-]{20,}","OAuth client secret Google"),
 ("nfp_[A-Za-z0-9]{16,}","token Netlify"),("netlify_[A-Za-z0-9]{16,}","token Netlify"),
 ("BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY","chave privada"),
 ("Authorization: Basic [A-Za-z0-9+/=]{16,}","credencial Basic"),
 ("password[\\t ]*[=:][\\t ]*[\"'][^\"']{6,}[\"']","senha literal"),
 ("(token|secret|apikey)[\\t ]*[=:][\\t ]*[\"'][A-Za-z0-9_+=/-]{24,}[\"']","credencial rotulada")]
ALLOWED_ROOT={"index.html","app.js",".nojekyll","README.md","public-config.json"}
NO_EXT={".env",".pdf",".xlsx",".docx",".pptx",".pem",".key"}
skip={'.git','node_modules','.github','src','scripts','dist'}
fail=[]
for p in sorted(Path('.').rglob('*')):
    if not p.is_file() or any(part in skip for part in p.parts): continue
    if p.suffix.lower() in NO_EXT or p.name.lower() in ('.env','cname'): fail.append(f"{p}: tipo de arquivo proibido")
    t=p.read_text(errors='ignore')
    for rx,label in CRED:
        if re.search(rx,t): fail.append(f"{p}: [{label}]")
    for m in re.finditer(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",t):
        try:
            d=json.loads(base64.urlsafe_b64decode(m.group(0).split('.')[1]+'=='))
            if d.get('role') and d.get('role')!='anon': fail.append(f"{p}: JWT role={d.get('role')} (so anon e publico)")
        except Exception: pass
extra=[f.name for f in Path('.').iterdir() if f.is_file() and f.name not in ALLOWED_ROOT]
if extra: fail.append(f"raiz com arquivos fora da allowlist: {extra}")
if fail:
    print("GATE: FALHOU - deploy bloqueado"); [print(" -",f) for f in fail]; sys.exit(1)
print("GATE: OK - 0 credenciais, 0 arquivos internos, raiz = artefatos publicos")
