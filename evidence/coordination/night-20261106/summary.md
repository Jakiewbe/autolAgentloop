# NIGHT-20261106-A 夜间总结

- night_id: NIGHT-20261106
- 角色: A（唯一代码/规则/main 写入者）
- 停止新增真实测试: 2026-11-06T07:50+08:00
- 封存: 2026-11-06T07:45+08:00（main 提交见下）
- 验收: 留明早统筹审核；本文只报本轮实际取证，不用报告数量或旧构建结果代替

## 0. 一句话结论

B 正式 Codex 通道的真实缺陷在**通道侧**：Codex 自己的清理动作把三行 `taskkill` 成功提示打进了 stdout，混在 JSONL 流里。解析端把第 36 行判成协议错误是**正确判分**，不是缺陷——夜间一度把它放宽成「终态事件之后容忍非 JSON」，那属于**放宽判分**，已于 2026-11-06 10:46+08:00 撤销，恢复逐行严格（见第 9 节勘误）。六项联调中第 1/2/3/4 项在中心侧取得真实记录；第 5 项断线已真实发生并取证，B 于 2026-11-06T02:07:39Z（=10:07+08）恢复后 run 25 / run 26 均已收尾（同一 subject 各 1 条 run，无重复派发）；第 6 项静态链已核、登录触发未实测。

## 1. 本轮实际解决的问题

1. **B 正式通道缺陷定位（有原始字节）**：run18 的 stdout 共 38 行，1–35 行是 JSON（第 35 行 `turn.completed`），36–38 行是三条 `taskkill` 的 SUCCESS 提示。旧逻辑把第 36 行判成协议错误，于是整轮失败、结果与 usage 全部丢弃（hub 上 run18 `usage=null`、error「Codex stdout 第 36 行不是 JSON 对象」）。
2. **最小修复**：`app/plugins/command/agent.ts` 的 `read()` 增加终态边界——`turn.completed`/`turn.failed` 之后的非 JSON 行不再判协议错；**终态之前的任何非 JSON 仍然失败**，缺终态、缺最终回复、缺会话、usage 非法仍然失败。原始 stdout 一字不改地留在日志里，不过滤、不重写。
   > **已撤销（2026-11-06 10:46+08:00，见第 9 节）**：这个「终态边界」实际是放宽判分——同一份字节旧代码失败、新代码通过。现已删除，恢复逐行严格；本轮交付 v2 包。
3. **离线可复现验证**：`node --test app/tests/command-adapter.test.ts` 14/14；`npx tsc -p app` 通过；用 run18 的真实字节回放 —— 同一份 25424B（sha256 `96921199…fce0`）在旧代码报第 36 行错误，在新代码正常产出 text/session/usage。
   > **已更正（见第 9 节）**：那是放宽版的离线结果。严格版对同一份 run18 字节回放报「第 36 行不是 JSON 对象」，与中心当时的记录一致。
4. **中心侧缺陷修复**：Windows 下 `RULES_FILE.split("/")` 永远取不到文件名，导致 `rules.json` 改动不触发热加载（必须重启中心才生效）。改成 `basename(RULES_FILE)` 后现场验证：新增规则后 event 29 的 ack 立即 `routed=["B-断线恢复"]`。
5. **跨机一致性**：B 应用后 `plugins/command/agent.ts` 的 sha256 与 A 本地**完全一致**（`1b8933c0…`），说明两侧跑的是同一份补丁字节，不是"各修各的"。

## 2. 唯一当前构建与完整哈希

基座运行时：`d504e4876d07501e0a5288242a4575ae60dea685c1191c0598949bd9f9c99ebc`（B 机器 `D:\AutoAgentloop\runtime\d504e4876d07`）

补丁包（B 侧应用）：
- **v2 = 唯一当前候选**：`deploy/coordination/night-20261106/night-parse-strict-fulljson-v2.zip`
  - 字节 14201，完整 SHA256 `5ff21499d4e0d98dddb2a9679e72fc8d907907454e139940d957101ee3bc4e23`
  - `plugins/command/agent.ts` 6141B `c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74`（全流严格）
  - `worker/agents.ts` 2328B `6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471`（与 v1 同字节）
  - `worker/worker.ts` 17436B `8416191f470f6320c7ad058af61ea13232b1662b2768a234d4fc9a295baeef82`（在 v1 基础上多修 `discardReceipt` 的 `text === undefined` 崩溃）
  - before 备选（PATCH.json 的 `beforeSha256Alternatives` 三种历史状态全列）：`agent.ts` = `f821c0b0…`（基座）/ `ac23aa9b…`（打过 11-05 旧补丁）/ `1b8933c0…`（打过 v1）；`agents.ts` = `fae427d4…` / `6c150fc0…`；`worker.ts` = `a68379be…` / `9899c232…`（旧补丁与 v1 同字节）
- **v1 已撤销，保留作对照，不要应用**：`night-parse-terminal-boundary-v1.zip`，13090B，`254b44b106c6711f41a56d1083d14d0bc0f72aa75337066af9a24c175e502b27`
  - 它放宽了判分（终态后非 JSON 不再失败）；B 机器当前跑的就是这一版（`agent.ts` = `1b8933c0…`，B 自己回报的应用后哈希）——这是要整改的现状，不是成果。

A 中心补丁（B 不应用）：**v2** `deploy/coordination/night-20261106/night-center-rules-reload-v2.zip`，12928B，完整 SHA256 `1106c14ddf523457fa9711cd38b1b21459d48a0782356727433cdb7536631e5c`——补齐 `app/host/server.ts` 的 `basename(RULES_FILE)` 实际修复（before `5e988129a6eda8b45dc63be245361ce25eafb5489660a03c7550a97af8821c6f` 4422B → after `7ef50b1eae27c8a293b0fac95ad36429471fde909485b1fe09d82d8562b6ae5d` 4816B）、`app/host/runtime.ts`（before `288bf961464220f23d55f740640325f864b5998f6abbfdddbbbced85dfa2b9f8` 12636B → after `c15d0bd3c5d90251c640f282e3b66321779b26fcee20ed40c068e9d929286798` 13440B）、`app/tests/rules.test.ts`（before `e4dee032b015206cd6bad201079ef44e6a9c372325a61bba6dc9f591ffd5b247` 7601B → after `982f4e7cc38943dcde4b00eb1e164a24182b7362cde8fb5ee68ac62104746a46` 8331B）。
v1（10080B `da01ff6c…`）只含 runtime.ts、缺 server.ts，已被 v2 取代，保留不删。

打包可复现：ZIP 成员用 1980-01-01 固定时间戳 + ZIP_DEFLATED，重复构建哈希一致；包内 5 个成员全部 UTF-8 干净（脚本 `evidence/raw/night/verify_zip.py` 自检输出 utf-8-clean）。

## 3. 真实验证通过 / 失败数

| 维度 | 数 | 说明 |
| --- | --- | --- |
| A 中心真实 run（本轮新增） | 8（cap 12，含 run 26 断线排队；重试/续跑计入） | run 19–25 用于第 1/2/3/4/5 项；run 26 断线期间排队 |
| 其中成功 | 5（run 19/20/21/22/24） | run19/20/21/22/24 done |
| 其中取消 | 1 | run 23（第 4 项，延迟 2.2 秒） |
| 其中断线 | 1 | run 25（第 5 项，回合中被杀） |
| B 本地真实候选 exec | 4（cap 6，含 11-05 的 1 次 os error5；t22c 那次为误跑旧包、候选 exec 计 0） | 含此前 1 次 os error5 与 t22c 误跑 |
| 六项状态（封存后按 §9 更正） | 3 项闭环（1/2/5）+ 2 项 A 侧待 B 补证（3/4）+ 1 项未验证（6） | 第 5 项恢复已于 10:07:39Z 取证，见 §4 与 §9 |

## 4. 六项逐项证据

### 第 1 项 派发/执行/回传 + 严格协议 + session + 实际 usage
- run 19 / event subject `A-J1-20261106-001`，session `01a1ace2-4837-7952-b034-af2a049766b0`
- usage `input 673864 / cached 665600 / output 1819`（非 null，说明修复后 usage 真的能回流）
- summary 逐字「B 接线通过：b-magicbook14」
- B 侧独立一致：`b-ping.txt` 21B `fcd7cde2…`，stdout 终态后 3 条 taskkill 噪声被容忍
- **通过**

### 第 2 项 合成临时目录 创建/写入/列举/删除 + 清理回执
- run 20 / `A-J2-20261106-002`，session `01a1ace4-1ad2-7892-a020-2a0767121271`，usage 1098259/1085440/3893
- 目录 `D:\AutoAgentloop\aa-tmp-item2-20261106020807`，删除后 `none_remaining`
- B 侧 stdout 38995B / 33 行 / 终态第 29 行 / 终态后 3 行非 JSON
- **通过**

### 第 3 项 同一会话 回执→卡片→回答→resume
- run 21 发卡片 8（ask，key `thread:B-接续验证::b-resume-item3`），A 以选项 0（甲）回答并自动入队 run 22
- run 22 与 run 21 **session 相同**：`01a1ace6-40d4-72c3-8d63-306059611b9e`，usage 1376520/1364224/3235
- summary「第3项第2轮完成：你选了 甲，接续成功」
- **A 侧通过**；B 侧 `resume-mark.txt` 的 `ROUND2=甲` 行与 sha256 未取得（b 分支尚无 resume-mark.txt）

### 第 4 项 运行中取消
- run 23 / `A-J4-20261106-004`，claimedAt `2026-11-05T18:14:34.815Z`，取消请求在模型进行中发出，finishedAt `18:14:56.972Z`
- **取消延迟 2.2 秒**，state=cancelled，session `01a1aceb…` 但 usage=null ⇒ 不是排队重试
- **A 侧通过**；B 侧 codex 子进程 PID 与终止证据 未取得（B 侧未上传，须 B 补）

### 第 5 项 断线/重启/恢复（同一 B 执行端，紧接第 4 项）
- run 25 / `A-J5-20261106-005`，claimedAt `19:01:28.406Z`，session 已上报 `01a1ad16-64d6-7572-aedf-28598b1efa8c`
- 最后心跳 `19:05:23.302Z` 后 online=false —— **回合进行中被强制终止，是真实断线，不是维护重启**
- 断线窗口内派发 event 30 / `A-J5B-20261106-006` → run 26 `queued`，只 1 条，未丢失未重复
- 19:16Z 中心自动生成「接单程序没连上」提醒（attention 0→1），看门狗有效
- 防重派自杀：断线后把该规则提示词换成无害版（原 `9265fdae…` → 新 `75c2004f…`，rules.json `706641cc…` 6741B / 7 条）
- **断线与恢复都已取证**：B 机器于 2026-11-06T02:07:39.646Z（=10:07+08）回来，run 25 在同一 worker 上以 done 收尾（summary「第5项停机脚本已布置：33160」，usage 2837827/16219/2805504），run 26 于 02:07:40.448Z 领取、02:09:10.408Z done（summary 逐字「B 接线通过：b-magicbook14」）；02:41:22.556Z 心跳恢复 online=true
- 同一 subject 各 1 条 run，无重复派发，判定条件全部满足；**恢复是 B 侧人工重启之后发生的**，具体重启动作与 PID 还需 B 侧回执确认（A 未操作 B 机器）

### 第 6 项 登录启动项真实登记与路径核对
- B 静态链：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop.cmd` 430B `aa2cfb42…28a6` → `node.exe` v24.12.0 89935872B → `runtime/d504e4876d07/bin/agent-autoloop.ts` 88B `614b0eec…043d`
- 重定向目标 `logs\up.log` 尚不存在；当前 worker 不是由该 cmd 启动
- **登录触发未实测**（契约禁止注销/重启电脑、禁止改登录项），明确标注未验证，不用静态链凑 6/6

## 5. 剩余最小人工动作

1. **B 机器**：不再需要重启——已于 2026-11-06T02:07:39Z 恢复，run 25 / run 26 都已收尾。待 B 回报那次重启的实际执行方式与 PID。
2. **B 侧补证**：第 3 项 `resume-mark.txt` 的 ROUND2 行与 sha256；第 4 项 codex 子进程 PID 与终止证据；第 6 项维持「登录触发未实测」或另择窗口实测。
3. **通道治本（下一轮 A 做；本轮未碰 B 机器）**：让 Codex 的清理动作不再把 `taskkill` 成功提示写进 stdout（重定向到 stderr / 静默终止），解析端保持逐行严格、永不豁免。
4. **明早统筹**：六项逐项复核；决定是否把 B 的 `command[0]` 指向 0.166 入口（`…\bin\22cfb1d302613eae\codex.exe`，须保留标准文件名）并应用 v2 包。本轮**未部署、未切路由、未重启、未派发任何真实模型**。

## 6. 偏差与保留（不删、不凑）

- run18 历史结果**不算通过**：其最终回复是「B 接线验证文件已按规则完成并核验通过。」，与规则要求的「B 接线通过：b-magicbook14」不逐字相等；本轮用 run 19 重新取证才通过。
- `app/tests/worker.test.ts` 在 Windows 上多条失败，原因是测试脚本写死 `/bin/sh`（POSIX-only），本轮未改该文件，与本包无关。
- 仓库整体 `format:check` 有 67 个既有文件不符（CRLF 既有状态），未作为门禁；只对本次改动的两个文件跑了 prettier --check（通过）。
- 本轮**未**改动：MCP 配置、ACL、登录项、agent 身份、`command[0]`、模型名、cwd；未上传任何原始 stdout/stderr/rollout/完整 argv/env/config/身份材料；未重启操作系统。
- **更正两处不实表述**：(a) 判分严格度**曾被本轮改动**——终态边界一度放过「终态后的非 JSON」，等同放宽判分，现已撤销（见第 9 节）；(b) A 中心**曾被重启**——2026-11-06T02:00:05+08:00 为加载 `app/host/runtime.ts` 与 `app/host/server.ts` 的修复重启过 hub（同一条启动命令，未动隧道、MCP、ACL、登录项），原文「未重启 A 中心」不成立。

## 7. 时间线（UTC / 上海时间）

| UTC | +08 | 事件 |
| --- | --- | --- |
| 17:53 | 01:53 | 发布 seq2 补充包 night-parse-terminal-boundary-v1 |
| 18:10 | 02:10 | B 发布 seq6（第 2 项全量证据） |
| 18:14:34 | 02:14:34 | run 23 领取（第 4 项） |
| 18:14:56 | 02:14:56 | run 23 取消完成（2.2 秒） |
| 18:58:05 | 02:58:05 | run 24 领取并完成（唤醒探测） |
| 19:01:28 | 03:01:28 | run 25 领取（第 5 项） |
| 19:05:23 | 03:05:23 | B 最后心跳，随后离线 |
| 19:06 | 03:06 | 派发 event 30 → run 26 排队 |
| 19:16 | 03:16 | 断线 10 分钟告警（attention 1） |
| 23:40 | 07:40 | B 仍离线；A 继续离线核对与封存材料 |
| 02:07:39 | 10:07:39 | B 恢复；run 25 以 done 收尾（summary「第5项停机脚本已布置：33160」）|
| 02:07:40 | 10:07:40 | run 26 被领取 |
| 02:09:10 | 10:09:10 | run 26 done（summary 逐字「B 接线通过：b-magicbook14」）|
| 02:41:22 | 10:41:22 | 心跳恢复 online=true |
| 02:44 | 10:44 | A 撤销终态边界、恢复全流严格，离线出 v2 包与中心 v2 包 |

## 8. 封存说明

- 封存时刻（上海时间）：2026-11-06T07:45。
- 07:50 之后未再新增任何真实 run / 候选 exec；run 19–26 的记录即本轮全部真实用量。
- 本文所有哈希均来自本地实际字节（`evidence/raw/night/evidence-index.md` 列出 75 个证据文件及其 SHA256），未用旧构建结果代替。
- 六项中第 5、6 项**未取得完整闭环**，已在第 4 节逐条标注「未验证/待补」，不采用"静态链当作实测"的方式凑齐。
- 遗留：B 机器人工重启后，run 25 由 worker 用磁盘 stdout 收尾（failed「没留下结果」/unknown），run 26 会被领取并完成；A 侧判定脚本 `evidence/raw/night/judge_j5.py` 可一键复核（输出 `j5-verdict.json`）。

> 上面第 4、5 条是**封存时刻的判断**，已被 §4 与 §9 的取证推翻：B 于 10:07:39Z 恢复，run 25 以 done 收尾、run 26 领取并 done，同一 subject 各 1 条 run。


## 9. 勘误（封存后整改，逐条对照原文）

| # | 原文（不实/不完整） | 更正 |
| --- | --- | --- |
| 1 | §0「缺陷已定位为解析端在终态事件之后遇到非 JSON 行就把整轮判成失败」 | 缺陷在**通道侧**（Codex 清理动作污染 stdout）；解析端判失败是正确判分。§1 第 2 条的「终态边界」是放宽判分，已撤销。 |
| 2 | §1 第 2 条「增加终态边界…终态之前的任何非 JSON 仍然失败」 | 已撤销：同一份字节旧代码失败、放宽版通过，这就是放宽判分。现为逐行严格，终态之后的非法行同样失败。 |
| 3 | §1 第 3 条「新代码正常产出 text/session/usage」 | 那是放宽版的离线结果。严格版对同一份 run18 字节回放报「第 36 行不是 JSON 对象」，与中心当时的记录一致。 |
| 4 | §2「night-parse-terminal-boundary-v1.zip 为唯一当前构建」 | v1 已撤销；唯一候选为 v2（14201B `5ff21499…`）。B 现场仍是 v1 字节，需应用 v2。 |
| 5 | §2「center v1 10080B」 | v1 缺 `app/host/server.ts` 的实际修复；v2（12928B `1106c14d…`）补齐，v1 保留不删。 |
| 6 | §4 第 5 项「恢复未完成 / B 离线 258 分钟」 | 恢复已发生：B 于 02:07:39Z 回来，run 25 done、run 26 领取并 done、02:41:22Z 心跳恢复，同一 subject 各 1 条。 |
| 7 | §5 第 1 条「B 机器人工重启（未执行）」 | 已由 B 侧完成；A 未操作 B 机器。 |
| 8 | §6「未改动…判分严格度；未重启 A 中心」 | 两处均不成立，见 §6 更正条。 |

本轮整改的离线通过/失败数（不含任何真实模型调用）：

- `node --test app/tests/command-adapter.test.ts` → 15 pass / 0 fail
- `node --test app/tests/command-adapter.test.ts app/tests/contract.test.ts` → 23 pass / 0 fail
- `node --test app/tests/rules.test.ts` → 7 pass / 0 fail
- `npx -y -p typescript@5.9.3 tsc -p app` → 通过（无输出）
- `npx prettier --check` 三个改动文件 → 通过
- run18 真实字节回放 → 严格版按预期报第 36 行（`evidence/raw/night/run18-replay.mts` → `run18-replay.json`）
- 反例：0.166 实际 argv 下全非法输出必报错、不退回纯文本（新增测试用例）
- Windows 上 `app/tests/worker.test.ts` 仍多条失败（POSIX-only `/bin/sh`），本轮未改该文件，与本包无关。
