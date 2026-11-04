# 第二轮独立验收

**结论：不通过。按下面 23 项统计：通过 14、失败 3、未验证 6。**

验收对象为本轮 A–F 修复及指定材料身份；第一轮其他通过项没有全部重跑，不冒充完整重新验收。第一轮留下的 5 类未验证事项继续保留。本轮新增的 Windows 权限限制单独记为未验证，不记代码失败。

本轮没有执行真实模型对话，没有发中台事件，没有运行 up、停止在线中台或改动其配置，没有提交、推送、建分支或 worktree。验收程序只在 `evidence/raw/acceptance/recheck-20261104-independent/` 新建文件，并使用测试临时目录；未修改任何验收开始时已有的仓库文件。

**材料时点：2026-11-04 19:56:53 +08:00。** 验收期间原有证据及治理文件发生外部变化，具体见 `after-comparison.json`。因此保存了 `reviewed-snapshot/` 和 `frozen-checks.json`，下文行号按该快照原文件位置计算。业务源码、部署包、补丁及两个校验清单在本轮前后保持相同身份；没有将外部变化归因给验收工具。运行日志 `20261104-codex-acceptance2.log` 的追加与证据文档内容变化分别记录。

## 逐项结果

| 编号 | 核对项 | 结论 | 事实依据 |
|---|---|---|---|
| 1 | A：Windows 停止、超时回归是否可独立确认 | 未验证 | 本轮 Windows 测试 2 通过、2 失败；独立短进程探针执行 taskkill 返回 spawnSync EPERM，见 `windows-runtime.log`、`native-session.log`。不据此判代码错误 |
| 2 | B：命令适配器占位符、JSON 最后消息、会话 ID | 通过 | `app/plugins/command/agent.ts:13,33,57`；适配器测试 6 通过、0 失败。`{sessionArgs}` 分支另经源码检查 |
| 3 | B：中台 run 8→9 使用同一 Codex thread | 通过 | 实际 command-1.json、两轮 stdout、原始 rollout 相互对应，见下文与 `runtime-evidence.json`、`rollout-check.json` |
| 4 | B：原 T7 正式接入完整性 | 失败 | `DSH_DEPLOYMENT_TASKBOOK.md:146` 要求的 Claude Code/DeepSeek 初始路径仍未接入；当前规则只有 Codex 和慢测，原始 Claude 日志为 400/401 |
| 5 | C：stale 依赖拒绝及桥接测试 | 通过 | `tools/anchor_bridge/bridge.mjs:124,134` 先查 done，再查 verification_state=pass；桥接测试 12 通过、0 失败；第一轮探针现返回明确拒绝 |
| 6 | C：findKit 定位已安装治理程序 | 通过 | 实际返回 `C:\Users\chs\Desktop\codex-plus\kit.py` 与安装器记录的 Python，via `.agents/skills/project-anchor/runtime.json` |
| 7 | D：最多 5 次派发，停后通知 | 通过 | `app/kernel/decide.ts:32,275`；内核测试 12 通过、0 失败；独立探针第 5 次 unknown，后续 5 次领取均无工作，存在 exhausted 通知 |
| 8 | D：会话失败不自动新建 | 通过 | `app/worker/worker.ts:264`；worker 会话测试 1 通过、0 失败；另以本机 Node 假进程核实只调用旧会话 1 次并返回失败，没有第二次启动 |
| 9 | D/F：说明文档与实际结论一致 | 失败 | `evidence/scheduling.md:44` 多列了不可到达的 60 分钟退避；`evidence/adapters.md:116` 仍称“全部通过”，与 :121、:126 的未验证矛盾 |
| 10 | E：回退脚本不再给只读 PID 赋值 | 通过 | `evidence/rollback.md:26-27` 已用 listenPid；只运行安全赋值探针通过，没有执行停止进程或配置回退 |
| 11 | F：OpenCode 取消一行的证据标注 | 通过 | `evidence/adapters.md:126,237` 明确改为未验证；原 json、stderr 仍为 0 字节。这里只通过标注修正，未通过取消功能验收 |
| 12 | win2 部署包及补丁身份 | 通过 | 独立 SHA256、大小见下表 |
| 13 | windows-changes.sha256 对应文件 | 通过 | 17 项全部一致 |
| 14 | windows-bundle.sha256 对应实物 | 通过 | 2 项全部一致 |
| 15 | 包内对应文件与 app 实物 | 通过 | 17 项全部一致；只读 tarfile，没有解包覆盖 |
| 16 | check_source_baseline.py | 通过 | 指定 Python 3.11 执行，38 通过、0 失败；源码确实通过 git show 获取上游 blob，不是本地自比 |
| 17 | manifest.artifacts 哈希及大小 | 失败 | 开始时 14 通过、1 失败；19:56:53 快照为 9 通过、6 失败，详见下文 |
| 18 | acceptance-codex.md 保留原判定、未自宣通过 | 通过 | :6、:74 与 `codex-final-1.txt` 的 11/6/5、不通过一致；:87-89 第二轮待返回，没有实施方替独立验收宣布通过。其材料身份问题计入 17 |
| 19 | 全部历史治理文件保留情况 | 未验证 | 任务书及 GOAL 基线一致；其他治理文件缺完整历史基线，CURRENT 被标易变，本轮又观察到外部修改 |
| 20 | 重复启动拒绝、登录自启 | 未验证 | Startup 脚本存在、429 B；本轮未执行可能改状态的 up，也未注销登录 |
| 21 | 完整数据库备份恢复 | 未验证 | 原回退日志证明配置切换、历史摘要存在，不证明数据库备份能完整恢复 |
| 22 | B 机、双机及跨网络 | 未验证 | `evidence/preflight/B.md`、`evidence/deployment/B.md` 均不存在；没有独立 B 实机复验 |
| 23 | DSH ACP 活体、真实模型身份及额度费用 | 未验证 | 只有源码与既有局部探针；没有 ACP 活体、实际 modelID/额度/额外扣款的完整证据，费用未知 |

## 失败清单和复现

以下命令从仓库根执行。`S` 代表 `evidence/raw/acceptance/recheck-20261104-independent/reviewed-snapshot`。

**1. T7 初始路径仍不完整。**

- 位置：`DSH_DEPLOYMENT_TASKBOOK.md:146-150`、`evidence/adapters.md:102,232,240`。
- 期望：Codex/OpenAI 与 Claude Code/DeepSeek V4.1 Flash 两个初始路径均接通并有受控操作、恢复、失败识别等证据。
- 实际：Codex 接续已修复；当前 live rules 的两个 agent 为 Codex command 与 slowtest，没有 Claude/Go。既有 Claude 原始输出仍是 Model unavailable / Go requires a credential，没有成功材料。DSH 未验证本身没有被误计为必须启用。
- 只读复现：

```powershell
$r = Get-Content "$env:USERPROFILE/.agent-autoloop/rules.json" -Raw | ConvertFrom-Json
$r.agents | ConvertTo-Json -Depth 6
Get-ChildItem evidence/raw/adapters -Filter '20261104T175629+0800_claude_p_model-*.json' | ForEach-Object {
  $v = Get-Content $_.FullName -Raw | ConvertFrom-Json
  [PSCustomObject]@{File=$_.Name;is_error=$v.is_error;result=$v.result}
}
```

**2. 文档仍有不一致。**

- 位置：`evidence/scheduling.md:44` 对照 `app/kernel/decide.ts:275-288`；`evidence/adapters.md:116` 对照 :121、:126。
- 期望：退避为 5、10、20、40 分钟，第 5 次失败立即停止；包含未验证项的结果不能统称全部通过。
- 实际：说明仍列出第 5 个 60 分钟退避，但该分支已被 MAX_ATTEMPTS 截断；OpenCode 取消行已纠正，节标题仍是“全部通过”。这是文档错误，不能据此否定已经通过的重试上限代码。
- 复现：

```powershell
node --disable-warning=ExperimentalWarning evidence/raw/acceptance/recheck-20261104-independent/retry-probe.mjs
rg -n '60 分钟|全部通过|取消.*未验证' evidence/raw/acceptance/recheck-20261104-independent/reviewed-snapshot/evidence/scheduling.md evidence/raw/acceptance/recheck-20261104-independent/reviewed-snapshot/evidence/adapters.md
```

**3. manifest 与实物不一致，验收材料也在变化。**

- 位置：`evidence/manifest.json:54-56,72-74,84-86,96-98,108-110,114-116`；`evidence/acceptance-codex.md:27,93` 的材料重算表述不能代替实际相等校验。
- 期望：15 个 artifacts 的 bytes 和 SHA256 全部一致。
- 实际：冻结快照仅 9 项一致，下面 6 项大小和哈希均不一致。开始时验收记录已经不符，之后 5 份证据文档又发生外部变化；不能把开始时的校验套到后来的材料。
- 复现冻结版本，不依赖之后是否被再次修订：

```powershell
& 'C:\Users\chs\AppData\Local\Programs\Python\Python311\python.exe' -B evidence/raw/acceptance/recheck-20261104-independent/check-frozen-manifest.py
```

该命令列出 6 条 FAIL，退出码 1。完整 expected/actual SHA256 在 `frozen-checks.json` 和 `manifest-frozen.log`。

| 文件 | manifest 大小 | 实际大小 | manifest SHA256 前缀 | 实际 SHA256 前缀 |
|---|---:|---:|---|---|
| evidence/windows-runtime.md | 24548 | 24724 | dfe68c4c | 5b7993ee |
| evidence/deployment/A.md | 8541 | 8647 | 731b0d5c | b2b8612b |
| evidence/rollback.md | 5096 | 5183 | 88d23ad3 | b51e7c8b |
| evidence/design.md | 10709 | 10735 | 84813b2a | bad860db |
| evidence/scheduling.md | 7503 | 7576 | de077c78 | b9e65271 |
| evidence/acceptance-codex.md | 2599 | 7970 | 50cb7c4f | bb90c205 |

## 本轮确认通过的关键证据

同一 thread 的判断不依赖“无新 rollout”这一条自述：

- `%USERPROFILE%/.agent-autoloop/worker/runs/8-1/command-1.json` 实际为首轮 exec；9-1 的实际参数为 `exec resume 01a1a662-6e93-7b31-bfe1-a8e9745abc43 --skip-git-repo-check --json ...`。
- 两轮 `stdout-1.log:1` 都上报同一 `thread_id=01a1a662-6e93-7b31-bfe1-a8e9745abc43`，两轮 exit-1 都为 0。
- 对应 `.codex/sessions/2026/11/04/rollout-2026-11-04T19-47-11-01a1a662-6e93-7b31-bfe1-a8e9745abc43.jsonl:1` 的 session_meta.id 一致；包含 2 个 turn_context、2 个 task_complete。用户消息记录有 3 条，其中含环境材料，不能机械把所有 role=user 行都说成业务回合；两条实际提示位于 :12、:30，时间分别对应 run 8、run 9。
- 以上只确认这两个既有回合的接续，不等于所有工具或所有失败路径已正式接通。本轮没有再调用模型。

第一轮 objection 探针现在输出“依赖的验收记录不是当前材料对应的结果：D（stale）”，不再是 null：

```powershell
node --input-type=module -e 'import {objection,findKit} from "./tools/anchor_bridge/bridge.mjs"; console.log(objection({plan:"approved",status:"todo",dependencies:["D"],deliverable_coverage:"covered"},new Map([["D",{status:"done",verification_state:"stale"}]]))); console.log(findKit(process.cwd()));'
```

本轮测试计数：桥接 12 通过、0 失败；适配器 6 通过、0 失败；内核 12 通过、0 失败；worker 会话测试 1 通过、0 失败；Windows 2 通过、2 失败。另有本机 Node 假进程与内存重试探针通过。标准 `node --test tools/anchor_bridge/bridge.test.mjs` 因测试隔离子进程 spawn EPERM 无法启动；加 `--test-isolation=none` 后同一测试文件全部通过。两种启动结果均保留，没有把启动受限算成桥接代码失败。

Windows 复现：

```powershell
node --disable-warning=ExperimentalWarning --test --test-isolation=none --test-force-exit app/tests/windows-runtime.test.ts
```

既有 `20261104-195000-worker-win-test.log:1-4` 确有 Windows 4 项通过，但整份混合日志为 8 通过、20 失败，exit=1。`20261104-2010-worker-only.log:25-28` 为 5 通过、19 失败，不是另一份 Windows 4/4。POSIX worker 测试依赖 /bin/sh，不能将它们在 Windows 的结果直接当业务缺陷，也不能把其中一个会话用例通过当成所有 worker 场景通过。因此额外用真正运行的本机 Node 假进程确认了会话失败只启动一次。

## 实际材料哈希

| 材料 | 大小 B | 本轮独立 SHA256 |
|---|---:|---|
| deploy/agent-autoloop-96b6c9c7-win2.tar.gz | 321572 | caf7048f4b6a5463e28ee6dca156b978f9c31173d17f31d96107f8ef980072a3 |
| evidence/raw/app/windows-changes.patch | 67593 | 0faca142e8ff3a0fdb2a6aab685696218ea3ec4cf8b0814d83e8e922533804ed |
| evidence/raw/app/windows-changes.sha256 | 1455 | e3ff4e5de15dd118af7cb2ea117814a9d1c9f50e07a314552b6fc8c35b0ff2c3 |
| evidence/raw/app/windows-bundle.sha256 | 214 | d43355d7df475973e3958175d09de34762c2873e5f9bac92b39095844cfab30d |
| evidence/manifest.json | 5791 | 01e41a09d57569a057769ac9000f1ef6d5d99e4c3f5154ce5635f65da4eacf41 |
| evidence/acceptance-codex.md | 7970 | bb90c205b8f60c1ee257ca70de17a85211b110cecfee0f366b00b27551a94e88 |

Git 当前仍是 detached HEAD `96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a`，只看到一个工作树；源码原有改动予以保留。最后检查源码基线仍为 38 通过、0 失败。原有治理状态没有被验收程序更新，因为本轮只授权只读验收和新建验收输出。

自检：先复查失败证据、测试覆盖与环境归因，再检查验收方式能否更简单；没有把历史日志、结构校验或实施方说明当成本轮实测。三类失败足以判本轮不通过；沙箱限制与其余未验证事项单独保留。
