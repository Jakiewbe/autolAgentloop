import datetime
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
dest=OUT/'reviewed-snapshot'
dest.mkdir()
paths=['evidence/manifest.json','evidence/acceptance-codex.md','evidence/source-baseline.json','evidence/scheduling.md','evidence/adapters.md','evidence/rollback.md','evidence/design.md','evidence/windows-runtime.md','evidence/deployment/A.md','tools/anchor_bridge/bridge.mjs','tools/anchor_bridge/bridge.test.mjs','DSH_DEPLOYMENT_TASKBOOK.md']
paths += [str(p.relative_to(ROOT)).replace('\\','/') for p in (ROOT/'app').glob('tests/*adapter.test.ts')]
paths += ['app/kernel/decide.ts','app/worker/worker.ts','app/plugins/command/agent.ts','app/tests/kernel.test.ts','app/tests/worker.test.ts']
checks=[]
for rel in paths:
    p=ROOT/rel; data=p.read_bytes(); q=dest/rel
    q.parent.mkdir(parents=True,exist_ok=True)
    with q.open('xb') as f: f.write(data)
    checks.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'unchanged_while_copying':data==p.read_bytes()})
manifest=json.loads((dest/'evidence/manifest.json').read_text(encoding='utf-8-sig'))
items=[]
for a in manifest['artifacts']:
    p=ROOT/a['path']; got=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
    items.append({'path':a['path'],'expected_bytes':a['bytes'],'actual_bytes':p.stat().st_size if p.exists() else None,'expected_sha256':a['sha256'],'actual_sha256':got,'pass':got==a['sha256'] and p.stat().st_size==a['bytes']})
data={'captured_at':datetime.datetime.now().astimezone().isoformat(),'files':checks,'manifest_checks':items}
with (OUT/'frozen-checks.json').open('x',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2)
print(data['captured_at'])
print('MANIFEST',sum(i['pass'] for i in items),'PASS',sum(not i['pass'] for i in items),'FAIL')
for i in items:
    if not i['pass']: print(json.dumps(i,ensure_ascii=False))
