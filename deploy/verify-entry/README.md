# 验证入口（固定交付）

本目录是**补充交付**，不是审核包的一部分。审核包 `deploy/B-reviewed-delivery.zip`（sha256 `e0b4fb5b2e03bd9701cf8af42d9c7f9af0106dc09fd1c3018fd64e427394d853`）保持原样，包内 `verify-b.ps1` 与 `agent_result.mjs` 一个字节都没动。

## 1. 交付身份

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| `deploy/verify-entry/verify-entry.ps1` | 1754 | `a95d0a7d2d338b129fb59e06eedb5c7ae657f375fd7e569723e8167fba572092` |
| `deploy/verify-entry/verify-model.mjs` | 9185 | `c313bbaa2fb79348f773050a7c62e84cf3613671046f3a80bd56a74c2dfcd9de` |

- 唯一有效版本 = **远端提交里的这两个 blob**。`.gitattributes` 已对 `*.ps1` 设 `-text`（按字节保存，不做换行转换），所以 `verify-entry.ps1` 在仓库里就是 LF、1754 字节。`verify-model.mjs` 在仓库里是 UTF-8 LF。
- 不再提供「LF 版 / CRLF 版自己挑」：下载后先算 `sha256`，与本表不符就停手，不要改字节。
- 依赖（不随包分发，由 B 自己提供并在运行时**自动校验哈希**）：

| 依赖 | 来源 | 固定值 | 校验时机 |
| --- | --- | --- | --- |
| `agent_result.mjs`（原包判分器） | `deploy/B-reviewed-delivery.zip` 内同名文件 | 2441 B / sha256 `0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f` | 每次运行前校验，不符直接退出 2，不判分 |
| Node.js | B 本机 | ≥ 18（A 上实测 v24.12.0） | 运行时；`verify-entry.ps1` 从 PATH 找 `node.exe`，找不到退出 2 |
| Windows PowerShell | B 本机 | 5.1（A 上实测 5.1 通过） | — |

判分器不复制、不重写：入口用 `import()` 加载 B 指定的 `agent_result.mjs`，只调用它导出的 `verifyAgentResult`。**判分标准、逐行 `JSON.parse`、`turn.completed`/`turn.failed` 判定、令牌逐字比对、会话编号非空要求全部来自原文件**，本入口不加严也不放宽。

## 2. 和原 `verify-b.ps1` 的差别（逐条对应本轮要核对的 6 点）

| 核对点 | 原 `verify-b.ps1` | 本交付 |
| --- | --- | --- |
| PS 5.1 参数绑定与默认输出目录 | `-OutputDirectory` 默认值写成 `(Join-Path $PSScriptRoot 'verification-output')`，在 param 绑定阶段求值，PS 5.1 下 `$PSScriptRoot` 为空 → 不传该参数直接报 `Join-Path : 无法将参数绑定到参数"Path"`（`verify-b.ps1:6`） | 默认值移进脚本体，用运行期 `$PSScriptRoot`；不传也正常 |
| 原生 stderr 被误判为进程失败 | `$stdout = & $Executable @agentArgs 2> $stderrFile` + `$ErrorActionPreference='Stop'`：codex 往 stderr 写一行进度就变成 `NativeCommandError` 终止脚本（实测 `verify-b.ps1:24`），后续落盘与判分都没跑 | 不经过 PowerShell 管道：Node `spawn` 直接读字节流，stderr 只当证据；PS 层只在最后调用 node 时把 `$ErrorActionPreference` 降为 `Continue`，成败只认退出码 |
| 未使用的 stdin 是否关闭 | 未重定向，codex 打印 `Reading additional input from stdin...` 并等待/中止 | `stdio: ['ignore', 'pipe', 'pipe']`，子进程 stdin 直接是 NUL |
| 等待真实进程 + 原生退出码 | `&` 同步等待，取 `$LASTEXITCODE`（但常因上一条中断而拿不到） | `await 'close'`，记录 `nativeExitCode`、`signal`、`durationMs`；被信号杀掉时按 124 交给判分器，不会当成成功 |
| stdout / stderr 完整留存 | `$stdout -join "`n"` 再按 UTF-8 重写：控制台编码转换、行尾归一、末尾换行丢失都可能破坏 JSONL；stderr 只有文件、无字节数/哈希 | 原始字节直接落盘，记录 `stdoutBytes`/`stderrBytes` 与两者 `sha256`；非 JSON 行原样保留，交给判分器逐行 `JSON.parse` 决定成败 |
| 判分口径 | 调 `agent_result.mjs` 的 CLI | 同一文件的导出函数（哈希先行校验）；另存 `verify-result.json` 记录令牌、原生退出码、判分结论与会话编号 |

**usage 的处理**：原判分器**不校验** `usage` 字段（`agent_result.mjs` 只看出局码、事件类型、最终文本、`thread_id`）。本交付按原样保留这一口径，既不额外要求 usage 非零，也不把 usage 清零当成失败；usage 的原始数值照样完整留在 `model.stdout.jsonl` 里。

**为什么不是一个纯 PowerShell 脚本**：PS 5.1 的原生命令调用只能把参数数组拼成一条命令行（`Start-Process -ArgumentList` 也是同样拼法），含空格或引号的提示词/路径会被拆开或转义错；`Start-Process` 又不保证拿到原生退出码与完整字节流。Node 的 `spawn(文件, 参数数组)` 是逐参数传递，stdin/stdout/stderr 三条流可控，所以执行器放 Node，PowerShell 只做参数校验与转发。已实测：含空格目录下的脚本、可执行、判分器三条路径同时可用，提示词整条到达子进程。

## 3. 调用契约

```text
powershell -NoProfile -ExecutionPolicy Bypass -File <...>\verify-entry.ps1 ^
  -Agent <codex|claude> -Executable <可执行文件完整路径> -Model <模型 ID> ^
  [-SettingsFile <claude 配置 json>] [-OutputDirectory <输出目录>] [-Validator <agent_result.mjs 路径>]
```

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `-Agent` | 是 | `codex` 或 `claude`；其他值在参数校验阶段被拒 |
| `-Executable` | 是 | 必须是已存在的**文件**；`.exe` 直接调用，`.cmd`/`.bat` 经 `cmd /d /s /c` 且参数按 cmd 规则加引号（已实测路径含空格可用） |
| `-Model` | 是 | 模型 ID。**`auto` 仅对 codex 有效**，含义是「不传 `-m`，用 CLI 自己的默认模型」，结果文件里记为 `model: "auto"`；claude 用 `auto` 直接退出 2 |
| `-SettingsFile` | `-Agent claude` 时必填 | 必须是已存在的文件 |
| `-OutputDirectory` | 否 | 默认脚本同目录 `verification-output\` |
| `-Validator` | 否 | 默认脚本同目录 `agent_result.mjs`；不给又不存在则退出 2 |

**退出码约定**

| 码 | 含义 | 是否算通过 |
| --- | --- | --- |
| 0 | 判分器 `verifyAgentResult` 返回通过（进程退出码 0、有成功终态、最终文本逐字等于令牌、会话编号非空） | 是 |
| 1 | 真实跑完但判分不通过（非零退出、非 JSON 行、无 `turn.completed`、出现 `turn.failed`/`error`、回答不符、无会话编号） | 否 |
| 2 | 输入/依赖问题：缺参、路径不存在、claude 缺 `-SettingsFile`、`-Model auto` 配 claude、找不到 `agent_result.mjs` 或其哈希不是原版、找不到 `node.exe` | 否（此时**没有**发起模型调用，`invoked` 必为 `false`） |
| 3 | 程序起不来或收不到进程结束事件（`spawn` 失败）——已经尝试发起 | 否（`invoked` 为 `true`） |
| 4 | **已经发起调用**，但入口自己没收尾：输出保存失败、`verify-result.json` 写不下去、未预期异常 | 否（`invoked` 必为 `true`） |

**产物（全部落在 `-OutputDirectory`）**

| 文件 | 内容 |
| --- | --- |
| `model.stdout.jsonl` | 模型进程 stdout **原始字节**（不转码、不裁剪） |
| `model.stderr.log` | 模型进程 stderr 原始字节 |
| `verify-result.json` | `passed`、`stage`、`invoked`、`agent`、`model`、`agentArgs`、`executable`+`executableSize`、`expectedToken`、`nativeExitCode`、`signal`、`durationMs`、两个输出的 `bytes`/`sha256`、`judge{path,sha256,passed,session,error}`、`error` |
| 控制台 | 一行 JSON 摘要（同样的关键字段），交给包装器解析 |

## 4. B 侧怎么接

包装器里原来那条 `verify-b.ps1` 调用**换成同一个参数集的新入口**即可，参数名一个没变：

```powershell
# 1) 先核对字节（不符就停）
Get-FileHash -Algorithm SHA256 <下载目录>\verify-entry.ps1   # 期望 a95d0a7d2d338b129fb59e06eedb5c7ae657f375fd7e569723e8167fba572092
Get-FileHash -Algorithm SHA256 <下载目录>\verify-model.mjs    # 期望 c313bbaa2fb79348f773050a7c62e84cf3613671046f3a80bd56a74c2dfcd9de

# 2) 真实调用（单行，直接粘进 PowerShell 5.1）
powershell -NoProfile -ExecutionPolicy Bypass -File "<下载目录>\verify-entry.ps1" -Agent codex -Executable "C:\Users\<B账户>\AppData\Local\OpenAI\Codex\bin\<目录>\codex.exe" -Model deepseek-v4.1-flash-1017 -Validator "D:\AutoAgentloop\_reviewed\agent_result.mjs" -OutputDirectory "C:\Users\<B账户>\agent-autoloop-verify"

# 等价的散列写法（变量多时更好读，仍是 PowerShell 语法）
$p = @{ Agent = 'codex'; Executable = 'C:\Users\<B账户>\AppData\Local\OpenAI\Codex\bin\<目录>\codex.exe'; Model = 'deepseek-v4.1-flash-1017'; Validator = 'D:\AutoAgentloop\_reviewed\agent_result.mjs'; OutputDirectory = 'C:\Users\<B账户>\agent-autoloop-verify' }
& "<下载目录>\verify-entry.ps1" @p
```

> 续行符：PowerShell 的续行符是反引号 \`（行尾一个），**不是** `^`；上面给的单行命令不需要续行符，粘上就能跑。

- `-Executable` 与 `-Model` 必须填 **B 本机实测可用**的那个（A 不替 B 猜，也不用 A 的成功替代 B）。
- `-Validator` 指向 B 自己解压出来的原包 `agent_result.mjs`；哈希不是 `0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f` 时入口直接退出 2，不会用改过的判分器放行。
- 判定：退出码 0 + `verify-result.json` 里 `passed: true`；其他一律按失败记录，`model.stdout.jsonl` / `model.stderr.log` / `verify-result.json` 三个文件原样回传。

## 5. A 本机已验证 / 仍需 B 验

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 原 `verify-b.ps1` 在真实 codex 上失败（stdin/stderr） | A 已复现 | `evidence/verify-entry.md` §2 |
| 新入口参数正确 → 进入真实调用 | A 已验（codex 0.166.0-alpha.5.1） | `evidence/raw/verify-entry/tests/11/` |
| 真实成功时保存原生退出码 + 完整输出 + 判分结果 | A 已验（exit 0、22 s、`thread_id` 非空、令牌逐字相符） | 同上 |
| 缺参 / 路径不存在 → 明确失败且未发起调用 | A 已验（两者均退出 **2**，控制台 `invoked:false`） | `tests/01`、`tests/02` |
| 非零退出或结果不合格 → 不返回成功 | A 已验（子进程退出 3、非 JSON 行、无 `turn.completed`、最终文本不等令牌，四种各自失败） | `tests/03`、`tests/04`、`tests/07`、`tests/15`（令牌不符=**15**，不是 06——06 是合法通过用例） |
| stdin 不被等待 | A 已验（`pause` 桩 1 s 返回） | `05-stdin` |
| stdout 字节保真（CRLF + 中文） | A 已验（落盘 sha256 与桩输出逐字节相同） | `07-bytes` |
| `.cmd` 与含空格路径的参数保真 | A 已验（argv 逐个还原，提示词未被拆开） | `tests/06`、`tests/09` |
| claude 分支能走到真实 CLI 并如实失败 | A 已验（199 s、exit 1、判分器报 `进程退出码为 1`，stdout 里是 `401 Go requires a credential`） | `evidence/raw/verify-entry/tests/12/` |
| 已发起调用但收尾失败 → 退出 4（不是 2） | A 已验（`model.stdout.jsonl` 位置是目录，`stage=output`、`invoked=true`） | `tests/16` |
| 默认输出目录 + 全路径含空格 | A 已验（产物落在脚本同目录 `verification-output\`，已归档） | `tests/14/verification-output/` |
| **B 的 codex/claude 真实模型能否通过** | **未验，需 B 实机** | — |
| B 的包装器接入 `verify-entry.ps1` 后整链 | **未验，需 B 实机** | — |
| B 的 `agent_result.mjs` 哈希是否等于原版 | **未验，需 B 实机**（入口会在运行时校验并拒绝不符） | — |

**A 侧环境事实（不是交付缺陷）**：A 的 codex 走 ChatGPT 账号，**只要显式传 `-m` 就被服务端拒**——`deepseek-v4.1-flash-1017`、`gpt-5.1-codex`、`gpt-5-codex` 全部返回 `The '<model>' model is not supported when using Codex with a ChatGPT account`；不传 `-m` 时默认模型可正常回话（这正是 `-Model auto` 的来源）。B 若实测 `-m` 可用，就传真实模型 ID，不要照抄 `auto`。
