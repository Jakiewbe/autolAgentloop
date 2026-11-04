
const fs = require("fs");
const p = "D:/DSH/resources/app.asar";
const fd = fs.openSync(p, "r");
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
// asar: uint32 4, uint32 headerPickleSize? standard: 
// [0..4)=4, [4..8)=header size+4?, [8..12)=header string size+4, [12..16)=json length
const jsonLen = head.readUInt32LE(12);
const buf = Buffer.alloc(jsonLen);
fs.readSync(fd, buf, 0, jsonLen, 16);
const header = JSON.parse(buf.toString("utf8"));
const dataOffset = 16 + jsonLen + (16 - (jsonLen % 16)) % 16; // pad to 16? asar pads json to 4
console.log("asar filesize:", fs.fstatSync(fd).size, "jsonLen:", jsonLen, "dataOffsetGuess:", dataOffset);
const hits = [];
function walk(node, path) {
  for (const [k, v] of Object.entries(node.files || {})) {
    const full = path ? path + "/" + k : k;
    if (v.files) { if (full.includes("acp")) hits.push("DIR " + full); walk(v, full); }
    else hits.push("FILE " + full + " size=" + v.size);
  }
}
walk(header, "");
const acp = hits.filter(h => /packages\/acp/i.test(h));
console.log("--- acp entries count:", acp.length);
console.log(acp.slice(0, 60).join("\n"));
