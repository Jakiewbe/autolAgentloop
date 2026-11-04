
const fs=require("fs");
const p="D:/DSH/resources/app.asar";
const fd=fs.openSync(p,"r");const head=Buffer.alloc(16);fs.readSync(fd,head,0,16,0);
const jsonLen=head.readUInt32LE(12);const buf=Buffer.alloc(jsonLen);fs.readSync(fd,buf,0,jsonLen,16);
const header=JSON.parse(buf.toString("utf8"));
console.log("top-level:", Object.keys(header.files).join(", "));
const paths=[];
(function walk(n,pre){for(const[k,v]of Object.entries(n.files||{})){const full=pre?pre+"/"+k:k;if(v.files)walk(v,full);else paths.push(full);}})(header,"");
console.log("total files:",paths.length);
for(const re of [/acp/i,/dsh/i,/agent/i]){const m=paths.filter(x=>re.test(x));console.log("--- match",re,"count",m.length);console.log(m.slice(0,15).join("\n"));}
