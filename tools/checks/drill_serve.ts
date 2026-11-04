// 备份还原演练用：只起中台（hub），不启动 worker，不碰模型、不改规则。
// 用途：验证「备份里的 config.json + hub.db + master.key + rules.json」能独立把中台跑起来并读回历史。
import { serve } from "../../app/host/http.ts";
import { commitOf } from "../../app/host/version.ts";

const port = Number(process.argv[2] ?? 3399);
const host = "127.0.0.1";
const server = serve(port, host, { commit: commitOf() });
server.on("listening", () => console.log(`listening on ${host}:${port} home=${process.env.AGENT_AUTOLOOP_HOME ?? "<default>"}`));
server.on("error", (error) => {
  console.log("listen failed: " + error);
  process.exit(1);
});
