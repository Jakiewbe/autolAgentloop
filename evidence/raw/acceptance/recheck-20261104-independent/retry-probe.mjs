import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { empty,evolve,rows } from '../../../../app/kernel/evolve.ts';
import { decide } from '../../../../app/kernel/decide.ts';
import { parseRules } from '../../../../app/protocol/rules.ts';
const env={secret:'simulation-secret',publicUrl:'https://hub.test'};
const rules=parseRules(readFileSync(new URL('../../../../app/tests/rules.fixture.json',import.meta.url),'utf8'),0,'UTC');
let view=evolve(empty(),decide(empty(),{type:'rules',args:[rules]},1,env).facts);
const act=(type,args,now)=>{const d=decide(view,{type,args},now,env);view=evolve(view,d.facts);return d.value;};
act('ingest',['app',{id:'audit-retry',type:'feedback.new'}],0);
const results=[];
for(let i=0;i<10;i++){
  const now=i*61*60000;
  const job=act('claimNext',['w1','audit-claim-'+i],now);
  if(!job){results.push({claim:i+1,job:null});continue;}
  act('finish',[job.run,job.token,{outcome:'failed',error:'local fake failure'}],now+1);
  const run=rows(view,'runs')[0];
  results.push({claim:i+1,attempts:run.attempts,state:run.state,delay_minutes:run.state==='queued'?(Date.parse(run.not_before)-(now+1))/60000:null});
}
assert.deepEqual(results.slice(0,4).map(x=>x.delay_minutes),[5,10,20,40]);
assert.equal(results[4].state,'unknown');
assert.ok(results.slice(5).every(x=>x.job===null));
const exhausted=rows(view,'cards').find(c=>String(c.key).includes(':exhausted'));
assert.ok(exhausted);
console.log(JSON.stringify({results,exhausted_notice:{key:exhausted.key,text:exhausted.text}},null,2));
