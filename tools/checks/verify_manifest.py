import hashlib,json,sys,pathlib
root=pathlib.Path('.')
m=json.loads((root/'evidence/manifest.json').read_text(encoding='utf-8'))
bad=[]
for a in m['artifacts']:
    p=root/a['path']
    if not p.exists():
        bad.append((a['path'],'MISSING')); continue
    b=p.read_bytes()
    h=hashlib.sha256(b).hexdigest()
    if len(b)!=a['bytes'] or h!=a['sha256']:
        bad.append((a['path'],f"bytes {len(b)} vs {a['bytes']}, sha {h[:12]} vs {a['sha256'][:12]}"))
print("artifacts", len(m['artifacts']), "mismatch", len(bad))
for x in bad: print("MISMATCH", x[0], x[1])
sys.exit(1 if bad else 0)
