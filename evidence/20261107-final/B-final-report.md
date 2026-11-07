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
| B4 | icacls、读 host/files.ts:5-19 与调用图 | 见方案文档 | 只出方案 | B4-acl-options.md | 执行待批准 |
| B5 | command -v / npm ls -g / opencode --help / 目录递归搜索 | 无 claude；opencode 缺 Claude 参数 | 结论：无法验证 | B5-claude-go-feasibility.md | 缺 CLI+settings+凭据 |
| B6 | 三条 npm 门槛（后台跑，避 120 s 上限） | 484/484/0/0；typecheck 0；format 0 | 命中（仅本机） | logs/b6-*.log | 不覆盖其它 Windows 版本 |
| B7 | 出包 + INDEX.sha256 + 推 b/final-20261107 | 见下节 | — | INDEX.sha256 | — |

---

## 8 · 收尾三行

1. **本轮变更的进程与任务**：计划任务 `\agent-autoloop` 未改动（仍 Running、Action 未变）；生产进程树未重启（13404 → 1856 → 17168，pid 未变）；仅清理了本轮自己 test:windows 中断留下的 2 个孤儿进程与 8 个临时目录。
2. **仍未闭合的缺口**：B2 注销重登四条判据全部待验（需真人空窗）；B1 的心跳间隔与"最后成功心跳"只能由 A 侧 hub.db 给出；B4 未执行（等明确指令）；B5 真实 Go 调用本机不可验证。
3. **需要 A 侧配合的动作**：① 核 hub.db 心跳间隔与最后成功心跳时间戳；② B2 空窗后 3 分钟内核登录后新心跳；③ 若要闭合 B5，给出可用的 Claude 协议 CLI 与私有 settings 路径（不含凭据传输）；④ 对 B4 推荐项（维持现状 + 家目录用自有子目录）给明确取舍。

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
| 分支 | `refs/heads/b-final-20261107`，提交 `8995778fbdafdfbcbfc90b812fc9b5f32487e5df` |
| 首推失败与处置 | 按要求先试 `b/final-20261107` → `remote rejected: cannot lock ref 'refs/heads/b/final-20261107': 'refs/heads/b' exists`。远端已有分支 `b`，Git 的 ref 命名空间不允许同时存在 `b` 与 `b/…`。删/改远端 `b` 属禁止项，故改用不冲突的 `b-final-20261107`。 |
| 未动项 | origin 未改；远端 `b`（0ce8008）与 `main`（9fabbe9）SHA 推送前后一致；无重写、无删分支；work copy 的 HEAD 与工作区未变（`c067fdb`，porcelain 0 行） |
| 打包方式 | 用 `git clone --no-hardlinks` 复制到 `_night\b-final-20261107` 再提交推送，避免在生产工作副本切分支；`evidence/**/*.log` 被仓库 `.gitignore` 的 `*.log` 命中，用 `git add -f` 显式纳入 |

