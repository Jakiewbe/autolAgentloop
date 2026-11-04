
const fs=require("fs");
const P="D:/DSH/resources/app.asar";
const fd=fs.openSync(P,"r");
const head=Buffer.alloc(16);fs.readSync(fd,head,0,16,0);
const jl=head.readUInt32LE(12);const jb=Buffer.alloc(jl);fs.readSync(fd,jb,0,jl,16);
const hdr=JSON.parse(jb.toString("utf8"));
const base=16+jl;
const files=[];
(function walk(n,pre){for(const[k,v]of Object.entries(n.files||{})){const full=pre?pre+"/"+k:k;if(v.files)walk(v,full);else if(v.size>0)files.push({p:full,size:v.size,off:base+Number(v.offset)});}})(hdr,"");
files.sort((a,b)=>a.off-b.off);
const needles=process.argv.slice(2);
const big=fs.readFileSync(P);
for(const nd of needles){
  const buf=Buffer.from(nd);let idx=0,hits=0;
  while((idx=big.indexOf(buf,idx))!==-1&&hits<8){
    // map
    let lo=0,hi=files.length-1,owner=null;
    while(lo<=hi){const mid=(lo+hi)>>1;if(files[mid].off<=idx){owner=files[mid];lo=mid+1;}else hi=mid-1;}
    console.log(nd,"@",idx,"->",owner?owner.p:"?", "offsetInFile="+(owner?idx-owner.off:-1));
    idx+=buf.length;hits++;
  }
  if(hits===0)console.log(nd,"-> not found");
}
