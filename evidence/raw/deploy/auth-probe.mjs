// Live check on the running hub: a worker's door opens for the worker's own key and for nothing else.
// Prints status codes only, never key material.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const config = JSON.parse(readFileSync(join(homedir(), ".agent-autoloop", "config.json"), "utf8"));
const url = config.url.replace(/\/$/, "") + "/v1/work?claim=probe-auth&wait=0&running=&capacity=1";

const probes = [
  ["no authorization header", {}],
  ["wrong bearer", { authorization: "Bearer " + "A".repeat(43) }],
  ["owner key used as worker", { authorization: "Bearer " + config.owner }],
  ["source key used as worker", { authorization: "Bearer " + config.source.key }],
  ["worker's own key", { authorization: "Bearer " + config.worker.key }],
  ["worker's own key, wrong worker name", { authorization: "Bearer " + config.worker.key }],
];

for (const [label, headers] of probes) {
  const target = label.endsWith("wrong worker name") ? url.replace("capacity=1", "capacity=1&worker=other-machine") : url;
  const response = await fetch(target, { headers });
  const text = await response.text();
  console.log(label.padEnd(34), response.status, text.slice(0, 120));
}
