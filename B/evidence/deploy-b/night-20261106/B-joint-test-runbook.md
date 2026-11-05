# B 侧六项联调执行手册（NIGHT-20261106-B）

状态时间：2026-11-06T01:53+08:00
执行端：worker PID 11968（b-magicbook14），entry runtime/d504e4876d07/bin/agent-autoloop.ts
模型：deepseek-v4.1-flash-1017（显式 -m），cwd D:\AutoAgentloop，MCP 保持（cua_repl/node_repl enabled，codex_app disabled，config.toml 未改）
执行入口：中完整性字节一致副本 C:\Users\19082\.codex-nighttest-20261106\codex-medium.exe（sha256 6ca87057...302c，368970544B）
前置条件：A 需先决定路由（FIX-A 给 D:\AutoAgentloop 设 Medium 标签 / FIX-B 中心 rules.json command[0] 指向中完整性副本），否则生产路由仍指向 Low 标签钉值路径，任何联调轮次都会在模型开始前 os error 5 退出。

## 通用要求（每轮）
- 只在 A 给的唯一 test_id 下执行，不自行派发；同 request_id 不重复执行。
- 每轮目录：evidence/deploy-b/night-20261106/<test_id>/，driver/prompt 写入轮次目录，OutDir 用该轮新 out 子目录（运行前确认不存在）。
- 运行前核对 argv（exe 路径、-m 模型、-C cwd、--json）、候选 sha256、适配器 sha256（ac23aa9b...894b）。
- 失败保留原始输出与原生退出码（runner exit / codex exit 分开记），有具体修复才复测，不原样重复。
- 真实 exec 预算：已用 3/6，剩余 3；六项中必须真跑轮次优先。

## 第 1 项 派发/执行/回传 + 严格协议 + session + 实际 usage
- A 动作：中心按 test_id 派发一轮 prompt（要求只回固定 token）。
- B 证据：轮次目录内 stdout.jsonl 事件（thread.started / item.completed / turn.completed）、session id、usage.input_tokens/cached/output 非零、适配器严格 JSONL（非 JSON 行不得回退为纯文本）。
- 判定：protocol.pass=true 且 usage 真实且 session 可复用。
- 已具备的同类证据：run-02-20261106T0224（session 01a1acc9-...，usage 413111/148608/154）。

## 第 2 项 合成临时目录增删列清
- B 动作：在 A 指定的合成目录内执行 创建→列目录→删除→再列目录，记录每步 before/after 清单与退出码。
- 证据：文件清单快照（name/size/mtime）、命令退出码、最终目录为空的核验。
- 备注：历史记录显示该项曾因删除策略与权限受限未完成（观测 848），本轮须先确认目标目录在中完整性可写范围内再执行。

## 第 3 项 同会话 回执→卡片→回答→resume
- 顺序：同一 session 内 4 个 turn：①回执 ②卡片 ③回答 ④resume 续接。
- 证据：4 个 turn 的 thread_id 相同；resume 命令未带 -C（适配器 {cwdArgs} 在 resume 时展开为空）；每轮 usage 累加。
- 风险：resume 需中心 rules.json 的 {resumeArgs} 展开正确。

## 第 4 项 运行中取消（排队重试不算）
- B 动作：在轮次运行到中途（stdout.jsonl 已出现 turn.started 且未 turn.completed）发起取消，记录取消时刻与进程退出码。
- 证据：取消后 run 目录内保留 turn.started 且无 turn.completed；原生退出码非 0；取消延迟毫秒数。
- 禁止：把排队等待中的取消当作本项证据。

## 第 5 项 断线/重启/恢复（紧接第 4 项，同一执行端按序）
- 仅 B worker 维护重启（已授权唯一例外）：重启前后记录 PID、启动命令、before/after 哈希、恢复后 session 是否可续。
- 证据：停机时间窗、重启 PID、恢复后 resume 成功或明确失败原因。

## 第 6 项 登录启动项登记与路径核对
- 已完成的静态核对：%APPDATA%\...\Startup\agent-autoloop.cmd（430B，sha256 aa2cfb42...28a6）→ node.exe（v24.12.0, 89935872B）→ runtime/d504e4876d07/bin/agent-autoloop.ts（88B，sha256 614b0eec...043d）；重定向目标 logs\up.log 尚不存在；当前 worker 非由该 cmd 启动（输出在 worker.stdout.log）。
- 未验证：真机重新登录触发。不重登则按约定明确标注「未验证」，不凑 6/6。

## 剩余风险
- hub 可达但 worker 日志末段多次 couldn't reach the hub（503/404/fetch failed，最后一条 2026-11-05T16:56:54Z）。
- 中心 rules.json 不在本机，路由修正只能由 A 执行。
