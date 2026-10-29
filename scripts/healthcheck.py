#!/usr/bin/env python3
"""Guard do Portal da Ouvidoria — monitora a URL pública real (sem Supabase, sem secrets).

Motivo da mudança: o guard anterior consultava o Supabase (projeto mxjdefwvaluwuqordfnt)
com SUPABASE_ACCESS_TOKEN e, desde 27/10, recebia HTTP_401 (token inválido/expirado),
gerando alerta falso enquanto o Portal público estava no ar. O Portal público não
depende mais de Supabase para leitura (0 referências no build publicado).

Agora verifica o caminho que o colaborador usa:
  1. URL neutra Base44 (/functions/ouvidoria) -> 200 + invólucro com iframe
  2. Home estática publicada                  -> 200 + marcador de conteúdo
  3. Índice de busca                          -> 200 + JSON com entradas
"""
import json, os, time, urllib.error, urllib.request
from datetime import datetime, timezone

PUBLICA = 'https://solan-7174f681.base44.app/functions/ouvidoria'
HOME = 'https://ruianycs.github.io/portal-ouvidoria-shell/p/index.html'
BUSCA = 'https://ruianycs.github.io/portal-ouvidoria-shell/p/search_index.json'


def get(url, timeout=25):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'portal-guard/2'})
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, int((time.time() - t0) * 1000), r.read(400000).decode(errors='ignore')
    except urllib.error.HTTPError as e:
        return e.code, int((time.time() - t0) * 1000), e.read(2000).decode(errors='ignore')
    except Exception as e:
        return 0, int((time.time() - t0) * 1000), str(e)[:120]


checks = {}

s, ms, b = get(PUBLICA)
checks['url_neutra'] = {'http': s, 'ms': ms, 'ok': s == 200 and 'iframe' in b.lower()}

s, ms, b = get(HOME)
checks['home'] = {'http': s, 'ms': ms, 'ok': s == 200 and ('Como podemos ajudar' in b or 'Portal da' in b)}

s, ms, b = get(BUSCA)
entradas = 0
try:
    entradas = len(json.loads(b).get('entradas', []))
except Exception:
    entradas = 0
checks['busca'] = {'http': s, 'ms': ms, 'ok': s == 200 and entradas > 0, 'entradas': entradas}

disponivel = all(c['ok'] for c in checks.values())
rec = {
    'ts': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    'resultado': 'OK' if disponivel else 'INDISPONIVEL',
    'status_supabase': 'NAO_UTILIZADO',
    'alvo': PUBLICA,
    'latencia_ms': sum(c['ms'] for c in checks.values()),
    'checks': checks,
}

os.makedirs('health', exist_ok=True)
json.dump(rec, open('health/last.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open('health/history.jsonl', 'a', encoding='utf-8') as f:
    f.write(json.dumps(rec, ensure_ascii=False) + '\n')

print(json.dumps({'resultado': rec['resultado'], 'latencia_ms': rec['latencia_ms'],
                  'url_neutra': checks['url_neutra']['http'], 'home': checks['home']['http'],
                  'busca': checks['busca']['http'], 'entradas': entradas}, ensure_ascii=False))
raise SystemExit(0 if disponivel else 1)
