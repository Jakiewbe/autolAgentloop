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

### 7.5 仍属源码侧已知差异的（本节未改）

- `format:check` 在这个检出上 149 个文件不合格，包括本次没碰过的文件（`tsconfig.json`、`worker/contract.ts`），说明是检出/换行与 prettier 版本口径问题，不是本轮改动引入；只对本次改动的 3 个文件跑了 `prettier --write`，不做全库格式化（会覆盖他人改动）。
- 未做「注销再登录」验证，见第 6 节第 2 条。
