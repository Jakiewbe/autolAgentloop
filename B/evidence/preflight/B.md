# B 机 DSH 部署前置盘点报告（T3）

| 字段 | 值 |
|---|---|
| 机器别名 | **B**（主机名 Magicbook14-zz，域 MAGICBOOK14-ZZ，账户 chs） |
| 任务书 | DSH_DEPLOYMENT_TASKBOOK.md（同版本，SHA256 见 §11），322 行 / 26371 字节 |
| 任务书读取位置 | D:\Autosave\DSH_DEPLOYMENT_TASKBOOK.md（用户提供） |
| B 实际管理目录 | **D:\AutoAgentloop**（本次盘点全部产物与证据所在；非 A 的 D:\Vibe_coding-Project\autoAgentloop，后者在 B 上不存在） |
| 证据根 | D:\AutoAgentloop\evidence\preflight\（本文件 + raw 原始日志） |
| 采集时间窗 | 2026-11-04T17:36:00+08:00 ~ 2026-11-04T17:53:09+08:00（Asia/Shanghai） |
| 采集执行者 | B 上的 DSH 会话（lead），非人工代填 |
| 标注体系 | `[实测]` 本机实际运行产生输出 / `[文件确认]` 只读配置或文件推断 / `[未验证]` 未取得证据 |

## 0. 结论摘要

**可直接用于 T11 的结论（4 条）**

1. `[实测]` B 具备**无交互**调用两条模型通道的能力，但都是**按模型显式指定**才成立：Codex 用 `-m deepseek-v4.1-flash-1017` 成功，Claude Code 用 `-p --model deepseek-v4.1-flash-1017` 成功；**两者默认模型都不可用**（Codex 默认 `gpt-6.1-sol` 额度耗尽 429，Claude 默认模型未作为默认路径验证）。
2. `[实测]` B 具备**无交互 DSH 执行入口**：`dsh --profile headless` 在"B 自己的 `.credentials.yaml` 注入 OPENCODE_GO_API_KEY + `--patch` 指向 opencode-go"组合下 EXIT=0 并输出预期串。桌面 profile 的 patch **不会**自动套用到 headless，这是 T11 必须处理的适配点。
3. `[实测]` B **没有** pwsh（只有 Windows PowerShell 5.1）、**没有** tailscale/zerotier/wireguard/openvpn、**没有** sshd 服务；`[文件确认]` PATH 中的 cloudflared 目录为空目录。→ 跨网络方案（T4）在 B 上等于从零选型安装，不要假定已有链路。
4. `[实测]` B 上存在**多份同一项目的副本**（honor-hackintosh-lab 家族至少 12 个目录），且 `g1-stock-20261020` 有 107 个未提交改动、`gpu-r5-20261017/src` 无远端。→ 首版启用前必须指定唯一写入副本，否则直接违反任务书"禁止两个副本同时写入同一项目"。

**阻塞项（需 A 或用户侧解决，B 单机侧不具备消除条件）**

| # | 阻塞 | 影响 | 需要谁 |
|---|---|---|---|
| B1 | Codex 默认模型 `gpt-6.1-sol` 处于 model_cooldown（reset_seconds=401826 ≈ 111h37m，约 4.6 天） | Codex 默认路径不可用；T13 复验必须显式指定模型或等额度恢复 | A/额度池 |
| B2 | `OPENCODE_GO_API_KEY` 不在 User/Machine 环境变量，只在 `~/.dsh/.credentials.yaml` | headless DSH 默认启动即 MISSING_CREDENTIAL；T11 需要明确的凭据注入方式（B 不复制 A 的凭据文件） | 用户/A 定策略 |
| B3 | 无跨网络链路（无 VPN 客户端、无 sshd、cloudflared 目录为空） | T4/T11 的"从不同网络领取任务"当前不可能 | T4 选型 |
| B4 | opencode 直连 `https://opencode.ai/zen/go/v1` 全部失败 | opencode 不作为 B 的执行通道；只走 8317 代理的 Codex/Claude | 模型侧 |
| B5 | C: 盘仅剩 7.2GB（120GB 总） | 部署包、node_modules、日志落盘空间受限；建议全部落 D: | 用户确认 |

## 1. 系统与账户

| 项 | 值 | 级别 |
|---|---|---|
| 主机名 / 账户 | Magicbook14-zz / chs（MAGICBOOK14-ZZ\chs） | [实测] |
| 用户目录 | C:\Users\19082（HOME=/c/Users/19082） | [实测] |
| 运行账户类型 | 本地交互登录用户，非管理员提权会话（计划任务以 Limited 运行） | [文件确认] |
| OS | Microsoft Windows 11 Home China，10.0.26200，Build 26200，64-bit | [实测] |
| 装机时间 / 上次启动 | 2025-10-04 18:53:36 / 2026-11-04 10:31:46（盘点时 uptime 7.1h） | [实测] |
| 区域 / 时区 | zh-CN / China Standard Time +08:00 | [实测] |
| 控制台代码页 | 936（GBK）；影响中文输出重定向与 grep，日志一律按 GBK/UTF-8 混存需注意 | [实测] |
| 磁盘 | C: 120GB，空闲 7.2GB（**紧张**）；D: 343.2GB，空闲 61.5GB；F: 24GB，空闲 16.1GB | [实测] |
| ExecutionPolicy | RemoteSigned（Get-ExecutionPolicy 生效值） | [实测] |
| LongPathsEnabled | 0（>260 字符路径会失败；Git core.longpaths 未设置） | [实测] |
| Git 全局身份 | user.name=Jakie，user.email=m1908286019@outlook.com；core.autocrlf 未设置 | [实测] |
| 最近补丁 | KB5127648、KB5127690（2026-10-17）；KB5127647（2026-10-15） | [实测] |
| 网络接口 | WLAN 172.17.18.197/18（默认路由 172.17.0.1）；Meta Tunnel 198.18.0.1/30（默认路由 198.18.0.2，本地代理隧道）；WSL vEthernet 172.20.224.1/20；以太网 Realtek USB GbE 已断开 | [实测] |
| 出网能力 | 直连 https://github.com HTTP 200 / 1.68s；经 127.0.0.1:7897 代理 200 / 1.86s；git ls-remote 到 GitHub 成功 | [实测] |
| 代理环境变量 | bash 环境仅 NO_PROXY=127.0.0.1,localhost,::1,198.18.0.0/16；User 级 HTTP(S)_PROXY 未设置 | [实测] |

## 2. 软件入口与版本（含与 A 的差异）

| 组件 | B 绝对入口 | B 版本 | A 版本（任务书） | 差异/风险 |
|---|---|---|---|---|
| Node | C:\Program Files\nodejs\node.exe | v24.12.0 | v24.12.0 | 一致 |
| npm / bun | 同上目录 / bun | npm 11.6.2，bun 1.3.13 | 未记 | 额外有 bun，B 独有的构建路径 |
| Git | **/ucrt64/bin/git**（另有 /d/Git/cmd/git） | 2.56.0.windows.2 | 2.52.0.windows.1 | **版本不同**；MSYS2 优先在 PATH 前部，脚本若固定 git 路径需按 B 实机改写 |
| Python | C:\Users\19082\AppData\Local\Programs\Python\Python312\python.exe | 3.12.2 | 未记 | `python3` 是 WindowsApps 存根（--version 空输出），脚本不得用 python3 |
| Codex | C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe（CODEX_CLI_PATH → bin\a159911ff70742e9\codex.exe）<br>C:\Users\19082\.codex\.sandbox-bin\codex.exe | 0.130.0-alpha.5（主用）<br>0.164.0-alpha.11.1 | PATH 中的 codex.exe | **PATH 中无 codex**，必须绝对路径调用；两个版本并存，选哪个要显式固定 |
| Claude Code | C:\Users\19082\.local\bin\claude.exe | 2.1.310 | claude.ps1 | 入口形态不同（exe vs ps1） |
| opencode | C:\Users\19082\AppData\Roaming\npm\opencode.cmd（另有 .ps1） | 1.17.13 | opencode.ps1 | 存在，但通道不可用（见 B4） |
| DSH 桌面 | D:\DPH\DeepSeek Harness.exe | 0.2.1-rc.3（File 0.2.1-rc.3 / Product 0.2.1.0） | 未记 | 签名 CN=Hangzhou DeepSeek… |
| DSH CLI | D:\DPH\resources\runtime\cli\bin\dsh.cmd（ELECTRON_RUN_AS_NODE=1 + app.asar 内 cli.js） | `dsh --version` = 0.2.1-rc.3 | 未记 | **PATH 中无 dsh**；桌面与 CLI 同版本、同一安装 |
| DSH 自带 runtime | D:\DPH\resources\runtime\versions.json | node 24.21.0，pnpm 11.28.5 | 未记 | B 存在两套 Node（系统 24.12.0 / DSH 捆绑 24.21.0），需在 T6 明确用哪套 |
| PowerShell | C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe | 5.1.26100.9711 Desktop | A 侧有 pwsh | **pwsh 未安装**：任何假定 pwsh 的适配脚本在 B 上直接失败 |

## 3. 后台进程能否取得与交互终端相同的必要配置（T2 第 3 条对齐）

| 通道 | 交互终端能否用 | 后台/无交互能否用 | 依据 |
|---|---|---|---|
| Codex（经 8317 代理） | 能（显式 -m） | **能**，前提：同用户会话 + 8317 已启动；`~/.codex/config.toml` 与 `~/.codex/auth.json`（4236 B，2026-11-03 23:07）为用户目录文件 | [实测] codex-exec/codex-edit/codex-resume2 日志 |
| Claude Code（经 8317 代理） | 能（显式 --model） | **能**，前提同上；`~/.claude/settings.json` 内 env 提供 BASE_URL 与 AUTH_TOKEN | [实测] claude-p / claude-edit / claude-continue |
| DSH headless | 能 | **能但需显式注入**：默认路由 deepseek-official 缺 DEEPSEEK_API_KEY；指向 opencode-go 后仍需 OPENCODE_GO_API_KEY **在环境变量里** | [实测] dsh-headless-* 四份日志 |
| opencode | 失败 | 失败 | [实测] 两次 4s 失败，模型不可用 / Unexpected server error |
| 8317 上游代理 | 能 | **依赖登录**：计划任务 \CLIProxyAPI 为 logon 触发（Interactive，Limited），不是开机启动；机器重启后未登录则模型链路整体不可用 | [文件确认] schtasks LastResult=0, LastRun 11/04 10:32:22 |

推论（T11 直接相关）：**B 的执行端不适合设计成"开机即用"**，要么改计划任务为开机触发（需在 T11 显式批准并记录），要么承认必须先登录。盘点阶段未修改任何计划任务或电源设置。

## 4. 模型通道与实测记录

### 4.1 通道与配置来源

| 通道 | 配置来源 | 实际模型 ID | 额度池非敏感别名 | 本机凭据状态 |
|---|---|---|---|---|
| cliproxyapi（Codex 上游） | `~/.codex/config.toml`：model_provider=cliproxyapi，base_url=http://127.0.0.1:8317/v1，wire_api=responses | 默认 gpt-6.1-sol；实测可用 deepseek-v4.1-flash-1017 | 8317 代理 → https://opencode.ai/zen/go/v1（D:\CLIProxyAPI\config.yaml） | `auth.json` 已配置（不导出内容） |
| claude-code（经 8317） | `~/.claude/settings.json` env：ANTHROPIC_BASE_URL=http://127.0.0.1:8317 | 默认 claude-fable-5-dd-hsalf-1.4v-keespeed；子代理 deepseek-v4.1-flash-1017 | 同上 | ANTHROPIC_AUTH_TOKEN 已配置（sk- 前缀，不导出） |
| opencode-go（直连） | `~/.config/opencode/opencode.json` provider=cc | 清单仅 deepseek-v4-flash / deepseek-v4-pro / glm-5.2 / kimi-k2.7-code / mimo-v2.5-pro | opencode.ai/zen/go | 可用但模型不可用（见 4.2 #5） |
| DSH 桌面默认 | `~/.dsh/profiles/desktop/cordis.patch.yml`：agent-default-model provider=opencode-go，model=deepseek-v4.1-flash，reasoningEffort=high | deepseek-v4.1-flash | opencode-go（apiKeyEnv=OPENCODE_GO_API_KEY） | `~/.dsh/.credentials.yaml` 仅存 refs.OPENCODE_GO_API_KEY（51 字符 oc_s…，不导出）；**环境变量未设置** |

### 4.2 分层实测（读取 / 受控编辑 / 运行检查 / 会话接续）

| # | 场景 | 命令（摘要） | 结果 | 耗时 | 日志 |
|---|---|---|---|---|---|
| 1 | Codex 默认模型读取 | `codex exec "输出 CODEX_OK"` | **失败** 429 model_cooldown（reset 401826s） | 即时 | raw/codex-exec-20261104T173901.log；上游原文见 D:\CLIProxyAPI\logs\error-v1-responses-2026-11-04T173911-f686d1ad.log |
| 2 | Codex 备用模型读取 | `codex exec -m deepseek-v4.1-flash-1017 ...` | **成功**，输出 CODEX_ALT_OK | 11s | raw/codex-alt-20261104T174035.log |
| 3 | Codex 受控编辑 + 自行运行检查 | 在 _probe/t3-models 新增 mul 并改 check.js，自跑 `node check.js` | **成功** CHECK_PASS，exit 0，4811 tokens，session 01a1a5ee-d337-7153-a059-f5413968da6d | 50s | raw/codex-edit-20261104T174054.log |
| 4 | Codex 会话接续 | `codex exec resume --last`（不带 -m）／带 -m | 不带 -m **回落到 gpt-6.1-sol → 429**；带 -m **成功且同一 session**，正确复述上轮输出与新函数 | 10s | raw/codex-resume-20261104T174151.log、raw/codex-resume2-20261104T174204.log |
| 5 | opencode 读取 | `opencode run -m cc/deepseek-v4-flash` / `-m cc/deepseek-v4.1-flash-1017` | **均失败**：Model is unavailable / UnknownError err_1e3f497c | 4s | raw/opencode-run-20261104T174013.log、raw/opencode-run2-20261104T174024.log |
| 6 | Claude Code 读取 | `claude -p --model deepseek-v4.1-flash-1017 ...` | **成功** subtype=success，is_error=false，session a60872bc-3f64-4585-be1c-eaec1e24ee67，cost 0.080465 USD，带 `[claude-code:unrecognized_model]` 警告但调用成功 | 32s | raw/claude-p-20261104T173933.log |
| 7 | Claude 受控编辑 + 运行检查 | `--permission-mode acceptEdits` 加 sub 并跑 node check.js | **成功**，10 turns，check exit 0 | 35s | raw/claude-edit-20261104T174220.log |
| 8 | Claude 会话接续 | `claude -c -p ...` | **成功**，复得 session 0fe969c6-38b4-43af-8412-2e57a950e781 | — | raw/claude-continue-20261104T174304.log |
| 9 | DSH headless 首次 | `dsh --profile headless "..."` | **失败** MISSING_CREDENTIAL: llm-deepseek: no API key for provider route "deepseek-official" | 5s | raw/dsh-headless-20261104T174439.log |
| 10 | DSH headless + patch | 加 `--patch raw/headless-opencode-go.patch.yml` | **失败** llm-pi-ai: no credential for provider route "opencode-go"（环境变量未设） | 5s | raw/dsh-headless-20261104T174457.log |
| 11 | DSH headless + patch + 环境变量 | 从 B 自己的 `.credentials.yaml` 取 key 注入环境后同上 | **成功** EXIT=0，输出 DSH_HEADLESS_OK | 5s | raw/dsh-headless-patched-20261104T174544.log（脚本 raw/run-dsh-headless2.sh） |

说明：所有"成功"均为真实模型返回（含 token 计数 / session ID / 成本），无模拟输出替代。锁定的探针工程在 D:\AutoAgentloop\_probe\t3-models（calc.js 含 add/mul/sub，check.js 三条断言，`node check.js` exit 0）。

### 4.3 与任务书口径的差异（需 A 记录）

- 任务书写的"DeepSeek V4.1 Flash"在 B 上的**实际模型 ID 是 `deepseek-v4.1-flash-1017`**（Codex/Claude 均以此成功）；DSH 桌面 profile 写的是 `deepseek-v4.1-flash`（无 -1017 后缀），opencode 模型清单里**没有** v4.1 系列。三处口径不一致，T7 必须以实测 ID 为准并对齐。
- Claude 默认模型 `claude-fable-5-dd-hsalf-1.4v-keespeed` 只被用作默认值，本次未以默认路径验证成功（B 用显式模型验证）→ 若 T7 依赖默认值，需补一次默认路径实测。

## 5. DSH 桌面入口与自动化入口是否同版本

`[实测]` 同一安装：桌面 D:\DPH\DeepSeek Harness.exe 与 CLI D:\DPH\resources\runtime\cli\bin\dsh.cmd 都解析到 0.2.1-rc.3，CLI 实际执行 app.asar 内的 cli.js。`[实测]` 本报告编写时桌面 DSH 正在运行（PID 14172，Web 127.0.0.1:14182，返回 401 "dsh web authentication required"，仅回环监听）。

`[实测]` 差异点不在版本而在**配置装配**：desktop profile 的 cordis.patch.yml 不会自动作用于 `--profile headless`；headless 需独立 patch + 环境变量凭据。这是 T11 的必做适配项（不是缺陷，是需要固化的启动契约）。

## 6. 项目盘点

### 6.1 候选目录与 Git 状态

| 目录 | 类型 | HEAD | 远端 | 脏文件 | 依赖可运行性 | 备注 |
|---|---|---|---|---|---|---|
| D:\Virtuals\projects\q | Node 服务（package.json 150 行，node_modules 已装） | 0eef732 (2026-09-22) | Jakiewbe/Virtualsalpha.git | 0 | `[实测]` node_modules 存在；未执行其测试脚本（T14 范围） | 另有 4 个 worktree：q-contract-upgrade 628ed96 / q-core-v1 f4f4889 / q-dependency-ci 348243b / q-launch-tax-storage c941820，分支 codex/* |
| D:\Virtuals\worktrees\*（4 个） | q 的 worktree | 见上 | 同 q | 0 | 同 q | **这 4 个分支在远端不存在**（ls-remote 无匹配）→ 本地独有 |
| D:\Hactk\honor-hackintosh-lab | macOS 驱动研究（无 package.json） | cef885e (2026-10-20) | Jakiewbe/honor-hackintosh-lab.git | 0 | 无 Node 依赖；构建依赖 macOS 工具链 | 远端 main 实际为 1fd2a6e（本地跟踪引用 cef885e 已陈旧） |
| D:\Hactk\g1-stock-20261020 | 同一研究的工作副本 | c68c73b (2026-10-25) | Jakiewbe/honor-hackintosh-lab.git | **107** | 同上 | 本地 origin/main 引用=c68c73b（陈旧）；远端 main=1fd2a6e，未能判定 c68c73b 是否已推送（对象不在本地，未 fetch） |
| D:\Hactk\g1-stock-work\usb-repo | g1-stock 的本地克隆 | — | **file:///D:/Hactk/g1-stock-20261020** | 0 | 同上 | 本地链式副本，无异地备份 |
| D:\Hactk\g1-stock-work\{nm-272ccd9,nm-cand,nm-cand-lf,nm-cand-v243,nm-cand-v243b,nm-lf,nm-pm-guard-local}（7 个） | NullMoth/nvidia-macos-driver 的多副本 | 各自 | NullMoth/nvidia-macos-driver.git | 0/639/2/0/2/0/2 | 同上 | nm-cand 有 **639** 个未提交改动；同项目 7 份副本并存 |
| D:\Hactk\g1-stock-work\ogkm | NVIDIA/open-gpu-kernel-modules | — | NVIDIA/open-gpu-kernel-modules.git | 0 | 同上 | 上游镜像副本 |
| D:\Hactk\g1-stock-work\xnu-43a9088 | apple-oss-distributions/xnu | — | apple-oss-distributions/xnu.git | **5698** | 同上 | 源码缓存，非业务项目 |
| D:\Hactk\gpu-r5-20261017\src | NullMoth NVIDIA 驱动源码 | 2b6828b | **无远端** | 0 | 同上 | **唯一工作副本**（无任何远端） |
| D:\CLIProxyAPI | Go 代理服务 | 5afc0f1d | router-for-me/CLIProxyAPI.git | 21 | `[实测]` 正在以 v8.0.30 运行（PID 23224） | 21 个改动含本地配置；B 的模型链路实体 |
| D:\Hactk | 目录级 git 仓库 | **无 HEAD** | 无 | 20 | — | 空仓库占位，内容未跟踪 |
| C:\Users\19082\Documents\Rboin、VVAI | 空 git 仓库 | **无 HEAD** | 无 | 0 | — | 无内容，非项目 |

`[文件确认]` 业务侧已存在 `.agent` 治理目录 5 处：D:\Autosave\.agent、D:\Hactk\g1-dev-20261015\base\.agent、D:\Hactk\g1-stock-20261020\.agent、D:\Hactk\g1-stock-work\usb-repo\.agent、D:\Hactk\honor-hackintosh-lab\.agent。T8 桥接时不要假定只有一份 Project Anchor 状态。

### 6.2 唯一工作副本判定（T3 第 3 条）

| 判定 | 目录 | 依据 |
|---|---|---|
| **唯一工作副本（无远端）** | D:\Hactk\gpu-r5-20261017\src | `git remote -v` 为空，HEAD 2b6828b 只存在于本机 |
| **唯一工作副本（本地独有分支）** | D:\Virtuals\worktrees\ 下 4 个 codex/* 分支 | `ls-remote --heads origin` 无这 4 个分支 |
| **高风险唯一改动** | D:\Hactk\g1-stock-20261020（107 个未提交）+ nm-cand（639 个未提交）+ xnu-43a9088（5698 个未提交） | 未提交内容只在工作区；且 g1-stock 的 HEAD 提交是否在远端未能判定 |
| **本地链式副本（无异地备份）** | D:\Hactk\g1-stock-work\usb-repo | 远端是 file:// 本地路径 |
| **同项目多副本，禁止同时写入** | honor-hackintosh-lab 家族：g1-stock-20261020、honor-hackintosh-lab、g1-stock-work\usb-repo、g1-dev-20261015\base（≥4 份）；NullMoth 驱动家族：gpu-r5-20261017\src + nm-*（7 份） | 目录内容与远端指向重叠 |
| **仅副本（有远端且干净）** | D:\Virtuals\projects\q（main 与 origin/main 一致）、D:\Hactk\g1-stock-work\ogkm | 可从远端重建 |

建议（供 T14 决策，不在盘点阶段执行）：首版启用只选 **1 个** 项目、**1 个** 副本。若选 q，则写入点固定为 D:\Virtuals\projects\q，4 个 worktree 只读；若选 honor 研究，则先把 g1-stock-20261020 的 107 个改动提交或纳入备份，再冻结其余副本为只读。

## 7. 生命周期：休眠、自动更新、后台服务、通知、磁盘（只记录，未修改）

| 项 | 现状 | 级别 |
|---|---|---|
| 睡眠 | 支持 S0 低电量待机（**网络已断开连接**）、休眠、快速启动；不支持 S1；STANDBYIDLE 交流/直流均为 0（不按空闲自动睡眠） | [实测] powercfg |
| 合盖动作 | powercfg 未能返回 LIDACTION 明细（别名与 GUID 查询都只回方案头），**未取得** | [未验证] |
| 自动更新重启 | 无 AU 策略键（HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU 不存在），即使用系统默认；未设活动时间 | [实测] |
| 现有后台服务 | 计划任务 \CLIProxyAPI（logon 触发，Interactive/Limited，D:\CLIProxyAPI\autostart.ps1，LastResult=0）；其他非 Microsoft 任务：EquiumMiner0300、Virtuals-QClaw-Adapter、EthosAIBot_DailyCheckin(Disabled)、PlatformExperiencesHelper_* | [实测] |
| DSH 自启 | HKCU Run 无 DSH/DeepSeek 项；Startup 文件夹为空 → **当前无自启**，T11 需注册 | [实测] |
| 通知方式 | 未发现 MCP/通知集成；DSH 有 tray.ico 但未验证托盘通知可用 | [未验证] |
| 磁盘 | C: 7.2GB 空闲（紧张，DSH/Codex 默认缓存都在 C）；D: 61.5GB | [实测] |

## 8. 与 A 的差异汇总与适配要求（给 T5/T6/T7）

1. **Git 2.56.0（MSYS2 /ucrt64 优先）vs A 的 2.52.0**：路径与行为都不同，脚本必须用 `command -v git` 或绝对路径探测，不得硬编码。
2. **无 pwsh**：T6 的 Windows 生命周期适配必须提供 PowerShell 5.1 兼容路径（DSH 自带 runtime 里也没有 pwsh）。
3. **无 dsh/codex 的 PATH 入口**：所有调用需绝对路径（dsh.cmd 在 D:\DPH\resources\runtime\cli\bin，codex 有两处）。
4. **两套 Node**（系统 24.12.0 / DSH 捆绑 24.21.0）：fork 产物必须显式选 runtime，否则行为随启动方式漂移。
5. **模型 ID 口径三处不一致**（deepseek-v4.1-flash-1017 / deepseek-v4.1-flash / opencode 清单无 v4.1）：统一到实测可用的 `deepseek-v4.1-flash-1017`，或由 A 决定别名映射。
6. **默认模型不可用**（gpt-6.1-sol 冷却 111h37m）：任何"默认即可跑"的假设在 B 上不成立。
7. **凭据形态不同**：B 的 key 在 `~/.dsh/.credentials.yaml` 的 refs 中，不在环境变量。T11 需要 A 明确：B 用哪份凭据、如何注入、是否允许写入 B 自己的 credentials 文件（**不复制 A 的登录文件**）。
8. **控制台 936 代码页**：日志与 grep 需要处理 GBK/UTF-8 混合。
9. **C 盘空间**：部署和缓存应定向到 D:；T6 需提供 cache/log 路径配置项。

## 9. T11 就绪条件（B 侧需要 A 提供，或需用户批准）

| # | B 需要 | 用途 | 当前状态 |
|---|---|---|---|
| 1 | 同版本部署包的 SHA256 清单（源包 + 解包后逐文件） | T11 第 1 条"核对内容哈希" | 未收到 |
| 2 | A 中心的实际访问地址（私网/隧道别名）+ 端口 + 访问限制说明 | T11 第 2 条连接 A | 未收到（B 无 VPN，见 B3） |
| 3 | B 执行端身份的注册方式（令牌/证书/账号）与命名规则 | T11 第 2 条"唯一执行端身份" | 未收到 |
| 4 | 明确 B 用哪份模型凭据 + 注入方式（环境变量 / B 自己的 credentials 文件） | 无交互启动 | 待定（见 B2） |
| 5 | 是否允许把 \CLIProxyAPI 计划任务改为开机触发（涉及改全局设置） | 后台重启后模型链路可用 | 待批准 |
| 6 | 部署落到哪个目录（建议 D:\AutoAgentloop\app，C 盘空间不足） | 安装位置 | 待确认 |

## 10. Codex 后续如何在 B 上实际复验（含限制）

**可实际复验的路径（按优先级）**

1. **直接在 B 上跑 Codex（推荐，最接近真实）**：
   - 入口：`C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe`（固定 0.130.0-alpha.5）；
   - 依赖：8317 代理在线（`curl -s -o /dev/null -w %{http_code} http://127.0.0.1:8317/v1/models` 或直接跑一次小任务）；
   - 必须显式模型：`codex exec -m deepseek-v4.1-flash-1017 "<复验指令>"`；若额度恢复可去掉 -m 验证默认路径；
   - 会话接续复验：`codex exec resume --last -m deepseek-v4.1-flash-1017 "..."`（不带 -m 会 429，这是已知坑，需在复验说明里写死）；
   - 证据：codex 自身 stdout + `~/.codex/sessions` 下的 rollout 文件 + B 侧 raw 日志三份对齐。
2. **让 Codex 审阅 B 的日志与产物**（Codex 不来 B 也能做）：把 `evidence/preflight/B.md` + `raw/*.log` + `manifest.json` 拷到 A/Codex 环境；B.md 内每条结论都带日志文件名与耗时，可逐条对账。
3. **B 侧自证脚本**（供 Codex 一键重跑）：
   - `verify-on-B.sh env`：只查身份/版本/端口/证据哈希，不调用模型。`[实测]` 本报告编写时已在 B 上运行，结果 **PASS**（node v24.12.0、git 2.56.0.windows.2、RemoteSigned、pwsh 缺失、codex 0.130.0-alpha.5、dsh 0.2.1-rc.3、claude 2.1.310、8317 返回 401 有响应）。
   - `verify-on-B.sh full`：另跑 Codex（备用模型）、Claude、DSH headless 三次真实调用。`[未验证]` full 模式本次未执行（避免重复消耗额度），执行结果由 Codex 复验时产生并记录。
   - `raw/run-dsh-headless2.sh`：复现 headless 成功路径（从 B 自己的 credentials 取 key 注入，不落盘不打印）；Codex 复验时应在**同一用户会话**下重跑并比对退出码与输出串。

**限制（必须记录，不得宣称已通过）**

- Codex 在**非该用户登录会话**下未验证（凭据与 8317 都依赖用户态）；Codex 的计划任务/服务化启动未验证。
- 默认模型 `gpt-6.1-sol` 处于 cooldown，Codex 默认路径的任何"通过"结论都不成立，直到额度恢复（约 4.6 天）。
- 跨网络（A/B 不同外网）完全没有链路，T13 的"从不同网络领取任务"目前**不可能**复验。
- DSH headless 的成功依赖环境变量注入这一外部步骤；若 Codex 只跑 `dsh --profile headless` 而不注入，会复现 MISSING_CREDENTIAL（这是预期失败，不是回归）。
- 本报告所有结论来自 B 本机单点，未与 A 的结果交叉比对（A 的 A.md 不在 B 上）。

## 11. 原始日志与证据清单（B 侧保留）

根目录：`D:\AutoAgentloop\evidence\preflight\`，原始日志在 `raw\`（**不脱敏、不删改**，机器可读原件）。读取方法：任何文本编辑器直接打开；或 `sed -n '1,200p' raw/<name>.log`。

| 文件 | 字节 | SHA256 前 16 位 |
|---|---|---|
| raw/claude-continue-20261104T174304.log | 1800 | e73f964c1b4929d2 |
| raw/claude-edit-20261104T174220.log | 2532 | 976f1a3f4baabbbb |
| raw/claude-p-20261104T173933.log | 1708 | 8b1365261391f69a |
| raw/codex-alt-20261104T174035.log | 704 | 7e422f6f3cac422e |
| raw/codex-edit-20261104T174054.log | 7478 | 98d055cf3d880d15 |
| raw/codex-exec-20261104T173901.log | 1127 | c1c3e8dffbebc834 |
| raw/codex-resume-20261104T174151.log | 802 | fdc69e2fb3f4ef1f |
| raw/codex-resume2-20261104T174204.log | 1054 | 3976f1bf0a7cb222 |
| raw/dsh-headless-20261104T174439.log | 1158 | 404c1931aa311bfe |
| raw/dsh-headless-env-20261104T174535.log | 235 | 3df619c128e84565 |
| raw/dsh-headless-patched-20261104T174457.log | 1396 | 8f5646f751314c99 |
| raw/dsh-headless-patched-20261104T174544.log | 16 | 3a9bf2ec1d63b763 |
| raw/opencode-run-20261104T174013.log | 110 | c4d9669776eceb1e |
| raw/opencode-run2-20261104T174024.log | 167 | 104033a404c6f4a7 |
| raw/headless-opencode-go.patch.yml | 466 | cba968723279aad9 |
| raw/run-dsh-headless.sh | 928 | 67728bc01902395e |
| raw/run-dsh-headless2.sh | 799 | 23fce7009678bed7 |
| verify-on-B.sh | 见 manifest.json | 见 manifest.json（自证脚本，env 模式已在 B 上 PASS） |

另有附加证据：`D:\CLIProxyAPI\logs\error-v1-responses-2026-11-04T173911-f686d1ad.log`（429 上游原文）、`~/.codex/config.toml`、`~/.claude/settings.json`、`~/.dsh/profiles/desktop/cordis.patch.yml`、`D:\DPH\resources\runtime\versions.json`；探针工程 `_probe\t3-models\`。

任务书哈希待 A 侧核对：B 上 D:\Autosave\DSH_DEPLOYMENT_TASKBOOK.md = 26371 字节（见 manifest.json）。

## 12. 未验证项与原因

| 项 | 原因 |
|---|---|
| 合盖动作（LIDACTION） | powercfg 别名与 GUID 查询均只返回方案头，未取得设置值 |
| Claude 默认模型（claude-fable-5-…）路径 | 只用显式 --model 验证，未验证默认值能否成功 |
| Codex/Claude 在非登录会话、服务化启动 | 涉及修改计划任务（全局设置），盘点阶段禁改 |
| 托盘/系统通知可用性 | 未配置任何通知集成，未做端到端通知实测 |
| 跨网络连通性、A 的地址与身份接口 | T4 范围，且 B 无任何 VPN/隧道组件 |
| B 各业务项目的构建/测试是否通过 | T14 范围，本阶段只记录仓库状态与依赖存在性 |
| A 的 A.md 与 B 的差异交叉比对 | A.md 不在 B 上 |

## 13. 标注与时间说明

- 采集时间统一用 Asia/Shanghai（本机时区），格式 2026-11-04T17:xx+08:00；跨机阅读时以任务/执行编号去重，不依赖时间。
- `[实测]`：本机实际执行并留有日志/输出（附文件名、耗时、退出码或响应码）。
- `[文件确认]`：只读配置文件或目录元数据推断，未触发运行。
- `[未验证]`：本次未取得证据，明确列为缺项而不是默认通过。
- 本报告未修改任何全局设置（电源、计划任务、环境变量、证书、网络），未复制 A 的任何私有配置，未写入 D:\Autosave\.agent（B 上的 A 账本快照，只读引用）。

---

**交付去向**：A 侧保存为 `evidence/preflight/B.md`。B 侧副本与哈希清单：`D:\AutoAgentloop\outbox\to-A\`（人工/T4 通道传递，B 不直接写 A 的工作区）。

## 14. A 侧采集脚本（collect_b.ps1）在 B 的实跑记录

> 本节是给 A 的对口验收证据：A 在 `main` 的 `tools/b_preflight/collect_b.ps1` 要求 B 本机真实运行过。

- 脚本来源：从 `origin/main` 取出的 `tools/b_preflight/collect_b.ps1`（18363 字节，UTF-8 with BOM，`#requires -Version 5.1`），内容一字未改；副本连同 A 的 `B_expected.md`、`B_bootstrap.md` 放在本目录 `a-kit/` 下。
- 执行环境：Windows PowerShell 5.1.26100.9711 Desktop（B 上没有 pwsh，脚本本身按 5.1 编写）。
- 第 1 次（2026-11-04T21:45:11，产物在 `a-kit/run/`）：`-OutDir ... -Alias B`，未给 `-ProjectRoots`。exit 0；`B.md` 2399 字节、`raw/` 8 份、zip 哈希 `C17869657B07BAFAA67E9E6DA6F7969D9AA827BB0009202D3FF974627FA3F1F9`。项目一节输出 `no_candidate_roots`，原因是脚本默认候选根（如 `D:\Vibe_coding-Project`）在 B 上不存在。
- 第 2 次（2026-11-04T21:47:11，产物在 `a-kit/run2/`）：`-ProjectRoots 'D:\Hactk','D:\Virtuals','D:\CLIProxyAPI','D:\Autosave','D:\AutoAgentloop','D:\DPH'`（B 的真实根）。exit 0；`B.md` 2400 字节、`raw/` 8 份（含 `07-projects.txt`）、zip 8.1 KB，哈希 `BEA39E097130E4024AF11660289EBEEC96750CDD07346935B85F34C5BBE7F7BF`，与 .sha256 文件内容一致（仅大小写和 `*` 前缀差异）。
- 调用格式坑（A 后续在 B 复跑需知）：`powershell -File script.ps1 -ProjectRoots 'a','b'` 会报 `PositionalParameterNotFound`（数组参数在 -File 模式下传不进去），改用 `-Command "& '...\collect_b.ps1' -ProjectRoots 'a','b'"` 才成功。
- 脚本里的 `codex`、`dsh` 两行为空：两者都不在 PATH（见 §2），脚本只查 PATH。完整版本信息以本文件 §2 为准。
- 定位：collect_b.ps1 的产物是 A 的**最小验收集**（A 期望的格式 + 可核对哈希），本文件是**深度报告**（15 个模型调用实测场景、与 A 的版本差异、唯一副本判定）。两套都在 `b` 分支，互不替代；A 侧 `evidence/preflight/B.md` 落点建议用本文件，a-kit 产物作为附录证据。

## 15. 发布位置（GitHub，2026-11-04T21:52+08:00 更新）

- 仓库：`https://github.com/Jakiewbe/autolAgentloop`
- 分支：`b`（B 专用）；`main` 是 A 的内容，B 没有向 `main` 提交过任何东西。
- 基线：`b` 由 A 的 `main` 最新提交 `62f38a1` 拉出重建（该树即 A 的交付快照 `717e4b8`，作者 `chs <chs@localhost>`，只删了一个治理草稿 `CURRENT.new.md`），单提交，只新增 `B/` 目录，A 的文件一个字节未动；`main` 指针全程没有被 B 改动。
- 路径前缀 `B/`，与 B 本机目录一一对应：

| 仓库路径（`b` 分支） | B 本机原始路径 |
|---|---|
| `B/README.md` | 发布说明（来源机器、采集时间窗、导览、区分规则） |
| `B/evidence/preflight/B.md` | `D:\AutoAgentloop\evidence\preflight\B.md`（本文件） |
| `B/evidence/preflight/manifest.json` | `D:\AutoAgentloop\evidence\preflight\manifest.json` |
| `B/evidence/preflight/b-preflight.json` | `D:\AutoAgentloop\evidence\preflight\b-preflight.json` |
| `B/evidence/preflight/verify-on-B.sh` | `D:\AutoAgentloop\evidence\preflight\verify-on-B.sh` |
| `B/evidence/preflight/raw/*` | `D:\AutoAgentloop\evidence\preflight\raw\*`（17 份原件） |
| `B/evidence/preflight/a-kit/*` | `D:\AutoAgentloop\evidence\preflight\a-kit\*`（A 的脚本 + B 上两次实跑产物） |

- 行尾策略：`B/.gitattributes` 设 `* -text`。raw 日志是 CRLF，Git 若做行尾规范化会改写字节、让 manifest 里的 sha256 全部失效，所以 B 的证据目录一律保持逐字节原样（代价是 diff 视图把文本按二进制显示）。第一次推送的两个提交缺这个文件，7 份 codex/opencode 日志被 CRLF→LF 改写，已用重建后的单提交替换；**以本提交为准**，旧的 `5893f5d`、`2f95400` 不代表有效内容。
- 作者身份：B 的提交作者固定为 `B Magicbook14-zz <b@magicbook14-zz.local>`；A 的提交是 `chs <chs@localhost>`，最早一次是 `Jakiec <chenobc@foxmail.com>`。
- 核对方法：`git ls-tree -r --name-only origin/b` 取清单，对每个路径跑 `git cat-file blob origin/b:<path> | sha256sum`，与 `evidence/preflight/manifest.json` 的哈希逐条比对，应当全等。
- 校验结果（2026-11-04T21:53 +08:00）：`git diff --name-only origin/main origin/b` 恰好 49 行且全部以 `B/` 开头；对 49 个 blob 逐个取内容算 sha256、与 B 本机同名文件逐字节比对，0 处不一致；`git status --porcelain` 为空；`main` 仍指向 A 的提交。
- 去重键：跨机对账用「场景编号 + 任务号」（如 `T3-S2`、`T11`），不用时间戳，也不用分支名。

## 16. 复验脚本 full 模式的实跑记录（2026-11-04T21:55 +08:00）

- 目的：证明 A/Codex 后续能在 B 上**实际复验**，而不是只拿到一份步骤说明。
- 第 1 次 `bash verify-on-B.sh full`：exit 1。第 1–3 节全部 OK；第 4 节 codex 报 `Not inside a trusted directory and --skip-git-repo-check was not specified`——在非 git 目录调用 codex 必须带这个旗标（日志 `verify-runs/verify-full-20261104T215415.log`）。
- 处置：给 `verify-on-B.sh` 的 codex 命令加 `--skip-git-repo-check`，并给 codex、claude 两条命令重定向 `/dev/null`（否则 codex 会停等 stdin）。脚本由 3538 字节变为 3641 字节。
- 第 2 次：exit 0，末行 `== 结果: PASS ==`。codex `-m deepseek-v4.1-flash-1017` 输出 `CODEX_VERIFY_OK`；claude 输出 `CLAUDE_VERIFY_OK`；DSH headless 因 `OPENCODE_GO_API_KEY` 未注入而按预期跳过（日志 `verify-runs/verify-full-20261104T215441.log`）。
- 复验用法：`bash verify-on-B.sh env`（不调模型，约 3 秒）；`bash verify-on-B.sh full`（两次真实模型调用；要让第 6 节也跑，先按 `raw/run-dsh-headless2.sh` 的方式注入 `OPENCODE_GO_API_KEY`）。
- 失败那次日志一并保留：复验者可以对照失败/成功两态，确认判据确实在工作。
