
const { readFileSync, writeFileSync } = require("node:fs");
const files = process.argv.slice(2);
for (const file of files) {
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  writeFileSync(file, text);
}
