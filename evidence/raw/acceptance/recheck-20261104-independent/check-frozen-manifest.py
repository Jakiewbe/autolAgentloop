import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent/'reviewed-snapshot'
items=json.loads((root/'evidence/manifest.json').read_text(encoding='utf-8'))['artifacts']
bad=[]
for a in items:
    p=root/a['path']
    if not p.exists(): continue
    h=hashlib.sha256(p.read_bytes()).hexdigest()
    if h!=a['sha256'] or p.stat().st_size!=a['bytes']:
        bad.append(a['path'])
        print('FAIL',a['path'],'expected',a['bytes'],a['sha256'],'actual',p.stat().st_size,h)
print('FAIL='+str(len(bad)))
raise SystemExit(bool(bad))
