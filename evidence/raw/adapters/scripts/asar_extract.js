
const fs=require("fs"), path=require("path");
const P="D:/DSH/resources/app.asar";
const OUT="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters/asar";
const fd=fs.openSync(P,"r");const head=Buffer.alloc(16);fs.readSync(fd,head,0,16,0);
const jsonLen=head.readUInt32LE(12);const jb=Buffer.alloc(jsonLen);fs.readSync(fd,jb,0,jsonLen,16);
const header=JSON.parse(jb.toString("utf8"));
const base=16+jsonLen; // entries' offset are relative to data start (after header pickle)
function list(prefix){
  const parts=prefix.split("/");let node=header;
  for(const p of parts){ if(!node.files||!node.files[p]) return []; node=node.files[p]; }
  const out=[];(function walk(n,pre){for(const[k,v]of Object.entries(n.files||{})){const full=pre?pre+"/"+k:k;if(v.files)walk(v,full);else out.push({p:prefix+"/"+full,size:v.size,offset:Number(v.offset)});}})(node,"");
  return out;
}
const want=process.argv[2]||"dsh/node_modules/@deepseek-ai/dsh-acp";
const files=list(want);
console.log("files under",want,":",files.length);
for(const f of files) console.log(f.size.toString().padStart(9), f.p.replace(want,""));
// extract
fs.mkdirSync(OUT,{recursive:true});
for(const f of files){
  const rel=f.p.replace(want+"/","");
  const dest=path.join(OUT, path.basename(want), rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  const b=Buffer.alloc(f.size);
  if(f.size>0) fs.readSync(fd,b,0,f.size,base+f.offset);
  fs.writeFileSync(dest,b);
}
console.log("extracted to",OUT);
