# B-FINAL-20261107 · B 侧收口报告

- 机器：MAGICBOOK14-ZZ（用户 chs，交互会话），角色 B（worker-only，本机无 hub）
- 工作副本：D:\AutoAgentloop\work\agent-autoloop，HEAD `c067fdbce6e75dead344a5f386bfd3e3164bd7f9`，`git status --porcelain` = 0 行
- 运行面：D:\AutoAgentloop\release\b-c067fdb-20261107（生产），家目录 C:\Users\19082\.agent-autoloop
- 本轮采样窗：2026-11-07 11:20:55 → 11:52 +08:00
- 口径：本报告只记录本轮实测；历史回执、上游 CI、A 侧旧文档一律不当证据。

---

## 1 · B1 通道恢复确认（零改动）

### 1.1 up.log 最近 10 行原文
文件：C:\Users\19082\.agent-autoloop\logs\up.log（9563 B，118 行，mtime 2026-11-07 11:08:32.509 +08:00；11:47:43 复核仍无新行）

```
2026-11-07T03:03:59.062Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:04:29.421Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:04:59.821Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:05:30.215Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:06:00.598Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:06:30.996Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:07:01.368Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:07:31.762Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:08:02.151Z [worker] couldn't reach the hub: Error: 中台返回 404
2026-11-07T03:08:32.509Z [worker] couldn't reach the hub: Error: 中台返回 404
```

- **最后一条 404**：2026-11-07T03:08:32.509Z = 本地 **2026-11-07 11:08:32.509 +08:00**。
- 之后有无新错误：**没有**。该行即文件末行，文件 mtime 与之相同；11:47:43 复核行数与 mtime 均未变。
- 前史（同一文件）：02:16:41 起为 503，02:17:11 起转为连续 404，约每 30.4 s 一条，直到 03:08:32 停止；03:12:28 进程重启后未再写任何错误或警告。

### 1.2 config.json 主机名
`https://obconic-subtetanic-tamika.ngrok-free.dev/...` → 主机名 **obconic-subtetanic-tamika.ngrok-free.dev**，与 A 侧静态域名一致（仅到主机名，路径与密钥不外带）。

### 1.3 判据核对
| 判据 | 实测 | 结论 |
|---|---|---|
| 最近 10 分钟无「中台返回 404」 | 最后一次 11:08:32.509+08:00，至 11:47:43（39 分钟）无新错误行 | 命中 |
| 心跳间隔稳定约 100 s | B 侧无法测：worker/worker.ts:592 只在失败时落日志，成功路径不写任何行 | **未验（须 A 侧 hub.db）** |
| 最后一次成功心跳精确时间戳 | 同上，B 侧给不出。可给边界：最后一次失败 11:08:32.509+08:00，此后 0 失败 | **未验（须 A 侧 hub.db）** |

### 1.4 链路在线的旁证（不替代心跳）
- 11:26:14 直连 https://obconic-subtetanic-tamika.ngrok-free.dev/healthz → HTTP 200 `{"ok":true,"commit":"dev"}`；/v1/work?claim=probe 不带密钥 → HTTP 401 `{"error":"要接单程序自己的密钥"}`（符合鉴权预期）；/ → 404（预期）。
- 11:43 netstat：pid 17168 持有 ESTABLISHED `198.18.0.1:6380 → 198.18.0.23:443`，长轮询在线。
- 11:47:02–11:49:25 每 10 s 采样一次（150 s，`logs/b1-worker-poll-cadence.log`）：任意时刻恒有 1 条 ESTABLISHED 指向 198.18.0.23:443，本地端口按 4129 → 5762 → 9557 → 2501 约每 50 s 轮换（换端口瞬间有短暂双连接重叠），与源码 WAIT=50 长轮询一致，**全程无空窗、无 30 s 退避段** → 该窗口内没有一次请求失败。这是"worker 一直在跟中台讲话"的直接证据，也是"最近 10 分钟无 404"的旁证。

> 口径：**本条只证明链路恢复，不证明生产自启可用。**自启可用性归 B2。

---

## 2 · B2 注销重登单实例验收（未完成，等真人空窗）

### 2.1 已就绪
- 采集脚本：`evidence\20261107-logon\capture.ps1 -Phase before|after -Out <文件>`（任务定义+完整 XML+State+LastTaskResult、进程树、监听、up.pid、两份 Startup 与 Run 键、up.log 尾 20 行、EnumWindows 按 ConsoleWindowClass 筛桌面窗口）。默认执行策略拒绝未签名脚本，必须用 `powershell -NoProfile -ExecutionPolicy Bypass -File`。
- 注销前快照已采一次（**仅作脚本自检，不作本轮证据**）：`evidence\20261107-logon\before.txt`，124 行，采集于 2026-11-07 11:42。注销前 5 分钟内必须用同一条命令重采覆盖。
- 注销后的命令：
```
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\AutoAgentloop\evidence\20261107-logon\capture.ps1" -Phase after -Out "D:\AutoAgentloop\evidence\20261107-logon\after.txt"
```

### 2.2 判据与已知基线
| 判据 | 对照基线（本轮 11:42 快照） | 状态 |
|---|---|---|
| 登录后 background.js 与 up 各恰好 1 个 | 现为 1×wscript(13404) → 1×background.ts(1856) → 1×up(17168) | 待验 |
| 桌面无新增控制台窗口 | ConsoleWindowClass 现 3 个，**全部 visible=False**：pid14144 bash.exe、pid1856 node.exe、pid20152 cli-proxy-api.exe | 待验（比较用：数量不增、且 visible 仍为 False） |
| hub 不可达时按退避重试且进程不退出 | 源码：失败后 PAUSE=30_000 再试，UNREACHABLE=10min 判定 | 待验（可用断网注入） |
| 登录后 3 分钟内出现新心跳 | hub.db 在 A 侧 | 待验（须 A 侧核） |

采集被系统限制的项（如窗口枚举被拒）当场写入未验，不推断。

---

## 3 · B3 test:windows 残留自查（与 B6 同批）

脚本：`evidence\20261107-final\snap.ps1`（任务全集与定义、3300–3500 与 4347 监听、%TEMP% 下 agent-autoloop-* 目录及体积、node 进程、up.pid）。
- 跑前：`before\b3-before.txt`（11:28:41，47 条）
- 跑后：`after\b3-after.txt`（11:42，47 条）

| 判据 | 实测 | 结论 |
|---|---|---|
| 跑完任务表只剩 \agent-autoloop | 仅 `\agent-autoloop`，State=Running，LastTaskResult=267009 | 命中 |
| 临时端口全部释放 | 3300–3500 与 4347 前后均无监听 | 命中 |
| 临时家目录被清理或登记为可删残留 | %TEMP% agent-autoloop-* 集合：前 24 个 / 后 24 个，`comm` 双向差为空 → 本轮完整跑未新增残留 | 命中（存量见 3.2） |
| 进程无孤儿 | 前后均为 1×wscript + 1×background.ts + 1×up，pid 未变 | 命中 |

### 3.1 中断即留残留：本轮实证（非推断）
首次 test:windows 被 run_code 默认 120 s 上限打断（实测该门槛需 136 s）。中断瞬间的残留，实测为：
- %TEMP% 新增 **8 个** agent-autoloop-* 目录（plugin-trouble×7 + service-PYoJaH，11:30–11:32 创建）
- **2 个孤儿 node 进程**：pid 16820（background.ts）、pid 1848（up，家目录为临时 agent-autoloop-service-PYoJaH）

清理命令（实测执行，随后任务表回到只有 \agent-autoloop）：
```powershell
Stop-Process -Id 1848,16820 -Force
Get-ChildItem $env:TEMP -Directory -Filter 'agent-autoloop-*' |
  Where-Object { $_.CreationTime -gt (Get-Date).AddMinutes(-30) } |
  Remove-Item -Recurse -Force
```
清理前后差异：目录数 24+8 → 24；node 进程 3+2 → 3；任务表始终只有 \agent-autoloop。

### 3.2 存量残留（可删，登记不清理）
%TEMP% 下 24 个 agent-autoloop-* 目录，均早于本轮，体积与清单见 `before\b3-before.txt`。清理（与生产无关，随时可执行）：
```powershell
Get-ChildItem $env:TEMP -Directory -Filter 'agent-autoloop-*' | Remove-Item -Recurse -Force
```
说明：test:windows 会**真注册计划任务、真起进程**，被 Ctrl-C、超时或强杀即留上述残留，属已知行为，非本轮缺陷。

---

## 4 · B4 ACL 处置（只交方案，未动 DACL）

见 `B4-acl-options.md`。结论摘要：
- 现状 `D:\AutoAgentloop`：Everyone (CI)(DENY)(DC)；chs 仅 (WO,S)；Owner=chs；Administrators/SYSTEM 继承 F。
- **推荐乙（维持现状）**，不是甲。理由不是"怕动"，而是**甲不足以解决问题**：host/files.ts 的 privateDirectory() 一旦拿到 WRITE_DAC，会执行 `SetAccessRuleProtection(true,false)` 把该目录 DACL 重置为 owner+SYSTEM FullControl，并**向下传播**，等于把整棵树现有的继承权限（含 Authenticated Users:M、Administrators:F）全部剥掉。给 chs 补 WD 换来的是一个会把生产目录树 ACL 改坏的入口。
- 若确实需要"家目录在 D 盘"的封闭运行：把 HOME 指到 chs 自己新建的子目录（如 D:\AutoAgentloop\work\agent-autoloop\.home）。owner 即 chs，privateDirectory() 直接成功，无需改任何 DACL。本轮 test:windows 里 "Windows init keeps its keys private even inside a shared directory" 通过（7.3 s）即为该路径的实测旁证。

---

## 5 · B5 真实 Go 调用可行性（事实核对）

见 `B5-claude-go-feasibility.md`。结论：**本机无法验证真实 Go 调用**。
- 本机无 Claude 协议 CLI：`command -v claude` 失败；npm 全局只有 @openai/codex 0.167.0、@playwright/mcp、opencode-ai 1.17.13、openskills。系统目录递归搜索无 claude.exe/claude.cmd。
- 唯一在装的候选是 opencode 1.17.13（C:\Users\19082\AppData\Roaming\npm\opencode + node_modules\opencode-ai\bin\opencode.exe，165 MB）。它的非交互入口是 `opencode run`，只认 -c/-s/--fork/--model/--agent；`--help` 里没有 -p/--print、--settings、--output-format、--permission-mode、--add-dir。plugins/claude-go/agent.ts 的 command() 恰好需要这一整套（`-p prompt --output-format json --settings X --strict-mcp-config --session-id/--resume --permission-mode --add-dir --disallowedTools=...`）。→ 缺口是协议层，不是包装层。
- 缺什么：① 讲 Claude 协议的 CLI（如 `npm i -g @anthropic-ai/claude-code` 后的 claude）；② 部署方提供的私有 provider settings 文件；③ 该 provider 的凭据。三者齐了才能跑一次只读调用。
- 未做且不会做：用 .cmd 包装冒充、手写 usage.cost、把回放脚本当真实调用。上一轮记录的 ".cmd 被拒 exit 127 / .exe 打用法 exit 1" 与上述事实一致（opencode 的 shim 与 exe 都不接受 Claude 参数）。

---

## 6 · B6 复跑门槛

命令：`cd /d/AutoAgentloop/work/agent-autoloop`

| 门槛 | 尾部结果 | EXIT |
|---|---|---|
| npm run test:windows | ℹ tests 484 / ℹ pass 484 / ℹ fail 0 / ℹ cancelled 0 / ℹ skipped 0 / ℹ todo 0 / duration_ms 135344.7914 | 0（DURATION_MS=136000） |
| npm run typecheck | `tsc -p .`，无输出 | 0（1 s） |
| npm run format:check | `All matched files use Prettier code style!` | 0（3 s） |

- 全量日志：`logs/b6-test-windows.log`、`logs/b6-typecheck.log`、`logs/b6-format-check.log`。
- 跑完 `git status --porcelain` 仍 0 行，HEAD 未变（`c067fdb`）。
- **口径：484/484 只代表本机（MAGICBOOK14-ZZ / Windows / node v24.12.0）门槛通过，不写成 Windows 全平台通过。**
- skip：0（另有 cancelled 0、todo 0），无触发条件需要说明。

---

## 7 · 回执表

| 项 | 做了什么（命令） | 输出摘要 | 判据命中 | 证据路径 | 未验 |
|---|---|---|---|---|---|
| B1.1 | `tail -n 10 ~/.agent-autoloop/logs/up.log`；`stat`；`wc -l` | 末行 03:08:32.509Z；118 行；mtime 11:08:32.509 | 命中 | logs/up-log-tail-10.txt | — |
| B1.2 | `grep -o 'https://[^/]*' config.json` | obconic-subtetanic-tamika.ngrok-free.dev | 命中（与 A 一致） | 本报告 1.2 | — |
| B1.3 | `curl /healthz`、`curl /v1/work`、`netstat -ano`、150 s 端口轮换采样 | 200 ok；401 鉴权；ESTABLISHED →443 | 404 静默 39 min 命中 | logs/b1-worker-poll-cadence.log | 心跳间隔/最后成功时间戳需 A 侧 hub.db |
| B2 | 写 capture.ps1、-Phase before 自检运行 | 124 行快照，任务/进程/端口/Startup/日志/窗口全字段可取 | 未执行（需真人空窗） | 20261107-logon/before.txt | 四条判据全部待验 |
| B3 | snap.ps1 前后各一次；comm 比对 | 24 vs 24 集合相同；任务唯一；端口空 | 命中 | before/b3-before.txt、after/b3-after.txt | 存量 24 目录未删（登记） |
| B4 | icacls、读 host/files.ts:5-19 与调用图、4 组 DACL 写探针、根因探针 T1–T5（5 个位置 × 5 项写法） | 根因=owner 段被拒（缺 WRITE_OWNER 继承），非 WRITE_DAC；失败边界=整棵 D 树 | 根因收敛；生产 DACL 未动 | B4-acl-options.md、B4-root-cause.md、logs/b4-*.txt | 4.2/4.3 补丁与放权未执行（等 A 侧决定） |
| B5 | command -v / npm ls -g / opencode --help / 目录递归搜索 | 无 claude；opencode 缺 Claude 参数 | 结论：无法验证 | B5-claude-go-feasibility.md | 缺 CLI+settings+凭据 |
| B6 | 三条 npm 门槛（后台跑，避 120 s 上限） | 484/484/0/0；typecheck 0；format 0 | 命中（仅本机） | logs/b6-*.log | 不覆盖其它 Windows 版本 |
| B7 | 出包 + INDEX.sha256 + 推 b/final-20261107 | 见下节 | — | INDEX.sha256 | — |

---

## 8 · 收尾三行

1. **本轮变更的进程与任务**：计划任务 `\agent-autoloop` 未改动（仍 Running、Action 未变）；生产进程树未重启（13404 → 1856 → 17168，pid 未变）；仅清理了本轮自己 test:windows 中断留下的 2 个孤儿进程与 8 个临时目录。
2. **仍未闭合的缺口**：B2 注销重登四条判据全部待验（需真人空窗）；B1 心跳数据已由 A 侧 hub.db 闭合（51 s 节奏），B 侧不再列；B4 根因已收敛，方案甲作废，等待对 4.1（D 树外隔离，已实测可用）/4.2（改 files.ts）/4.3（放权）的取舍；B5 记本环境不可验证（资源缺口，非缺陷）。
3. **需要 A 侧配合的动作**：① B2 空窗后 10 分钟内提供登录时刻并在 3 分钟内核对新心跳；② 对 B4 三条处置给取舍（4.1 可立即用，4.2 属上游改动）；③ 若要闭合 B5，指定 CLI 安装来源与私有 settings 的落地位置（不含凭据传输）。

---

## 9 · B7 打包与推送（实测）

### 9.1 交付包
- 目录：`D:\AutoAgentloop\evidence\20261107-final\`（报告 3 份 + before/after 快照 + 4 份日志 + 2 份探针脚本 + snap.ps1）、`D:\AutoAgentloop\evidence\20261107-logon\`（capture.ps1、before.txt、PROCEDURE.md）。共 18 个文件，154 KB。
- 校验：`INDEX.sha256` 共 18 行；`sha256sum -c` → **18/18 OK**（无 FAILED）。
- 密钥与数据库扫描：包内不含 `master.key`、`hub.db`、`config.json`；`grep -rE '"key"\s*:'` 无命中。config.json 只引用了主机名，未带路径与密钥。

### 9.2 推送
| 项 | 结果 |
|---|---|
| 目标 | `https://github.com/Jakiewbe/autolAgentloop.git`（B 私库，与 origin=KKKKhazix 无关） |
| 分支 | `refs/heads/b-final-20261107`；提交链 `8995778`（主体）→ `4fb6d94`（补录 9.1/9.2）→ 收尾提交（本行更正）。报告自身哈希随 INDEX 变化，**以远端该分支 HEAD 为准** |
| 首推失败与处置 | 按要求先试 `b/final-20261107` → `remote rejected: cannot lock ref 'refs/heads/b/final-20261107': 'refs/heads/b' exists`。远端已有分支 `b`，Git 的 ref 命名空间不允许同时存在 `b` 与 `b/…`。删/改远端 `b` 属禁止项，故改用不冲突的 `b-final-20261107`。 |
| 未动项 | origin 未改；远端 `b`（0ce8008）与 `main`（9fabbe9）SHA 推送前后一致；无重写、无删分支；work copy 的 HEAD 与工作区未变（`c067fdb`，porcelain 0 行） |
| 打包方式 | 用 `git clone --no-hardlinks` 复制到 `_night\b-final-20261107` 再提交推送，避免在生产工作副本切分支；`evidence/**/*.log` 被仓库 `.gitignore` 的 `*.log` 命中，用 `git add -f` 显式纳入

---

## 10 · A 侧裁决（2026-11-07 13:03）的回应与本轮更正

采样时间 2026-11-07 13:06–13:25 +08:00。以下每一条都对应新的实测或新的口径改写。

### 10.1 心跳节奏：B 写错一倍，已更正为约 51 s
- A 侧 hub.db `facts` 表 `type=heartbeat` + `key='worker:b-magicbook14'` 共 2965 条，首条 `2026-11-04T16:34:09.751Z`；2964 个差值中位 **50.97 s**、p90 101.6 s，`<40 s` 763 / `40–60 s` 1857 / `60–80 s` 9 / `80–120 s` 322 / `>120 s` 13。
- 最后成功心跳：`2026-11-07T04:56:23.552Z` = 本地 **12:56:23.552**（seq 12381），取数时落后 13 s。
- 更正：本报告 1.3 节沿用工单"约 100 s"的说法是错的，真实节奏 **约 51 s**，与本机源码 `protocol/client.ts` 的 `WAIT=50` 一致。80–120 s 的 322 个不是变慢，是**丢一拍后两拍合并**，p90 落在 101.6 s 即此因。
- 今日那段 3219 s 间断：`2026-11-07T02:15:27.755Z` → `2026-11-07T03:09:06.599Z`（本地 10:15:27.755 → 11:09:06.599），与 A 侧隧道 10:16:34 消失、11:08:36 重启对齐；B 侧 up.log 的最后一条 404 落在 11:08:32.509，正好在这段间断的尾部。
- 口径：**1.3 节"心跳间隔/最后成功心跳"从此不为未验项，数据源为 A 侧 hub.db（外部证据，已由 A 确认）。**

### 10.2 计划任务字段的口径更正
`LastTaskResult=267009` 不是错误码；`0x00041301` 的语义是**任务正在运行中**。只有当任务不在运行时，该字段才用于判断上次运行成败。本报告此前把它列在状态行里而未加注释，此处更正。

### 10.3 B4：根因收敛，A 的表述与 B 的旧建议各有一处被推翻
详见 [B4-root-cause.md](B4-root-cause.md)。三条要点：
1. 失败段是**安全描述符的 owner 段**，不是 DACL 段：D 树子目录上"只写 DACL"成功、"只写 owner"失败、"先给 chs FullControl 再写 owner"成功、"随后跑 `files.ts` 原样代码"成功（`logs/b4-owner-clause-probe.txt` T1–T5）。
2. 缺的是 **WRITE_OWNER 继承**：根上 `chs:(WO,S)` 是显式且 `inh=None`，子对象只继承 `Authenticated Users:(I)(M)`，不含 WRITE_OWNER。补 WriteDAC（方案甲）无效——探针 C 在 D 树内写 DACL 本就成功。
3. 失败边界是**整棵 D:\AutoAgentloop 子树**，不是根目录：根下新建子目录、work 副本下新建子目录、以及 A 建议的 `work\agent-autoloop\.home` 下新建子目录，三者均 FAIL（`logs/b4-exact-probe.txt`）。%TEMP% 与 %LOCALAPPDATA% 均 OK。
- 因此推荐项改写为：**隔离目录必须落在 D:\AutoAgentloop 之外**（如 `%LOCALAPPDATA%\agent-autoloop-home`，实测 OK）；`.home` 放在工作副本内的方案作废。另有两条可选：丁（改 `files.ts`，owner 段仅在非 owner 时写，实测 DACL-only 足够）、戊（把 `chs:(WO,S)` 放成可继承，不推荐）。

### 10.4 B5：记「本环境不可验证」，不计缺陷
A 侧给出的事实（`claude.exe` 2.1.153、settings 键名、F1 链路证据）已录入 [B5-claude-go-feasibility.md](B5-claude-go-feasibility.md) 第 5 节，标注为 A 侧事实、非 B 侧证据。本机缺 CLI + 私有 settings + 凭据，属资源决定，不阻塞收尾。

### 10.5 B7 归属（仓库 / 分支 / 提交 → 材料）
| 仓库 | 分支 | 提交（按顺序） | 承载材料 |
|---|---|---|---|
| `https://github.com/Jakiewbe/autolAgentloop.git`（注意仓库名是 **autol**Agentloop，不是 `agent-autoloop-b-handoff-20261107`） | `b-final-20261107` | `8995778` | 报告 1–9 节主体、B4/B5 方案、PROCEDURE、快照、日志、INDEX.sha256 |
| 同上 | 同上 | `4fb6d94` | 补录 9.1/9.2（打包与首推失败的处置） |
| 同上 | 同上 | 本轮追加提交 | 10.1–10.6、B4-root-cause.md、B5 第 5 节、四个新探针脚本与其日志、INDEX 重算 |

- 远端 `b`(`0ce8008`)、`main`(`9fabbe9`) 推送前后一致；origin（KKKKhazix）未推未动；无重写、无删分支；生产工作副本仍 `c067fdb`、`git status --porcelain` 0 行。
- 精确 HEAD SHA 以远端该分支为准（报告自身哈希随 INDEX 变化，不可能自指）。

### 10.6 B2 登录时刻的上报协议（就绪，待真人空窗）
- B 侧职责：报出**登录落定的本地时刻**（精确到分钟，取桌面出现后的第一个整分），并当场跑 `capture.ps1 -Phase after`。
- A 侧判据：登录后 3 分钟内执行 `facts` 查询，命中条件为存在 `seen_at ∈ (login, login+3min)` 的 `worker:b-magicbook14` 心跳。
- 边界：这条只证明 worker 起来了并连上中心；"桌面无新增控制台窗口"只能由 B 侧 `capture.ps1` 的 ConsoleWindowClass 枚举给出，A 侧无法替代。

### 10.7 交付包更新（覆盖 9.1 的 18 文件口径）
- 现在 **29 个文件**：新增 `B4-root-cause.md`、4 个探针脚本（`scripts/b4-root-diagnosis.ps1`、`b4-stepwise-probe.ps1`、`b4-exact-probe.ps1`、`b4-label-probe.ps1`、`b4-owner-clause-probe.ps1` 共 5 个）与 5 份对应日志。
- `INDEX.sha256` 已重算，`sha256sum -c` → **29/29 OK**。
- 编码：本轮 b4 系列日志原有 GBK（PowerShell 重定向默认码页），已就地转为 UTF-8 后再入包，避免 git 侧乱码；`b3-after-interrupt.txt`、`b4-icacls-before.txt` 同步转换。
- 残留检查：探针建的 `D:\AutoAgentloop\labprobe-*`、`aclprobe-*` 与误建的 `work\agent-autoloop\.home`（空目录）全部清除，`git status --porcelain` 仍 0 行。 |

## 14 · B2 已执行（11-08 01:54 注销 / 01:56 重登，四条断言全中）

本单唯一需真人的项已闭合，明细见 [B2-report.md](B2-report.md) §13。摘要：

| 断言 | 结果 | 关键值 |
|---|---|---|
| 任务表只有 `\agent-autoloop` 且 Running | 命中 | LastRunTime 更新为 11/08 01:56:37；aftercap 任务在采集前自我注销，未污染表 |
| node 恰好一组（1 background 父 + 1 up 子） | 命中 | 8220 wscript → 24908 node(background.ts) → 16424 node(up) |
| 桌面无新增控制台窗口 | 命中 | ConsoleWindowClass 3→2，全部 visible=False；少的是注销时被杀的旧会话 bash 窗口 |
| up.pid 与实际一致 | 命中 | up.pid=16424，pid 存活、start 01:56:40 |

- 时间线：01:54:47 注销（系统日志 7002）→ 01:56:36 登录（7001）→ 01:56:37 登录触发启动 → 01:56:43 `worker b-magicbook14 started`（up.log 第 212 行）→ 01:57:41 aftercap 执行 → 01:57:45 自我注销 → 01:57:50 after 快照 → 01:58:02 端口/任务快照。登录→after 74 秒。
- 采集方式：注销会杀掉 DSH 会话，故 after 由**登录触发的一次性计划任务**采集（脚本第一步先 `Unregister-ScheduledTask` 自我注销，再做 capture + snap）。
- 链路补充：01:59 `/healthz` → HTTP 200；up pid 16424 有 1 条 ESTABLISHED → 18.177.60.68:443；重启后 up.log 无 503/404。
- 受限采集项（登记不推断）：任务上下文取不到 `SESSIONNAME`，after 快照 session= 为空；未测「注销后无人登录期间 up 是否继续跑」。
- 仍待 A 侧：hub.db 中 `worker:b-magicbook14` 的 seen_at 是否落在 (2026-11-08T01:56:36+08:00, 01:59:36)。

### 14.1 交付包口径更新（覆盖 10.7 的 29 文件口径）
- 现在 **57 个文件（INDEX 56 行 + INDEX 自身）**：新增 `B2-report.md`、`logon-b2/`（9 件：PROCEDURE、after-capture-log、after-capture.ps1、before/after 快照、logoff-request、register-aftercap.ps1、capture.ps1）、`before/b2-b3-before.txt`、`after/b2-b3-after.txt`、`after/b2-b3-after-logon.txt`、`logs/ports-b2-*.txt`、`logs/b2-*`、`logs/b4-*`、`logs/temp-home-credential-scan.txt`、`logs/hub-gap-*`、`scripts/scan-temp-homes.ps1`、`scripts/hub-gap-watch.ps1`、`B4-root-cause.md` 等。
- `INDEX.sha256` 重算为 56 行，格式沿用首推口径（`sha256sum -b`，路径前缀 `20261107-final/`，在 `evidence/` 下校验）：`cd evidence && sha256sum -c 20261107-final/INDEX.sha256` → **56/56 OK**。
- 包内不含 `master.key`、`hub.db`、`config.json`；`sk-`/`ghp_`/`PRIVATE KEY` 模式扫描无命中（报告里提到这些文件名属正文，不是文件本身）。
- 分支仍为 `b-final-20261107`（`b/final-20261107` 因远端已有 `b` 而 ref 冲突，见 9.2），只追加提交，不重写、不删分支、不动 origin 与远端 `b`/`main`。
