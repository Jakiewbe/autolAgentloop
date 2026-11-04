import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def inventory():
    result = {}
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git") and Path(base, d) != OUT]
        for name in files:
            p = Path(base, name)
            result[p.relative_to(ROOT).as_posix()] = sha(p)
    return result

def save(name, value):
    p = OUT / name
    with p.open('x', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)

def run(name, argv, cwd=ROOT, timeout=100):
    print('RUN', name, flush=True)
    with (OUT / (name + '.log')).open('x', encoding='utf-8') as f:
        f.write(json.dumps({'argv':argv,'cwd':str(cwd)}, ensure_ascii=False)+'\n')
        f.flush()
        try:
            r = subprocess.run(argv, cwd=cwd, stdout=f, stderr=subprocess.STDOUT, timeout=timeout)
            f.write('\nAUDIT_EXIT='+str(r.returncode)+'\n')
            print(name, 'exit', r.returncode, flush=True)
        except subprocess.TimeoutExpired:
            f.write('\nAUDIT_TIMEOUT='+str(timeout)+'\n')
            print(name, 'TIMEOUT', flush=True)

if sys.argv[1] == 'start':
    save('before.json', inventory())
    actual = {}
    for rel in ['deploy/agent-autoloop-96b6c9c7-win2.tar.gz','evidence/raw/app/windows-changes.patch','evidence/raw/app/windows-changes.sha256','evidence/raw/app/windows-bundle.sha256','evidence/manifest.json','evidence/acceptance-codex.md']:
        p=ROOT/rel
        actual[rel]={'bytes':p.stat().st_size,'sha256':sha(p)}
    save('actual-hashes.json',actual)
    checks=[]
    for filename, prefix in [('windows-changes.sha256', ROOT/'app'),('windows-bundle.sha256',ROOT)]:
        for line in (ROOT/'evidence/raw/app'/filename).read_text().splitlines():
            expected,rel=re.match(r'([0-9a-f]{64})\s+\*?(.+)',line).groups()
            got=sha(prefix/rel)
            checks.append({'list':filename,'path':rel,'expected':expected,'actual':got,'pass':got==expected})
    for a in json.loads((ROOT/'evidence/manifest.json').read_text(encoding='utf-8-sig'))['artifacts']:
        p=ROOT/a['path']
        checks.append({'list':'manifest','path':a['path'],'pass':p.exists() and sha(p)==a['sha256'] and p.stat().st_size==a['bytes'],'actual':sha(p) if p.exists() else None,'actual_bytes':p.stat().st_size if p.exists() else None})
    with tarfile.open(ROOT/'deploy/agent-autoloop-96b6c9c7-win2.tar.gz') as t:
        members={m.name.removeprefix('./'):m for m in t.getmembers() if m.isfile()}
        for line in (ROOT/'evidence/raw/app/windows-changes.sha256').read_text().splitlines():
            expected,rel=re.match(r'([0-9a-f]{64})\s+\*?(.+)',line).groups()
            candidates=[n for n in members if n==rel or n.endswith('/'+rel)]
            got=hashlib.sha256(t.extractfile(members[candidates[0]]).read()).hexdigest() if len(candidates)==1 else None
            checks.append({'list':'tar-members','path':rel,'matches':candidates,'pass':got==expected,'actual':got})
    save('identity-checks.json',checks)
    print('IDENTITY',sum(x['pass'] for x in checks),'pass',sum(not x['pass'] for x in checks),'fail',flush=True)
    run('source-baseline',[sys.executable,'-B','tools/checks/check_source_baseline.py'])
    run('bridge-default',['node','--test','tools/anchor_bridge/bridge.test.mjs'])
    run('bridge-inprocess',['node','--test','--test-isolation=none','tools/anchor_bridge/bridge.test.mjs'])
    run('command-adapter',['node','--disable-warning=ExperimentalWarning','--test','--test-isolation=none','app/tests/command-adapter.test.ts'])
    run('kernel',['node','--disable-warning=ExperimentalWarning','--test','--test-isolation=none','app/tests/kernel.test.ts'])
    run('worker-session',['node','--disable-warning=ExperimentalWarning','--test','--test-isolation=none','--test-name-pattern=a session that','app/tests/worker.test.ts'])
    run('windows-runtime',['node','--disable-warning=ExperimentalWarning','--test','--test-isolation=none','--test-force-exit','app/tests/windows-runtime.test.ts'],timeout=180)
elif sys.argv[1] == 'finish':
    before=json.loads((OUT/'before.json').read_text(encoding='utf-8'))
    after=inventory()
    changed=[p for p,h in before.items() if after.get(p)!=h]
    save('after-comparison.json',{'changed_or_deleted':changed,'added':[p for p in after if p not in before]})
    print('EXISTING_CHANGED',changed)
