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

自测：**22 例，通过 22，失败 0**（`evidence/deploy-b/guard-selftest-v4.json`，逐例日志 `evidence/deploy-b/selftest-logs-v4/case-*.log|.err|.argv.txt`，驱动 `_probe/run-guard-tests4.ps1`，夹具包 SHA256 `12501105805449531747e6f7cf399933bf06e36d8647cbedb86a8e87f569ac71`）：

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

递归全量清单是生成物 evidence/deploy-b/MATERIALS.sha256，严格 sha256sum 格式（哈希 + 两空格 + 相对路径，故可直接 -c 校验；字节数另存在 _probe/materials-table.md 表里，不掺进清单行，避免 -c 把字节当文件名）。覆盖 evidence/deploy-b、evidence/deployment、outbox/to-A-deploy 下全部文件，不列自身以免自引用。核对方式：

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

- 输入类 3 项：worker 身份文件未到 B（阻塞安装）；A 侧 command[0] 仍是裸 codex 且 A 侧 codex 需 0.166（B 的 PATH 无 codex，0.130 在 A 侧会 400 model_not_found）；A 侧登记仅 desktop-lm7rki1，尚无 b-magicbook14。
- 跨机联调 6 项（§7 全表）。
- 合计 9 项未验证，与 A 交接单口径一致；环境检查 10 项、守卫自测 22 例、模型探测单列，不混算。
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

# 2. 复跑守卫 22 例（隔离，不触真实 HOME；约 2 分钟）
cd D:\AutoAgentloop && powershell -NoProfile -ExecutionPolicy Bypass -File _probe/run-guard-tests4.ps1

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

不复用本地工作副本自证：从 GitHub 重新克隆到 `D:\AutoAgentloop\_verify\clone-<stamp>`，`git checkout -B recheck origin/b` 后按证据自身声明逐项核对。脚本 `_probe/recheck-b.sh`，原始输出 `evidence/deploy-b/recheck-<stamp>.log`。

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
