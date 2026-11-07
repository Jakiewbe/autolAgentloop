# B2-report · B2-20261107（B 机 b-magicbook14）

生成时间：2026-11-07 14:26 +08:00
主机：MAGICBOOK14-ZZ（worker-only，无 hub、无 /healthz、无 owner 密钥）
工作副本：D:\AutoAgentloop\work\agent-autoloop，HEAD c067fdbce6e75dead344a5f386bfd3e3164bd7f9，git status --porcelain 0 行（本单全程未改工作副本）
生产运行面：D:\AutoAgentloop\release\b-c067fdb-20261107 + C:\Users\19082\.agent-autoloop

## 0 一句话状态

B2 的 before 快照与四条断言的基线已采到（14:14:49），**after 快照未采：需要真人注销重登**，本单在此处按第 9 条阻塞处理，未自行重启进程掩盖。
B4 断言脚本、临时目录凭据扫描、断链兜底观测脚本、门槛复跑四项已完成。
另有一条本单期间新出现的现场事实：**14:13:48 起 worker 再次连续拿不到中台（503/404 交替）**，见 §6。

## 1 B2 注销重登：before 快照（已完成）

文件：evidence/20261107-logon/before-b2-1420.txt（124 行，14:14:49 采集）
采集脚本：evidence/20261107-logon/capture.ps1（-Phase before -Out …）

四条断言在 before 侧的取值：

| 断言 | before 取值 | 结果 |
|---|---|---|
| 计划任务 \agent-autoloop 只有 1 条且 Running | Get-ScheduledTask 全集仅 \agent-autoloop，State=Running，LastRunTime=11/07 03:11:17，LastTaskResult=267009（0x00041301 运行中，不是错误码） | 基线成立 |
| node 进程恰好一组 | wscript.exe pid=13404 → node pid=1856（host/background.ts，start 03:12:28）→ node pid=17168（bin/agent-autoloop.ts up，start 03:12:28）；无第二组 | 基线成立 |
| 无新增控制台窗口 | EnumWindows 筛 ConsoleWindowClass = 3 个，全部 visible=False：pid=21452（.dsh bash.exe）、pid=1856（node.exe）、pid=20152（cli-proxy-api.exe） | 基线=3 |
| up.pid 与实际 pid 一致 | up.pid 文件内容 17168；实际 up 进程 17168 | 一致 |

端口快照：evidence/20261107-final/logs/ports-b2-before.txt（全量 Get-NetTCPConnection -State Listen 列表）。
本机 node 监听只有 **18787**，属 billion-context：pid=20564，「node.exe C:\Users\19082\.dsh\profiles\desktop\node_modules\billion-context\dist\index.js start --host 127.0.0.1 --port 18787」，不是 agent-autoloop。3300–3500 与 4347 全程无监听。

未做：after 快照。原因见 §8 阻塞项——注销会中断当前会话，必须真人执行；按工单第 9 条「注销后起不来…立即停」的前置要求，before 已在注销前落盘。

## 2 B4 落地：只读断言脚本（已完成）

脚本：evidence/20261107-final/scripts/assert-home-not-in-dtree.ps1
解析口径与 host/home.ts:5 完全一致：process.env.AGENT_AUTOLOOP_HOME ?? path.join(homedir(), '.agent-autoloop')；判定先于任何文件读写，命中禁区直接 exit 2，不做任何 read/write。

运行输出：evidence/20261107-final/logs/b4-home-assert.txt（5 个用例）

| 用例 | 输入 | 期望 | 实测 |
|---|---|---|---|
| 1 | 当前环境（AGENT_AUTOLOOP_HOME 未设，默认 homedir） | PASS | OK home=C:\Users\19082\.agent-autoloop，source=default(homedir)，exists=True，EXIT=0 |
| 2 | -CandidateHome D:\AutoAgentloop\x | REFUSED | VIOLATION，EXIT=2 |
| 3 | -CandidateHome D:\AutoAgentloop\work\agent-autoloop\.home | REFUSED | VIOLATION，EXIT=2 |
| 4 | -CandidateHome D:\AutoAgentloop（根本身） | REFUSED | VIOLATION，EXIT=2 |
| 5 | -CandidateHome %LOCALAPPDATA%\agent-autoloop-home | PASS | OK，exists=False（尚未创建），EXIT=0 |

判据命中：当前 HOME 通过、伪路径报错退出。

已知限制登记（不改 DACL，按 A 侧方案乙）：

- host/files.ts:5-17 的 privateDirectory() 会 SetAccessRuleProtection(true,false)，丢弃全部继承 ACE，只留 owner + S-1-5-18，并重写 owner 段。
- 在 D:\AutoAgentloop 整棵子树内的对象上执行会抛 UnauthorizedAccessException「尝试执行未经授权的操作。」；根因已收敛到 **owner 段**：D 树子对象上没有 WRITE_OWNER 继承（不是缺 WRITE_DAC）。证据：evidence/20261107-final/B4-root-cause.md 与 logs/b4-owner-clause-probe.txt。
- 因此 HOME 必须在 D:\AutoAgentloop 之外（当前为 C:\Users\19082\.agent-autoloop，合规）；隔离候选目录用 %LOCALAPPDATA%\agent-autoloop-home。
- 这是对象属性，不是能力缺失；补 WriteDAC 会在根目录自我剥夺并向下传播，故不补。

## 3 残留与临时目录凭据扫描（已完成，未删除任何文件）

脚本：evidence/20261107-final/scripts/scan-temp-homes.ps1
输出：evidence/20261107-final/logs/temp-home-credential-scan.txt

- 扫描范围：%TEMP%\agent-autoloop-*（24 个目录，逐个递归列文件、体积、mtime，并对文件名命中 master.key / config.json / hub.db / secrets.env / *.key / *credentials* / *token* 的文件算 SHA256 与生产同名文件比对）。
- 生产家目录 C:\Users\19082\.agent-autoloop 实际只有 config.json（sha256 68085FBE…C8BF）、up.pid、logs/、worker/：**没有 master.key，也没有 hub.db**（本机是 worker-only）。
- 命中 15 个文件，分布在 6 个目录，全部为测试产物：

| 目录 | 命中文件 | 判定 |
|---|---|---|
| agent-autoloop-conformance-qevflD | hub.db 311296 B、master.key 43 B | 测试 hub 生成，非生产 |
| agent-autoloop-http-AGzWpb | hub.db 249856 B、master.key 43 B | 同上 |
| agent-autoloop-state-timers-3WNCCl | hub.db 180224 B、master.key 43 B | 同上 |
| agent-autoloop-state-timers-NNcHaa | hub.db 180224 B、master.key 43 B | 同上 |
| agent-autoloop-state-timers-pPxFQl | hub.db 176128 B、master.key 43 B | 同上 |
| agent-autoloop-state-timers-Q1fesU | hub.db 180224 B、master.key 43 B | 同上 |
| agent-autoloop-up-lock-xp0S12 | config.json 490 B、hub.db 159744 B、master.key 43 B | 测试配置：url 主机 127.0.0.1，含 worker.key 与 owner 字段（测试值）；与生产 config.json 哈希不同 |

- 结论：**0 个生产凭据命中**。所有 master.key / hub.db 均为本机测试实例自己生成的（生产家目录根本没有这两个文件）；唯一一个 config.json 指向 127.0.0.1，是测试 hub 的配置。
- 未删除。若批准清理，命令（逐条、只针对这 24 个测试目录，执行前后各存一次目录清单）：

```powershell
# 清理前
Get-ChildItem $env:TEMP -Directory -Filter 'agent-autoloop-*' | Select-Object Name,LastWriteTime | Sort-Object Name | Out-File D:\AutoAgentloop\evidence\20261107-final\logs\temp-cleanup-before.txt
# 删除（24 个测试家目录，不含生产家目录）
Get-ChildItem $env:TEMP -Directory -Filter 'agent-autoloop-*' | Remove-Item -Recurse -Force
# 清理后
Get-ChildItem $env:TEMP -Directory -Filter 'agent-autoloop-*' | Select-Object Name | Out-File D:\AutoAgentloop\evidence\20261107-final\logs\temp-cleanup-after.txt
```

第一轮中断留下的 8 个目录（plugin-trouble ×7 + service-PYoJaH）与本轮 2 个孤儿进程（pid 16820 background.ts、pid 1848 up）在上一轮已清：现在 agent-autoloop-plugin-trouble* 与 agent-autoloop-service-PYoJaH* 存在数均为 0。

## 4 断链兜底：本地观测（已完成，只加观测不改配置）

脚本：evidence/20261107-final/scripts/hub-gap-watch.ps1
记录文件：evidence/20261107-final/hub-gap-log.txt（同一故障只记一行，故障键=连续失败段的起始时间戳，存 evidence/20261107-final/hub-gap-state.txt）
默认读：C:\Users\19082\.agent-autoloop\logs\up.log

规则（脚本内有注释，可按行核对）：

1. 只看带 ISO 时间戳的行，失败判定为消息含 "couldn't reach the hub"。
2. 从最后一条带时间戳的日志往回走，连续失败段在两种情况下断开：遇到非失败行；或相邻两条日志时间差 > 5 分钟（进程重启、停摆不算同一段故障）。
3. 若最后一条日志距今已静默 > 5 分钟，判定该段已结束，不记（worker 成功轮询不写日志，静默通常意味着通了）。
4. 跨度 = min(now, 最后一条失败时间) − 段起始时间，即**失败实际持续时长**，不是「距开始过了多久」；避免 worker 恢复静默后仍在累加分钟数。
5. 跨度 ≥ 10 分钟且该段起始时间未记录过 → 追加一行；起始时间写进 state 文件，同一段只记一次。

测试输出：evidence/20261107-final/logs/hub-gap-watch-test.txt

| 用例 | 输入 | 期望 | 实测 |
|---|---|---|---|
| T1 | 合成日志（30 s 一条失败，共 25 条，12 分钟），-Now=首条+4.5 min | 不记 | below threshold，0 条 |
| T2 | 同上，-Now=首条+12.5 min | 记 1 条 | recorded，1 条 |
| T3 | 同上，-Now=首条+39.5 min | 不重复 | already recorded，仍 1 条 |
| T4 | 生产 logs/up.log，真实 now（当时段长 6.7 分钟） | 不记 | below threshold，0 条 |
| T4b | 同上，真实 now（段长 9.6 分钟） | 不记 | below threshold，0 条 |
| T4c | 同上，真实 now（段长 12.3 分钟，14:13:48 → 14:26:08） | 记 1 条 | recorded，hub-gap-log.txt 出现 1 行；再跑一次不再记（state 命中） |
| T4d | 同上，把 now 拨到段尾 +30 分钟（模拟恢复后静默） | 判定段已结束，不记 | no ongoing outage（静默 > 5 分钟） |
| T5 | 假运行：node bin/agent-autoloop.ts up，AGENT_AUTOLOOP_HOME=%TEMP%\agent-autoloop-gapwatch-probe，config.url=http://127.0.0.1:1（不可达端口） | 产生真实失败行；+2 min 不记、+11 min 记 1 条、+30 min 不重复 | 日志原文见 logs/hub-gap-probe-unreachable.log：06:18:53.271Z worker b-gapwatch-probe started、06:18:53.297Z / 06:19:23.310Z couldn't reach the hub: TypeError: fetch failed；+2 min 不记、+11 min 记 1 条、+30 min 不重复 |

假运行使用独立临时家目录，跑完已删除（探针家目录与临时 state/out 文件均已清理，目录存在性检查为 removed）。生产 config.json 未被改动，未起任何隧道。

## 5 门槛复跑（已完成）

| 命令 | 结果 | 日志 |
|---|---|---|
| npm run test:windows | tests 484 / suites 0 / pass 484 / fail 0 / cancelled 0 / skipped 0 / todo 0，duration_ms 181428.5016，EXIT=0 | logs/b2-test-windows.log |
| npm run typecheck | tsc -p . 无输出，EXIT=0 | logs/b2-typecheck.log |
| npm run format:check | All matched files use Prettier code style!，EXIT=0 | logs/b2-format-check.log |

三条合计 DURATION_MS=189000。跑前/跑后快照：before/b2-b3-before.txt 与 after/b2-b3-after.txt（各 47 条），逐行 diff 只差采集时间戳；任务表仍只有 \agent-autoloop（Running）；3300–3500 与 4347 无监听；%TEMP% agent-autoloop-* 目录数 24 → 24（无新增残留）。跑完 git status --porcelain 0 行，HEAD 仍 c067fdb。

口径：484/484 只代表本机门槛（本机 Windows 版本 + 本机 node 版本），不写成 Windows 全平台通过；本轮 skipped=0，无 skip 触发条件需要说明。

## 6 本单期间的新现场事实：中台再次不可达

14:13:48 起 worker 重新出现连续失败，截至 14:26:08 仍未恢复（up.log 共 145 行，mtime 14:26:08.831）。断链观测脚本在 14:26:13 按规则记下第一条真实记录：gap_start_utc=2026-11-07T06:13:48.549Z、gap_minutes=12.3、consecutive_failure_lines=10（evidence/20261107-final/hub-gap-log.txt）。日志尾部原文：

```
2026-11-07T06:13:48.549Z [worker] couldn't reach the hub: Error: 中台返回 503
2026-11-07T06:14:18.938Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T06:16:02.312Z [worker] couldn't reach the hub: TypeError: fetch failed
2026-11-07T06:16:49.587Z [worker] couldn't reach the hub: Error: 中台返回 503
2026-11-07T06:17:20.032Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T06:19:03.836Z [worker] couldn't reach the hub: Error: 中台返回 503
2026-11-07T06:19:34.221Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T06:20:04.577Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T06:23:22.663Z [worker] couldn't reach the hub: Error: 中台返回 503
2026-11-07T06:26:08.831Z [worker] couldn't reach the hub: Error: 中台返回 503
```

失败在 503 与 404 之间交替，中间夹一次 TypeError: fetch failed（本地 DNS/连接层），间隔 30 s ~ 103 s 不等，与 worker 失败后 PAUSE=30 s 的退避一致。

说明：这与 B1 当时的「11:08:32 之后无新错误」不冲突——11:12 进程重启后到 14:13 之间日志一条没写，14:13:48 才恢复写入，且写的就是失败。按工单第 5 条，隧道守护在 A 侧（计划任务 agent-autoloop-tunnel，每 5 分钟自愈），B 侧未改 config.url、未起隧道。请 A 侧核对 14:13 之后 hub 侧的 worker:b-magicbook14 心跳是否同时中断。

## 7 口径纠正落实

- 心跳节奏：本报告一律按 **约 51 s**（中位 50.97 s、p90 101.6 s，与源码 WAIT=50 一致）；80–120 s 的 322 条是丢一拍后两拍并一次。上一轮工单的「约 100 秒」是 A 侧笔误，已作废。
- LastTaskResult=267009 是 0x00041301「正在运行中」，不是错误码。
- 推送仓：https://github.com/Jakiewbe/autolAgentloop.git（autolAgentloop），分支 b-final-20261107，追加提交，不重写历史、不删分支、不动 origin（KKKKhazix 上游）。

## 8 未验清单（不推断）

1. **B2 after 快照（四条断言的后半段）**：需要真人注销并重新登录。未做，因此「单实例已验证」这句话本轮不成立。
2. 登录后第一次心跳的精确时刻：需 B 侧先登录，A 侧在 3 分钟内查 hub.db seen_at 落在 (登录时刻, +3 分钟)。未发生。
3. 登录后桌面是否出现新增控制台窗口：窗口枚举只在登录会话内有效，未发生。
4. 断链观测脚本未注册为计划任务（只交脚本与测试），因此「持续运行中的观测」未验；如需常驻，需批准后由 B 侧加一条计划任务。
5. hub 侧 14:13 之后心跳是否中断：B 侧无 hub.db，未验，已请 A 侧核对。

## 9 阻塞

阻塞项只有一条：B2 需要真人注销重登（会中断当前会话）。
注销后若出现双实例、任务表出现第二条 agent-autoloop*、或 up 进程起不来，按工单第 9 条：立即停、保留现场、发回任务表 + 进程树 + 最近 20 行 up.log，不自行修配置。
回滚参考：本单未改任何生产配置、未改 DACL、未改计划任务；唯一新增的是 evidence 下的脚本与日志。

## 10 收尾三行

1. 本轮变更的进程与任务：无。生产进程仍是 13404 wscript → 1856 background → 17168 up，任务表仍只有 \agent-autoloop（Running）；假运行探针进程已退出，临时家目录已删。
2. 仍未闭合的缺口：B2 after 快照与「单实例已验证」结论（等真人注销）；登录后心跳时刻与窗口枚举；断链观测未常驻。
3. 需要 A 侧配合：真人注销窗口的确认；登录后 3 分钟内查 hub.db 的 seen_at；核对 14:13 之后 hub 侧心跳是否与 B 侧 404/503 同步中断。

## 11 交付包口径（本轮补充）

- 包内新增 logon-b2/ 三件：b2-before-1420.txt（B2 登录前快照全文）、capture.ps1（before/after 采集脚本）、PROCEDURE.md（注销重登操作与回滚）。原文件仍在 evidence/20261107-logon/，包内这份是副本，保证交付目录自洽。
- 行尾统一为 LF：仓库根 .gitattributes 写着 * text=auto eol=lf，PowerShell 重定向产生的 CRLF 入库时会被规范化，于是「包内文件字节」与「INDEX.sha256 记录的哈希」对不上（上一版就是这个问题：44 条 INDEX 在新 clone 里 16 条 mismatch）。本轮把 evidence 下所有文本文件就地 CRLF→LF（内容不变，只动行尾），再重算 INDEX。
- 校验改在**新 clone 里**做，不在工作目录做：clone → checkout → cd evidence → sha256sum -c 20261107-final/INDEX.sha256，要求 48/48 OK。只在本机工作目录通过不算。
- 包内不含 master.key、不含 config.json 的 url/worker.key 字段、不含 hub.db；%TEMP% 下命中的测试产物未删除（等指令），仅登记。
