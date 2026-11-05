# 验证入口交付与实测证据（2026-11-05）

交付物：`deploy/verify-entry/verify-entry.ps1` + `deploy/verify-entry/verify-model.mjs`（契约与哈希见 `deploy/verify-entry/README.md`）。
版本：v2（2026-11-05 12:5x 起，针对独立复核 128c1b3 的 4 条问题修订，逐条对照见 §6）。v1 的字节与实测见表 §6.1。
本轮范围：只修验证入口 + 交接材料；未执行安装、join、init、up、try、service install，未改 B 的账本/脚本/分支，未动活动路由，未重发身份密钥。

## 1. 交付字节

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| `deploy/verify-entry/verify-entry.ps1` | 2470 | `b997a5241ce4369f123916b684565f5557109e6aaea2a47d103fcd6452348294` |
| `deploy/verify-entry/verify-model.mjs` | 10458 | `b320d19d8e1fb968722bf05ffb15cd31548f50f2d7a38908ac73e10f9b46b413` |
| `deploy/verify-entry/README.md` | — | 契约文件，不参与字节校验（会随说明更新） |

判分器依赖 `deploy/B-reviewed/agent_result.mjs`：2441 B / `0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f`（原包文件，未改）。审核包 `deploy/B-reviewed-delivery.zip` 未改，sha256 仍 `e0b4fb5b…9853`。

## 2. 原 `verify-b.ps1` 的真实失败（不是文档推测）

命令（12:07，PowerShell 5.1，真实 codex 0.166.0-alpha.5.1）：

```text
powershell -NoProfile -ExecutionPolicy Bypass -File deploy/B-reviewed/verify-b.ps1 -Agent codex ^
  -Executable C:\Users\chs\AppData\Local\OpenAI\Codex\bin\22cfb1d302613eae\codex.exe ^
  -Model deepseek-v4.1-flash-1017 -OutputDirectory evidence/raw/verify-entry/orig-run
```

结果：`codex.exe : Reading additional input from stdin...` → `NativeCommandError`，定位 `verify-b.ps1:24`；`model.stderr.log` **0 字节**、`model.stdout.jsonl` **未生成**；外层 `exit=0`（脚本自己没跑到推出码那步）。

根因链（三条各自独立成立）：

1. `& $Executable @agentArgs 2> $stderrFile` 未重定向 stdin → codex 打印提示并等输入；
2. 同一行在 `$ErrorActionPreference='Stop'` 下把原生 stderr 转成 `NativeCommandError` → 脚本终止；
3. 终止点在第 24 行，`WriteAllText`、判分、退出码三段都没执行，所以「外壳成功、结果为空」。

另两条与 stdin 无关的缺陷：`-OutputDirectory` 默认值在 param 绑定阶段用 `$PSScriptRoot`（PS 5.1 为空）→ 不传就报 `Join-Path : 无法将参数绑定到参数"Path"`（`verify-b.ps1:6`）；`$stdout -join "`n"` 重新按 UTF-8 写盘，编码、行尾、末尾换行都被改写。

## 3. 新入口实测矩阵（Windows PowerShell 5.1，全部真实执行）

目录：`evidence/raw/verify-entry/tests/NN/`，每项含 `console.log`（控制台一行 JSON）、`result.txt`（场景/期望/实际/判定）与 `verification-output/`（跑出结果的用例才有 `model.stdout.jsonl`、`model.stderr.log`、`verify-result.json`；01/02 在调用前就退出，因此没有产物，这正是要证明的事；16 的 `model.stdout.jsonl` 本身就是那个故意造成的目录）。所有用例一律用显式 `-OutputDirectory` 指到证据树，仓库目录内不留产物。

| # | 场景 | 输入要点 | 期望 | 实际退出码 | 关键输出 |
| --- | --- | --- | --- | --- | --- |
| 01 | 缺必填参数 | 不给 `-Model` | 退出 **2**，不调用 | 2 | 入口自己校验：`{"passed":false,"stage":"input","invoked":false,"error":"missing required parameter -Model"}`（不再由 PS 绑定报错，那条是 exit 1，语义与「判分失败」撞车） |
| 02 | 可执行路径不存在 | `stubs/nope.exe` | 明确失败，不调用 | 2 | `executable does not exist or is not a file` |
| 03 | 模型非零退出 | 桩：合法 JSONL + `exit /b 3` | 判分不通过 | 1 | `judgeError: 进程退出码为 3`，stdout 仍存 80 B |
| 04 | 输出非 JSON | 桩：`this is not json` | 判分不通过 | 1 | `Unexpected token 'h', "this is not json" is not valid JSON` |
| 05 | 等待 stdin | 桩：`pause` | 不得挂起 | 1 | 1 s 返回；判分器拒绝非 JSON 输出 |
| 06 | 参数保真 + 通过路径 | 桩回显 argv 并把令牌当最终文本 | 8 个 argv 不被拆；判分通过 | 0 | `passed:true`、`session: stub-args-thread` |
| 07 | 字节保真 | 桩写 CRLF + 中文 + 末尾换行 | 落盘字节一致 | 1 | 落盘 sha256 与桩输出 sha256 同为 `f2258820…e354`（判分因无 `turn.completed` 失败，符合预期） |
| 09 | 含空格路径 | 同一桩放在 `stubs/with space/` | 参数不被截断 | 0 | 提示词整条到达：`Reply with only this token: AGENT_VERIFY_…` |
| 10 | 真实 codex + 显式 `-m deepseek-v4.1-flash-1017` | A 的 ChatGPT 账号 | 如实失败 | 1 | `The 'deepseek-v4.1-flash-1017' model is not supported when using Codex with a ChatGPT account`（环境事实，非入口缺陷） |
| 11 | 真实 codex + `-Model auto`（不传 `-m`） | 默认模型 | 通过 | 0 | 约 20 s；4 行 JSONL；`thread_id` 每次新建（最近一次 `01a1a9fd-f714-7f10-bb65-5e5b3dd69537`）；最终文本 = 随机令牌；产物在 `tests/11/verification-output/` |
| 12 | 真实 claude | `claude.cmd` + `-SettingsFile` | 如实失败 | 1 | 199 s；`{"type":"result","subtype":"success","is_error":true,"api_error_status":401,"result":"Failed to authenticate. API Error: 401 Upstream request failed: Go requires a credential"}` |
| 13 | LF 版脚本可执行 | 桩，`-Model m` | 通过 | 0 | 证明仓库里的 LF 字节在本机 PS 5.1 可直接跑 |
| 14 | 默认输出目录 + 全路径含空格 | 脚本/可执行/判分器都放在 `evidence/raw/verify-entry/default-run/with space/`，不传 `-OutputDirectory` | 通过 | 0 | 产物落在**同一目录** `with space\verification-output\`，已随仓库归档到 `tests/14/verification-output/`（不再只留在本机临时目录）；判分器是原版副本，哈希校验通过 |
| 15 | 令牌不符 | 桩：合法 JSONL + `thread.started` + `turn.completed`，但最终文本是 `令牌 + " (extra)"` | 判分不通过 | 1 | `judgeError: 实际最终回复与检查标识不一致`（这是唯一支持「令牌不符已测」的用例，v1 文档误引了 06） |
| 16 | 已发起调用、收尾失败 | `model.stdout.jsonl` 这个位置先建成**目录**，跑完写盘时 `EISDIR` | 退出 **4**，`invoked:true` | 4 | `{"stage":"output","invoked":true,"error":"the model ran but its output could not be saved: EISDIR…"}`（v1 在这种情况下返回 2，被复核复现） |

**结论口径**：01/02 证明「输入不合法就不发起调用」，且 `invoked:false` 可核对；03/04/07/15 证明「跑完了但结果不合格，绝不返回成功」；16 证明「已经发起过」绝不冒充「输入错误」；11 证明「真实成功时保存原生退出码、完整输出、判分结果」；05/06/09/14 证明 stdin、参数、空格路径、默认输出目录；10/12 证明失败被原样报出，没有被入口吞掉。

复跑方式：`bash tools/checks/verify_entry_matrix.sh`（桩用例）或 `bash tools/checks/verify_entry_matrix.sh --with-network`（追加 10/11 真实 codex，标 A 本机）。14 个用例（01–16，缺 08 编号；含真实模型的 10/11）本轮全部命中期望退出码，逐项记录在各自目录的 `result.txt`。

## 4. 判分器的口径（未改，供 B 对齐）

`agent_result.mjs` 的 `verifyAgentResult`：

```text
exitCode !== 0                                  → throw 进程退出码为 N
stdout 每一非空行 JSON.parse                    → 任何非 JSON 行即失败
codex: 必须有 turn.completed，且不得有 turn.failed / error
codex: text = 最后一条 item.completed 且 item.type === "agent_message" 的 text
text.trim() !== expected                        → throw 实际最终回复与检查标识不一致
thread.started.thread_id 必须是非空字符串
claude: 最后一条 result 必须 subtype==="success" 且 is_error 为假
```

**usage 不在判分条件里**，本交付不额外校验、也不清零掩盖。

## 5. A 已验 / 仍需 B 验

A 已验：上面 14 个用例（01–16，缺 08 编号），全在本机 Windows PowerShell 5.1 真实执行。

仍需 B 实机：

1. B 的 codex / claude 真实模型 ID 能否通过（A 的账号只接受默认模型，不能替代）；
2. B 的包装器把 `verify-b.ps1` 换成 `verify-entry.ps1` 后整链是否成立；
3. B 本机 `agent_result.mjs` 的 sha256 是否等于 `0bead26b…5a6f`（入口运行时自动校验，不符退出 2）；
4. B 的 PowerShell 版本与执行策略下是否需要 `-ExecutionPolicy Bypass`（本入口沿用原调用形式）。

## 6. 未做与边界

- 未执行任何安装/联调动作；未改 B 的账本、脚本、分支；未重发或公开传输身份密钥（`C:/Users/chs/agent-autoloop-handoff/b-magicbook14.worker.key` 保持人工交付，本文件不含其内容）。
- 未调整活动路由：A 侧 `b-magicbook14` 的 `command` 仍是占位的裸 `codex`，等 B 回传真实绝对路径与模型后再改。
- 中心 `127.0.0.1:3350` 与 ngrok 隧道保持运行，本文件不涉及地址变更。

## 6. 对独立复核 128c1b3 四条问题的逐条处置

复核记录：`C:/Users/chs/.codex/visualizations/2026/11/05/01a1a9f0-850f-7ef1-99ad-bf30fae7d54a/review-checks/report.json`（证据一致性 10 通过 / 0 失败；契约核验 4 通过 / 3 失败）。

| # | 复核意见 | 处置 | 现在的事实与证据 |
| --- | --- | --- | --- |
| 1 | 退出码 2 不能证明「未发起调用」：程序跑完、保存输出失败时仍返回 2/stage input（`verify-model.mjs:257`） | 引入 `INVOKED` 状态位：spawn 之前才允许 2，一旦置位，任何 2 都被强制升为 4；输出写盘与结果写盘各自 try/catch → 4 / stage `output`；顶层 catch 按 `INVOKED` 分 2 或 4 | `tests/16`：`EISDIR` 场景退出 **4**、`invoked:true`、`stage:"output"`；`tests/01/02` 仍是 2 且 `invoked:false`。结果 JSON 新增 `stage`/`invoked` 两个字段 |
| 2 | README 的命令用 cmd 续行符 `^`，PS 5.1 粘贴即报错（`README.md:84`） | 改成**单行可直接粘贴**命令 + `@{}` 散列写法，并加一句说明 PS 续行符是反引号 | `deploy/verify-entry/README.md` §4；本机 PS 5.1 按该单行命令实测 = `tests/11`（真实 codex，exit 0） |
| 3 | 缺 `-Model` 实际退出 1，与契约写的 2 矛盾（`evidence/verify-entry.md:42`） | 弃用 `[Parameter(Mandatory)]`/`[ValidateSet]`（PS 绑定失败恒为 exit 1，与「判分失败」撞车），改为入口自己校验：缺参/取值非法 → 打印 `stage:input, invoked:false` 的 JSON 并 exit 2 | `tests/01`：exit **2**；无参数直接调用也是 exit 2 |
| 4 | 第 14 项产物只在临时目录；README:104「令牌不符已测」引用的 06 实际是通过用例 | 第 14 项改为在仓库内 `evidence/raw/verify-entry/default-run/with space/` 执行，产物归档到 `evidence/raw/verify-entry/tests/14/verification-output/`；新增 `tests/15`（合法 JSONL + 最终文本 = 令牌 + 后缀）真正覆盖「令牌不符」，README 改指向 15 | `tests/14/verification-output/`（含 `verify-result.json`）；`tests/15` `judgeError: 实际最终回复与检查标识不一致`；README §5 表格已改 |

配套：`tools/checks/verify_entry_matrix.sh` 把上面所有场景脚本化（`--with-network` 追加 10/11），每条产出 `result.txt`（title/expected/actual/verdict）与 `console.log`，本轮 14 个用例全部命中期望退出码（`console.log` + `result.txt` 逐项可判）。

### 6.1 v1（提交 ea76351 / 128c1b3）的字节，供追溯

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| `verify-entry.ps1` | 1754 | `a95d0a7d2d338b129fb59e06eedb5c7ae657f375fd7e569723e8167fba572092` |
| `verify-model.mjs` | 9185 | `c313bbaa2fb79348f773050a7c62e84cf3613671046f3a80bd56a74c2dfcd9de` |

v1 已被 v2 取代：两者不可混用（v2 的 README/契约按 v2 的退出码语义写），B 只需按最新提交取字节并按 §1 的哈希核对。
