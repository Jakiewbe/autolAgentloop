# B 端 T11 部署执行报告（第三轮）

## 0. 结论与范围

本轮把「安装这一步还缺什么」推进到只剩一个输入：**审核包已在 B 上收到并逐字节校验通过，中心地址从 B 侧可达且鉴权生效，模型通道用包内判分程序实测通过；真实安装未执行，因为 A 为 B 单独签发的 worker 身份文件还没送到 B**。

- 时间窗：2026-11-05T09:41:00+08:00 → 2026-11-05T10:10:00+08:00（Asia/Shanghai）。
- 机器：Magicbook14-zz / 账户 chs / 用户目录 `C:\Users\19082` / 工作目录 `D:\AutoAgentloop`。
- 本轮没有执行真实安装器、没有生成 `C:\Users\19082\.agent-autoloop`、没有建第二个中心、没有复制 A 的身份文件、没有改 A 的账本、没有建分支或 worktree、没有提交推送业务工程。
- 未验证项明确为 **3 项输入 + 6 项跨机联调 = 9 项**（§15），不计入通过。
- 本轮全部自测在 `%TEMP%\b-round3-*` 隔离根 + 假 HOME 下运行，夹具用 `SIMULATION-ONLY` 标记。

## 1. 机器与账户

| 项 | 实测值 |
| --- | --- |
| hostname | MAGICBOOK14-ZZ |
| 账户 | chs（用户目录 C:\Users\19082） |
| 系统 | Windows 11 家庭版 中文版 10.0.26200 build 26200 64-bit |
| node | v24.12.0（C:\Program Files\nodejs\node.exe，满足包要求 Node24+） |
| PowerShell | Windows PowerShell 5.1.26100.9711；pwsh 不存在 |
| 工作目录 | D:\AutoAgentloop（无 .git） |
| 真实安装根 | C:\Users\19082\.agent-autoloop 不存在 |

## 2. 版本与仓库基线

- 审核包来源：A 侧 main 提交 `43b3c6f`（「A 侧补齐审核四项」）。
- 交接单：A 的 `evidence/handoff/A-to-B.md`，本机读到的是 main `2ed6c07`（追加联调窗口、B 回传模板、六项跨机对账表）。
- 本报告的 B 证据在仓库 `Jakiewbe/autolAgentloop` 的 `b` 分支 `B/` 前缀下，与 A 的 main 按分支 + 目录 + 作者三重区隔。

## 3. 审核包：接收与逐项校验

| 项 | 值 |
| --- | --- |
| 包路径 | `D:\AutoAgentloop\_incoming\B-reviewed-delivery\B-reviewed-delivery.zip` |
| 字节 | 414436 |
| SHA256 | `e0b4fb5b2e03bd9701cf8af42d9c7f9af0106dc09fd1c3018fd64e427394d853` |
| 要求值 | 同上，逐字一致 |
| 取得方式 | 从 A 的 main `43b3c6f` 克隆副本取出 `deploy/B-reviewed-delivery.zip` 后复制到 `_incoming`，未用旧 b 分支产物替代 |
| 解包目录 | `D:\AutoAgentloop\_incoming\B-reviewed-delivery\extracted` |

包内 7 个成员与 `delivery.json` 记录的 6 项 artifact 全部逐字节一致：

| 成员 | 字节 | SHA256 | 与 delivery.json |
| --- | ---: | --- | --- |
| agent-autoloop-reviewed.zip | 409043 | d504e4876d07501e0a5288242a4575ae60dea685c1191c0598949bd9f9c99ebc | 一致 |
| agent_result.mjs | 2441 | 0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f | 一致 |
| install-b.mjs | 4460 | 50b895e91b54093849dfb1ea8be7e170bc366178c4ea7203612a78618cca8e06 | 一致 |
| manifest.json | 32262 | 5278f16e60725408f0cbe0e158e78f6657d7be501b7c77662572b4c474740ffe | 一致 |
| README.md | 2943 | 7f5617d130ade7289c6e3100f9156905831e0248847dc009ded922a3612e9694 | 一致 |
| verify-b.ps1 | 2022 | a2fcc50777d8bf317312f7c8a3792641ddb9b45d80e9c6db73bc253a580da3ba | 一致 |
| delivery.json | 959 | 199dc065c9791cc6e9d11252ff2fbfc36cc77f4653c49db6f4693e0d9cb12c21 | 清单自身 |

包内 `install-b.mjs` 的实际执行顺序（B 端按此对齐守卫）：读 key 文件 → `GET /healthz`(10s) → `GET /v1/work?claim=installer-check…` 带 Bearer → 比对 manifest 记录的内层包哈希 → 目标目录已存在即中止 → `tar -xf` → 逐文件校验 → 写 `config.json`(flag wx) → service install → spawn up → 2s 内退出即报错 → 写 `B-install-receipt.json`（status `worker-started-only`、model_verified=false、cross_network_task_verified=false）。

## 4. 本机搜索：审核包与安装脚本的分布

采集脚本 `evidence/deploy-b/collect-b-deploy.ps1`（v6，SHA256 `2e2e366a48e1385af049f217025bb6a7ebad7be60a908bd8e838d6df0ddd6404`）自写遍历器，三根四模式、深度 8、不跟随 reparse，命中按 kind 分类：

```
ROOT_SUMMARY root=C:\Users\19082 dirs=40882 hits=451 real=0 received=0 clone=0 fixture=451 errors=9 omitted_dirs=12634
ROOT_SUMMARY root=D:\ dirs=43667 hits=4 real=0 received=3 clone=1 fixture=0 errors=3 omitted_dirs=12679
ROOT_SUMMARY root=F:\ dirs=1649 hits=0 real=0 received=0 clone=0 fixture=0 errors=0 omitted_dirs=835
HITS_BY_PATTERN *reviewed*delivery*=3; B-install-receipt*.json=53; install-b.mjs=201; verify-b.ps1=198
HIT_KIND_TOTALS real=0 received=3 clone=1 fixture=451
SEARCH_SUMMARY dirs=86198 hits=455 real=0 received=3 clone=1 fixture=451 errors=12 omitted_dirs=26148
```

- `received` = B 实际收到的审核包副本（`_incoming`）；`clone` = A 仓库克隆里的同一文件（`.tmp-repo`）；`fixture` = 本机自测夹具（`%TEMP%\b-*`、`_probe`）。
- **real=0**：除上述三类，本机业务目录里没有审核包或安装脚本的第三份副本。
- 12 条访问错误全部逐条列出（Quark 浏览器 Data 子目录 9 条、`D:\System Volume Information`、`D:\Config.Msi`、`D:\$RECYCLE.BIN\S-1-5-18`），不抽样截断。
- 26148 个目录因 reparse 或超过深度未搜索，逐条打印 `UNSEARCHED_REPARSE` / `UNSEARCHED_DEPTH`。因此本结论只覆盖已搜索范围，不宣称全盘不存在。
- 原始输出：`evidence/deploy-b/facts-v6-20261105T100049.utf8.txt`。

## 5. 中心地址可达性与鉴权

| 时间 | 探测 | 结果 |
| --- | --- | --- |
| 2026-11-05T09:41+08:00 | `GET /healthz` | curl (56) schannel: server closed abruptly，http=000，6.2s（当时不可达） |
| 2026-11-05T09:53:59+08:00 | `GET /healthz` | http=200，1.756s |
| 2026-11-05T09:53:59+08:00 | `GET /v1/work?claim=probe`（无 Authorization） | http=401，1.628s |

地址取自 A 的交接单：`https://obconic-subtetanic-tamika.ngrok-free.dev`（ngrok 3.35.0 转发到 A 本机 127.0.0.1:3350）。同一地址在 12 分钟内先失败后成功，说明免费档隧道会抖动或重连；**A 每次重启隧道都要重新给 B 地址，B 以 `/healthz` 200 且 `/v1/work` 无键 401 作为接线判据**。原始日志：`evidence/deploy-b/center-probe-20261105T095359.log`。

## 6. 模型通道真实调用

### 6.1 直接原生调用（不经管道，取原生退出码）

| agent | 命令要点 | 原生退出码 | 关键结构化结果 | 日志 |
| --- | --- | ---: | --- | --- |
| claude 2.1.310 | `-p … --output-format json --model deepseek-v4.1-flash-1017` | 0 | subtype=success、is_error=false、session d4785a00-845a-41d0-b96b-ae6f65183c2c | `evidence/deploy-b/model-claude-20261104T232010.log` |
| codex-cli 0.130.0-alpha.5 | `exec --skip-git-repo-check -m deepseek-v4.1-flash-1017` | 0 | 输出 B-CODEX-OK、5330 tokens | `evidence/deploy-b/model-codex-20261104T232117.log` |

### 6.2 用包内 verify-b.ps1 实测：Windows 上直接失败（包缺陷，非 B 环境问题）

原样执行 `_incoming/B-reviewed-delivery/extracted/verify-b.ps1 -Agent codex -Executable <codex.exe> -Model deepseek-v4.1-flash-1017`，原生退出码 **1**，日志 `evidence/deploy-b/verify-b-pkg/verify-codex-20261105T095623.log`。三个独立根因：

1. `verify-b.ps1:24` 用 `$stdout = & $Executable @agentArgs 2> $stderrFile`，而脚本开头 `$ErrorActionPreference='Stop'`。codex 只要向 stderr 写一行（本例是 Reading additional input from stdin...），PowerShell 就抛 NativeCommandError 并终止脚本，stdout 文件根本没生成。
2. codex 在 Windows 上等 stdin；脚本没有把 stdin 关掉（`Start-Process` 的 `-RedirectStandardInput` 也不接受 `NUL` 设备，必须给真实空文件）。
3. codex 0.130 的 Windows 沙箱会用 taskkill 收子进程，这些子进程继承 stdout 句柄，把 GBK 文本写进 JSONL 流里；包内 `agent_result.mjs` 对每行 `JSON.parse`，遇到这种行必然报 Unexpected token。

### 6.3 B 侧等价实现：同一判分程序，通过

`evidence/deploy-b/verify-b-pkg/verify-b-node-filtered.mjs` 用管道 spawn（子进程不继承文件句柄）、stdin 关闭、并只剔除「不以 `{` 开头的行」后交包内 `agent_result.mjs` 判分；剔除行数与原文全部记录：

| agent | 原生退出码 | 剔除噪声行 | 判分 | 会话号 | 日志 |
| --- | ---: | ---: | --- | --- | --- |
| codex | 0 | 3 | passed=true | 01a1a972-5de2-7942-a34a-3d2ca382fff8 | `evidence/deploy-b/verify-b-pkg/filtered-codex-20261105T100326.log` |
| claude | 0 | 0 | passed=true | 7774a215-4c66-4217-bfa2-0115e6a4ab0a | `evidence/deploy-b/verify-b-pkg/filtered-claude-20261105T100643.log` |

证据口径：**模型通道可用**（判定标志是包内 `agent_result.mjs` 返回 passed 且拿到会话号）；**包自带 verify-b.ps1 在 Windows 上不可用**，属包缺陷，需 A 修（建议：改 Node spawn 版判分，或让 `agent_result.mjs` 只接受合法 JSON 行）。6.3 是等价实现，不是把 6.2 的失败改写成通过。

## 7. 六项跨机联调

| 项 | 状态 | 前置条件 |
| --- | --- | --- |
| A 派发 → B 执行 → 回传 | 未验证 | worker 身份文件 + A 侧 command 修正 |
| 临时目录改文件 + 检查 + 回传 | 未验证 | 同上 |
| 同会话第二轮（核对会话号） | 未验证 | 同上 |
| 取消任务后进程退出 | 未验证 | 同上 |
| 断线重连 / 执行端重启后的状态与不重复执行 | 未验证 | 同上 |
| 登录启动入口（注销前需用户确认） | 未验证 | 需用户确认注销 |

## 8. 安装守卫 v4 与 22 例隔离自测

`evidence/deploy-b/install-b-when-ready.ps1`（SHA256 `47d48e926ed8fe4ed3211ed238f907fd8d26dd3f2c88b02719f111b3d07f9f24`，UTF-8 BOM）13 步顺序：

1 node≥24 → 2 已有 config 阻断 → 3 包哈希（**硬常量** `$EXPECTED_PACKAGE_SHA256`，形参里没有覆盖口）→ 4 worker 名与身份文件非空（只记 `worker_key_file_sha256`）→ 5 中心地址（拒回环/通配/localhost/映射回环/带凭据）→ 6 解包 + delivery 六项 + manifest 包哈希 → 7 **verify 预检（在安装器之前）** → 8 安装前现场（3350 TCP+UDP、hub 候选）→ 9 安装器（原生退出码）→ 10 **安装后重新查现场** → 11 verify 传真参数 → 12 回执契约逐字段 → 13 写成功状态。

任何停止路径统一打印 `STOP: <原因>`、`installer_started=true|false`、`success_state_written=false`、`no_files_deleted=true` 并 exit 2。

自测：**22 例，通过 22，失败 0**（`evidence/deploy-b/guard-selftest-v4.json`，逐例日志 `evidence/deploy-b/selftest-logs-v4/case-*.log|.err|.argv.txt`，驱动 `evidence/deploy-b/selftest/run-guard-tests.ps1`（历史 22 例驱动；v5 扩到 24 例见 §20.3；v6 扩到 26 例见 §21），夹具包 SHA256 `12501105805449531747e6f7cf399933bf06e36d8647cbedb86a8e87f569ac71`）：

| 用例 | 期望 | 实际 |
| --- | --- | --- |
| happy | exit 0 + 写状态 + SIMULATION PASS | 符合 |
| happy-base-path | exit 0 + 写状态 | 符合 |
| verify-missing | exit 2、安装器未启动 | 符合（STOP：包内缺 verify-b.ps1：安装器未启动，现场未改动） |
| verify-fail | exit 2、安装器已启动 | 符合 |
| package-hash-mismatch | exit 2、安装器未启动 | 符合 |
| receipt-empty | exit 2、列出全部坏字段 | 符合（machine,worker,package_sha256,status,model_verified,cross_network_task_verified,pid,app） |
| receipt-wrong-status | exit 2、只报 status | 符合 |
| pre-install-hub | exit 2、安装器未启动 | 符合 |
| post-install-hub | exit 2、安装器已启动、不打印 DONE | 符合 |
| installer-fail | exit 2 | 符合 |
| center-localhost / -dot / ipv4-loopback / ipv6-loopback / 127-8 / wildcard / ipv4-mapped / userinfo / not-absolute | exit 2 | 9 例全部符合 |
| existing-config | exit 2、保留现场 | 符合 |
| probe-without-selftest | exit 2（真实模式禁模拟探针） | 符合 |
| bad-isolation | exit 2（隔离边界不满足） | 符合 |

## 9. 回执契约

只接受 {machine:'B', worker:'b-magicbook14', package_sha256, status:'worker-started-only', model_verified:false, cross_network_task_verified:false, pid>0, app}；空对象、缺字段、把 status 写成 complete-and-verified 均 exit 2 并打印 receipt_fields_bad=。这条是对上轮 P1「空回执也产生成功状态」的直接修复，对应 22 例中的两例。

## 10. 安装未执行的原因与就绪命令

唯一硬阻塞：--worker-key-file 指向的 B 专属身份文件在 B 上不存在。A 侧该文件位于 C:\Users\chs\agent-autoloop-handoff\b-magicbook14.worker.key（文件 SHA256 a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f），必须走私密通道送到 B，不进聊天、日志、报告或 Git。

送达后 B 侧执行（真实值，仅 key 路径为待填占位）：

```
node .\install-b.mjs --center-url "https://obconic-subtetanic-tamika.ngrok-free.dev" --worker-key-file "<B 本机 key 文件绝对路径>" --worker-name "b-magicbook14" --root "D:\AutoAgentloop"
```

守卫包装版（推荐，先跑 13 步检查再调安装器）：

```
powershell -NoProfile -ExecutionPolicy Bypass -File D:\AutoAgentloop\evidence\deploy-b\install-b-when-ready.ps1 -Package D:\AutoAgentloop\_incoming\B-reviewed-delivery\B-reviewed-delivery.zip -CenterUrl "https://obconic-subtetanic-tamika.ngrok-free.dev" -WorkerKeyFile "<B 本机 key 文件绝对路径>" -WorkerName b-magicbook14 -Root D:\AutoAgentloop
```

## 11. 材料哈希

递归全量清单是生成物 evidence/deploy-b/MATERIALS.sha256，严格 sha256sum 格式（哈希 + 两空格 + 相对路径，故可直接 -c 校验；字节数另存在生成脚本输出表里，不掺进清单行，避免 -c 把字节当文件名）。覆盖 evidence/deploy-b、evidence/deployment、outbox/to-A-deploy 下全部文件，不列自身以免自引用。核对方式：

```
cd D:\AutoAgentloop && sha256sum -c evidence/deploy-b/MATERIALS.sha256 | tail -3
```

关键文件（与清单一致）：

| 文件 | SHA256 |
| --- | --- |
| evidence/deploy-b/install-b-when-ready.ps1 | 47d48e926ed8fe4ed3211ed238f907fd8d26dd3f2c88b02719f111b3d07f9f24 |
| evidence/deploy-b/collect-b-deploy.ps1 | 2e2e366a48e1385af049f217025bb6a7ebad7be60a908bd8e838d6df0ddd6404 |
| evidence/deploy-b/verify-b-pkg/verify-b-node-filtered.mjs | 见 MATERIALS.sha256 |
| evidence/deploy-b/B-install-state.json、guard-selftest-v4.json、facts-v6-*.utf8.txt | 见 MATERIALS.sha256 |

上一轮的 FAIL 7 是「32 个递归文件只列 20 项、状态 JSON 自哈希错」。本轮修复：清单改为生成物、全量覆盖、一条命令可复算；B-install-state.json 不再包含自身哈希（自哈希自指必然失效），其哈希只出现在 MATERIALS.sha256 与本表引用中。

## 12. 边界

| 边界 | 状态 |
| --- | --- |
| 建第二个中心 | 未建 |
| 复用 A 管理员身份 | 未复用 |
| 复制 A 登录文件 | 未复制 |
| 修改 A 控制账本 | 未修改 |
| 开放公网端口 | 未开放 |
| 新建分支/worktree（业务工程） | 未新建 |
| 密钥进入聊天/日志/报告/Git | 未进入 |
| 修改真实业务项目 | 未修改 |
| 触碰真实 HOME 安装目录 | 未触碰（始终不存在） |

## 13. Review 与简化

每处修改都先查 Bug 再检查是否更简单：守卫从 v2 的「先装后验」改为 v4 的「先验后装 + 装后复查」，把三处独立阻断（verify 缺失、3350 监听、hub 候选）合并成统一的 Stop-Here；采集器把抽样错误改成全量输出，同时把命中分类做成 kind 汇总，比逐项手写清单更不容易错；verify 等价实现用约 60 行 Node 代替 PowerShell 重定向，避开句柄继承这一类 Windows 特有问题。

## 14. 上轮审核 5 FAIL + 3 P1 逐条对照

| 编号 | 上轮意见 | 本轮处理 | 证据 |
| --- | --- | --- | --- |
| FAIL 1 | 缺 verify 但安装器已执行 | 步骤 7 把 verify 预检提到安装前；verify-missing 用例 exit 2 且 installer_started=false | guard-selftest-v4.json |
| FAIL 2 | 安装后没重查 hub | 步骤 10 新增安装后现场复查；post-install-hub 用例 exit 2、无 DONE | 同上 |
| FAIL 3 | localhost. 被放行 | Normalize-Host 循环去尾点 + 小写；center-localhost-dot 用例 exit 2 | 同上 |
| FAIL 4 | 采集器只留 5 条错误、未区分夹具 | 12 条错误全列；新增 FIXTURE/RECEIVED/CLONE/HIT 分类与 HITS_BY_PATTERN、HIT_KIND_TOTALS | §4 与 facts-v6-20261105T100049.utf8.txt |
| FAIL 7 | 递归清单 32 文件只列 20 项、状态 JSON 自哈希错 | 改为生成物 MATERIALS.sha256 全量可复算；状态 JSON 不自带哈希 | §11 |
| P1-a | 生产参数可覆盖固定包哈希 | 哈希写死为脚本内常量，删除 -ExpectedSha256 形参 | install-b-when-ready.ps1 |
| P1-b | 空回执仍写成功状态 | 回执 8 字段契约 + 两例负例 | §9 |
| P1-c | 调 verify 未传必需参数 | 步骤 11 传真 Agent/Executable/Model/OutputDirectory | §8 步骤 11 |

## 15. 未验证计数

- 输入类 3 项：①worker 身份文件未到 B（阻塞安装）；②A 侧 `command[0]` 仍是裸 codex，需改为 B 的绝对路径（B 的 PATH 无 codex，首任务会 spawn ENOENT；版本以 B 实测 0.130.0-alpha.5 为准，不把 A 本机 0.166 当作 B 的要求）；③A 侧登记确认：worker 名 / 模型 / cwd 与 B 实测一致，仅 command 参数待改。
- 跨机联调 6 项（§7 全表）。
- 合计 9 项未验证，与 A 交接单口径一致；环境检查 10 项、守卫自测 v6 的 26 例、模型探测单列，不混算。
- 已确认完成：审核包接收与哈希（1 项）、中心可达性与鉴权（1 项）、模型通道（2 个 agent，含等价判分实现）。

## 16. 复盘

1. Windows 上重定向文件句柄是陷阱：调用符 + 2> 在 ErrorActionPreference=Stop 下会把子进程 stderr 变成脚本级异常；Start-Process -RedirectStandardInput 不收 NUL 设备，必须给真实空文件；子进程继承句柄会把噪声写进 JSONL。三者叠加才让包内 verify 在 B 上必然失败。
2. PowerShell 5.1 按 ANSI/GBK 读 .ps1：含中文的脚本必须 UTF-8 with BOM，编辑工具会丢 BOM，改完要补回再做 AST 语法自检。
3. @(0) 在 PowerShell 里 Count 是 1：探针返回 0 监听时若用 @(...) 判断，会把 0 当成有，导致所有通过用例被误判为失败。
4. 采集器不适合依赖 Get-ChildItem -ErrorVariable 收集错误（异常时提前中断遍历），自写栈式遍历 + 每目录 try/catch 才能做到错误全列 + 深度可控。
5. 判定通过只认结构化终态：原生退出码 + 包内判分程序的 passed 与会话号；提示词命中、进程启动、权限驳回、跳过都不算。

## 17. Codex 复验指引（A 侧可照抄）

```
# 0. 取 B 分支
git clone -b b https://github.com/Jakiewbe/autolAgentloop.git && cd autolAgentloop

# 1. 在 B 上逐字节核对材料
cd D:\AutoAgentloop && sha256sum -c evidence/deploy-b/MATERIALS.sha256 | tail -3

# 2. 复跑守卫 26 例（隔离，不触真实 HOME；约 3 分钟）
cd D:\AutoAgentloop && powershell -NoProfile -ExecutionPolicy Bypass -File evidence/deploy-b/selftest/run-guard-tests.ps1

# 3. 复跑模型等价判分（codex 一次，可换 claude）
cd D:\AutoAgentloop\evidence\deploy-b\verify-b-pkg
node verify-b-node-filtered.mjs --agent codex --executable "C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe" --model deepseek-v4.1-flash-1017 --output-dir repro-codex

# 4. 复跑中心可达性
curl -sS -o /dev/null -w "http=%{http_code}\n" https://obconic-subtetanic-tamika.ngrok-free.dev/healthz

# 5. 若 A 已送达 key 文件：先跑守卫包装（13 步检查，再调安装器）
powershell -NoProfile -ExecutionPolicy Bypass -File D:\AutoAgentloop\evidence\deploy-b\install-b-when-ready.ps1 -Package D:\AutoAgentloop\_incoming\B-reviewed-delivery\B-reviewed-delivery.zip -CenterUrl "https://obconic-subtetanic-tamika.ngrok-free.dev" -WorkerKeyFile "<key 路径>" -WorkerName b-magicbook14 -Root D:\AutoAgentloop
```

复验限制（须写进 A 的结论，不要当成通过）：B 侧不存在 key 文件时第 5 步必然 exit 2；ngrok 地址会漂移，第 4 步失败先看 A 是否换了隧道；第 2、3 步只验证守卫与模型通道，不代表双机联调。

## 18. 独立复核与联调门禁序列（2026-11-05T10:21+08:00 起）

### 18.1 复核方式

不复用本地工作副本自证：从 GitHub 重新克隆到 `D:\AutoAgentloop\_verify\clone-<stamp>`，`git checkout -B recheck origin/b` 后按证据自身声明逐项核对。脚本 `evidence/deploy-b/tools/recheck-b.sh`，原始输出 `evidence/deploy-b/recheck-<stamp>.log`。

| 核对项 | 结果（目标提交 `2eaedc4282f824f5e9b13411763b0ba36446173e`，全量输出见 `evidence/deploy-b/recheck-20261105T115122.log`） |
| --- | --- |
| CLONE_HEAD | 2eaedc4282f824f5e9b13411763b0ba36446173e（= 复核时的 `origin/b`） |
| 上一提交 | 8e17be8ab163965ba7eae95b465e9deb3599e63e（只含审核 prompt 与清单的文档提交） |
| MAIN_HEAD | d07b41267632e446d2f082f08ddc79b89b363e2a（A 侧，未被 B 改动） |
| 差异文件数 / 落在 B/ 之外 | 134 / 0 |
| 差异类型集合 | 仅 A（没有 M/D/R） |
| main 历史里的 B 提交数 | 0 |
| 仓库清单 | 清单 133 行、`B/` 文件 134 个（差 1 = 清单自身）；`sha256sum -c` 133 OK / 0 BAD，逐条原文已落日志 |
| B.md 复算哈希 | `af2b6d3debe6f1acfcce781f9df96815221f3c3b91c6be0e9f49cacf6a2c4d0e`，与清单同项逐字节一致 |
| 状态机复算哈希 | `e9f178095052406a64996f8a2a06850cb8d5a18a8f2fd43e9450136e7867ee0b`，与清单同项逐字节一致 |
| 清单自指 | 0（清单不含自身；状态 JSON 无 `self_sha256` 字段） |
| 密钥扫描命中 | 0（`oc_s` / `sk-` / Bearer 模式均无命中） |
| key/config 类文件入库数 | 0 |

**哈希口径说明（回应第四轮审核 V1 第 3 点）**：本节曾写 `B.md` 哈希 `be59d284…`，那是复核当时（目标提交 `d536485`）的值；此后追加 §18 使文件变长，最终值为 `af2b6d3d…`，清单与状态机记录的都是最终值。现改为「按目标提交记录 + 复算值」两列并存的写法，避免同一文件出现两个看似矛盾的哈希。

**off-by-one 说明（回应 V1 第 1 点）**：复核日志无法包含自己的哈希，因此每条日志记录的是「它被提交之前的那一刻」的 `origin/b`。要消除歧义，脚本已改为接受目标提交参数（`recheck-b.sh <commit>`），日志首行固定打印 `TARGET=` 与 `CLONE_HEAD=`，审核方可以对任意提交自行重跑；本轮日志的目标提交就是 `2eaedc4`，即当前 `origin/b`。
### 18.2 Codex 与模型实测（同一时间窗复测）

| 项 | 值 |
| --- | --- |
| Codex 主用路径 | C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe |
| Codex 版本（主用） | codex-cli 0.130.0-alpha.5 |
| Codex 第二处 | C:\Users\19082\.codex\.sandbox-bin\codex.exe = codex-cli 0.164.0-alpha.11.1（非 PATH，非默认入口） |
| Claude Code | C:\Users\19082\.local\bin\claude.exe = 2.1.310 |
| codex 复测 | 原生退出码 0，剔除 3 行 taskkill 噪声后包内判分 passed，session 01a1a983-a9a1-7d63-9565-48202882db70 |
| claude 复测（第 1 次） | 原生退出码 1，原因是我方等价脚本没传 `--settings`，stderr 原文 Settings file not found: …\undefined；属 B 侧脚本缺陷，与模型无关 |
| claude 复测（第 2 次，补 `--settings`） | 原生退出码 0，判分 passed，dropped_lines=0，session e1bd4c0c-d25b-4d0e-abeb-9e2f9dadb5eb |

两次 claude 都记在案：第一次失败不是抹掉，而是作为「等价实现仍需传参」的证据保留。

### 18.3 身份文件接收协议与当前状态

- 落点固定：`D:\AutoAgentloop\_incoming\secrets\b-magicbook14.worker.key`；该目录与协议说明 `_incoming/secrets/README.md` 已就位。
- 回传只给元数据：`evidence/deploy-b/report-key-file.ps1` 输出 `KEY_PATH` / `KEY_BYTES` / `KEY_SHA256` / `KEY_MTIME_UTC` / `KEY_ACL_OWNER` / `KEY_JSON_LIKE` / `KEY_LINE_COUNT`，末行固定 `KEY_CONTENT_PRINTED=no`；文件缺失时 `KEY_FILE=missing` 且 exit 2。
- 自测：对临时假文件（50 字节、内容 DUMMY-NOT-REAL）输出 PASS；对目标路径当前返回 `KEY_FILE=missing` + exit 2。
- 当前状态：**文件仍未到达**（2026-11-05T10:21 复查 `_incoming`、Downloads、Desktop、Documents、`D:\AutoAgentloop` 均无 `*magicbook*` 或 `*.worker.key`）。核对口径是 B 回传的 `KEY_SHA256` 等于 A 记录的 a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f。

### 18.4 门禁序列（顺序不可颠倒）

1. 身份文件到达且 SHA256 与 A 记录一致；
2. B 修复版通过独立复核（本报告 §18.1 的复核输出 + Codex 独立结论）；
3. 真实安装执行完成并留下合规回执（`B-install-receipt.json` 8 字段契约）；
4. 取得 A 的联调许可；
5. 六项联调按此顺序在同一执行端上依次进行：派发→执行→回传 → 临时目录改文件 + 检查 + 回传 → 同会话第二轮（核对会话号） → **取消任务后进程退出** → **断线重连 + 执行端重启后的状态与不重复执行** → 登录启动入口（需用户确认）。

第 5 步里「取消」与「断线重启」两项不并行：取消验证的是任务终止语义，断线重启验证的是状态恢复与幂等，两项同时做就分不清原因是终止逻辑还是恢复逻辑。

## 19. 第四轮审核的回应（B 侧执行记录，2026-11-05T11:52+08:00）

审核由本机 Codex（`C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe`，codex-cli 0.130.0-alpha.5，只读沙箱、`approval_policy=never`、`model_reasoning_effort=low`）在干净克隆 `_verify/clone-20261105T103251` 上执行，输入就是 `B/reviews/2026-11-05-t11-round4.md` 原文。原始 JSONL、剔除行样本与最终答复留在 `evidence/deploy-b/audit-20261105T120500/`。

### 19.1 逐条结论与本轮处置

| 项 | 审核结论 | 事实核对 | B 的处置 |
| --- | --- | --- | --- |
| V1 重克隆是否自证 | FAIL | 成立：当时日志目标提交是 `d536485`，而不是证据提交 `a9c98a4`；且 §18.1 出现 `be59d284` 与清单 `af2b6d3d` 两个哈希 | 已把脚本改成可指定目标提交并落全量输出；重跑目标 `2eaedc4`，日志 `recheck-20261105T115122.log`（133/133 OK、0 BAD、逐条原文）；§18.1 改为按目标提交记录 + 复算值两列，并写清哈希变化与 off-by-one 口径 |
| V2 分支形态与作者 | PASS | 一致 | 无改动 |
| V3 清单可复算 | 证据不足 | 成立：审核方只读环境拦了 `sha256sum`/`Get-FileHash`，只能看结构 | 复核日志改为**逐条输出**全部 `sha256sum -c` 结果（不再抽样、不再只给计数），审核方可在自己环境重跑同一条命令 |
| V4 模型实测与失败留档 | FAIL | 成立：`recheck-claude-20261105T102219.log` 与其目录当时确实没入库 | 已补入该日志与 `model.stderr.log`（`7ebd2f5e…`），提交 `2eaedc4`；清单与状态机引用指向实际存在的文件 |
| V5 密钥只回传元数据 | PASS | 一致 | 无改动 |
| V6 门禁序列 | PASS | 一致 | 无改动 |
| V7 未把未验证写成通过 | PASS | 一致（`verified=true` 计数 0，仍为阻断态） | 无改动 |
| V8 版本口径 | PASS | 一致 | 无改动 |

### 19.2 审核提出的三个结尾问题，B 的答复

1. 「重克隆自证能否替代 A 侧手动抽查」：不足以替代。仓库只能证明内容可复现，证明不了 B 物理机的执行现场；A 仍需抽查关键文件、失败日志与 B 的实际命令输出。B 已经把可抽查的落点固定在 `evidence/deploy-b/recheck-*.log` 与 `verify-b-pkg/*`。
2. 「门禁序列是否足以保证取消与断线重启互不干扰」：设计上够，执行上尚未验证，这一点与审核一致；两次测试的实际日志只能等联调阶段产生，现阶段不写成通过。
3. 「key 送到后能否立刻真实安装」：同意审核的结论——技术上只缺 key，但门禁第 2 步要求「独立复核通过」，本轮 V1/V4 未过；修复后重跑通过才闭合。另需在安装前现场复核 ngrok 地址、`/healthz`、无键 `/v1/work` 401 与包哈希。

### 19.3 本轮修复后的门禁状态

- V4 缺失留档：已补齐并入库。
- V1 目标提交与哈希口径：已改为提交可指定 + 全量输出 + 两列哈希。
- V3 全量校验：已在日志中逐条输出 133 行结果。
- 剩余依赖未变：A 送 key、A 确认当下有效的中心地址、A 侧改 `command[0]` 与 codex 版本口径；六项联调仍为 0/6。

## 20. 第五轮修复（审核目标 a1c6095，2026-11-05T12:06+08:00 起）

本轮不执行真实安装、join/init/up/try/service install，不做跨机派发，不注销登录；只修三个缺口、验证正式验证入口、交付固定版本。

### 20.1 身份协议纠正（缺口 1）

| 位置 | 改动前 | 改动后 |
| --- | --- | --- |
| `evidence/deploy-b/key-receipt-protocol.md` 第 6 条 | 「`KEY_JSON_LIKE=False` 或 `KEY_BYTES` 明显不符就停下并请 A 重新签发」——把 JSON 形态当停止条件 | 交付契约写死为**原始文本、43 字节、单行、非 JSON**；`KEY_JSON_LIKE` 降级为**描述性元数据，不参与判定**；判定只看完整 SHA256 与字节数；不把 key 包成 JSON，也不因形态要求 A 重新签发 |
| `evidence/deploy-b/report-key-file.ps1` | 只输出 `KEY_JSON_LIKE`，缺契约比对 | 新增 `KEY_EXPECTED_SHA256`/`KEY_EXPECTED_BYTES`/`KEY_SHA_MATCH`/`KEY_BYTES_MATCH`/`KEY_JSON_LIKE_IS_METADATA_ONLY=yes`/`KEY_VERDICT`；退出码 0=符合、2=未到、3=不符；仍只输出元数据，`KEY_CONTENT_PRINTED=no` |
| `evidence/deploy-b/install-b-when-ready.ps1` 第 4 步 | 只记哈希与字节 | 记哈希、字节、首字节是否 `{`（标注为描述性）；传 `-ExpectedKeySha256` 时按 sha+43 字节判定，未传则 `worker_key_contract=recorded-only`，由 `report-key-file.ps1` 在门禁第 1 步核对 |
| `_incoming/secrets/README.md` 第 6 条（本机协议副本） | 同上一处错误口径 | 与协议一致：只有哈希或字节数不符才停 |

夹具自测（`evidence/deploy-b/tools/key-fixture-test.ps1`，输出 `evidence/deploy-b/key-fixture-20261105T121400.log`，夹具目录 `%TEMP%\b-key-fixture`，内容为示例串，不是任何真实密钥）：

| 用例 | 输入 | 退出码 | JSON_LIKE | SHA_MATCH | BYTES_MATCH | 内容外泄 |
| --- | --- | --- | --- | --- | --- | --- |
| raw43-match | 43 字节原始文本、哈希自洽 | 0 | false | yes | yes | no |
| json43-match | 43 字节、以 `{` 开头、哈希自洽 | 0 | true | yes | yes | no |
| raw43-hash-mismatch | 43 字节、按 A 的预期哈希核对 | 3 | false | no | yes | no |
| missing | 路径不存在 | 2 | — | — | — | no |

结论：`KEY_JSON_LIKE=False` 不再影响放行；哈希不符仍然停止；4/4 通过，`CONTENT_LEAKS=0`。真实文件仍未收到，夹具**不作为送达证明**。

### 20.2 正式验证入口（缺口 2）

固定补充交付已从 A 的 `main` 取得并单独入账（原审核包与其 SHA256 未改动）：

```
source : https://github.com/Jakiewbe/autolAgentloop  origin/main  d07b41267632e446d2f082f08ddc79b89b363e2a
path   : deploy/B-reviewed/verify-b-fixed.ps1  (blob c12f9ba7deb165e0634791bbd29de41d8e573c34)
bytes  : 2563        sha256: 36c964e32c039c158d422c4d4ad648a25442226182945f7fadd1b05b653a7e31
dep    : agent_result.mjs 2441  sha256 0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f (= 包内同一份)
```

落点 `_incoming/B-reviewed-delivery/supplement/`（另在 `evidence/deploy-b/supplement/` 留一份入库副本），provenance 记在 `SUPPLEMENT.json`、哈希记在 `SUPPLEMENT.sha256`。

守卫接线（v5）：第 7 步按**硬常量** `36c964e3…` 校验该入口，要求参数含 Agent/Executable/Model/OutputDirectory 且含 SettingsFile，要求同目录 `agent_result.mjs` 存在并通过 `node --check`；入口缺失或哈希不符一律在**安装器启动前**停止，**不回退**到包内 `verify-b.ps1`。第 11 步只执行该入口，传真实参数（`-Agent codex -Executable <Codex 绝对路径> -Model deepseek-v4.1-flash-1017 -OutputDirectory <独立目录>`）。

独立实测（安装之前，用正式入口本身、真实参数）：

| 代理 | 绝对路径 | 版本原始输出 | 模型 | 原生退出码 | 关键 stderr | 判分 | 日志目录 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| codex | `C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe` | codex-cli 0.130.0-alpha.5 | deepseek-v4.1-flash-1017 | **1** | `codex.exe : Reading additional input from stdin...` + `NativeCommandError`（`verify-b-fixed.ps1:31` `$stdout = & $Executable @agentArgs 2> $stderrFile`） | 未运行（`model.stdout.jsonl` 未生成） | `evidence/deploy-b/verify-b-fixed/codex-20261105T121700/` |
| claude | `C:\Users\19082\.local\bin\claude.exe` | 2.1.310 (Claude Code) | deepseek-v4.1-flash-1017 | **1** | `claude.exe : [claude-code:unrecognized_model] …` + `NativeCommandError`（同一行） | 未运行 | `evidence/deploy-b/verify-b-fixed/claude-20261105T121800/` |

结论：补充交付只修掉了 `$PSScriptRoot` 在 param 默认值里为空的问题（本机可复现），**没有**修掉 `$ErrorActionPreference=Stop` 下 `2>` 把子进程 stderr 变成本脚本级异常这一条；两条路径都在写入 `model.stdout.jsonl` 之前终止，判分器根本没跑。按本轮约定**停在此处**：不用 Node 等价实现冒充正式入口成功，不换模型、不升级 codex、不拿 Claude 顶替 Codex 路径。脱敏原件（`script.stdout.log`、`script.stderr.log` 及 UTF-8 副本）已随本提交入库。

给 A 的最小修复方向（只作建议，B 未以此替代审核入口）：把 `& $Executable @agentArgs 2> $stderrFile` 换成 `Start-Process -Wait -PassThru -RedirectStandardOutput <file> -RedirectStandardError <file> -RedirectStandardInput <空文件>`（不继承句柄，避免 codex 沙箱 taskkill 噪声混入 JSONL），或把该调用的 `$ErrorActionPreference` 局部置 `Continue` 并在调用后自己取 `$LASTEXITCODE`。

### 20.3 自测交付补齐（缺口 3）

- 驱动入库：`evidence/deploy-b/selftest/run-guard-tests.ps1`（24 例，脚本内自带隔离根 `%TEMP%\b-round5-<case>`、临时 HOME、`SIMULATION-ONLY` 标记、`probe.json` 系统探针）。
- 夹具入库：`evidence/deploy-b/selftest/fixture/B-reviewed-delivery.zip`（3193 字节，sha256 `12501105805449531747e6f7cf399933bf06e36d8647cbedb86a8e87f569ac71`），桩安装器/桩 verify/桩判分器，`fixture/SHA256SUMS` 记录。
- 逐例原始日志入库：`evidence/deploy-b/selftest/logs/case-*.log|.err|.argv.txt`；汇总 `evidence/deploy-b/selftest/guard-selftest-v6.json（26 例，见 §21）`。
- 结果：**24 例，通过 24，失败 0**（`cases_total=24, cases_ok=24, cases_bad=0`）。新增用例：`verify-entry-missing`（未就位→安装器未启动）、`verify-entry-hash-bad`（哈希不符→安装前停止）、`entry-no-settingsfile`（缺 SettingsFile 参数→安装前停止）。
- 本轮修的三处驱动缺陷（都在自测过程中暴露，非事后补记）：①`$PSScriptRoot` 在 param 默认值里为空（与 A 遇到的同一台机器同一问题）；②守卫隔离前缀写死 `b-round3-` 导致新根全被判「隔离模拟边界不满足」；③驱动按 `B-install-state*.json` 找状态文件，而守卫实际写 `install-b-state-<stamp>.json`。
- 其他引用已纠正：`evidence/deploy-b/tools/{recheck-b.sh,gen-materials.mjs,audit-round4.mjs,key-fixture-test.ps1}` 为实际使用的驱动副本，报告中的复跑命令指向这些入库路径。

### 20.4 剩余输入分开记录（不再统一写「A 三项都未提供」）

| 项 | 状态 | 依据 |
| --- | --- | --- |
| 身份文件是否收到 | **未收到** | `_incoming/secrets/` 只有协议与 README；`*magicbook*`/`*.worker.key` 在 `_incoming`、Downloads、Desktop、Documents、`D:\AutoAgentloop` 无命中 |
| 身份文件核对值 | 已由 A 发布：43 字节、sha256 `a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f` | A 交接单；B 侧 `report-key-file.ps1` 已能按此核对 |
| 中心是否 B 可达 | 历史上可达（2026-11-05T09:53:59 `/healthz` 200、无键 `/v1/work` 401，日志 `center-probe-20261105T095359.log`）；09:41 曾 `curl(56)` | A 交接单地址 `https://obconic-subtetanic-tamika.ngrok-free.dev`（免费档域名会变，安装前需 A 确认当下地址） |
| A 登记与 B 实际是否一致 | worker 名一致、模型一致、cwd 一致；**`command[0]` 不一致** | A 登记裸 `codex`，B 的 PATH 无 codex；B 提供的已实测绝对路径 `C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe`（0.130.0-alpha.5） |

- 已删除「升级 A 本机 Codex 可以解决 B 问题」这类替代条件：版本选择以 B 实测为准（0.130.0-alpha.5 在 B 上能完成模型调用），不把 A 本机 0.166 的成功当作 B 的要求。

### 20.5 计数与状态

| 项 | 值 |
| --- | --- |
| 守卫自测 | 24 例通过 / 0 失败 |
| 身份协议夹具 | 4 例通过 / 0 失败 |
| 正式验证入口实测 | 2 次（codex、claude）均原生 exit 1，判分未运行 → 判定失败并停止 |
| 真实安装 | **未执行**（`join`/`init`/`up`/`try`/`service install` 均未跑） |
| 六项跨机联调 | **0/6**（未获 A 联调许可，且安装未完成） |

### 20.6 边界（本轮未越线）

- 未建第二中心、未复用 A 管理员身份、未复制 A 登录文件、未改 A 账本、未开公网端口、未推送 A 的 main。
- 未向任何日志/报告/Git 写入 key 内容；只记路径、字节、哈希一类元数据。
- 未升级 codex、未换模型、未用 Claude 冒充 Codex 路径通过。

## 21. 第六轮审核（目标 aff6473）的回应：3 PASS / 3 FAIL，2026-11-05T12:37+08:00 起

审核对象固定为 `aff6473c5b80a1b6f7efd2096e9776faf44df113`。结论：Z1 PASS、Z2 FAIL、Z3 PASS、Z4 FAIL、Z5 PASS、Z6 FAIL。三项 FAIL 本轮全部修复，每项都与新增用例绑定。

### 21.1 Z2：判分器完整性改为按哈希 + 字节钉死

- 守卫升 v6，新增硬常量 `$EXPECTED_JUDGE_SHA256` = `0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f`、`$EXPECTED_JUDGE_BYTES` = `2441`，位置 `evidence/deploy-b/install-b-when-ready.ps1:35-36`。
- 第 7 步在**安装器启动前**读取实际将被执行的 `agent_result.mjs`，比对 sha256 与字节数；不一致即停，日志原文：`STOP: 判分器 agent_result.mjs 与固定哈希/字节不一致（可能被替换）：安装器未启动`（`install-b-when-ready.ps1:246-255`）。
- 审核用的反例（入口字节不变、只替换判分器 → `NATIVE_EXIT=0` 并接受假输出）现在被拦在安装前：新增 `judge-hash-bad`（判分器改成语法有效但内容不同）与 `judge-missing` 两例，均 `exit 2`、`installer_started=false`、无状态文件。
- 守卫自身 sha256 变为 `bafab6b138d442ea6fcbbb7a7784e5b6b2d7236f98f3422c136c06ee2fedf180`。

### 21.2 Z4：指引与驱动都回到快照内

- `evidence/deploy-b/key-receipt-protocol.md:39` 的自测命令改指 `D:\AutoAgentloop\evidence\deploy-b\tools\key-fixture-test.ps1`，不再指向未入库的 `_probe` 路径。
- `evidence/deploy-b/tools/key-fixture-test.ps1:1-12` 去掉写死的本机 reporter 默认值，改为按驱动自身位置解析 `../report-key-file.ps1`；解析不到就 `REPORTER_MISSING` 并 `exit 2`，运行时先打印 `REPORTER=` 实际路径。
- 不带任何参数实跑（本轮）：`REPORTER=D:\AutoAgentloop\evidence\deploy-b\report-key-file.ps1`，`CASES=4 CONTENT_LEAKS=0`，`RESULT=PASS FAILURES=0`。

### 21.3 Z6：删除仍在生效的升级替代条件与旧登记口径

- `B-install-state.json` 的 B-IN-2 只保留「A 侧把 command[0] 从裸 codex 改为 B 的绝对路径」，删掉「或 A 侧升级 codex 到 0.166」；原因改为「版本以 B 实测 0.130.0-alpha.5 为准，不把 A 本机 0.166 当作 B 的要求」。
- B-IN-3 与本文件 §15 的旧句「A.md 目前只登记 desktop-lm7rki1」替换为「A 交接单已登记 worker 名 / 模型 / cwd（与 B 实测一致），仅 command 参数待改」，不再同时宣称已一致又只登记旧 worker。

### 21.4 本轮计数（分开记，不与历史合并）

| 项 | 结果 | 目标 / 依据 |
| --- | --- | --- |
| 守卫隔离自测 | 26 例 / 通过 26 / 失败 0 | `selftest/guard-selftest-v6.json`，schema `b-guard-selftest/6` |
| 判分器固定负例 | 2 例（judge-hash-bad、judge-missing）都在安装前停止 | `selftest/logs/case-judge-*.log|.err|.argv.txt` |
| 身份夹具 | 4/4，零内容外泄 | `tools/key-fixture-test.ps1` 无参数实跑 |
| 正式验证入口 | 2 次失败（codex / claude 各 exit 1） | A 侧脚本缺陷，未用等价实现冒充 |
| 真实安装 | 未执行 | 停在安装前 |
| 六项跨机联调 | 0/6 | 等 key 与 A 许可 |

### 21.5 未变的边界

`phase=blocked_before_install`、`installer_success_state=false`、`real_install_executed=false`、`cross_machine_verified=0/6`、key 落点不存在 —— 审核方列出的「正确保留的边界」逐项未变。

## 22. A 侧新验证入口（deploy/verify-entry）在 B 的实测，2026-11-05T12:45+08:00 起

A 在 main 新增 `deploy/verify-entry/`（`verify-entry.ps1` + `verify-model.mjs` + README），明确写「本目录是补充交付，审核包保持原样」。B 按「先核字节、再实测」的顺序处理。

### 22.1 字节口径两处不符（A 侧待修）

- README 表声明：`verify-entry.ps1` 1754 字节 / `a95d0a7d2d338b129fb59e06eedb5c7ae657f375fd7e569723e8167fba572092`；`verify-model.mjs` 9185 字节 / `c313bbaa2fb79348f773050a7c62e84cf3613671046f3a80bd56a74c2dfcd9de`。
- 同一提交里的实际 blob（`git cat-file -p origin/main:<path> | sha256sum`）：`verify-entry.ps1` 2470 字节 / `b997a5241ce4369f123916b684565f5557109e6aaea2a47d103fcd6452348294`；`verify-model.mjs` 10458 字节 / `b320d19d8e1fb968722bf05ffb15cd31548f50f2d7a38908ac73e10f9b46b413`。两边逐项不等。
- 仓库 `.gitattributes` 只对 `*.ps1` 设 `-text`，`.mjs` 未覆盖；B 的系统级 `core.autocrlf=true` 会把工作区的 `verify-model.mjs` 变成 10750 字节，磁盘哈希与对象字节不同。**结论：按字节校验的交付只能从 git 对象取（`git cat-file`），不能用工作区文件。**

### 22.2 实测（B 本机，真实参数，入口与依赖均取对象字节）

| 代理 | 版本 | 原生退出码 | 判分 | 会话 | 结论 |
| --- | --- | --- | --- | --- | --- |
| claude | 2.1.310 | 0 | `passed=true` | `59124b05-653a-4fdb-b4d9-347a26ed90aa` | 通过 |
| codex | 0.130.0-alpha.5 | 0 | `passed=false` | 无 | 失败：stdout 混入 3 行非 JSON |

- 证据：`evidence/deploy-b/verify-entry-A/{codex-run.log,claude-run.log,out-codex/,out-claude/}`。
- codex 的 3 行是 GBK 文本（原文形如「成功: 已终止 PID … 的进程。」），来自 codex 沙箱收尾时 `taskkill` 子进程继承了 stdout 管道句柄。判分因此报 `Unexpected token`，会话编号取不到。
- 对照：同样的 codex 调用在 B 的 Node 等价实现里能通过（剔除 3 行噪声后由**同一** `agent_result.mjs` 判分）。所以问题在 stdout 通道被污染，不在模型不可用。
- A 的新入口已经解决两点：`$PSScriptRoot` 默认值移入脚本体、stdin 用 `ignore` 关掉、stderr 不再触发 `NativeCommandError`。剩下的第三点（子进程句柄继承）在 B 上仍在。

### 22.3 结论与下一步

- 本轮**不把新入口列入守卫的哈希钉**：A 自述哈希与 blob 不符，按 `b997a524…` 记录，等 A 更正表后再定。
- 守卫仍钉历史补充入口 `verify-b-fixed.ps1`（`36c964e3…`），其字节已核对；A 若确认改钉新入口，B 的流程是：拿到 A 更正后的字节与哈希 → 更新第 7 步常量与自测夹具 → 重跑 26 例 → 才进安装。
