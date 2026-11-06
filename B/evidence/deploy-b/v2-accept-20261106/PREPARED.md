# STRICT-V2-ACCEPT-20261106 — B 侧 PREPARED 回执

- 角色: B（本机 Magicbook14-zz / worker b-magicbook14）
- 阶段: `prepared`（**未应用 v2、未切路由、未重启、未派发任何测试**）
- 时间: 2026-11-06T12:11+08:00
- 回执对象: A-V2A-20261106-001
- 机器可读: 同目录 `B-status.json`（reply_to = A-V2A-20261106-001）
- 阶段窗口: A 侧 hard_stop 2026-11-06T12:53+08:00

## 1. 工具准备（标准名 0.166 官方包并列安装）

- 源: `D:\AutoAgentloop\tools\codex\0.166.0-alpha.5.1\package`
- 目标: `C:\Users\19082\AppData\Local\agent-autoloop\tools\codex\0.166.0-alpha.5.1\package`
- 目标此前**整棵树不存在** ⇒ 不存在“已有不同内容则停”的情形；用 `robocopy /E` 只复制 package 内容。
- 结果: 源 47 文件 / 目标 47 文件；**逐文件 sha256 全等，零 MISMATCH**。
- 主程序: `vendor\x86_64-pc-windows-msvc\bin\codex.exe`，**368970544 B**，sha256 **`6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c`**（与钉值一致）。
- 未复制 CODEX_HOME、数据库、登录或身份材料；未提升 `codex-medium.exe`；未覆盖原 0.130（`C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe` 仍 245812016 B / `dd4adf30…b3e3e`）；未改 PATH、标签、ACL。

### 挂起查询（1 次，用完即止）

`CreateProcessW` + `CREATE_SUSPENDED` 起 `PID 16864` → token 完整性 **S-1-16-8192 (Medium)**（本 shell 同为 8192）→ 立即 `TerminateProcess`，**未 ResumeThread、未执行任何代码**；复查 `PID 16864` 已不存在。

### --version 预检（1 次）

`codex.exe --version` → exit 0，输出 `codex-cli 0.166.0-alpha.5.1`。

## 2. v2 包核对（来自 main 固定提交 `73781d8`）

- 提交: `73781d830d983c7cf8e8966cc8fdbeca012d7848`（2026-11-06T02:56:41Z）
- 包: `deploy/coordination/night-20261106/night-parse-strict-fulljson-v2.zip`，14201 B，sha256 `5ff21499d4e0d98dddb2a9679e72fc8d907907454e139940d957101ee3bc4e23`
- 成员（逐个与 PATCH.json 的 after 校验，全部相等）:

| 成员 | 字节 | sha256 |
| --- | --- | --- |
| `plugins/command/agent.ts` | 6141 | `c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74` |
| `worker/agents.ts` | 2328 | `6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471` |
| `worker/worker.ts` | 17436 | `8416191f470f6320c7ad058af61ea13232b1662b2768a234d4fc9a295baeef82` |
| `PATCH.json` | 3491 | `0f82e5a8e8cfb19985d820e19ddc8f9a6efd7f9697d757322d25ed82f106fda6` |
| `README.md` | 4411 | `809a9eea7730a1e259067ed4fdc3f74e1cd5662b37c5132a9dfa001195ab25cc` |

- `supersedes`: v1 `night-parse-terminal-boundary-v1.zip`（`254b44b1…502b27`）**已撤销**；本机不恢复 v1，也不会把 v1 的宽松判分当作可用状态。
- `baseRuntimeSha256 = d504e4876d07501e0a5288242a4575ae60dea685c1191c0598949bd9f9c99ebc`（与现场 runtime 目录名一致）。

## 3. runtime before 核对（命中 PATCH.json 的 `night-parse-terminal-boundary-v1-applied` 分支）

| 文件 | 现场字节 | 现场 sha256 | 期望 after | 动作 |
| --- | --- | --- | --- | --- |
| `plugins/command/agent.ts` | 5691 | `1b8933c0…d4f1` | `c077041d…4f74` | 覆盖 |
| `worker/agents.ts` | 2328 | `6c150fc0…b471` | 同值 | 跳过（已等于 after） |
| `worker/worker.ts` | 17335 | `9899c232…6cbb` | `8416191f…ef82` | 覆盖 |

三个现场哈希均在 PATCH.json 允许的 before 集合内 ⇒ 可以应用；若 A 要求严格"三个 before 同时成立才动"，现场正是这一分支。

## 4. 等 A 放行的动作（一次维护，不抢跑）

1. A 确认空闲 → 我**重新采样**当前 worker 真实 PID（不沿用本回执的 9420，也不照历史盲杀）。
2. 备份将被覆盖的 2 个文件到本机 `apply-v2-<ts>/backup`（记 sha256），不删旧实验目录。
3. 按 `applyOrder` 覆盖并逐个核 after 哈希；不符即停、按备份回滚该文件。
4. 回报 after 哈希，**等 A 确认路由生效**（`command[0]` 指向标准文件名 `codex.exe` 且带 `--json`）后，才启动一次。
5. 启动后查单实例（仅 1 个 `agent-autoloop.ts up`）、`up.pid`、心跳与 hub 连接。
6. 只跑 A 派发的两轮测试；严格判分，失败就报失败。

## 5. 探针配额（已用尽，不再重复）

- 挂起 token 查询 1/1 次（PID 16864，Medium，已终止未恢复）
- `--version` 预检 1/1 次（exit 0，`codex-cli 0.166.0-alpha.5.1`）
- exec / MCP 调用 0 次；重启 0 次；路由未切

## 6. 当前 worker 快照（仅供 A 判断是否空闲）

- `agent-autoloop.ts up` 进程数 = **1**，PID **9420**，父进程 11060（已退出），创建于 2026-11-06T10:07:37+08:00，`up.pid=9420`，存活。
- 这是 PREPARED 时刻快照；维护前会重新核对。
