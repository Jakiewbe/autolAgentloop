# B2 · 注销重登单实例验收 · 操作单（需真人，20 分钟空窗）

## 0 前置
- 生产树不动：\agent-autoloop 任务、D:\AutoAgentloop\release\b-c067fdb-20261107、%USERPROFILE%\.agent-autoloop 都不改。
- 采集脚本：`D:\AutoAgentloop\evidence\20261107-logon\capture.ps1`（默认执行策略拒绝未签名脚本，必须带 `-ExecutionPolicy Bypass`）。

## 1 注销前（5 分钟内做，越近越好）
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\AutoAgentloop\evidence\20261107-logon\capture.ps1" `
  -Phase before -Out "D:\AutoAgentloop\evidence\20261107-logon\before.txt"
```
覆盖 before.txt 后，确认文件里这几项非空：任务 Action 全文 + State + LastTaskResult、进程树（wscript→background.ts→up）、监听（应为空）、up.pid、Startup 清单、up.log 尾 20 行、ConsoleWindowClass 窗口列表。

**注意**：本文件里的 up.log 中文会显示为乱码（PowerShell 5.1 按 ANSI 读 UTF-8 的已知行为）；需要原文时用 bash：`tail -n 20 ~/.agent-autoloop/logs/up.log`。

## 2 真人注销 → 重新登录（空窗 20 分钟）
注销即断开交互会话，\agent-autoloop 是 AtLogOn + Interactive 令牌，重登后由计划任务拉起。

## 3 登录后 10 分钟内
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\AutoAgentloop\evidence\20261107-logon\capture.ps1" `
  -Phase after -Out "D:\AutoAgentloop\evidence\20261107-logon\after.txt"
```
超时未采到就写原因，不补拍。

## 4 判据（四条，逐条写命中/未命中）
| # | 判据 | 对照（11:42 基线） | 判定方式 |
|---|---|---|---|
| 1 | 登录后 background.js 与 up 各恰好 1 个 | 1×wscript(13404) → 1×background.ts(1856) → 1×up(17168) | after.txt「PROCESS TREE」计数 |
| 2 | 桌面无新增控制台窗口 | ConsoleWindowClass 3 个，全部 visible=False（pid14144 bash / pid1856 node / pid20152 cli-proxy-api） | after.txt「DESKTOP WINDOWS」数量不增且 visible 仍 False |
| 3 | hub 不可达时按退避重试、进程不退出 | 源码：失败后 PAUSE=30_000 重试；UNREACHABLE=10min | 断网注入后看 up.log 新增行 + 进程仍在 |
| 4 | 登录后 3 分钟内出现新心跳 | hub.db 在 A 侧 | A 侧核对（B 不碰 hub.db） |

窗口枚举若被系统拒绝，写进未验，不推断。

## 5 回滚 / 卡住
- 判据 1 未命中（例如出现两个 up）：`Stop-Process -Id <多的那个> -Force`，再 `Get-ScheduledTask agent-autoloop | Start-ScheduledTask`；只停进程不改任务定义。
- 判据 3 未命中（进程退出）：把 after.txt 与 up.log 新增行贴出，附 `Get-ScheduledTaskInfo -TaskName agent-autoloop` 的 LastTaskResult，等人判。
