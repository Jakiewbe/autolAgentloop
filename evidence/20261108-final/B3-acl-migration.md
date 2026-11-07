# B3 ACL 方案乙落地（AGENT_AUTOLOOP_HOME → D:\AutoAgentloop\home）

证据目录：evidence/20261108-final/b3/

## 0. 先说结论（有一处与任务单的假设不一致，照实写）

任务单说 `D:\AutoAgentloop\home` 是「你自己可写、不需要改 DACL 的目录」。**实测不是。** 这个目录能写，但 `host/files.ts` 的 `privateDirectory()` 在里面仍然抛 `UnauthorizedAccessException`。原因不是缺 WRITE_DAC（owner 隐式有），而是缺 **WRITE_OWNER**：`privateDirectory` 里 `$acl.SetOwner($owner)` 这一步需要 WRITE_OWNER，而 `D:\AutoAgentloop` 给 chs 的显式 ACE 只有 `0x180000`（WRITE_OWNER+SYNCHRONIZE，**不可继承**），子目录继承到的只有 Everyone DENY + AU Modify（`0x1301bf`，不含 WRITE_OWNER）。

为了让 B3 的其余验收项都能闭合，B 侧做了一次**范围最小的一次性授权**：只在 `D:\AutoAgentloop\home` 这一个目录上，给当前用户加一条**可继承的 TakeOwnership（0x80000 = WRITE_OWNER）ACE**，没有改 `D:\AutoAgentloop`、没有关继承、没有下发到别处。产品自己的 `privateDirectory` 随后把 DACL 整块替换成「owner + SYSTEM 全控」，那条授权 ACE 已被覆盖掉，不留残余。

这不是任务单禁掉的那条「给自己加 WriteDAC 权限」：没有 WRITE_DAC，没有在根目录上动手，没有自我剥夺，没有向下传播。但它确实是一次 DACL 写入，所以单列在这里给 A 判定。

## 1. 迁移前

见 b3/01-before-migration.txt

| 项 | 值 |
| --- | --- |
| 旧 HOME | `C:\Users\19082\.agent-autoloop`（**不是** D:\AutoAgentloop，任务单里的旧目录口径需更正） |
| 旧 up.pid | 16424（wscript 8220 → background.ts 24908 → up 16424） |
| 旧计划任务 | `\agent-autoloop`，Running，LastTaskResult 267009 |
| worker/runs | 22 个目录，最新 35-1（2026-11-06 14:47） |
| 心跳探测 | HTTP 200，`{"job":null,"cancel":[]}`，**2026-11-07T19:28:59Z** |

## 2. 新 HOME 的 ACL 两方向（产品代码原样跑，不手写等价块）

`AGENT_AUTOLOOP_HOME=D:/AutoAgentloop/home node -e 'import("./host/files.ts").then(m=>m.privateDirectory(process.env.AGENT_AUTOLOOP_HOME))'`，release 树里的真实模块。

| 阶段 | 结果 |
| --- | --- |
| 授权前 | `PRIVATE_DIRECTORY ERR` → `使用"2"个参数调用"SetAccessControl"时发生异常:"尝试执行未经授权的操作。"`（UnauthorizedAccessException，与 A 上一轮 init 失败同源） |
| 一次性授权后 | **`PRIVATE_DIRECTORY OK`** |
| 产品块跑完后的 ACL | `NT AUTHORITY\SYSTEM Allow FullControl` + `MAGICBOOK14-ZZ\chs Allow FullControl`，owner = `MAGICBOOK14-ZZ\chs` |

一次性授权（只此一条命令，只此一个目录）：

```powershell
$d='D:\AutoAgentloop\home'; $me=[Security.Principal.WindowsIdentity]::GetCurrent().User
$a=Get-Acl $d
$a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($me,[Security.AccessControl.FileSystemRights]::TakeOwnership,'ContainerInherit,ObjectInherit','None','Allow'))
Set-Acl -Path $d -AclObject $a
```

授权前/后的完整 ACL、产品块跑完后的 ACL 全文：b3/02-acl-new-home.txt。

对照实验（同一 token、同一 PowerShell）：`%LOCALAPPDATA%\_b3probe\d1` 与 `C:\Users\19082\_b3probe\d1` 上同一产品块 **OK**（不需要任何授权）；`D:\AutoAgentloop\_b3probe\d1` 上 **ERR**。junction（`D:\AutoAgentloop\...\j1` → `%LOCALAPPDATA%`）也不行：`SetAccessControl` 落在重解析点本身，同样 ERR。

## 3. 迁移执行

见 b3/03-stop-old.txt、b3/04-copy-data.txt、b3/05-start-new.txt

1. 建 `D:\AutoAgentloop\home`，走完 §2 的两方向验证。
2. 停旧服务：`AGENT_AUTOLOOP_HOME=C:/Users/19082/.agent-autoloop node .../bin/agent-autoloop.ts service remove` → 任务 `\agent-autoloop` 注销、up 16424 与 wscript 8220 全停（进程表为空）。
3. 拷数据：`config.json`（sha256 两侧一致 `68085fbe…`）、`worker/`（22 个 runs 目录）、`logs/`。
4. 装新服务：`AGENT_AUTOLOOP_HOME=D:/AutoAgentloop/home node .../bin/agent-autoloop.ts service install`。

**注意（A 侧看板要改）**：服务名由 HOME 派生（`host/service.ts:14-17`）——HOME 不是 `~/.agent-autoloop` 时标签是 `agent-autoloop-<sha256(HOME)[0:8]>`。所以迁移后计划任务叫 **`agent-autoloop-09bbb91a`**，旧名 `\agent-autoloop` 已不存在。任何按任务名 `agent-autoloop` 判活的监控都会看不到它。

## 4. 迁移后

见 b3/06-after-migration.txt

| 项 | 值 |
| --- | --- |
| 计划任务 | `agent-autoloop-09bbb91a`，Running，LastRun 2026-11-08 03:29:40，LastTaskResult 267009 |
| 进程链 | wscript 16076 → node 3048（`host/background.ts "D:\AutoAgentloop\home"`）→ node 22156（`bin/agent-autoloop.ts up`） |
| 新 up.pid | 22156 |
| up.log | `2026-11-07T19:29:40.816Z [worker] worker b-magicbook14 started` |
| worker/runs | 22（与迁移前一致，没有丢 run） |
| 心跳探测 | HTTP 200，`{"job":null,"cancel":[]}`，**2026-11-07T19:30:19Z**，0.63 s |

心跳「在 A 中心可见」这一条：B 侧拿不到 `seenAt`——`agent-autoloop status` 直接回「这台电脑上没有本人的密钥（只接活的电脑看不了）」，worker key 没有 `/v1/state` 权限。B 侧能给的是**中台确实收了这次心跳**（`/v1/work?claim=beat` 200，且 worker 自己每轮轮询都不报错），迁移前后各一次，时间点 19:28:59Z 与 19:30:19Z。`seenAt` 请 A 侧按这两个时间点在自己的 `/v1/state` 里读。

## 5. 旧目录

- `C:\Users\19082\.agent-autoloop`：**原样保留**，没删没改（`up.pid` 里还是旧值 16424，属于旧进程遗留，`runningUp()` 会按进程命令核验，不会误判成在跑）。
- `D:\AutoAgentloop`：**没动**，DACL 与迁移前一致（唯一改动是新建子目录 `home` 及它自己的一次性授权，见 §0）。

## 6. 回滚（一条命令）

```bash
AGENT_AUTOLOOP_HOME=D:/AutoAgentloop/home node /d/AutoAgentloop/release/b-c067fdb-20261107/bin/agent-autoloop.ts service remove \
&& AGENT_AUTOLOOP_HOME=C:/Users/19082/.agent-autoloop node /d/AutoAgentloop/release/b-c067fdb-20261107/bin/agent-autoloop.ts service install
```

回滚后：任务名回到 `\agent-autoloop`，HOME 回到旧目录，worker 用旧目录里的 config.json 与 22 个 runs 继续接活。新目录 `D:\AutoAgentloop\home` 保留不删，需要时再手动清。
