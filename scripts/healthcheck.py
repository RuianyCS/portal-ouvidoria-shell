#!/usr/bin/env python3
"""Healthcheck externo do backend do Portal (sem secrets, sem dados internos).

Verifica, usando apenas a chave anon publica do proprio shell:
  1. Supabase Auth       -> GET  /auth/v1/health                  (espera 200)
  2. Edge Function       -> POST /functions/v1/portal-content     (espera 401)
  3. REST/RLS            -> GET  /rest/v1/portal_release          (espera 401/403)
  4. Storage privado     -> GET  /storage/v1/object/public/...    (espera 400)
Grava health/last.json e health/history.jsonl (sem conteudo, sem credenciais).
"""
import json, os, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone

CFG = json.load(open('public-config.json', encoding='utf-8'))
BASE = CFG['supabase_url'].rstrip('/')
KEY = CFG['supabase_anon_key']
HDR = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}

def call(method, path, body=None):
    t0 = time.time()
    req = urllib.request.Request(BASE + path, method=method, headers={**HDR, 'Content-Type': 'application/json'},
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        r = urllib.request.urlopen(req, timeout=20)
        return r.status, round((time.time() - t0) * 1000), r.read(200).decode(errors='ignore')
    except urllib.error.HTTPError as e:
        return e.code, round((time.time() - t0) * 1000), e.read(200).decode(errors='ignore')
    except Exception as e:
        return 0, round((time.time() - t0) * 1000), str(e)[:120]

checks = {}
s, ms, _ = call('GET', '/auth/v1/health');            checks['auth'] = {'http': s, 'ms': ms, 'ok': s == 200}
s, ms, b = call('POST', '/functions/v1/portal-content', {'path': 'index.html'})
checks['edge_function'] = {'http': s, 'ms': ms, 'ok': s in (401, 403)}   # sem sessao = protegido
s, ms, _ = call('GET', '/rest/v1/portal_release?select=id');             checks['rest'] = {'http': s, 'ms': ms, 'ok': s in (200, 401, 403)}
s, ms, _ = call('GET', '/storage/v1/object/public/portal-private/releases/index.html')
checks['storage'] = {'http': s, 'ms': ms, 'ok': s in (400, 401, 403)}    # bucket privado nao serve publico

ref = CFG.get('supabase_ref') or BASE.split('//')[1].split('.')[0]
status = 'OK' if all(c['ok'] for c in checks.values()) else 'DEGRADADO'
if checks['auth']['http'] == 0:
    status = 'INDISPONIVEL'
rec = {'ts': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'status': status,
       'ref': ref, 'latencia_ms': sum(c['ms'] for c in checks.values()), 'checks': checks}
os.makedirs('health', exist_ok=True)
json.dump(rec, open('health/last.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open('health/history.jsonl', 'a', encoding='utf-8') as f:
    f.write(json.dumps(rec, ensure_ascii=False) + '\n')
print(json.dumps({'status': status, 'latencia_ms': rec['latencia_ms'],
                  'auth': checks['auth']['http'], 'edge': checks['edge_function']['http'],
                  'rest': checks['rest']['http'], 'storage': checks['storage']['http']}, ensure_ascii=False))
sys.exit(0 if status == 'OK' else 1)
