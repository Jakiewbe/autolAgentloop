# 版本验收记录 — v2 候选（STRICT-V2-ACCEPT-20261106）

- 阶段: STRICT-V2-ACCEPT-20261106；request_id: A-V2A-20261106-001
- 被测候选: night-20261106-parse-strict-fulljson-v2（night_id 材料见 night-20261106）
- 记录生成（上海）: 2026-11-06T12:16+08:00
- 记录方式: 本人实际执行命令，下表的数字全部来自命令输出；原始日志留在 A 本机（本文件只给路径与哈希，不上传原始输出）

## 1. 固定包核对（命令: 逐包 zipfile 打开 + 逐成员 SHA256）

| 包 | 字节 | SHA256 | testzip |
| --- | --- | --- | --- |
| deploy/coordination/night-20261106/night-parse-strict-fulljson-v2.zip | 14201 | 5ff21499d4e0d98dddb2a9679e72fc8d907907454e139940d957101ee3bc4e23 | null |
| deploy/coordination/night-20261106/night-center-rules-reload-v2.zip | 12928 | 1106c14ddf523457fa9711cd38b1b21459d48a0782356727433cdb7536631e5c | null |
| deploy/coordination/night-20261106/night-parse-terminal-boundary-v1.zip（旧包，保留不动，已撤销） | 13090 | 254b44b106c6711f41a56d1083d14d0bc0f72aa75337066af9a24c175e502b27 | null |
| deploy/coordination/night-20261106/night-center-rules-reload-v1.zip（旧包，保留不动，已撤销，缺 server.ts） | 10080 | da01ff6c696edb56d2e26bb8b5d9de370897a29892e64ea3c59a252d6631cfc8 | null |

## 2. 工作树与包 after 逐文件比对（命令: 比对 SHA256）

| 文件 | 字节 | 工作树 SHA256 | 与包 after 一致 |
| --- | --- | --- | --- |
| app/plugins/command/agent.ts | 6141 | c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74 | 是 |
| app/worker/agents.ts | 2328 | 6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471 | 是 |
| app/worker/worker.ts | 17436 | 8416191f470f6320c7ad058af61ea13232b1662b2768a234d4fc9a295baeef82 | 是 |
| app/host/server.ts | 4816 | 7ef50b1eae27c8a293b0fac95ad36429471fde909485b1fe09d82d8562b6ae5d | 是 |
| app/host/runtime.ts | 13440 | c15d0bd3c5d90251c640f282e3b66321779b26fcee20ed40c068e9d929286798 | 是 |
| app/tests/rules.test.ts | 8331 | 982f4e7cc38943dcde4b00eb1e164a24182b7362cde8fb5ee68ac62104746a46 | 是 |

结论: 中心两个文件（server.ts / runtime.ts）在 A 侧已等于 after ⇒ 本阶段对中心只记 «already applied»，**不覆盖、不重启中心**。

## 3. 回归与类型检查（命令输出为准）

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `node --test app/tests/command-adapter.test.ts app/tests/contract.test.ts app/tests/rules.test.ts` | 0 | tests 30 / pass 30 / fail 0 / cancelled 0 / skipped 0 / todo 0（duration 567ms） |
| `npx -y -p typescript@5.9.3 tsc -p app` | 0 | 输出 0 字节（通过；仓库本地无 typescript，用 npx 固定 5.9.3） |
| `node --experimental-strip-types evidence/raw/night/run18-replay.mts` | 0 | stdout_lines 38、non_json_lines [36,37,38]、reading = {`error`:"Codex stdout 第 36 行不是 JSON 对象，原始输出保留在日志中", `session`:"01a1ab19-c2f1-7681-aa54-8c3971d344d6"} ⇒ 真实 run18 字节在严格判分下必然失败，判分未放宽 |
| `npx prettier --check`（6 个包内文件 + command-adapter.test.ts） | 1 | 见下条说明 |

本地日志（A 本机，未上传）: tests.log 2808B 230a4711…335f、tsc.log 0B e3b0c442…b855、replay.log 315B 555568f4…dbf2、prettier.log 181B 19931a20…0f8、prettier-head.log 415B bc7daf99…3de1。

## 4. 全流严格反例（Windows 执行端相关）

- 终态后的 taskkill 噪声：`agent.ts` 现在逐行严格，第 4 行即报 /不是 JSON 对象/、`text` undefined、`usage` undefined，日志仍保留原字节 —— 该用例由「放行」翻转为「必失败」。
- 拟用 0.166 实际命令：`[C:\Users\19082\AppData\Local\OpenAI\Codex\bin\22cfb1d302613eae\codex.exe, exec, resume, 01a1ad16-…, --skip-git-repo-check, --json, -m, deepseek-v4.1-flash-1017, P]` 喂 `["", "not JSON", "成功: 已终止 PID 16344 的进程。", "[]", "\"text\"", "null\r\n{}\r\n"]` ⇒ 必报错、不退回纯文本。
- 同一 argv 把 codex.exe 改名 codex-0166.exe ⇒ 退回纯文本 {text:"plain answer"}，证明识别依据是「标准文件名 codex.exe|cmd|bat + --json」，不是路径。
- Windows 细节覆盖：argv 用 Windows 绝对路径（反斜杠，basename 走 node:path/win32）；stdout 含 CRLF 行；均在本轮 30 条通过用例内。

## 5. 已知边界（不追认）

1. `app/tests/worker.test.ts` 为 POSIX-only（写死 `/bin/sh`），Windows 上多条失败；本轮未改该文件，未把它计入通过数。
2. prettier：`agents.ts` / `server.ts` / `runtime.ts` 报格式不符。核实为**既有漂移**——把 HEAD 版本取出来（LF 归一）跑同一配置同样报不符，且这三个文件的字节是被审包的一部分，本阶段不重排格式以免改变已审 after 哈希；本轮由 A 改写的 `agent.ts`、`worker.ts`、`command-adapter.test.ts` 均通过。
3. 第 6 项真实登录触发仍未验证；取消/断线只在旧 0.130 + 夜间字节上测过，对标称 0.166 + v2 组合未重测；改名 CLI 纯文本回退分支仍存在，未被批准为正式形态。

## 6. 本记录不覆盖的内容

- 不覆盖真实模型执行（本阶段前两条正式执行尚未派发）。
- 不覆盖 B 侧应用结果（待 B 回 PREPARED 与 after 哈希）。
- 不作六项总验收，不宣布最终通过。

## 7. 当前技术基线（2026-11-06 静态收口）

- 基线：**0.166 标准名入口（codex.exe 368970544B / 6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c）+ 严格 v2 全流 JSON 判定（agent.ts 6141B / c077041d…、worker.ts 17436B / 8416191f…）**；统筹已认可为当前正式技术基线，未宣布六项总验收。
- 真实验证：run 29 / run 30 正式执行 2/2 通过（attempts 0、0 重试、0 非 JSON 行、native exit 0、MCP node_repl 返回 2 与 4、同 session resume）；另有 run 27 一次真实模型调用（准备回合）⇒ 本阶段真实模型调用 ≥3 次；run 28 未被领取，不计执行。
- 临时规则收尾：只移除 V2-准备 / V2-验收 / V2-应用 三条，rules.json 13283B → 6650B（7 条），备份 rules.json.bak-v2accept-cleanup；agents 段与其余顶层键逐字未变；热加载已在 hub 事实库确认（seq 8095 / 04:55:58Z）；无待执行任务。
- 调度规则：准备、维护、发布由 B 端 DSH 完成，不派给被测模型；hub 事件只用于需要被测模型真实执行的验收回合。
- 本记录仍不覆盖：六项跨机联调重做、中心包部署（night-center-rules-reload-v2.zip 1106c14d… 只核对未部署未重启）、历史失败行与旧包的撤销/保留状态不变。
