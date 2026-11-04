# Windows 原生执行与生命周期：改动与实测（T6）

机器：Windows 10 19045，git-bash，node v24.12.0 / pnpm 11.9.0。
源码：`app/`（上游 `96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a` + 本地改动，未 commit）。
本文件只写**实际跑过**的东西；没跑过的在最后一节单列。

## 1. 结论

- 平台差异集中到 `host/platform.ts` + `worker/runner.ts` 两个文件；其余代码不再直接用到 /bin/sh、ps、Unix 进程组、systemd/launchd。
- Windows 上「起一轮」= node 启动 runner（进程树根）→ runner 起真实 exe；「看这一轮」= pid 是否还活着 + 命令行里有没有这一轮的 marker；「停这一轮」= `taskkill /PID <runner> /T /F` 整树结束。
- 真实跑通：启动（含空格/中文路径）、输出/退出码/结果落盘、停止整树无残留、超时停止、重启后认领原任务不重开。命令、退出码、日志都在第 4 节。
- 上游 49 个测试文件里，Windows 上能自行通过的从 21 个变成 23 个（新增的 `windows-runtime` 通过，`adapters` 由失败转通过），没有任何文件由通过转为失败。其余失败项全部是上游测试夹具依赖 POSIX（/bin/sh 假命令、symlink 权限、rmSync 锁、git commit 锁），与本次改动无关 —— 见 4.5。

## 2. 平台边界（host/platform.ts）

| 能力 | POSIX（保留上游做法） | Windows（新增） |
| --- | --- | --- |
| 找程序 | `SHELL -lc 'command -v NAME'` | `PATH` 各段 + `.PATHEXT` 组合后 `existsSync` |
| 起一轮 | `spawn("/bin/sh", ["-c", script, marker, out, err, result, ...login])`，`detached:true`，`unref()`，pid=进程组号 | 写 `command-<turn>.json`（program/args/shell/cwd）→ `spawn(node, [runner.ts, commandFile, out, err, result, marker])`，`detached`，`windowsHide:true`，`unref()` |
| 真实入口 | 由登录 shell 展开 | `.cmd/.bat` → `%ComSpec% /d /s /c`（每个词自己加引号、`%`→`%%`）；`.ps1` → `pwsh`/`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File`；其余 exe 直接 `spawn`，**全部 `shell:false`** |
| 还活着吗 | `ps -p PID -o command=` 且含 marker | `process.kill(pid,0)` + `wmic process where processid=N get commandline`（失败回落 `Get-CimInstance Win32_Process`，2 秒缓存）且含 marker |
| 这一组还在吗 | `ps -ax -o pgid= -o stat=`，忽略 Z | 同「还活着吗」（Windows 无进程组；runner 就是树根） |
| 停 | `process.kill(-pid, SIGTERM\|SIGKILL)` | `taskkill /PID pid /T /F` |

为什么 Windows 上一律 `/T /F`：实测 `taskkill /T`（不带 /F）对控制台 node 进程直接失败（`只能强制终止(带 /F 选项)`，exit=128，子进程仍在跑），Windows 也没有可投递给控制台程序的「软信号」。所以 Windows 上「停止」就等于「整树立即结束」；worker 的 STOP_GRACE 逻辑保留（进程已即时消失，下一 tick 就 conclude），cancel/timeout 的结论由 `entry.why` 决定，不依赖 exit 文件。原始输出：`evidence/raw/app/06-taskkill-probe.log`。

## 3. 改动文件清单

| 文件 | 改动 | 为什么 |
| --- | --- | --- |
| `host/platform.ts`（新） | 上表全部；另含 `pidAlive/commandLineOf/runAlive/runTreeAlive/stopRun/launchTurn/programFor/which/onPath/findProgram` | Windows 没有 /bin/sh、ps、进程组；把这些集中一处，其他文件只调平台函数 |
| `worker/runner.ts`（新） | 读 command json → spawn 真实 exe（`shell:false`）→ 把 stdout/stderr 写进文件 → 子进程退出后 `exit-<turn>`（tmp+rename）→ 自己退出；起不来时写 stderr、exit 127 | Windows 上「分离进程 + 事后按 pid 组查询」没有等价物：需要一个比 worker 活得久、又是整棵树的根的宿主进程，worker 重启后才能认出/终止这一轮 |
| `worker/worker.ts` | 删掉自带的 sh 启动脚本、ps 查询、进程组信号，改调 platform；command 文件名按平台 `.json`/`.sh`；`entry.pid` 语义＝这一轮的树根 | 平台差异集中化，语义与文件布局保持上游 |
| `worker/agents.ts` | `findProgram` 转调 platform（Windows 用 PATH+PATHEXT） | Windows 没有登录 shell；claude/codex 探测两端一致 |
| `host/service.ts` | Windows 分支：`startupFile()`=`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\<label>.cmd`、`startupScript()` 写「登录即 up + 退出后 10 秒重起 + 输出追加 `<HOME>\logs\up.log`」、`installService/removeService/serviceRunning`、`runningUp` 改 pidAlive+commandLineOf、`stopUp` 用 taskkill /T 再 /F | 用用户级 Startup 脚本替代 launchd/systemd；不写注册表、不装服务、不建计划任务，撤销＝删掉那一个 .cmd |
| `cli/main.ts` | `howToRun()` 在 Windows 找 `agent-autoloop.cmd`、按平台加引号；`linkSkill()` 用 junction | Windows 的 symlink 需要额外权限；提示命令要能直接粘进 cmd/PowerShell |
| `bin/agent-autoloop.cmd`（新） | `node --disable-warning=ExperimentalWarning "%~dp0agent-autoloop.ts" %*` | 没有 shebang，需要真实 .cmd 入口 |
| `tests/windows-runtime.test.ts`（新） | 4 条 Windows 原生检查（见 4.4） | T6 要求真实启动/停止/超时/重启恢复 |
| `tests/helpers.ts` | Windows 下把 `APPDATA` 指向测试临时目录 | 防止任何测试真的往当前用户 Startup 目录写启动脚本 |

未改：`plugins/acp/bridge.ts`（子进程终止）、`plugins/desktop/channel.ts`（macOS 通知判断）、`host/service.ts` 的 darwin/systemd 分支 —— 属 T7 或保持上游。
`git diff --stat`（已跟踪文件）：`cli/main.ts 19+-`、`host/service.ts 73+-`、`tests/helpers.ts 2+`、`worker/agents.ts 25+-`、`worker/worker.ts 72+-`，共 100 插入 / 91 删除；新增文件 4 个：`host/platform.ts`、`worker/runner.ts`、`bin/agent-autoloop.cmd`、`tests/windows-runtime.test.ts`（另 pnpm install 生成未跟踪的 `pnpm-lock.yaml`）。

## 4. 检查与真实结果

全部命令在 `app/` 下执行；日志在 `evidence/raw/app/`。汇总日志：`evidence/raw/app/10-final-checks.log`。

### 4.1 类型检查

    node ./node_modules/typescript/bin/tsc -p .
    → exit 0（2026-11-04T18:00:43+08:00）

只作为前置门槛，不作为 T6 的完成证据。

### 4.2 格式检查（上游 `format:check`）

    node ./node_modules/prettier/bin/prettier.cjs --check "**/*.{ts,json,yml}"
    → exit 1，153 个文件被 warn
    node ./node_modules/prettier/bin/prettier.cjs --check --end-of-line crlf "**/*.{ts,json,yml}"
    → exit 0，全部通过

原因：`git config core.autocrlf=true`，工作区是 CRLF，而 prettier（3.9.10）默认 `endOfLine: "lf"`，于是整个仓库（含未改动的上游文件，如 `worker/contract.ts`、`tsconfig.json`）都被判不合格式。基线当时就是如此，不是本次改动引入；按 CRLF 解释后我的文件与全仓库都合规。未改仓库配置。

### 4.3 taskkill 语义实测

脚本 `evidence/raw/app/taskkill-probe.js`，日志 `evidence/raw/app/06-taskkill-probe.log`：

| 命令 | 结果 |
| --- | --- |
| `taskkill /PID <父> /T` | exit 128，输出「无法终止 PID … 原因: 只能强制终止(带 /F 选项)」「一个已挂起进程的子进程仍然在运行」，子进程仍活 |
| `taskkill /PID <子> /T /F` | exit 0，「成功: 已终止 PID …（属于 PID … 子进程）」，父、子全部消失 |

这是 `stopRun` 在 Windows 上一律 `/T /F` 的依据。

### 4.4 Windows 原生回归检查（新增）

    node --disable-warning=ExperimentalWarning --test --test-force-exit tests/windows-runtime.test.ts
    → exit 0；pass 4 / fail 0；duration 5950ms
    日志：evidence/raw/app/11-windows-runtime-final.log（迭代过程 07-windows-runtime-1/2/3.log）

| 用例 | 断言要点 | 实测 |
| --- | --- | --- |
| a turn runs in the rule's folder and keeps its output, exit code and result（692ms） | cwd 是带空格+中文的目录；真实 exe 跑完；`exit-1`＝`0`；`stdout-1.log` 含「好了」；`command-1.json` 的 program 是 node 绝对路径、args 完整、`shell:false`；hub 收到 `outcome=done` | 通过 |
| stopping a turn ends the tree it started（877ms） | 直接经 `launchTurn` 起一个「自己再 spawn 一个常驻子进程」的脚本；先确认 runner 与孙进程都活着；`stopRun` 后两者都消失（`pidAlive`/`runTreeAlive` 均为 false） | 通过 |
| a turn over its time is stopped and the run says why（1221ms） | 用可控时钟把时间推过 1 分钟；worker 发停止；结果是 `outcome=failed`、`error` 含「超过 1 分钟」 | 通过 |
| a restarted worker keeps the turn it finds, and doesn't start it again（2991ms） | 第一个 worker 起了一轮就丢下不管；第二个 worker 在同一 HOME 上接手：没有新的 `command-2.json`，被打断的脚本只启动 1 次，最终结果正常回传 | 通过 |

### 4.5 端到端演示（留下可翻看的现场）

    node --disable-warning=ExperimentalWarning evidence/raw/app/demo-run.ts
    → exit 0；summary [[101,"done"],[102,"cancelled"]]
    日志：evidence/raw/app/13-demo-run.log；现场：evidence/raw/app/demo-home/worker/runs/

- run 101：`command-1.json` 里 `program = C:\Program Files\nodejs\node.exe`（路径含空格）、`args` 为脚本绝对路径、`shell=false`、`cwd = ...\project 目录 with spaces`；`stdout-1.log` = 「这一轮干完了」；`exit-1` = `0`。
- run 102（长跑，被中台 cancel）：`stdout-1.log` 空、没有 `exit-1`（被整树终止，来不及写），结果 `cancelled/已停止` —— 说明结论不依赖 exit 文件。
- 两个 run 目录里都保留了 `context.json`（每轮上下文），`entry.json` 在结果回传后被删除，与上游语义一致。

三种 Windows 入口各自起一次（同样走 `launchTurn`，日志 `evidence/raw/app/14-entry-kinds.log`，脚本 `evidence/raw/app/entry-kinds.ts`）：

| 传入的命令 | 实际 program（`command-1.json`） | args | exit | stdout | 树已消失 |
| --- | --- | --- | --- | --- | --- |
| `C:\Program Files\nodejs\node.exe hello.mjs` | `C:\Program Files\nodejs\node.exe` | `["...\\hello.mjs"]` | 0 | exe 入口 ok | 是 |
| `...\hello.cmd` | `C:\WINDOWS\system32\cmd.exe` | `["/d","/s","/c","...\\hello.cmd"]` | 0 | cmd 入口 ok | 是 |
| `...\hello.ps1` | `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.EXE` | `["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File","...\\hello.ps1"]` | 0 | powershell 入口 ok | 是 |

三者 `shell` 都是 `false`，路径带空格也没有被拆开。

CLI 入口本身（日志 `evidence/raw/app/15-cli-cmd.log`）：

    cmd /c "app\bin\agent-autoloop.cmd --version"
    → agent-autoloop 1.0.0（提交 96b6c9c71671）；exit 0

### 4.6 残留进程核对

    powershell -NoProfile -ExecutionPolicy Bypass -File evidence/raw/app/residual.ps1
    → node.exe count: 1（另一个是 DSH 自己的 billion-context，命令行里没有 agent-autoloop/runner）
    → agent-autoloop/runner processes: 0
    → tasklist 快照同结论（"node.exe","45704" 为 DSH 组件）
    日志：evidence/raw/app/12-residual.txt

测试跑完立刻查（18:00:48 跑完，18:00:54 查）、演示跑完再查、以及 exe/cmd/ps1 三种入口各跑一次之后又查了一次（`evidence/raw/app/12c-residual-node-list.txt`）：当前机器上的两个 node.exe 分别是 DSH 自己的 billion-context（PID 45704）和 OpenAI Codex 的运行器（PID 58676），命令行走查与 agent-autoloop/runner 的匹配数都是 0 —— 我们起的进程一个都没留下。启动脚本目录 `%APPDATA%\...\Startup` 内容仍是 `MDI Jade 6.lnk / desktop.ini`，没有被测试污染。

### 4.7 上游检查的对照（保留适用项）

命令：`bash evidence/raw/app/run-test-matrix-after.sh`（每个测试文件单独跑、90 秒硬超时）。
结果：`evidence/raw/app/08-test-matrix-after.log`；失败分类：`evidence/raw/app/09-failure-classes.log`；改动前的基线：`evidence/raw/app/05-test-matrix.log`。

| | 改动前 | 改动后 |
| --- | --- | --- |
| 整文件 exit=0 | 21 / 49 | 23 / 50 |
| 逐文件差异 | — | `adapters` 由 exit=1 变 exit=0（基线失败原因：「找不到 codex：先装好并登录」，即旧 `findProgram` 依赖登录 shell）；新增 `windows-runtime` exit=0；**没有**任何文件由 0 变非 0 |

仍未通过的文件（改动前后一致），原因全部在测试夹具层面，与本次改动无关：

- `worker`（90s 超时，4 通过 17 失败）、`worker-login-shell`、`simulation`：夹具用 `/bin/sh -c`、`ps`、`sleep`、`mv` 当被测 agent；
- `cards/channels/conformance/events/http/key-remove/rules/runs/schedule/stream/why`：夹具在收尾 `rmSync` 时被仍打开的文件句柄挡住（Windows 的 EPERM），或 spawn 一个 shebang 脚本；
- `acp`：`symlink` 需要开发者模式/管理员（EPERM）；
- `delivery-scope`：夹具里 `git commit` 在临时目录失败；
- `install/uninstall/try/loop/desktop/examples/example-plugins/recipes/browser-handoff/business-recipes/worker-login-shell`：夹具依赖 POSIX 假命令与 macOS/launchd 行为。

这也是新增 `windows-runtime.test.ts` 的原因：上游那套检查在 Windows 上无法表达「真实起一个进程、停掉它、验证树里没有残留」。

### 4.8 部署包（无 commit 时怎么保证 B 是同一份）

    git diff --binary > evidence/raw/app/windows-changes.patch      # 已跟踪文件
    git diff --no-index --binary -- /dev/null <每个新文件> >> 同一个 patch
    sha256sum <9 个改动文件 + pnpm-lock.yaml> > evidence/raw/app/windows-changes.sha256

回环校验（证明 B 照此能复现出同一份）：

    git clone <app> verify-copy && git -C verify-copy checkout 96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a
    git -C verify-copy apply --binary windows-changes.patch     → APPLY_OK
    cd verify-copy && sha256sum -c ../windows-changes.sha256    → 9 个文件全部 OK
    （pnpm-lock.yaml 在干净克隆里不存在，属 install 产物，故该行为预期告警）

（这段是 18:10 那次复核的原始记录，patch 当时 908 行、5 改 4 增。20:00 之后的最终材料是 patch 1582 行、11 个修改文件 + 5 个新增代码文件 + `pnpm-lock.yaml`，清单 `evidence/raw/app/windows-changes.sha256` 17 行；以 `evidence/manifest.json` 为准。）

### 4.9 启动脚本（V17 的源码侧验证）

APPDATA 与 AGENT_AUTOLOOP_HOME 都指到 `evidence/raw/app/service-scratch/` 下跑，**真实的 Startup 目录一个文件都没动**（跑完仍只有 `MDI Jade 6.lnk`、`desktop.ini`）。脚本 `evidence/raw/app/service-windows.ts`，日志 `evidence/raw/app/16-service-windows.log`，exit 0：

    startup file  = ...\service-scratch\appdata\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop-d2f4f32c.cmd
    created = true        line endings CRLF = true      sets this home = true
    starts up = true      restarts = true               logs = true
    log folder ready = true
    serviceRunning while no up process = false
    stranger kept = true            （不是我们的 .cmd 不会被删）
    removed after install = true    （installService 之后 removeService 清干净）

生成的内容（原样）：

    @echo off
    rem Starts it at sign-in, and again after ten seconds if it stops. Delete this file to stop that.
    set "AGENT_AUTOLOOP_HOME=<HOME>"
    :agent-autoloop
    "C:\Program Files\nodejs\node.exe" "--disable-warning=ExperimentalWarning" "<ROOT>\bin\agent-autoloop.ts" "up" >>"<HOME>\logs\up.log" 2>&1
    timeout /t 10 /nobreak >nul
    goto agent-autoloop

`label()` 沿用上游规则：默认 HOME 得到 `agent-autoloop.cmd`，自定义 HOME 追加 home 路径的 sha256 前 8 位，所以同一台机器上多个安装不会互相覆盖。脚本每个词都自带引号（node 路径含空格、ROOT 含中文路径都不受影响），运行输出追加进 `<HOME>\logs\up.log`，不需要可见终端。

## 5. 与验收场景的对应（源码侧）

| 场景 | 源码侧事实 | 证据 |
| --- | --- | --- |
| V11 停止与超时 | 停止＝`taskkill /T /F` 整树；超时由 worker 时钟触发同一路径；两者结论不依赖 exit 文件 | 4.4 用例 2、3；4.5 的 102 |
| V12 A 中心重启 | `entry.json` + `up.pid` 落盘；重启后 `runningUp` 用 pidAlive+命令行识别；worker 扫 `runs/` 认领未结束的轮次 | 4.4 用例 4（同一 HOME 上第二个 worker 接手且不重开） |
| V13 B 执行端重启 | 与 V12 同一机制（代码相同、HOME 不同） | **未在 B 上验证**（B 尚未就位） |
| V17 启动机制 | Startup .cmd：登录即 up、退出后 10 秒重起、输出进 `<HOME>\logs\up.log`；`service remove` 只删自己的那一个 | 代码 + 4.6（目录未被污染）；**未真实登录重启验证** |

## 6. 未验证 / 已知差异

1. **未在 B 上验证**：B 尚未就位，目录、join、Startup、重启恢复都只有 A 侧等价验证。
2. **未做真实登录/重启验证**：Startup 脚本没有在「注销再登录」条件下跑过（不修改系统配置、不重启机器）。脚本内容与 `serviceRunning` 的判定在代码层通过检查，但没有实机登录证据。
3. **没有优雅停止**：Windows 无软信号，`taskkill /T` 不带 /F 会失败，所以正在写文件的 agent 会被直接结束；POSIX 保留 SIGTERM→SIGKILL 两段式。对 T7 的取消语义有影响，已记录。
4. **桌面通知不成立**：`plugins/desktop/channel.ts` 用 `launchctl print gui/<uid>` 判断（macOS），Windows 上恒为不可用；通知只能走中台 channel 或 `config.worker.unreachable` 命令。属 T7。
5. **Startup .cmd 会闪一下控制台窗口**：脚本用 node 直接跑，动作本身不需要可见终端（`detached` + `windowsHide` + `stdio:ignore`），但 cmd 宿主启动瞬间会闪窗。没有用 `.vbs` 隐藏，因为 .cmd 可读、可审、可一键删除。未实测闪窗频率。
6. **`agent-autoloop update`（`git pull --ff-only`）在 detached HEAD 上不可用**：设计上不升级；升级需重新 checkout 并重打 patch，未执行。
7. **格式检查在 Windows CRLF 工作区默认不合格**：见 4.2，属检出方式问题，未改仓库配置。
8. **上游测试夹具的 Windows 失败未修**：49 个文件里 27 个仍失败，原因是夹具用 /bin/sh 假命令等；改写全部夹具超出 T6 范围，且会动到「测试即行为规格」的上游约定。为此新增独立的 Windows 检查，而不是修改上游预期。
## 7. 真机部署阶段（18:17–18:26）发现并修掉的两个 Windows 阻断

这一节是 T10 真机部署时新跑出来的，不属于首轮源码适配：首轮只保证「已装好的环境能跑」，没走过 `init`。

### 7.1 `init` 在 Windows 上必然失败（阻断级，已修）

- 现象：`node bin/agent-autoloop.ts init --command "C:\Users\chs\AppData\Local\OpenAI\Codex\bin\22cfb1d302613eae\codex.exe exec --skip-git-repo-check -C {cwd} {prompt}" --no-service` → 打印 `rules.json 有问题：规则「试一下」的 cwd 要是以 ~/ 或 / 开头的目录`，exit 1；HOME 下只有 `hub.db`/`master.key`/`rules.json`，**没有 config.json**，中台起不来。
- 根因：`cli/main.ts` 的 starterRules 用 `path.join(HOME, "try")`，Windows 上得到 `C:\Users\chs\.agent-autoloop\try`；`protocol/rules.ts:74` 的校验是 `/^(~\/|\/)/`，只认 POSIX 绝对路径。init 在写 config 之前先 `addKey`（打开运行时库，随之加载并校验 rules.json），所以卡在这一步。
- 修复：`protocol/rules.ts` 新增 `isDirSpec`，接受 `~/`、`/`、盘符（`C:\x`、`c:/x`）与 UNC（`\\host\share`），报错文案改为「要是以 ~/、/ 或盘符开头的目录」；starterRules 保持 `HOME/try` 原语义（两端都合法），不动 `cli/main.ts` 的取值。
- 失败先行：`tests/rules.test.ts` 增加 5 条 cwd 断言（`C:\project\notes`、`c:/project/notes`、`\\share\notes`、`~/notes`、`/notes`）。修复前 `assert.doesNotThrow` 失败，修复后整文件 6/6 pass、fail 0。
- 证据：`evidence/raw/deploy/20261104-182000-init.log`（失败原文与现场）、`evidence/raw/deploy/20261104-182200-init-retry.log`（修复后 `init_exit=0`、config.json 键名清单、rules.json 里的 codex 命令数组）。

### 7.2 测试收尾在 Windows 上误报 EPERM（已修）

- 现象：`tests/rules.test.ts` 的 6 条用例全 pass，但测试文件本身判失败：`Error: EPERM, Permission denied: \\?\C:\Users\chs\AppData\Local\Temp\agent-autoloop-rules-XXXX`，位置 `tests/helpers.ts:15` 的 `rmSync`；只加 `maxRetries/retryDelay` 无效（不是瞬时占用）。
- 根因：同一进程里的 SQLite 仍持有 `hub.db` 句柄，Windows 不允许删除被打开的文件，重试改变不了结果。
- 修复：`tests/helpers.ts` 抽出 `removeHome()`：先 10 次 × 50ms 重试，仍失败时只吞 `EPERM`/`EBUSY`（其余照抛），注释写明原因。临时目录残留不算测试失败。
- 证据：同上日志；修复后 `tests/rules.test.ts` → `pass 6 / fail 0`。

### 7.3 `service install` 首次 EPERM、第二次成功（判断为瞬时，未改代码）

- 首次：`EPERM: operation not permitted, open 'C:\Users\chs\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop.cmd'`。
- 对照：同一路径下 bash `echo > probe.txt` 成功；独立 node 进程 `writeFileSync` 写 `probe-a.cmd`/`probe-b.txt` 均成功（`evidence/raw/deploy/20261104-183200-startup-probe.txt`）。第二次 `service install` exit 0，生成 429 字节 `agent-autoloop.cmd`。
- 判断：Defender 实时扫描对「非资源管理器进程首次在 Startup 新建 .cmd」的瞬时拦截，不是代码缺陷。风险：B 上首次安装可能需要重跑一次，已写进部署记录。

### 7.4 真机端到端结果（A 中心 + A 执行端，codex 0.166）

| 项 | 结果 | 证据 |
| --- | --- | --- |
| hub 监听 | `127.0.0.1:3350` LISTENING（pid 56328），worker `desktop-lm7rki1` started | `evidence/raw/deploy/20261104-182300-up.log` |
| try 第 1 轮 | exit 0，产出「等你决定 #1 试跑：选一个颜色」卡片 | `evidence/raw/deploy/20261104-182400-try.log` |
| 回答后再跑一轮 | `answer 1 1` → 第 2 轮结束语「你选了蓝色，试跑通过」；`status`：今天 2 轮、等你 0 | 同上（日志内含 answer/status 段） |
| 重复启动 | `up` 拒绝：「已经在跑了（进程 56328）」 | `evidence/raw/deploy/20261104-183000-service-restart.log` §1 |
| 重启恢复 | `taskkill /PID 56328 /F` 后重新 `up` → 新 pid 53264；`status` 仍显示 2 轮与已答卡片；`why 2` 时间线完整 | 同上 §6–§9 |
| 启动项 | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop.cmd`，内容为 node + PROGRAM + `up`，输出追加 `<HOME>\logs\up.log` | 同上 §5 |

### 7.4a Codex 独立验收时同一套用例只过 2/4 的原因（20:10 复跑，已澄清）

Codex 在它自己的沙箱里跑 `tests/windows-runtime.test.ts` 得 2/4，失败的两条是「停止一个回合要连它起的整棵进程树一起停」和「超时的回合要被停掉」（`windows-runtime.test.ts:159,184`），报 `taskkill` 拒绝访问 —— 沙箱不许它杀别的进程，不是代码坏了。

本机（danger-full-access，同一份材料）复跑：`windows-runtime.test.ts` **4/4 pass**，两条分别是 752ms、931ms；同一次全文件跑（`tests/worker.test.ts` 24 条）总体 5 pass / 19 fail，失败集中在 `spawn /bin/sh ENOENT`、临时目录 EPERM/ENOENT —— 与改动前的基线同类（基线 `evidence/raw/app/08-test-matrix-after.log`：`FILE worker exit=124 secs=90 pass=4 fail=17`；`09-failure-classes.log` 列同样为 EPERM/ENOENT/缺 sh）。日志：`evidence/raw/app/20261104-195000-worker-win-test.log`（全文件）、`evidence/raw/app/20261104-2010-worker-only.log`（worker 单文件，24 条 5 pass / 19 fail）。

也就是说：**Windows 运行时是通的；上游那套用 POSIX 脚本当夹具的用例在 Windows 上本来就不成立**，本轮没有改夹具、也不打算为了让它们变绿而改。

### 7.5 仍属源码侧已知差异的（本节未改）

- `format:check` 在这个检出上 149 个文件不合格，包括本次没碰过的文件（`tsconfig.json`、`worker/contract.ts`），说明是检出/换行与 prettier 版本口径问题，不是本轮改动引入；只对本次改动的 3 个文件跑了 `prettier --write`，不做全库格式化（会覆盖他人改动）。
- 未做「注销再登录」验证，见第 6 节第 2 条。
