# 回退手册（A 机已实测的部分）

目标：把 A 机从这套部署退回到「装之前」或者退回到某一次改动之前，且不丢账本、不丢密钥、不重复派单。

机器：DESKTOP-LM7RKI1。安装目录（下称 HOME）：`C:\Users\chs\.agent-autoloop`。

## 1. HOME 里有什么，哪些能删

| 文件/目录 | 是什么 | 删除后果 | 回退时怎么办 |
|---|---|---|---|
| `hub.db`（含 `-wal`/`-shm`） | 事实日志与投影：轮次、卡片、回答、规则版本、事件 | 账本全丢，历史无法重建 | **不动**。回退一律先复制一份再操作 |
| `master.key` | 主密钥，用来派生各类密钥 | 所有已发出的密钥（worker/source/channel）全部失效 | **不动**。换配置不需要换它 |
| `config.json` | 中台地址、各自身份的密钥、通道密钥、并发 | 起不来（读不到密钥） | 从 `.bak-*` 恢复，见 §2 |
| `rules.json` | 规则与登记表 | 起来后无规则，事件没人接 | 从备份恢复；注意账本里的规则是累加的，见 §5 |
| `worker/runs/*` | 每轮的 `command-1.json`、`stdout/stderr-N.log`、`exit-N` | 丢当次输出（回执已进账本） | 保留，出事时是唯一现场 |
| `bridge/anchor-events.json` | Anchor 桥接的已发送事件 id | 同一条任务可能被再发一次 | 保留 |
| `logs/`、`try/`、`up.pid` | 日志、试跑目录、运行标记 | 无影响 | 可清，`up.pid` 只在中台没在跑时清 |

密钥不在磁盘明文里以文件形式保存（在 `config.json` 与账本里以派生形式存在），所以**备份 `config.json` 就是备份了身份**：别把备份贴进证据库或聊天。

## 2. 改配置后要回退（已实测，18:56）

```powershell
# 1) 停掉这一个进程（hub + worker 同进程；按端口找 pid，别按名字杀）
# 变量别叫 $pid/$PID：PowerShell 的 $PID 是只读的当前进程编号，赋值会报「无法覆盖变量 PID」，之后误用会杀掉终端本身
$listenPid = (Get-NetTCPConnection -LocalPort 3350 -State Listen | Select-Object -First 1).OwningProcess
Stop-Process -Id $listenPid -Force
# 2) 换回备份
Copy-Item "$env:USERPROFILE\.agent-autoloop\config.json.bak-20261104-190000" "$env:USERPROFILE\.agent-autoloop\config.json"
# 3) 起回来并核对
cd C:\path\to\app; node bin/agent-autoloop.ts up
node bin/agent-autoloop.ts status
```

实测结果（`evidence/raw/deploy/20261104-193000-rollback.log`）：

- 换回旧配置后能起来，`status` 正常；
- 历史完整：`今天 3 轮`、卡片 `#1 试跑：选一个颜色：蓝色` 仍在；
- 再把 `capacity=1` 写回、重启，`status` 正常，`config.json` 里 `capacity=1` 生效；
- 全程没有新派单、没有重复记录。

## 3. 退回到「这套部署之前」（A 机只剩这一步没实测）

1. `agent-autoloop service remove`（已单独实测通过）删掉 Startup 里的 `agent-autoloop.cmd`，之后开机不再自启。
2. 停进程：同 §2 第 1 步。
3. 把 HOME 整体改名保留（不要删）：`Rename-Item "$env:USERPROFILE\.agent-autoloop" ".agent-autoloop-backup-<日期>"`。这套部署之前本机就存在两个这样保留下来的目录：`.agent-autoloop-residue-20261104-1740`（17:40 的测试残留）、`.agent-autoloop-failed-init-20261104-1817`（第一次 init 失败）。它们含 `master.key`，**不进证据**。
4. 删掉 `~/.codex/skills/agent-autoloop` 这个 junction（`init` 建的），否则 Codex 还会看到这个技能。
5. 完整卸载（`agent-autoloop uninstall`）**没有实测**：它会问确认，还需要决定读/写哪些目录。要用它，先看清它的提示再答。

## 4. 换部署包（同版本重装）

`deploy/agent-autoloop-96b6c9c7-win2.tar.gz`（sha256 `caf7048f4b6a5463e28ee6dca156b978f9c31173d17f31d96107f8ef980072a3`；win1 是它之前的版本，回退到 19:00 那版时用 win1 的 `2ba21c42…d940`）解到新目录、`pnpm install`、沿用同一个 HOME 即可——账本与密钥都在 HOME 里，换代码目录不影响历史。核对哈希用 `sha256sum -c`。

## 5. 已知会让回退「看起来没生效」的坑

1. **规则是累加的**：从 `rules.json` 删掉一条规则，账本里仍会继续用它。想让它不再接事件，要么改它的 `when.types`，要么换事件类型避开（演练里就是这么绕的）。
2. **规则写错时旧规则继续跑**：只推一张卡说明错在哪，不会静默生效；`agent-autoloop check` 是改完必跑的检查。
3. **同进程**：`up` 把 hub 与 worker 放在一个进程里，杀它两个一起停；子进程（真实 Agent）会留下，`worker/runs/*/entry.json` 让重启后的接单程序重新认领。
4. **Windows 停止一律强杀**（`taskkill /T /F`），没有优雅停止；正在写的日志可能截断，但账本在 SQLite 事务里，不受影响。

## 6. 数据与凭据处置

- 本手册和证据库都不记录任何密钥明文；`config.json` 的备份只留在 HOME 里。
- 演练造的临时来源密钥（`anchor-bridge-test`/`-test2`/`-test3`）都已 `key remove` 撤回，撤回输出在 `evidence/raw/deploy/20261104-185000-anchor-bridge.txt`。
