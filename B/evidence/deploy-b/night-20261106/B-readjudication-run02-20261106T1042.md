# run-02 局部只读复判（B，2026-11-06T10:42+08:00）

- night_id: NIGHT-20261106
- 角色: B（唯一写入者：本机证据与本目录）
- 复判对象: `D:\AutoAgentloop\evidence\deploy-b\night-20261106\run-02-20261106T0224\`
- 性质: **离线字节复判**。本轮**没有调用任何模型**、没有启动/重启 worker、没有新建正式 run、没有改配置/路由/标签/ACL/身份。
- 结论: 用**当时真正被执行的严格适配器字节**（归档副本）回放存档 stdout，得到与 `out/result.json` 逐字段一致的 `text/session/usage`；包装器退出码与 CLI 原生退出码已分开记账。

## 1. 输入字节核对（先证明被复判的是什么）

| 文件 | 字节 | sha256 |
| --- | --- | --- |
| `out/stdout.jsonl` | 1786 | `39a97bda127015185ae782d915129f1b9df6f92568c878eb86c6989a75bed138` |
| `out/stderr.log` | 39 | `1aa26269eb1cc57f86b235a03cda53c004edb5b1e9fc99d4da4f00843293d721` |
| `prompt.txt` | 127 | `704eba6d5e9fdc1209164b9a413f7cfde02cede48dddc3f494ea9a52e0dccc66` |
| `expect.txt` | 2 | 内容 `2` |

- `out/stdout.jsonl` 与 `out/stderr.log` 的 sha256 **等于** `out/result.json` 中 `meta.stdoutSha256` / `meta.stderrSha256` ⇒ 复判输入就是当时保存的那份字节，未经过滤或重写。
- 时间校正：目录名 `T0224` 与真实时间不符（命名偏移约 46 分钟）。真实证据：全部文件 mtime 为 `2026-11-06 01:37–01:38 +0800`，`result.json` 的 `meta.startedAt = 2026-11-05T17:37:44.515Z`（= 01:37:44 +08），`durationMs = 39860`。**run-02 实际发生在 01:37:44–01:38:24**。

## 2. 当时用的到底是哪个适配器（这是本次复判的关键）

| 对象 | 字节 | sha256 | 说明 |
| --- | --- | --- | --- |
| run-02 记录（`adapter.sha256.txt` 与 `result.json meta.adapter.sha256`） | 5691 | `ac23aa9b634065786a25e9b53f2301d618d68227f8c460f56a4b3bcabd4e894b` | 打 11-05 旧补丁、**未**打本夜 `night-parse-terminal-boundary-v1` 的严格适配器 |
| 归档副本 `apply-v1-20261106T0157/backup/plugins/command/agent.ts` | 5691 | `ac23aa9b…e894b`（同上） | 与记录逐字节一致，可作复判输入 |
| **当前磁盘** `runtime\d504e4876d07\plugins\command\agent.ts` | 6268 | `1b8933c0d1f8976b5afe7cc9fbdcd9021549a1057e68ae96f35ed85fd0bcd4f1` | 01:57 应用 A 补充包后的新逻辑，**不是** run-02 实际运行的字节 |

⇒ 若用当前磁盘适配器复判，测的是"新逻辑"，不是"run-02 当时的行为"。因此本次一律使用归档副本。归档树里 `worker/agents.ts` 为 `6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471`（补丁未改该文件，与当前一致）。

## 3. 复判方法（可重复）

- 目录 `readjudicate-run02-20261106T1042/`：`plugins/command/agent.ts`（归档字节 `ac23aa9b`）、`worker/agents.ts`（`6c150fc0`）、`host/`、`protocol/`（从 runtime 复制，仅作 import 解析，未改动）。
- `replay.ts`（sha256 `ed81f4af7de9f6581e2d690abafeb0a46a3030082ec678e846b1dbc730501989`）：`import archived from "./plugins/command/agent.ts"`，直接调 `archived.read(stdout, code, stderr, { command })`，`command` 取自 `result.json meta.argv`，`stdout` 为存档原文。
- 运行：`node --experimental-strip-types replay.ts`（只用本地 Node 24.12.0，无网络、无模型）。
- 输出：`replay.out.txt`（sha256 `012edd3463fea780a6f74485103aa3fb7ce73694daa30fb16c47c7bde9ab583c`）。

## 4. 复判结果

```
A exact-replay code=0 => {"text":"2","session":"01a1acc9-bde3-7910-bba0-68b3fdfb4656","usage":{"input":413111,"output":154,"cached":148608}}
```

与 `out/result.json` 的 `protocol` 字段逐项相等：`pass=true`、`text="2"`、`session=01a1acc9-bde3-7910-bba0-68b3fdfb4656`、`usage={input 413111, cached 148608, output 154}`；`probe.pass=true`、`reason="expected reply and real usage recorded"`。

严格性对照（证明这是**严格**适配器，不是宽容版）：

| 用例 | 输入改动 | 结果 |
| --- | --- | --- |
| B 终态前非 JSON | 在 `turn.completed` 前插入 `SUCCESS: taskkill (pid 11480)`（第 10 行） | `error="Codex stdout 第 10 行不是 JSON 对象，原始输出保留在日志中"` |
| C 缺终态 | 删除 `turn.completed` | `error="Codex 没有成功完成本轮"` |
| D 上游非零 | 传入 `code=11` | `error="退出码 11：Reading additional input from stdin..."` |

⇒ run-02 之所以通过，是因为**它的终态之后没有任何非 JSON 行**（`observation.nonJson=[]`，十行全 JSON），不依赖后来那个补丁。

## 5. 模型与真实 MCP（全部来自存档字节，非新调用）

- 模型：`result.json meta.model = deepseek-v4.1-flash-1017`，argv 为 `exec --skip-git-repo-check -C D:\AutoAgentloop --json -m deepseek-v4.1-flash-1017 <prompt>`。
- `item_0` 有一条**非致命** error：`Model metadata for deepseek-v4.1-flash-1017 not found. Defaulting to fallback metadata…`（走 fallback 元数据，未改模型、未改配置）。
- 真实 MCP 调用（`item.completed` 事件里的 `mcp_tool_call`）：
  - `item_1` server=`node_repl` tool=`js` args=`{"code":"1+1","title":"Evaluating 1+1"}` → `result.content[0].text = ""`（空回）
  - `item_2` reasoning：`The output was empty apparently. Let me re-run with nodeRepl.write.`
  - `item_3` server=`node_repl` tool=`js` args=`{"code":"nodeRepl.write(1+1)","title":"Writing the result"}` → **`result.content[0].text = "2"`**，`_meta["codex/nodeReplExecutionDurationMs"]=0`
  - `item_4` agent_message `"2"`；`turn.completed` usage `input 413111 / cached 148608 / output 154 / reasoning 16`（cached ≤ input 成立）
- 证据等级说明：`mcp list --json` 那次预检（exit 0，92 ms，stdout sha256 `593d7aa3…`）**只证明配置与启用状态**，`result.json mcp.connection = "unverified"` 已如实标注；**真实握手证据是上面 exec 回合内的 `mcp_tool_call` 往返**，两者不要混为一谈。

## 6. 退出码口径（包装器 vs CLI 原生）

| 轮次 | 包装器 `isolated-one-turn.mjs` 退出码 | CLI 原生 `meta.exitCode` | 备注 |
| --- | --- | --- | --- |
| run-01 | `exit=11`（`run.exitcode.txt`） | **1** | stderr 三行 `os error 5`；stdout.jsonl 0 字节 |
| run-03-pinned | `exit=11` | **1** | 同签名，arg0 临时目录 `codex-arg0Ts2LcQ` |
| run-02 | `exit=0` | **0** | `signal=null, timedOut=false, durationMs=39860` |
| run 19–26（正式 0.130 通道） | `exit-1` 文件为 0（run 23 无 exit 文件，取消） | 0 | 由 worker 记录 |

- **11 是包装器自己的"协议判定失败"码**，不是 codex 的原生退出码；先前 summary 里"run-01/03 exit 11"的写法已按此更正为"包装器 11 / CLI 原生 1"。
- 适配器自身的 `error` 文本里出现的"退出码 11"是它把传入的 `code` 直接拼进消息（见上表 D 用例），与包装器码同值属巧合，不应混读。

## 7. 进程/文件完整性记录（只引用已有取证，不新增提权动作）

- `_probe/susp-il-20261106T0205.ps1`（`CreateProcessW` + `CREATE_SUSPENDED`，只查询 token 完整性级别后 `TerminateProcess`）记录：
  - 钉值候选 `D:\AutoAgentloop\tools\codex\0.166.0-alpha.5.1\package\vendor\x86_64-pc-windows-msvc\bin\codex.exe` → **Low (S-1-16-4096)**
  - `C:\Users\19082\.codex-nighttest-20261106\codex-medium.exe` → **Medium (S-1-16-8192)**
  - `D:\_iltest_20261106\codex-copy.exe`（D: 根新目录） → Medium；`D:\AutoAgentloop\_iltest_20261106\codex-copy.exe`（树内） → Low
  - 本 shell / cmd.exe 子进程 → Medium
- run-02 的执行体是 Medium 副本（368970544 B，sha256 `6ca87057…c302c`，与钉值候选**逐字节一致**），故它能在 `C:\Users\19082\.codex` 完成 arg0/sqlite 初始化；run-01/run-03 用 Low 候选则 `os error 5`。
- 未能取得 SACL：`Get-Acl -Audit` 报缺 `SeSecurityPrivilege`，`IsInRole(Administrator)=False` ⇒ Low 标签的**设置源**仍未直接证实，只是通过"换目录就变 Medium"的配对实验定位。

## 8. 复判的局限（别把结论读大）

1. 复判是**同源复核**：输入是当时保存的 stdout，不是独立第三方时间戳；它能证明"给定这些字节，归档适配器必然得出记录的结论"，不能独立证明这些字节确实由本机 CLI 在那个时刻产生（后者由 `meta` 的 spawn 记录、mtime、`version.stdout.log`、`mcp-list.json` 这条记录链支撑）。
2. 本轮零模型调用、零正式 run、worker 未重启、`config.toml` / MCP 配置 / 路由 / 标签 / ACL 全部未改。
3. `run-02` 的 Medium 副本只是**本夜验证入口**，不是对钉值路径的永久修复；永久口径仍待 A 在 FIX-A/B/C 中选定。
