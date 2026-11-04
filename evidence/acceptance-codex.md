# T13：交 Codex 独立验收（记录，不含自宣结论）

本文件记录「把 A 侧成果交给 Codex 独立审查」这件事本身：材料、哈希、命令、时间、原始输出位置，以及 Codex 自己给出的结论。
**实施方（DSH Lead）不对验收结果下结论**：通过与否以第 4 节的 Codex 原文为准；第 5 节只写证据链是否完整，第 6 节写仍未验证项。

- 第一轮（19:19–19:29）：**Codex 判「本次部署验收不通过」**（22 项：通过 11、失败 6、未验证 5）。原文 `evidence/raw/acceptance/codex-final-1.txt`。
- 第二轮（20:05–）：针对那 6 条修复之后重交，材料换成 win2 包与新的补丁；结论见 §4.2。

## 1. 固定材料（同一份，可复核）

### 1.1 第一轮（19:19，材料版本 1）

| 材料 | 期望 | 实测 |
|---|---|---|
| `deploy/agent-autoloop-96b6c9c7-win1.tar.gz` | 318771 B / `2ba21c422dbcf84c40e03d10bebee2c97693a3d4cfdfcd3e2adaaabf55fdd940` | 一致（`evidence/raw/app/windows-bundle.sha256` 旧版） |
| `evidence/raw/app/windows-changes.patch` | 50527 B / `f371da066b49cc4d46c7932b0759d16c6bc372fcedd0f73700409211d0e5561d` | 一致 |
| `evidence/raw/acceptance/prompt.txt` | 9 项核对要求 A–I | 已写 |

### 1.2 第二轮（20:05，材料版本 2）

| 材料 | bytes / sha256 | 校验 |
|---|---|---|
| `deploy/agent-autoloop-96b6c9c7-win2.tar.gz` | 321572 / `caf7048f4b6a5463e28ee6dca156b978f9c31173d17f31d96107f8ef980072a3` | `sha256sum -c evidence/raw/app/windows-bundle.sha256` → OK |
| `evidence/raw/app/windows-changes.patch` | 67593 / `0faca142e8ff3a0fdb2a6aab685696218ea3ec4cf8b0814d83e8e922533804ed` | 同上 → OK |
| `evidence/raw/app/windows-changes.sha256` | 1455 / `e3ff4e5de15dd118af7cb2ea117814a9d1c9f50e07a314552b6fc8c35b0ff2c3` | 17 行（11 改 + 5 增 + pnpm-lock），`app/` 内 `sha256sum -c` 全 OK |
| `evidence/raw/app/windows-bundle.sha256` | 214 / `d43355d7df475973e3958175d09de34762c2873e5f9bac92b39095844cfab30d` | 2 行，仓库根 `sha256sum -c` 全 OK |
| `evidence/manifest.json` | 由 `tools/checks/refresh_manifest.py` 重算 | 15 个 artifacts 的 bytes+sha256 与实物逐项比对：`tools/checks/verify_manifest.py` → `artifacts 15 mismatch 0`（`evidence/raw/app/20261104-2015-manifest-verify.txt`）。manifest 自身哈希随本文件修订而变，故不在此写死，以仓库内最新文件为准 |
| 源码基线 `evidence/source-baseline.json` | 由 `tools/checks/check_source_baseline.py` 机器核对 | 38 项 FAIL=0（含 11 个改动的上游/本地双哈希、5 个新增、补丁与包哈希、治理文件哈希） |
| `evidence/raw/acceptance/prompt2.txt` | 3039 / `516fb0ac46b82f6c34efd238dee628bfae4bdac6bb639e7fe79f7d26b5d5b402` | 第二轮提示词 |

第二轮相对第一轮的实质变化（都要 Codex 自己核，本文只是索引）：

1. `app/plugins/command/agent.ts`：`{resumeArgs}` / `{cwdArgs}` / `{sessionArgs}` / `{session}` 占位符；JSON 行输出取**最后一条** `agent_message`；上报 `thread_id` 等会话 ID。单测 `app/tests/command-adapter.test.ts` 6 条。
2. live `~/.agent-autoloop/rules.json`：`exec {resumeArgs} --skip-git-repo-check {cwdArgs} --json {prompt}`；中台两轮实测接在同一 codex thread（`evidence/raw/deploy/20261104-2058-resume-verify.txt`）。
3. `app/kernel/decide.ts`：`MAX_ATTEMPTS = 5`，到顶置 `unknown` 并通知；`app/worker/worker.ts`：会话接不上就失败，不再自动新建会话。`evidence/scheduling.md` §4/§7 已按代码改写。
4. `tools/anchor_bridge/bridge.mjs`：依赖必须 `done` 且 `verification_state === "pass"`；`findKit` 增加技能目录与 `runtime.json` 探测。测试 12 条。
5. `evidence/rollback.md`：`$listenPid` 取代只读 `$PID`；`evidence/adapters.md`：opencode 取消改标 [未验证]。

## 2. 命令

```bash
# 第一轮（19:02 写好，等 19:19 额度恢复后跑）
bash evidence/raw/acceptance/run-acceptance.sh
# 第二轮（20:05）
bash evidence/raw/acceptance/run-acceptance2.sh
```

两者都是：

```
"C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe" exec \
  --skip-git-repo-check -C D:/Vibe_coding-Project/autoAgentloop --sandbox workspace-write \
  -o evidence/raw/acceptance/codex-final-<n>.txt "$(cat prompt<n>.txt)"
```

- 用 **0.166.0-alpha.5.1** 那个二进制（0.130.0-alpha.5 会 400 `model_not_found`，见 `evidence/adapters.md`）。
- `--sandbox workspace-write`：让它能跑只读校验并写自己的输出；提示词明确禁止改仓库文件、禁止 commit/push/建分支。
- 完整 stdout/stderr：第一轮 `evidence/raw/acceptance/20261104-codex-acceptance.log`（1.09 MB），第二轮 `…acceptance2.log`。最终答复另存 `codex-final-<n>.txt`。

## 3. 运行记录

| 时间 | 动作 | 结果 |
|---|---|---|
| 19:02:15 | 第一轮等待脚本启动（等额度恢复） | 等到 19:19 开跑 |
| 19:19–19:29 | 第一轮 codex exec | exit=0，无重试；答复 7657 B 落盘 |
| 19:29 | 第一轮结论 | **不通过**（通过 11 / 失败 6 / 未验证 5） |
| 19:30–20:05 | 按那 6 条修复 + 补证据 + 重打包 | 见 §1.2；kernel/adapter/bridge 测试与实测日志更新 |
| 20:05 | 第二轮 codex exec 启动 | 进行中，见 §4.2 |

## 4. Codex 原文结论

### 4.1 第一轮（`evidence/raw/acceptance/codex-final-1.txt`，7657 B）

统计：**通过 11、失败 6、未验证 5**；原文结论：**「固定材料身份一致，但桥接准入、重试限制和回退命令存在明确问题，本次部署验收不通过」**。

6 条失败（原文要点）：

1. Windows 回归在它的沙箱里 2/4：停止与超时两条 `taskkill` 拒绝访问（`windows-runtime.test.ts:159,184`）；「历史 4/4 不能替代本次复验」。
2. T7 正式接入不完整：`rules.json` 只配一次性 `codex exec`，`app/plugins/command/agent.ts:5` 无会话接续；Claude 未接通。
3. 桥接放行失效依赖：`objection({plan:"approved",status:"todo",dependencies:["D"],...}, D=done+stale)` 返回 `null`；`findKit()` 返回 `null`（`bridge.mjs:26/88`）。
4. 无总重试上限且会自动新建会话（`decide.ts:259`、`worker.ts:268`，与 `scheduling.md:43` 矛盾）。
5. `rollback.md:25` 给 PowerShell 只读 `$PID` 赋值（`& { $pid=1 }` 报「无法覆盖变量 PID」，后续 `$PID` 变成终端自身编号，有杀终端风险）。
6. opencode 取消证据 0 字节却写成通过。

5 条未验证：治理保留范围、重复启动拒绝与登录自启（CIM/进程查询受限）、完整数据库恢复、B 机全部、DSH ACP 活体与实际 modelID / 额度费用。

### 4.2 第二轮（`evidence/raw/acceptance/codex-final-2.txt`，2095 B）

统计：**23 项中通过 14、失败 3、未验证 6**；原文结论：**「不通过」**。它自己的完整逐项结果、实际哈希与原始输出在 `evidence/raw/acceptance/recheck-20261104-independent/report.md`（它写在仓库内，属它的产物，未删）。

3 条失败（原文要点）与我在它返回后的处置：

| # | Codex 原文要点 | 处置 |
|---|---|---|
| 1 | **T7 仍不完整**：Codex 同一 thread 接续已证实，但任务书要求的 Claude Code/Go 路径尚未接通（依据 `DSH_DEPLOYMENT_TASKBOOK.md:146`、`evidence/adapters.md:102、232`）；`rules.json` 里只有 Codex 和慢测 | 已跑真机补测：`ANTHROPIC_MODEL=deepseek-v4.1-flash claude -p …` → `400 Upstream request failed: Model is unavailable`（`evidence/raw/adapters/20261104T201000_claude_v41.json`，exit 1）；`kimi-k3` 早前为 `401 Go requires a credential`。即 Go 网关不接受本机 `~/.claude/settings.json` 里的那个 `ANTHROPIC_AUTH_TOKEN`（不是 Go 订阅凭据）。**任务书 T7 完成条件「两条初始路径实测通过」在本机不具备条件**，按实记录为外部凭据阻塞，不写通过、也不把 Codex 分支写进 rules 冒充接通 |
| 2 | **文档仍有矛盾**：`evidence/scheduling.md:44` 多写了不会发生的 60 分钟退避（第 5 次失败立即停）；`evidence/adapters.md:116` 仍写「全部通过」，与取消行「未验证」冲突 | 两处已改：`scheduling.md:44` 写明「第 1–4 次失败按 5/10/20/40 分钟退避，60 分钟是单个等待封顶、设了 5 次上限后走不到」；`adapters.md:116` 标题改为「取消一项未验证，其余通过」 |
| 3 | **manifest 与实物不符**：19:56 快照里 15 项只有 9 项匹配（我在此前改过文档未重算） | 重算并加了只读校验 `tools/checks/verify_manifest.py`：`python tools/checks/verify_manifest.py` → `artifacts 15 mismatch 0`（`evidence/raw/app/20261104-2015-manifest-verify.txt`），exit 0 |

它同时确认已修的项：stale 依赖拦截、治理程序定位、5 次派发上限、禁止自动新建会话、`$listenPid` 修正、取消行标注；包/补丁/两份清单/源码基线检查通过。Windows 回归在它沙箱里仍是 2/4，它把停止与超时记为**未验证、不判代码失败**（它自己的探针确认 `taskkill` 被沙箱拒绝）。

它的报告还记了一条：验收期间检测到**原有材料发生外部变化**。这是我在它读材料的同时更新了 `.agent/CURRENT.md`（治理账本，基线里标 volatile 只报告）——时间与差异在它的 `before.json`/`after-comparison.json` 里，不辩解，照记。

**因此本部署当前状态：两轮独立验收均为「不通过」，第一轮 6 条已修并可复核，第二轮 3 条里 2 条已修、1 条（Claude/Go 通道）受上游凭据限制无法在本机达成。是否重新交第三轮由用户决定。**

## 5. 证据链是否完整（只看链条，不判成败）

- 材料身份：两轮都有 tar/patch/逐文件/包级哈希，且第二轮补了 `check_source_baseline.py`（38 项 FAIL=0）与 `refresh_manifest.py`（missing=0）两个机器校验。
- 运行可复现：两轮都是同一条命令模板 + 同一二进制 + 同一仓库根；日志与最终答复都落盘。
- 修复可核对：6 条失败逐条对应到文件与测试（§1.2 第 1–5 点），其中 3 条有新增/更新的测试或实测证据。
- 未做：Codex 的沙箱限制（taskkill、CIM 查询）导致部分项在它那边只能得到「受环境限制」，这一条无法由实施方消除，只能由它自己说明。

## 6. 未验证 / 无法在本机完成的

- **B 机全部**：B 不可达，`evidence/preflight/B.md` 仍缺，T3 阻塞，T11 未做。
- **跨不同网络的连接实测**：只做到方案与约束（`evidence/network.md` §5 明写未做）。
- **Claude Code 通道**：上游 400/401，任何真实回合都没有。
- **费用与额度**：codex 无接口；18:49 撞到一次用量上限（恢复时间 19:18）。
- **登录自启 / 完整数据库恢复**：只有 Startup 脚本与一次真实重启恢复，没有注销再登录；数据库没有做完整恢复演练。
- **DSH ACP 活体**：PATH 无 dsh CLI，只有源码与 README 证据。
