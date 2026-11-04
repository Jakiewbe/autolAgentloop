# A/B 部署设计（T5）

本文件描述：源码基线、A/B 两侧的目录与账户、Windows 适配改了哪些文件、部署包如何在没有提交的情况下保证两端跑的是同一份代码。
所有路径与命令都在 A 上实际执行过；未在 B 上验过的项目单独标注「未验证」。

## 1. 来源与基线

| 项 | 值 |
| --- | --- |
| 上游 | https://github.com/KKKKhazix/agent-autoloop.git |
| 研究基线 | `96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a`（fix(service): quote systemd unit values (#38)） |
| 交接时 main 头 | `4567e5166f5f39e792ec738e72a06f64126ae6e2`（未使用） |
| 实际 checkout | `96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a`，detached HEAD，未建分支/worktree，未 commit/push |
| 许可 | MIT（app/LICENSE，"Copyright (c) 2026 数字生命卡兹克"） |
| fork | **未创建**：本机无 gh CLI，也没有可用的 GitHub 凭据（不写密钥到文件）。改为直接克隆上游并固定基线，来源可由 remote + SHA 核对 |
| 克隆时间 | 2026-11-04T17:36:46+08:00（日志 evidence/raw/app/01-clone.log） |
| 文件数 | 187（git ls-files） |
| 工具链 | node v24.12.0 / pnpm 11.9.0 / npm 11.12.1 / git 2.56.0.windows.2 |

机器可读版本见 `evidence/source-baseline.json`。

## 2. A 侧（中心，本机）

| 项 | 位置 / 值 |
| --- | --- |
| 安装目录（ROOT） | `D:\Vibe_coding-Project\autoAgentloop\app`（git checkout 的源码，直接被 node 运行，无编译产物、无全局安装） |
| 运行入口 | `node --disable-warning=ExperimentalWarning app\bin\agent-autoloop.ts <命令>`；Windows 便捷入口 `app\bin\agent-autoloop.cmd`（PATH 上有它时 `agent-autoloop` 即可） |
| 运行目录 | 进程当前目录无关；每轮 agent 进程的 cwd 取自 rules 的 `cwd`（缺失/不存在时该轮直接报「在 X 启动不了：这个目录不存在」） |
| 配置目录 | `%USERPROFILE%\.agent-autoloop`（可用 `AGENT_AUTOLOOP_HOME` 覆盖）：`config.json`（url/hub/worker/channels）、`rules.json`（任务规则）、`secrets.env`（由 `process.loadEnvFile` 读，内容不入库） |
| 数据目录 | `<HOME>\worker\runs\<run>-<attempt>\`：`entry.json`（重启恢复依据）、`context.json`、`stdout-<turn>.log`、`stderr-<turn>.log`、`exit-<turn>`、`command-<turn>.json`（Windows）/ `command-<turn>.sh`（POSIX）；`<HOME>\up.pid`；`<HOME>\logs\up.log`（启动脚本重定向） |
| 启动账户 | 当前登录用户（本机 chs），用户级；不写注册表、不装 Windows 服务、不建计划任务 |
| 启动方式 | `agent-autoloop init`/`service install` 在 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop.cmd` 写一个启动脚本：登录即跑 `up`，退出后 10 秒重起（等价 launchd KeepAlive / systemd Restart=always）；输出追加到 `<HOME>\logs\up.log` |
| 通知入口 | ① 中台 channel（webhook/飞书等，见 `plugins/channels/`）；② `config.worker.unreachable` 指定的命令，连不上中台 10 分钟后调用一次；③ 桌面通知通道 `plugins/desktop/channel.ts` 目前只在 macOS 成立（用 launchctl 判断可用性），Windows 上没有原生 toast —— 作为待办记录，属 T7 |
| 停止一轮 | 中台发 cancel → worker 下一 tick `stopRun` → Windows 上 `taskkill /PID <runner> /T /F` 整树结束，结果按 `why=cancel` 落盘并回传 |
| 停止整体 | `agent-autoloop service remove`（删启动脚本并 `stopUp`）；或直接 `taskkill /PID $(cat <HOME>\up.pid) /T` |
| 回退 | `agent-autoloop service remove` → 删掉 Startup 里那一个 .cmd；`agent-autoloop uninstall --yes` 清 HOME/链接；代码回退用 `git -C app checkout -- . && git -C app clean -fd`（会丢本地改动，必须先取走 patch） |

## 3. B 侧（执行端）设计

B 与 A 是同一份代码、同一套目录约定，只是 HOME 和账户不同。

| 项 | 位置 / 值 |
| --- | --- |
| 安装目录（ROOT） | `C:\AgentAutoloop\app`（建议不用含空格的路径，虽然代码已支持，但少一层变量） |
| 运行入口 | `C:\AgentAutoloop\app\bin\agent-autoloop.cmd`（同一份包装脚本）或直接 node 调 ts |
| 配置目录 | `C:\Users\<B用户>\.agent-autoloop`，`config.json` 由 `agent-autoloop join <A的hub地址> --worker <名字> --key <令牌>` 生成；令牌只经命令行/环境传入，不写进文档 |
| 数据目录 | `C:\Users\<B用户>\.agent-autoloop\worker\runs\...`，与 A 同构 |
| 启动账户 | B 的交互登录用户（Agent CLI 的登录态是每用户的）；仍为用户级 Startup 脚本 |
| 启动方式 | 与 A 相同的一个 .cmd；B 重启后 `up` 重新起 worker，worker 扫 `runs/` 里的 entry.json，仍存活的轮次继续等，不重开 |
| 通知入口 | 与 A 相同（B 的失败经中台 channel 通知），B 本机不承担通知 |
| 停止/回退 | 与 A 相同 |
| 网络 | 走 T4 的加密私网，B 只出站连 A 的 hub 地址；具体地址别名见 evidence/network.md（不在本文件） |

B 上的目录建立、Startup 脚本生成、重启恢复均**未验证**（B 尚未就位；A 上的对应路径已实测，见 evidence/windows-runtime.md）。

## 4. Windows 改动文件清单

| 文件 | 改了什么 | 为什么 |
| --- | --- | --- |
| `host/platform.ts`（新，约 260 行） | 平台边界：`WINDOWS`、`which/onPath/findProgram`、`launchTurn`（POSIX 保留上游 /bin/sh + 登录 shell + detached；Windows 走 runner）、`programFor`（.cmd/.bat→cmd.exe /d /s /c；.ps1→pwsh/powershell -File；其余 exe 直接 spawn，全部 shell:false）、`pidAlive`、`commandLineOf`、`runAlive`、`runTreeAlive`、`stopRun` | Windows 没有 /bin/sh、ps、进程组；把「怎么起、怎么查、怎么停」集中到一处，其余代码不再直接依赖 POSIX 工具 |
| `worker/runner.ts`（新，约 60 行） | 托管运行器：读 command json → spawn 真实 exe → 把 stdout/stderr 写进文件 → 子进程退出后写 exit 文件（tmp+rename）→ 自己退出；被杀时整树随之结束 | Windows 没有「分离会话 + 事后按 pid 组查询」的等价物，需要一个比 worker 活得久、又是进程树根的宿主进程，才能做到「worker 重启后仍能判定/终止这一轮」 |
| `worker/worker.ts` | 删掉自带的 sh 启动/ps 查询/进程组实现，改为调用 platform 的 `launchTurn/alive/groupAlive/signal`；command 文件名按平台用 `.json`/`.sh`；`entry.pid` 语义变为「这一轮的树根」 | 平台差异集中化；行为和文件布局保持上游语义 |
| `worker/agents.ts` | `findProgram` 转调 `host/platform.ts`（Windows 用 PATH+PATHEXT 查找，不再用登录 shell 的 `command -v`） | Windows 没有登录 shell；claude/codex 的探测在两端一致 |
| `host/service.ts` | 新增 Windows 分支：`startupDir/startupFile/startupScript`、`installService` 写 Startup .cmd、`removeService` 校验内容后删除、`runningUp` 改用 pidAlive+commandLineOf、`stopUp` 用 taskkill /T（再 /F）、`serviceRunning` 看脚本是否存在且 up 在跑 | 用用户级 Startup 脚本替代 launchd/systemd；不写注册表、不装服务 |
| `cli/main.ts` | `howToRun()` 在 Windows 找 `agent-autoloop.cmd` 并按平台加引号；`linkSkill()` 用 junction 代替 symlink | Windows 的 symlink 需要额外权限；提示语里的命令要能直接粘进 cmd/PowerShell |
| `bin/agent-autoloop.cmd`（新） | `node --disable-warning=ExperimentalWarning "%~dp0agent-autoloop.ts" %*` | Windows 上没有 shebang，需要真实的 .cmd 入口 |
| `tests/windows-runtime.test.ts`（新） | 4 条 Windows 原生检查，见 evidence/windows-runtime.md | T6 要求真实启动/停止/超时/重启恢复，不能只看 tsc |
| `tests/helpers.ts` | Windows 下把 `APPDATA` 指向测试临时目录 | 防止任何测试真的把启动脚本写进当前用户的 Startup 目录 |

保留未改：`plugins/desktop/channel.ts`（macOS 通知判断，属 T7）、`plugins/acp/bridge.ts`（子进程终止，属 T7）、所有 `host/service.ts` 的 darwin/systemd 分支。

## 5. 部署包与内容哈希（无提交情况下如何保证两端同一份）

不允许 commit/push，所以「B 跑的是不是我改的这份」不能只给上游 SHA。方案：

1. 基点：`96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a`。
2. 取本地差异：`git -C app add -N . && git -C app diff --binary > evidence/raw/app/windows-changes.patch`（对新增文件用 intent-to-add 让它们进 diff）。
3. 逐文件哈希：`sha256sum` 覆盖 11 个修改文件 + 5 个新增代码文件 + `pnpm-lock.yaml`，存 `evidence/raw/app/windows-changes.sha256`（17 行，在 `app/` 内 `sha256sum -c` 校验，实测全 OK）；补丁与 tar.gz 两个哈希单独放 `evidence/raw/app/windows-bundle.sha256`（2 行，在仓库根校验）。
4. 传到 B：`git clone` 上游 → `git checkout 96b6c9c…` → `git apply --binary windows-changes.patch`（失败则整包拷贝白名单：`bin cli host kernel protocol plugins skills scripts sim tsconfig.json package.json`，不含 node_modules/.git）→ `pnpm install` → `sha256sum -c windows-changes.sha256` 全绿才算同一份。
5. 记录：B 上保存 `git -C app status --porcelain` 与 `git -C app rev-parse HEAD`，回传后与 A 对照。

实际产物：`evidence/raw/app/windows-changes.patch`、`evidence/raw/app/windows-changes.sha256`、`evidence/raw/app/windows-bundle.sha256`（生成命令与结果见 evidence/windows-runtime.md「部署包」一节）。

这些哈希不是手抄而是可复核的：`tools/checks/check_source_baseline.py` 读 `evidence/source-baseline.json`，逐项比对上游 blob 哈希（`git show <commit>:<path>`）、本机文件哈希、补丁与 tar.gz 哈希、以及 `git status` 的改动集合；2026-11-04 19:15 跑过一次，29 项全过（日志 `evidence/raw/app/20261104-191500-source-baseline-check.txt`）。

## 6. 未验证 / 待确认

- GitHub fork 未创建（无 gh 与凭据）。
- B 侧目录、Startup 脚本、join 流程、重启恢复：B 未就位，未验证。
- `agent-autoloop upgrade`（`git pull --ff-only`）在 detached HEAD 上会失败 —— 设计上是「不升级」，若要升级需重新 checkout 上游新提交并重打 patch，步骤同上，未执行。
- Windows 上没有可投递给控制台程序的软信号（taskkill 不带 /F 会拒绝），因此「通知它收尾」这一步在 Windows 上不存在，停止=整树结束；这会影响期望优雅退出的 agent（例如正在写文件），已记录为已知差异。
- 桌面通知在 Windows 上不成立（plugins/desktop/channel.ts 为 macOS 判断），通知走中台 channel，属 T7 范围。
