# worker 9420 驻留证据（B，2026-11-06T10:42+08:00）

目的：把"10:07:37 那次维护重启"的**启动方式、宿主退出后存活、job 归属**记录成可核对事实，并明确**输出重定向本身不能证明长期驻留**。

## 1. 启动方式（可复现的脚本原文）

- 脚本：`D:\AutoAgentloop\_probe\restart-worker-post-night.ps1`，697 B，sha256 `ce498d7377e667db333f368be6581b8a19f1883c4ada3715a6dbac7d00499f1a`，mtime `2026-11-06 10:07:33.752 +0800`。
- 关键三行（原文）：

```powershell
$p = Start-Process -FilePath $node -ArgumentList $args -WorkingDirectory 'D:\AutoAgentloop' -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError $err
Start-Sleep -Seconds 6
Write-Output "started pid=$($p.Id) alive=$([bool]$alive)"
```

- `$node = 'C:\Program Files\nodejs\node.exe'`；`$args = @('--disable-warning=ExperimentalWarning','D:\AutoAgentloop\runtime\d504e4876d07\bin\agent-autoloop.ts','up')`。
- 重定向目标：`C:\Users\19082\.agent-autoloop\logs\worker.stdout.post-night-20261106T1020.log`（241 B）与 `…worker.stderr…log`（0 B）。
- 脚本由**工具宿主的 pwsh 进程**执行（不是 codex 回合内的 shell，也不是启动项 cmd）。

## 2. 进程事实（Win32_Process 采样）

| 项 | 值 |
| --- | --- |
| PID | 9420 |
| 映像 | `C:\Program Files\nodejs\node.exe` |
| 命令行 | `"C:\Program Files\nodejs\node.exe" --disable-warning=ExperimentalWarning D:\AutoAgentloop\runtime\d504e4876d07\bin\agent-autoloop.ts up` |
| CreationDate | `2026/11/6 10:07:37` |
| ParentProcessId | `11060`（**已退出**，`Get-CimInstance Win32_Process -Filter 'ProcessId=11060'` 无结果） |
| `up.pid` | 内容 `9420`，mtime `10:07:37` |
| 存活采样 | 10:11、10:37:19、10:39:47、10:42:18 均存活（`Get-Process -Id 9420` 非空） |

- 单实例核对（10:42）：`node.exe` 共 6 个，其中命令行匹配 `agent-autoloop\.ts\s+up` 的**只有 1 个**（9420）。
- 心跳/长连接：`Get-NetTCPConnection -OwningProcess 9420` 在 10:39 与 10:42 两次采样都看到到 `198.18.1.108:443` 的 `Established` 连接，本地端口从 4151 变为 1213 ⇒ 期间发生过重连，说明轮询线程在**持续工作**，不是挂死。

## 3. job 归属（能测到的与测不到的）

- `IsProcessInJob(OpenProcess(0x0400, 9420), NULL, &inJob)` → `inJob = TRUE`（`ok=True`）。探针：`probe-9420-20261106T1039/job-owner-9420.ps1`（sha256 `5602c5de06b8b58b53636126a2f89c4d815afcdce61bf59640497c63da0fced8`），输出 `job-owner.out.txt`（sha256 `d5b51e5817df8b9fda7dd4fa7af1bc075c0c992d0bb74e21aee80590cb391ddd`）。
- 可确定：9420 **位于某个 job 对象内**，且**父进程退出后没有被一起终止** ⇒ 该 job 未设 `kill-on-close`，或该进程走了 breakaway；两种情况都不是"在无人管的状态下裸跑"。
- 取不到：job **名称**。未提权时没有直接 API 拿别的进程的 job 句柄名（需 `NtQueryInformationJobObject`/`SeDebug` 级别手段），B 未做提权 ⇒ job 归属只记"在某 job 内 + 父退出后存活"，不写具体所属。

## 4. 为什么"输出重定向"不能当驻留证据

- 重定向只做一件事：把子进程的 stdout/stderr 写进文件。日志文件存在、内容有 `worker b-magicbook14 started`，**只能证明那一刻有人在写**，不能证明之后进程还在。
- 反例就在本夜：run 25 拉起的 PID **3600** 也有同样的日志与启动记录（`aa-item5-restart.log` 有 `START succeeded attempt=1 workerPid=3600 03:07:23.069`），但 10:04 复查时 `node.exe` 已不存在、无 3600 日志、`up.pid` 仍是 33160 ⇒ **同样的重定向手法，一个死了、一个活着**。
- 因此本夜的驻留判定只用三类独立证据：① 多次独立时间点的进程采样（`CIM/Get-Process` 非空）；② `up.pid=9420` 与 PID 一致；③ 到 hub 的 `Established` 长连接在持续重建/保持。日志只作辅助。

## 5. 与 3600 消失的差别（推断，标注为推断）

- 3600 的启动链是：run 25 回合 → codex 子进程（`pid 18964` 类的回合进程）→ PowerShell → `Start-Process` 子进程。回合结束时整条链被回收，3600 随之消失。
- 9420 的启动链是：工具宿主 pwsh → `Start-Process`；父进程 11060 已退出，9420 仍在 ⇒ 宿主退出不必然带走子进程（见第 3 节 job 事实）。
- **推断**：3600 落在"随回合/宿主一起收掉的 job"里，9420 落在"不 kill-on-close 的 job"里。3600 已消失，无法再测其 job 归属，故此条只作为差别描述，不作为已证结论。

## 6. 本轮未做的事

- 未重启/未再次拉起 worker；未改启动项、`config.toml`、MCP 配置、路由、标签、ACL、身份；未动其他进程。
- 未做真机重登录，故第 6 项的"登录触发"仍为**未实测**。
