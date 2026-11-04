# A 机环境、账户通道与项目盘点（T2）

- 机器别名：A（本机）；主机名 `DESKTOP-LM7RKI1`；工作组 `WORKGROUP`；运行账户 `chs`
- 任务编号：T2（A 的环境、账户通道和项目盘点）
- 本报告采集窗口：2026-11-04 17:36–17:45 (+0800)
- 原始日志目录：`evidence/raw/preflight/`（逐条引用见第 11 节）
- 验证级别定义：**已实测**＝在本机真实执行并留下原始输出；**仅文件确认**＝读取配置文件/清单确认存在，未实际运行；**未验证**＝未检查或无结论
- 本报告不含任何凭据内容；凭据只记“已配置/缺失”与保存位置用途

## 0. 治理状态核对 【已实测】

- `kit.py status . --brief --focus`（2026-11-04 17:44）：revision 22、task_revision 19、current_alignment=aligned、focus=T1、goal_approved=false（GOAL 仍为模板）。
- 已读取 `DSH_DEPLOYMENT_TASKBOOK.md`（322 行）与 `.agent/{GOAL,CURRENT,tasks.json}`；T1 为 done，T2—T14 为草案。
- 本目录不是 Git 仓库：未 `git init`、未建分支/worktree、未提交、未推送；根目录既有文件全部保留。

## 1. 系统身份与硬件 【已实测】

| 项 | 值 | 证据 |
| --- | --- | --- |
| OS | Windows 10 家庭中文版，build 19045，64 位 | `20261104-173650-os.txt` |
| CPU | AMD Ryzen 5 5600（6 核 12 线程） | `20261104-173650-hardware-disk.txt` |
| 内存 | 17,121,669,120 字节（≈16 GiB） | 同上 |
| 磁盘 | C: 剩余 25.5 GB；D: 剩余 763.8 GB | 同上 |
| 上次启动 | 2026-11-01 19:00:06（采集时已连续运行约 3 天） | 同上 / 17:39 复核 |

## 2. 工具链与绝对入口 【已实测】

| 组件 | 版本 | 绝对入口 |
| --- | --- | --- |
| Node（系统） | v24.12.0 | `C:\Program Files\nodejs\node.exe` |
| npm（系统） | 11.12.1 | 随 Node |
| pnpm（系统） | 11.9.0 | `C:\Users\chs\AppData\Roaming\npm\pnpm.ps1` |
| Git（PowerShell/where） | 2.52.0.windows.1 | `C:\Program Files\Git\cmd\git.exe` |
| Git（git-bash 解析） | 2.56.0.windows.2 | `/ucrt64/bin/git`（**与上面不一致**） |
| Python（默认 PATH） | 3.7.1 | `C:\ProgramData\Miniconda3\python.exe`（**过旧，勿用于部署脚本**） |
| Python 3.11 | 3.11.5 | `C:\Users\chs\AppData\Local\Programs\Python\Python311\python.exe` |
| Python（DSH 运行时） | 3.12.14 | `D:\DSH\resources\runtime\primary-runtime\dependencies\python` |
| Codex CLI | 0.130.0-alpha.5 | `C:\Users\chs\AppData\Local\OpenAI\Codex\bin\codex.exe`（**不在 PATH**） |
| Claude Code | 2.1.153 | `C:\Users\chs\AppData\Roaming\npm\claude.ps1` |
| OpenCode CLI | 1.14.29 | `opencode`（PATH 内） |
| DSH 桌面 | 安装器 44.7.0 / 应用 0.2.1-rc.5 | `D:\DSH\DeepSeek Harness.exe` |
| DSH 自动化 CLI | 0.2.1-rc.5 | `D:\DSH\resources\runtime\cli\bin\dsh.cmd` |

部署含义（必须遵守，不靠默认 PATH）：

1. 系统 Node `24.12.0` / pnpm `11.9.0` 与 DSH 运行时 Node `24.21.0` / pnpm `11.28.5` 是两套版本；`app/` 依赖安装与锁文件必须固定用一套（建议 DSH 运行时自带的 node/pnpm），否则 lockfile 漂移。
2. Git 双版本共存，脚本里一律写 `C:\Program Files\Git\cmd\git.exe` 绝对路径。
3. 默认 `python` 是 3.7.1，部署/校验脚本一律写 `Python311` 或 DSH 运行时 python 的绝对路径。

## 3. DSH 桌面入口与自动化入口是否同版本 【已实测】

- 安装器版本文件 `D:\DSH\version` = `44.7.0`；应用版本记录在 `D:\DSH\resources\runtime\primary-runtime\runtime.json` 的 `desktopVersion` = `0.2.1-rc.5`（同文件记录 node 24.21.0 / pnpm 11.28.5 / python 3.12.14 与 payloadDigest `e2cef445…eb7d`）。
- 自动化入口 `D:\DSH\resources\runtime\cli\bin\dsh.cmd` 的实现：设置 `ELECTRON_RUN_AS_NODE=1` 后，用同一个 `DeepSeek Harness.exe` 执行 `app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js`。
- 实测：`D:\DSH\resources\runtime\cli\bin\dsh.cmd --version` → `0.2.1-rc.5`，exit 0。
- 结论：桌面入口与自动化入口共用同一 `app.asar`，应用版本一致（0.2.1-rc.5）；`44.7.0` 只是安装包/产品版本号。**部署改动只能落在 fork 目录 `app/`，不得就地改 `D:\DSH\resources`（asar 内路径 `app.asar\dsh` 不是普通目录，文件系统可见的只有 `app.asar.unpacked\dsh\node_modules`）。**

## 4. 无交互/后台上下文 【已实测】

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| 隐藏窗口分离进程（`Start-Process -WindowStyle Hidden -File`） | exit 0；拿到 node v24.12.0、npm 11.12.1、claude 2.1.153、codex-cli 0.130.0-alpha.5；PATH 含 `Roaming\npm` | `20261104-173826-bg-context.txt` |
| 计划任务（Interactive / Limited，`-File` 脚本） | lastTaskResult=0；拿到 node `C:\Program Files\nodejs\node.exe`、claude `…\npm\claude.ps1` 与完整用户 PATH | `20261104-173901-task-env.txt`（任务 `DSHPreflightEnvProbe2` 已 unregister，cleanup_removed=True） |

教训与约定：

1. 计划任务动作必须用 `-File <绝对路径脚本>`，不要内联 `-Command` 拼接引号——第一次这么写时输出为空、只有任务结果 0，属于假成功。
2. 登录会话内的计划任务能拿到与终端一致的配置；**Session 0（服务上下文）未实测**，这属于 T10 启动方式决策项。
3. 重启后要能自动跑起来，依赖“重启后自动登录”或 Run 键/启动项，**未验证**（T10）。

## 5. 模型通道盘点 【凭据存在性＝仅文件确认；调用结果＝已实测】

| 通道 | 配置来源 | 实际模型 ID | 凭据 | 实测结果 |
| --- | --- | --- | --- | --- |
| 1. Codex CLI | `C:\Users\chs\.codex\config.toml` | `model="gpt-6.1-sol"`，`model_reasoning_effort=high`，`approval_policy=never`，`sandbox_mode=danger-full-access`，`[windows] sandbox=unelevated` | `~/.codex/auth.json` 存在（未读内容） | `codex exec` 成功返回约定 token；显式 `-m gpt-5.6-sol` / `gpt-5.5` / `gpt-5.3-codex` 全部 exit=1；`models` 缓存解析报 `unknown variant \`max\`` |
| 2. Claude Code 2.1.153 | `C:\Users\chs\.claude\settings.json` 的 `env` | `ANTHROPIC_BASE_URL=https://opencode.ai/zen/go`；`ANTHROPIC_MODEL=deepseek-v4-flash`；opus→`kimi-k3`；sonnet→`qwen3.6-plus`；haiku→`deepseek-v4-flash`；`effortLevel=high`；`model="opus[1m]"` | `settings.json` 内 token（未导出）+ 原生 `~/.claude/.credentials.json` 存在 | `claude -p` → `400 Upstream request failed: Model is unavailable`；`--model deepseek-v4-flash` 同样 400；换成目录内真实存在的 `--model deepseek-v4.1-flash` 后不再报错但 120 s 无输出被 timeout 杀掉（exit=124），加 `--settings {"enabledPlugins":{}}` 依旧挂起 → **不可用** |
| 3. OpenCode CLI 1.14.29 | `C:\Users\chs\.config\opencode\opencode.json`（`shell=powershell` 在 `opencode.jsonc`） | provider `opencode`＝"OpenCode Go"，`@ai-sdk/openai-compatible`，`baseURL=https://opencode.ai/zen/go/v1`；models：`deepseek-v4-flash`、`deepseek-v4-pro`、`glm-5.2`、`kimi-k2.7-code`、`mimo-v2.5-pro` | apiKey 存在（未记录） | `opencode models` 列出 101 个模型（配置里写的 `deepseek-v4-flash`/`kimi-k2.7-code` 已不在目录，实际是 `deepseek-v4.1-flash` 等）；`opencode run --model opencode/deepseek-v4.1-flash` **成功回显约定 token** |
| 4. DSH 自身 | DSH 应用配置（GUI `127.0.0.1:1334` 运行中） | 本会话模型 `deepseek-v4.1-flash` | 未导出 | 运行中（本报告即由其产出） |

非敏感账户/额度池别名：通道 1＝Codex 账号登录态；通道 2/3＝同一个 OpenCode Go 额度池（同一个 apiKey，两条客户端）；通道 4＝DSH 内置。**这些登录文件一律不复制到 B（任务书硬规则）。**

## 6. 小任务实测：读取 / 受控编辑 / 运行检查 / 会话接续 【已实测】

| 能力 | 通道 1 Codex 0.166 | 通道 2 OpenCode | 通道 3 Claude Code | 证据 |
| --- | --- | --- | --- | --- |
| 读取＋生成 | 通过（回显 `PROBE-C166-R1`） | 通过（回显 `PROBE-OC-R1`） | 未通过（400 / 挂起） | `20261104-180600-codex166-resume.txt`、`20261104-180200-resume-probe.txt` |
| 会话接续 | 通过（`resume <THREAD_ID>` 回显 `PROBE-C166-R2` 并复述上一轮 token） | 通过（`--continue` 回显 `PROBE-OC-R2`） | 未验证 | `20261104-180700-codex166-resume2.txt`、`20261104-180200-resume-probe.txt` |
| 受控编辑 | 未在 A 侧单独复测（T7 的 `codex166_edit_run_check` 已覆盖编辑+运行检查，原始日志在同一 evidence 树） | 未验证 | 未验证 | `../../raw/adapters/20261104T174154+0800_codex166_edit_run_check.*` |
| 运行检查 | 同上 | 未验证 | 未验证 | 同上 |

根因（已实测，2026-11-04 17:52–18:03）：

1. 本机装了**两个 codex 二进制**：`…\Codex\bin\codex.exe`＝0.130.0-alpha.5（唤回 `400 model_not_found: The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account`，且刷新模型目录时解析 `unknown variant max` 失败）；`…\Codex\bin\22cfb1d302613eae\codex.exe`＝0.166.0-alpha.5.1（同一账号、同一 config，**成功**）。→ 通道必须锁定 0.166 的绝对路径，不能依赖 PATH 或 `bin\codex.exe`。
2. `codex exec resume --last` 省略 `--skip-git-repo-check` 会报 `Not inside a trusted directory`；用显式 `THREAD_ID` 更稳（`--json` 输出里的 `thread_id`）。
3. OpenCode 模型目录已改名：可用 ID 是 `deepseek-v4.1-flash`（带 `.1`）；旧 `deepseek-v4-flash`/`kimi-k3` → `400 Model is unavailable`。`opencode models` 共 101 条。
4. Claude Code 用正确 ID 仍 120 s 无输出被 timeout 杀掉（exit=124），`--settings {"enabledPlugins":{}}` 禁用插件后依旧挂起 → 本机插件/hook 缺陷，与模型渠道无关。
5. `dsh.cmd headless "…"` 能启动（`--help` exit 0），但立刻 `MISSING_CREDENTIAL: llm-deepseek: no API key for provider route "deepseek-official"`；桌面/网页版用的是 `deepseek-account-platform` 凭据记录（`~/.dsh/.credentials.yaml` 内确有该记录），headless profile 未接同一凭据 → 属部署期凭据路由问题（T6/T10）。

**结论（对应 T2 完成条件）**：A 已能无交互启动**两条**执行通道——Codex 0.166（exec + resume 均实测）与 OpenCode CLI（run + continue 均实测），且都留有原始日志。DSH headless 待补凭据路由，Claude Code 不可用（原因有据，不选作初始通道）。


## 7. 候选业务项目盘点 【git/依赖＝已实测；开发命令＝仅文件确认】

| 项目 | 路径 | Git | `.agent` | 包管理/入口 | 开发命令（来自 manifest） |
| --- | --- | --- | --- | --- | --- |
| autoAgentloop（本目录） | `D:\Vibe_coding-Project\autoAgentloop` | 否 | 是 | — | — |
| DDdak | `D:\Vibe_coding-Project\DDdak` | 是（main，dirty 27） | 是 | `requirements.txt` | 计划任务 `DDdak-Monitor` / `DDdak-ReverseTether` |
| EISMaster | `D:\Vibe_coding-Project\EISMaster` | 是（main，dirty 14） | 是 | `pyproject.toml` | 未从 manifest 取得 |
| GITTDCRmaster | `D:\Vibe_coding-Project\GITTDCRmaster` | 是（main，dirty 16） | 是 | `package.json` | `dev,build,lint,preview,typecheck,test,tauri,tauri:dev,tauri:build…`（Tauri） |
| OPEISMaster | `D:\Vibe_coding-Project\OPEISMaster` | 是（main，dirty 11） | 是 | `pyproject.toml` | 未从 manifest 取得 |
| Virtualsalpha | `D:\Vibe_coding-Project\Virtualsalpha` | 是（`codex/tick-chain-isolation`，dirty 7） | 是 | `package.json` | `dev,start,monitor,typecheck,test,test:full,test:db,db:migrate,backtest:project…` |
| Hash1 | `D:\Vibe_coding-Project\Hash1` | 是（`codex/pfft-gpu-miner`，dirty 0） | 否 | `package.json` | `mine,check,pfft,gpu,dashboard,equium…` |
| JEV网申 | `D:\Vibe_coding-Project\JEV网申` | 否 | 是 | `package.json` | `start,start:tui,start:ui,apply,review…` |
| 其他 | ACP、ACP Score、CLIproxy、FigureMaster、FigureMasterSkills、Wechat_Robot、Virtuals Predict、VirtualsDegen、Origin Figmaster、Prismaxvlamster 等 | 多为否 | 否 | 无/混合 | — |

- 依赖与桌面软件：本机装有 Docker Desktop、VMware、MATLAB（`D:\Matlabs`）、ChemOffice、Gatan、Adobe、Autodesk、Riot Vanguard、ACE 反作弊；这些会影响长跑进程（反作弊/安全软件可能拦截注入）。
- 副本关系：所有候选项目都只在本机 A 的 `D:\Vibe_coding-Project` 下；**B 上是否存在同名副本尚未确认（T3）**，因此首版禁止双副本同时写同一项目。
- 未选定业务项目前，只建专用演练项目（T5/T14 决策）。

## 8. 常驻条件（休眠 / 更新重启 / 后台服务 / 通知 / 磁盘）【已实测】

| 项 | 结论 |
| --- | --- |
| 睡眠/休眠 | S1/S2/S3 待机均不支持，休眠未启用，混合睡眠与快速启动不可用 → 空闲不会自动睡眠 |
| Windows Update | 无 `WindowsUpdate\AU` 策略键（默认策略），`ActiveHours` 8–17，`RebootRequired` 不存在 |
| 自动重启风险 | 默认策略下活动时间外可能自动重启；本轮**只记录不修改**，T10 决策 |
| 安全/反作弊类常驻 | 火绒 `HipsDaemon`/`Sysdiag`、ACE `ACE-Tray`/`AntiCheatExpert`、`CodexSandboxService.OpenAI.Codex`、`CoworkVMService`、`WinFsp.Launcher` |
| 网络类常驻 | `clash_verge_service`（7897/8550）、`cpolar`（9200/4040/6060）、`GameViewerService`、`VMware NAT`、`WSLService` |
| 计划任务（非 Microsoft） | `DDdak-Monitor`(Running)、`DDdak-Monitor-Watchdog`、`DDdak-ReverseTether`(Running)、`CodexDailyBackup`、`ScienceResearchDailyAcquisition`、`EquiumMinerStart3AM`、WPS/NVIDIA/Adobe 更新任务 |
| 启动项 | HKCU/HKLM Run 约 20 项（OneDrive、Steam、Riot、夸克、百度网盘、Docker Desktop、Kimi、MathWorks、`SunloginClient`/`AweSun`、ACE-Tray、火绒 Sysdiag 等）；启动文件夹仅 `MDI Jade 6.lnk` |
| 通知方式 | Windows 通知可用（`ToastEnabled` 未显式关闭）；用户环境变量 `PUSHDEER_KEY` 存在（41 字符，值未记录）→ 可作为完成通知通道 |
| 磁盘 | C: 25.5 GB（偏紧，注意 pnpm store 与 Electron 构建）、D: 763.8 GB |

## 9. 现有远程控制/隧道组件（对 T4 关键）【已实测】

| 组件 | 状态 | 证据 | 可用性判断 |
| --- | --- | --- | --- |
| cpolar | 服务 Running/Automatic；监听 9200、127.0.0.1:4040（Web UI）、127.0.0.1:6060；`~/.cpolar/cpolar.yml` 内有 `tunnels:`（website / remoteDesktop 两条 addr+proto），authtoken 存在（未记录） | 端口表、yml 键名 | 已有出站隧道能力，可把 A 服务映射出去；属第三方云隧道，绑定范围与鉴权需专门核对 |
| 向日葵（SunloginClient / AweSun） | HKLM Run 有 `SunloginClient.exe --cmd=autorun`、`AweSun.exe --cmd=autorun`；目录 `D:\SunloginClient` 存在（agent/awesun_guard/driver/plugins）；当前无进程 | Run 键、目录 | 远程桌面管理通道候选；B 侧是否安装未知 |
| UU 远程 GameViewer | 进程运行，监听 0.0.0.0:11738 与 172.16.184.69:3597/8910/10793/11006 | 端口表 | 远程桌面通道候选（不适合承载任务 API） |
| SMB | `LanmanServer` 运行，445 监听，共享 `ADMIN$ C$ D$` | 端口表、`Get-SmbShare` | 内网文件通道；不可作为跨网方案 |
| VPN / mesh | Tailscale、ZeroTier、WireGuard、OpenVPN、Syncthing、AnyDesk、ToDesk、RustDesk 服务均不存在；`SunloginService` 仅残留（安装目录 `C:\Program Files\Oray` 不存在，Stopped/Manual） | 服务表 | **没有现成加密私网** |
| 外网可达性 | github.com 200、api.github.com 200、registry.npmjs.org 200、tailscale.com 200 | 网络日志 | 可选装 Tailscale |

T4 建议（供后续任务确认，本报告不下结论）：首选 Tailscale 两端各自登录独立账号/设备；备选 cpolar 单隧道（仅当无法装 mesh）；向日葵/GameViewer 只作为人工管理通道，不承载任务 API。

## 10. 两条初始执行通道的无交互启动方式（T2 完成条件的当前答案）

通道 1（Codex 0.166，**已实测可用；必须用带哈希目录里的那个二进制**）：

```powershell
$codex = "C:\Users\chs\AppData\Local\OpenAI\Codex\bin\22cfb1d302613eae\codex.exe"
& $codex exec --skip-git-repo-check --json -C "D:\Vibe_coding-Project\autoAgentloop\app" -o out.txt "PROMPT" < NUL
# 接续（THREAD_ID 取自上一步 --json 输出里的 thread_id）
& $codex exec resume --skip-git-repo-check --json -o out2.txt "<THREAD_ID>" "PROMPT"
```

要点：不要用 `bin\codex.exe`（0.130 对该账号的 `gpt-6.1-sol` 一律 400）；stdin 显式关闭；`--json` 便于取证，`-o` 保存最终回答；模型用 config 默认值，本机 0.130 上显式 `-m` 的样本全部失败。

通道 2（OpenCode CLI，**已实测可用**）：

```bash
opencode run "PROMPT" --model opencode/deepseek-v4.1-flash
opencode run --continue "PROMPT" --model opencode/deepseek-v4.1-flash
```

要点：模型 ID 必须用 `opencode models` 里的真实条目（`deepseek-v4.1-flash` 带 `.1`）；旧 ID 会让上游返回 `400 Model is unavailable`；一次性任务用 `opencode run`（非 TUI）。

通道 3（DSH headless，**待补凭据后可用**）：`dsh.cmd headless "PROMPT"` 能启动，但缺 `DEEPSEEK_API_KEY`/`deepseek-official` 路由凭据，见第 6 节根因 5；补齐后是部署目标的第二形态（T6/T10）。

通道 4（Claude Code，**当前不可用，不选作初始通道**）：

- `claude -p` 用旧模型 ID → `400 Model is unavailable`；用正确的 `deepseek-v4.1-flash` → 120 s 无输出、被 timeout 杀掉（exit=124）；禁用插件（`--settings {"enabledPlugins":{}}`）后依旧挂起。
- 结论：该缺陷与模型渠道无关，属本机 Claude Code 插件/hook 环境；修复归 T7，**不影响 A 的两条初始通道**。


## 11. 原始日志索引 【已实测】

| 日志 | 覆盖内容 | 时间 |
| --- | --- | --- |
| `20261104-173650-os.txt` | OS 版本、build、架构 | 17:36:50 |
| `20261104-173650-hardware-disk.txt` | CPU/内存/磁盘/启动时间 | 17:36:50 |
| `20261104-173650-toolchain.txt` | node/npm/pnpm/git/python 版本与路径 | 17:36:50 |
| `20261104-173650-agents.txt` | codex/claude/opencode/dsh 入口与版本 | 17:36:50 |
| `20261104-173650-credential-presence.txt` | 凭据文件存在性（无内容） | 17:36:50 |
| `20261104-173650-background-and-power.txt` | 电源/休眠/后台策略 | 17:36:50 |
| `20261104-173650-candidate-projects.txt` | 候选项目初扫 | 17:36:50 |
| `20261104-173650-network.txt` | 接口/路由/邻居/VPN 探测/外网 | 17:36:50 |
| `20261104-173826-bg-context.txt` | 隐藏窗口分离进程上下文 | 17:38:26 |
| `20261104-173839-task-env.txt` | 计划任务第一次（内联命令）失败样本 | 17:38:39 |
| `20261104-173901-task-env.txt` | 计划任务第二次（-File 脚本）成功 | 17:39:01 |
| `20261104-174500-claude-p.txt` | Claude 默认模型 400 | 17:41:31 |
| `20261104-174700-claude-p-deepseek-v4-flash.txt` | Claude 指定 deepseek-v4-flash 仍 400 | 17:43:53 |
| `20261104-174700-claude-p-glm-5.2.txt` | Claude 指定 glm-5.2 空响应 | 17:44:00 |
| `../../raw/adapters/20261104T173734+0800_codex_exec_min.*` | Codex 最小生态探针（成功） | 17:37:34 |
| `../../raw/adapters/20261104T173842+0800_codex_model_gpt-5.6-sol.*` | 显式模型失败样本 | 17:38:42 |

| `20261104-175200-claude-p-deepseek-v4-pro.txt` / `-kimi-k2.7-code.txt` | Claude 换模型仍空响应 | 17:52 |
| `20261104-175400-channel2-rootcause.txt` | OpenCode 模型目录改名根因 | 17:54 |
| `20261104-175500-opencode-models.txt` | `opencode models` 101 条清单 | 17:55 |
| `20261104-175600-channel2-fix-probe.txt` | OpenCode 用正确 ID 回显 `PROBE-OPENCODE-4A2B` | 17:56 |
| `20261104-175700-claude-v41-probe.txt` | Claude 用正确 ID 仍挂起（exit=124） | 17:57 |
| `20261104-175800-claude-noplugin-probe.txt` | Claude 禁用插件后仍挂起（exit=124） | 17:58 |
| `20261104-180100-codex-recheck.txt` | 0.130 `bin\codex.exe` 复测 400 model_not_found | 18:00 |
| `20261104-180200-resume-probe.txt` | OpenCode `run` + `--continue` 接续（R1/R2）、0.130 codex resume 400 | 17:59 |
| `20261104-180200-dsh-headless.txt` | `dsh.cmd --help`（headless 子命令存在，exit 0） | 18:00 |
| `20261104-180300-dsh-headless-run.txt` | `dsh headless` 缺 DEEPSEEK_API_KEY 凭据 | 18:00 |
| `20261104-180600-codex166-resume.txt` | Codex 0.166 首轮回显 `PROBE-C166-R1`；`resume --last` 缺参失败样本 | 18:02 |
| `20261104-180700-codex166-resume2.txt` | Codex 0.166 `resume <THREAD_ID>` 接续成功（复述 R1） | 18:02 |
| `work/codex166/turn1.jsonl` | 0.166 的 `--json` 事件流（含 thread_id） | 18:02 |

## 12. 未验证 / 缺口 / 风险清单（不得当作通过）

1. Claude Code 仍不可用（正确模型 ID 也挂起，exit=124），已定位为本机插件/hook 缺陷，归 T7；**A 的第二通道已由 OpenCode CLI 顶替并实测**。
2. Codex 0.166 的读取与会话接续已实测；受控编辑与运行检查只在 T7 的 adapters 日志里覆盖，未在 A 侧独立复测 → T7 补齐。
3. Session 0 / 服务上下文未实测；重启后自动登录与自启动未配置 → T10。
4. Windows Update 默认策略下可能自动重启（仅记录） → T10 决策。
5. cpolar 已有两条隧道配置（website / remoteDesktop），暴露面与鉴权未核对 → T4/T10 必须核对，避免任务服务被公网可达。
6. 火绒 / ACE 反作弊对子进程、注入、文件写入的干扰未实测 → T6。
7. B 机全部信息空缺（T3 blocked：当前无任何可达通道）。
