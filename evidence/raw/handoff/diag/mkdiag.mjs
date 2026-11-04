import { readFileSync, writeFileSync } from "node:fs";
const src = "C:/Vibe_coding-Project/autoAgentloop/deploy/B-reviewed/verify-b.ps1";
const d = readFileSync(src);
const idx = d.indexOf(Buffer.from("$ErrorActionPreference"));
writeFileSync(process.argv[2], Buffer.concat([d.subarray(0, idx), Buffer.from('Write-Output "DIAG root=[$PSScriptRoot] cmd=[$PSCommandPath]"\r\n'), d.subarray(idx)]));
console.log("wrote", process.argv[2]);
