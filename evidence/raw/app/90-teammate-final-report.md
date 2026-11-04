# app-source 收尾报告（T5/T6，2026-11-04 18:05）

> 本文件由 Lead 原样归档 teammate "app-source" 的收尾消息，供 Codex 独立复验时定位证据。所有原始日志在 evidence/raw/app/ 下。

## 一、T5：fork、版本基线、实施设计
- GitHub fork 未执行：本机无 gh、无可写凭据（00-preflight.log 记录 gh: command not found）。改为直接克隆上游；source-baseline.json 中 fork.created=false 并写明原因。
- 上游 https://github.com/KKKKhazix/agent-autoloop.git；checkout 96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a（detached，fix(service): quote systemd unit values (#38)）；main 头 4567e516… 仅记录未使用。
- git clone → app，exit 0；git status 干净；未建分支、未 worktree、未 commit/push。
- 许可 MIT，Copyright (c) 2026 数字生命卡兹克；git ls-files = 187。
- 工具链 node v24.12.0 / pnpm 11.9.0 / npm 11.12.1 / git 2.56.0.windows.2。
- pnpm install 成功（4.1s，devDeps typescript 7.0.2 / prettier 3.9.10 / @types/node 26.6.4），未装全局包；副作用：新增未跟踪 pnpm-lock.yaml。
- design.md 内容：A 侧目录（ROOT=D:\Vibe_coding-Project\autoAgentloop\app，HOME=%USERPROFILE%\.agent-autoloop 或 AGENT_AUTOLOOP_HOME，config.json/rules.json/secrets.env，worker/runs/<run>-<attempt>/{entry.json,context.json,stdout-N.log,stderr-N.log,exit-N,command-N.json}，up.pid，logs/up.log）、启动账户、启动与通知入口、停止/回退方式；B 侧设计（C:\AgentAutoloop\app，未就位）；Windows 改动清单；部署包 + 内容哈希方案。

## 二、T6：Windows 原生执行与生命周期（真实改动）
平台差异收敛到两个新文件：host/platform.ts（267 行）、worker/runner.ts（46 行），其余 5 个文件改为调用它们。

| 文件 | 改动 |
| --- | --- |
| host/platform.ts（新） | which/onPath/findProgram（PATH+PATHEXT）、launchTurn（Windows 走 runner，POSIX 保留 sh+登录 shell+detached）、programFor（.cmd/.bat→%ComSpec% /d /s /c 逐词引号+%→%%；.ps1→pwsh/powershell -NoProfile -File；全部 shell:false）、pidAlive/commandLineOf/runAlive/runTreeAlive、stopRun |
| worker/runner.ts（新） | 读 command-N.json → spawn(program,args,{shell:false}) → stdout-N.log/stderr-N.log → 子进程退出后写 exit-N（tmp+rename）→ 自己退出；起不来写 127 |
| worker/worker.ts | 删自带 sh 脚本/ps/进程组信号，改平台调用 |
| worker/agents.ts | findProgram 转调 platform |
| host/service.ts | Windows 分支：Startup .cmd（登录即 up、停止后 10 秒重起、输出进 <HOME>\logs\up.log）、runningUp 用 pidAlive+命令行、stopUp 用 taskkill /T→/F、serviceRunning |
| cli/main.ts | howToRun() 找 .cmd 并按平台加引号；linkSkill() 用 junction |
| bin/agent-autoloop.cmd（新） | node --disable-warning=ExperimentalWarning "%~dp0agent-autoloop.ts" %* |
| tests/windows-runtime.test.ts（新，222 行） | 4 条原生检查 |
| tests/helpers.ts | Windows 下 APPDATA 指向测试临时目录 |

停止一律 /T /F 的原因：实测 taskkill /T（不带 /F）对控制台 node 进程直接失败（只能强制终止），exit 128，子进程仍在跑；Windows 无可投递给控制台程序的软信号（evidence/raw/app/06-taskkill-probe.log）。

## 三、真实执行结果
| 检查 | 命令 | 结果 | 日志 |
| --- | --- | --- | --- |
| 类型 | tsc -p . | 0 | 10-final-checks.log |
| 格式 | prettier --check "**/*.{ts,json,yml}" | 1（153 文件），--end-of-line crlf 后 0 | 10-final-checks.log |
| Windows 回归 | node --test --test-force-exit tests/windows-runtime.test.ts | 0，pass 4 / fail 0，5950ms | 11-windows-runtime-final.log |
| 上游逐文件矩阵 | 50 个测试文件 × 90s 硬超时 | 基线 21/49 → 改动后 23/50；adapters 1→0；无回退 | 08-test-matrix-after.log、09-failure-classes.log |
| 端到端演示 | node evidence/raw/app/demo-run.ts | 0，[[101,"done"],[102,"cancelled"]] | 13-demo-run.log + demo-home/worker/runs/ |
| 三种入口 | node evidence/raw/app/entry-kinds.ts | 0，exe/cmd/ps1 全 exit=0、shell=false、树已消失 | 14-entry-kinds.log |
| CLI 入口 | cmd /c "app\bin\agent-autoloop.cmd --version" | 0 → agent-autoloop 1.0.0（提交 96b6c9c71671） | 15-cli-cmd.log |
| 启动脚本 | node evidence/raw/app/service-windows.ts | 0，install→校验→别人的 .cmd 不删→remove 清干净 | 16-service-windows.log |
| 残留进程 | Get-CimInstance Win32_Process | agent-autoloop/runner 匹配 0 | 12-residual.txt、12c-residual-node-list.txt |

四条 Windows 用例（真实起进程）：①带空格+中文目录跑完一轮，exit-1=0，stdout 含「好了」，command-1.json 的 program/args/cwd 正确，hub 收到 outcome=done（692ms）；②自 spawn 常驻孙进程，stopRun 后 runner 与孙进程都消失（877ms）；③可控时钟推过 1 分钟→outcome=failed、error 含「超过 1 分钟」（1221ms）；④第二个 worker 接手上一个丢下的轮次，被打断脚本只启动 1 次、无 command-2.json（2991ms）。

格式检查默认不合格的原因：仓库 core.autocrlf=true，工作区 CRLF，prettier 3.9.10 默认 endOfLine: lf → 连未改动上游文件都不合格（基线如此）。按 CRLF 解释后全仓库通过；未改仓库配置。

## 四、git 状态与关键 diff
M cli/main.ts、M host/service.ts、M tests/helpers.ts、M worker/agents.ts、M worker/worker.ts（5 files changed, 100 insertions(+), 91 deletions(-)）
?? bin/agent-autoloop.cmd (4)、?? host/platform.ts (267)、?? tests/windows-runtime.test.ts (222)、?? worker/runner.ts (46)、?? pnpm-lock.yaml

部署包（因不能 commit）：evidence/raw/app/windows-changes.patch（908 行，--binary）+ windows-changes.sha256（10 条）。回环验证：git clone --no-hardlinks app → checkout 基线 → git apply --binary → APPLY_OK，sha256sum -c 9 个源文件全部 OK；当前 app/ 里再跑一次 10/10 OK。

## 五、未验证 / 已知差异
1. GitHub fork 未创建（无 gh/凭据），只有上游克隆 + 本地 patch。
2. B 侧全部未验证（目录、join、Startup、重启恢复只有 A 侧等价证据）→ V13 无法在源码侧证明。
3. 未做真实注销/登录验证 Startup 脚本（不重启机器、不改系统配置）。
4. 没有优雅停止：Windows 一律强杀，正在写文件的 agent 会被直接结束（影响 T7 取消语义）。
5. 桌面通知判断仍是 macOS 的 launchctl → Windows 上恒不可用，通知只走中台 channel / unreachable 命令（属 T7）。
6. Startup .cmd 启动瞬间会闪一下控制台窗口（未实测频率）。
7. update（git pull --ff-only）在 detached HEAD 上不可用。
8. 上游 49 个测试文件里仍有 27 个在 Windows 失败，全部是夹具依赖 POSIX（/bin/sh 假命令、rmSync 句柄 EPERM、symlink EPERM、git commit 失败），改动前后首错文本逐字相同——未改写上游夹具，改用新增的独立 Windows 检查覆盖。

写入范围：app/、evidence/design.md、evidence/source-baseline.json、evidence/windows-runtime.md、evidence/raw/app/。
