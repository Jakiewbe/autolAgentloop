import hashlib
import json
import os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
HOME=Path.home()/'.agent-autoloop'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
data={'rules':{},'runs':{},'rollout':None}
rules=json.loads((HOME/'rules.json').read_text(encoding='utf-8-sig'))
data['rules']={'path':str(HOME/'rules.json'),'sha256':sha(HOME/'rules.json'),'agents':{k:{'use':v.get('use'),'command':v.get('command')} for k,v in rules['agents'].items()}}
for run in (8,9):
    d=HOME/'worker/runs'/f'{run}-1'
    spec=json.loads((d/'command-1.json').read_text(encoding='utf-8-sig'))
    entry=json.loads((d/'entry.json').read_text(encoding='utf-8-sig')) if (d/'entry.json').exists() else {}
    stdout=(d/'stdout-1.log').read_text(encoding='utf-8',errors='replace')
    events=[]
    for line_no,line in enumerate(stdout.splitlines(),1):
        try: v=json.loads(line)
        except ValueError: continue
        if v.get('type')=='thread.started': events.append({'line':line_no,'type':v['type'],'thread_id':v.get('thread_id')})
        item=v.get('item',{})
        if item.get('type')=='agent_message':
            text=item.get('text','')
            events.append({'line':line_no,'type':'agent_message','mentions_blue':'蓝色' in text,'text_sha256':hashlib.sha256(text.encode()).hexdigest()})
    args=spec['args']
    data['runs'][str(run)]={'path':str(d),'command_sha256':sha(d/'command-1.json'),'program':spec['program'],'args_except_prompt':args[:-1],'cwd':spec.get('cwd'),'stdout_sha256':sha(d/'stdout-1.log'),'events':events,'exit':(d/'exit-1').read_text().strip(),'entry_resume':entry.get('resume'),'entry_session':entry.get('session'),'job_session':entry.get('job',{}).get('session')}
thread=data['runs']['8']['events'][0]['thread_id']
matches=list((Path.home()/'.codex/sessions/2026/11/04').glob('*'+thread+'*'))
if len(matches)==1:
    p=matches[0]
    meta=[];users=[]
    for n,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
        v=json.loads(line);pl=v.get('payload',{})
        if v.get('type')=='session_meta': meta.append({'line':n,'id':pl.get('id'),'timestamp':v.get('timestamp'),'cwd':pl.get('cwd')})
        if v.get('type')=='event_msg' and pl.get('type')=='user_message':
            txt=pl.get('message','')
            users.append({'line':n,'timestamp':v.get('timestamp'),'mentions_blue':'蓝色' in txt,'message_sha256':hashlib.sha256(txt.encode()).hexdigest()})
    data['rollout']={'path':str(p),'sha256':sha(p),'meta':meta,'user_messages':users}
with (OUT/'runtime-evidence.json').open('x',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2)
print(json.dumps(data,ensure_ascii=False,indent=2))
