import hashlib,json
from pathlib import Path
out=Path(__file__).resolve().parent
p=Path.home()/'.codex/sessions/2026/11/04/rollout-2026-11-04T19-47-11-01a1a662-6e93-7b31-bfe1-a8e9745abc43.jsonl'
records=[json.loads(x) for x in p.read_text(encoding='utf-8').splitlines()]
data={'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'session_id':records[0]['payload']['id'],'turn_context_count':sum(x['type']=='turn_context' for x in records),'task_complete_count':sum(x['type']=='event_msg' and x.get('payload',{}).get('type')=='task_complete' for x in records),'user_message_records':[]}
for n,x in enumerate(records,1):
    pl=x.get('payload',{})
    if x['type']=='response_item' and pl.get('type')=='message' and pl.get('role')=='user':
        text=''.join(i.get('text','') for i in pl.get('content',[]))
        data['user_message_records'].append({'line':n,'timestamp':x.get('timestamp'),'characters':len(text),'mentions_blue':'蓝色' in text,'sha256':hashlib.sha256(text.encode()).hexdigest()})
with (out/'rollout-check.json').open('x',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2)
print(json.dumps(data,ensure_ascii=False,indent=2))
