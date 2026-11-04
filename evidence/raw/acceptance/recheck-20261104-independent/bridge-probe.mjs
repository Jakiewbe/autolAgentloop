import assert from 'node:assert/strict';
import { objection, findKit } from '../../../../tools/anchor_bridge/bridge.mjs';
const task={plan:'approved',status:'todo',dependencies:['D'],deliverable_coverage:'covered'};
const why=objection(task,new Map([['D',{status:'done',verification_state:'stale'}]]));
assert.match(why,/stale/);
const found=findKit(process.cwd());
assert.ok(found?.program);
console.log(JSON.stringify({why,found},null,2));
