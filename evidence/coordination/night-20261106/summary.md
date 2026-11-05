# NIGHT-20261106-A 夜间总结

- night_id: NIGHT-20261106
- 角色: A（唯一代码/规则/main 写入者）
- 停止新增真实测试: 2026-11-06T07:50+08:00
- 封存: 2026-11-06T07:45+08:00（main 提交见下）
- 验收: 留明早统筹审核；本文只报本轮实际取证，不用报告数量或旧构建结果代替

## 0. 一句话结论

B 正式 Codex 通道的真实缺陷已定位为**解析端在终态事件之后遇到非 JSON 行就把整轮判成失败**，已用最小改动修好、两侧字节一致、真实 run 上确认 usage 能正常回流；六项联调中第 1/2/3/4 项在中心侧取得真实记录，第 5 项**断线已真实发生并取证**、恢复需 B 机器一次人工重启（A 不操作 B 机器，已停在该环节），第 6 项静态链已核、登录触发未实测。

## 1. 本轮实际解决的问题

1. **B 正式通道缺陷定位（有原始字节）**：run18 的 stdout 共 38 行，1–35 行是 JSON（第 35 行 \`turn.completed\`），36–38 行是三条 \`taskkill\` 的 SUCCESS 提示。旧逻辑把第 36 行判成协议错误，于是整轮失败、结果与 usage 全部丢弃（hub 上 run18 \`usage=null\`、error「Codex stdout 第 36 行不是 JSON 对象」）。
2. **最小修复**：\`app/plugins/command/agent.ts\` 的 \`read()\` 增加终态边界——\`turn.completed\`/\`turn.failed\` 之后的非 JSON 行不再判协议错；**终态之前的任何非 JSON 仍然失败**，缺终态、缺最终回复、缺会话、usage 非法仍然失败。原始 stdout 一字不改地留在日志里，不过滤、不重写。
3. **离线可复现验证**：\`node --test app/tests/command-adapter.test.ts\` 14/14；\`npx tsc -p app\` 通过；用 run18 的真实字节回放 —— 同一份 25424B（sha256 \`96921199…fce0\`）在旧代码报第 36 行错误，在新代码正常产出 text/session/usage。
4. **中心侧缺陷修复**：Windows 下 \`RULES_FILE.split("/")\` 永远取不到文件名，导致 \`rules.json\` 改动不触发热加载（必须重启中心才生效）。改成 \`basename(RULES_FILE)\` 后现场验证：新增规则后 event 29 的 ack 立即 \`routed=["B-断线恢复"]\`。
5. **跨机一致性**：B 应用后 \`plugins/command/agent.ts\` 的 sha256 与 A 本地**完全一致**（\`1b8933c0…\`），说明两侧跑的是同一份补丁字节，不是"各修各的"。

## 2. 唯一当前构建与完整哈希

基座运行时：\`d504e4876d07501e0a5288242a4575ae60dea685c1191c0598949bd9f9c99ebc\`（B 机器 \`D:\AutoAgentloop\runtime\d504e4876d07\`）

补丁包（B 侧应用，唯一当前构建）：\`deploy/coordination/night-20261106/night-parse-terminal-boundary-v1.zip\`
- 字节 13090，完整 SHA256 \`254b44b106c6711f41a56d1083d14d0bc0f72aa75337066af9a24c175e502b27\`
- 包内三个文件的应用后哈希：
  - \`plugins/command/agent.ts\` 6268B \`1b8933c0d1f8976b5afe7cc9fbdcd9021549a1057e68ae96f35ed85fd0bcd4f1\`
  - \`worker/agents.ts\` 2328B \`6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471\`
  - \`worker/worker.ts\` 17335B \`9899c23219722532f4d42b13106cde224ec890287d66027910106150dcac6cbb\`
- \`agent.ts\` 的两种可能 before：\`runtime-base-d504e4876d07\` = \`f821c0b0eb4e…\`（未打过旧补丁），\`patch-command-result-fix-applied\` = \`ac23aa9b6340…\`（已打过 11-05 的旧补丁）；B 现场是后者。

A 中心补丁（B 不应用）：\`deploy/coordination/night-20261106/night-center-rules-reload-v1.zip\`，10080B，SHA256 \`da01ff6c696edb56d2e26bb8b5d9de370897a29892e64ea3c59a252d6631cfc8\`。

打包可复现：ZIP 成员用 1980-01-01 固定时间戳 + ZIP_DEFLATED，重复构建哈希一致；包内 5 个成员全部 UTF-8 干净（脚本 \`evidence/raw/night/verify_zip.py\` 自检输出 utf-8-clean）。

## 3. 真实验证通过 / 失败数

| 维度 | 数 | 说明 |
| --- | --- | --- |
| A 中心真实 run（本轮新增） | 8（cap 12，含 run 26 断线排队；重试/续跑计入） | run 19–25 用于第 1/2/3/4/5 项；run 26 断线期间排队 |
| 其中成功 | 5（run 19/20/21/22/24） | run19/20/21/22/24 done |
| 其中取消 | 1 | run 23（第 4 项，延迟 2.2 秒） |
| 其中断线 | 1 | run 25（第 5 项，回合中被杀） |
| B 本地真实候选 exec | 4（cap 6，含 11-05 的 1 次 os error5；t22c 那次为误跑旧包、候选 exec 计 0） | 含此前 1 次 os error5 与 t22c 误跑 |
| 六项通过 | 2 完全 + 2 A 侧 + 2 部分 | 逐项证据见第 4 节 |

## 4. 六项逐项证据

### 第 1 项 派发/执行/回传 + 严格协议 + session + 实际 usage
- run 19 / event subject \`A-J1-20261106-001\`，session \`01a1ace2-4837-7952-b034-af2a049766b0\`
- usage \`input 673864 / cached 665600 / output 1819\`（非 null，说明修复后 usage 真的能回流）
- summary 逐字「B 接线通过：b-magicbook14」
- B 侧独立一致：\`b-ping.txt\` 21B \`fcd7cde2…\`，stdout 终态后 3 条 taskkill 噪声被容忍
- **通过**

### 第 2 项 合成临时目录 创建/写入/列举/删除 + 清理回执
- run 20 / \`A-J2-20261106-002\`，session \`01a1ace4-1ad2-7892-a020-2a0767121271\`，usage 1098259/1085440/3893
- 目录 \`D:\AutoAgentloop\aa-tmp-item2-20261106020807\`，删除后 \`none_remaining\`
- B 侧 stdout 38995B / 33 行 / 终态第 29 行 / 终态后 3 行非 JSON
- **通过**

### 第 3 项 同一会话 回执→卡片→回答→resume
- run 21 发卡片 8（ask，key \`thread:B-接续验证::b-resume-item3\`），A 以选项 0（甲）回答并自动入队 run 22
- run 22 与 run 21 **session 相同**：\`01a1ace6-40d4-72c3-8d63-306059611b9e\`，usage 1376520/1364224/3235
- summary「第3项第2轮完成：你选了 甲，接续成功」
- **A 侧通过**；B 侧 \`resume-mark.txt\` 的 \`ROUND2=甲\` 行与 sha256 未取得（b 分支尚无 resume-mark.txt）

### 第 4 项 运行中取消
- run 23 / \`A-J4-20261106-004\`，claimedAt \`2026-11-05T18:14:34.815Z\`，取消请求在模型进行中发出，finishedAt \`18:14:56.972Z\`
- **取消延迟 2.2 秒**，state=cancelled，session \`01a1aceb…\` 但 usage=null ⇒ 不是排队重试
- **A 侧通过**；B 侧 codex 子进程 PID 与终止证据 未取得（B 侧未上传，须 B 补）

### 第 5 项 断线/重启/恢复（同一 B 执行端，紧接第 4 项）
- run 25 / \`A-J5-20261106-005\`，claimedAt \`19:01:28.406Z\`，session 已上报 \`01a1ad16-64d6-7572-aedf-28598b1efa8c\`
- 最后心跳 \`19:05:23.302Z\` 后 online=false —— **回合进行中被强制终止，是真实断线，不是维护重启**
- 断线窗口内派发 event 30 / \`A-J5B-20261106-006\` → run 26 \`queued\`，只 1 条，未丢失未重复
- 19:16Z 中心自动生成「接单程序没连上」提醒（attention 0→1），看门狗有效
- 防重派自杀：断线后把该规则提示词换成无害版（原 \`9265fdae…\` → 新 \`75c2004f…\`，rules.json \`706641cc…\` 6741B / 7 条）
- **断线已证明；恢复未完成**：B worker 至 2026-11-06T07:40+08:00（已离线 258 分钟） 仍离线，需 B 机器人工重启；A 不操作 B 机器
- 恢复判定标准：run 26 被领取完成 + run 25 由 worker 用磁盘 stdout 收尾（failed「没留下结果」/unknown）+ 同一 subject 不出现第二条 run

### 第 6 项 登录启动项真实登记与路径核对
- B 静态链：\`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop.cmd\` 430B \`aa2cfb42…28a6\` → \`node.exe\` v24.12.0 89935872B → \`runtime/d504e4876d07/bin/agent-autoloop.ts\` 88B \`614b0eec…043d\`
- 重定向目标 \`logs\up.log\` 尚不存在；当前 worker 不是由该 cmd 启动
- **登录触发未实测**（契约禁止注销/重启电脑、禁止改登录项），明确标注未验证，不用静态链凑 6/6

## 5. 剩余最小人工动作

1. **B 机器**（唯一需要人工权限的环节）：
   - 先看 \`D:\AutoAgentloop\aa-item5-restart.log\` 末 20 行，确认自动重启为何没成功
   - 在 \`D:\AutoAgentloop\` 执行：\`node --disable-warning=ExperimentalWarning D:\AutoAgentloop\runtime\d504e4876d07\bin\agent-autoloop.ts up\`
   - 重启后**不要**重跑第 5 项、不要新建同类事件；A 会用 hub 记录核对 run 25/26
2. **B 侧补证**：第 3 项 \`resume-mark.txt\` 的 ROUND2 行；第 4 项 codex 子进程终止证据；第 6 项维持「未验证」或另择窗口实测
3. **明早统筹**：六项逐项复核 + 是否把正式 \`command[0]\` 指向新构建（本轮**未切**）

## 6. 偏差与保留（不删、不凑）

- run18 历史结果**不算通过**：其最终回复是「B 接线验证文件已按规则完成并核验通过。」，与规则要求的「B 接线通过：b-magicbook14」不逐字相等；本轮用 run 19 重新取证才通过。
- \`app/tests/worker.test.ts\` 在 Windows 上多条失败，原因是测试脚本写死 \`/bin/sh\`（POSIX-only），本轮未改该文件，与本包无关。
- 仓库整体 \`format:check\` 有 67 个既有文件不符（CRLF 既有状态），未作为门禁；只对本次改动的两个文件跑了 prettier --check（通过）。
- 本轮**未**改动：MCP 配置、ACL、登录项、agent 身份、\`command[0]\`、模型名、cwd、判分严格度；未上传任何原始 stdout/stderr/rollout/完整 argv/env/config/身份材料；未重启 A 中心与操作系统。

## 7. 时间线（UTC / 上海时间）

| UTC | +08 | 事件 |
| --- | --- | --- |
| 17:53 | 01:53 | 发布 seq2 补充包 night-parse-terminal-boundary-v1 |
| 18:10 | 02:10 | B 发布 seq6（第 2 项全量证据） |
| 18:14:34 | 02:14:34 | run 23 领取（第 4 项） |
| 18:14:56 | 02:14:56 | run 23 取消完成（2.2 秒） |
| 18:58:05 | 02:58:05 | run 24 领取并完成（唤醒探测） |
| 19:01:28 | 03:01:28 | run 25 领取（第 5 项） |
| 19:05:23 | 03:05:23 | B 最后心跳，随后离线 |
| 19:06 | 03:06 | 派发 event 30 → run 26 排队 |
| 19:16 | 03:16 | 断线 10 分钟告警（attention 1） |
| 23:40 | __LAST_SEEN__ | B 仍离线；A 继续离线核对与封存材料 |

## 8. 封存说明

- 封存时刻（上海时间）：2026-11-06T07:45。
- 07:50 之后未再新增任何真实 run / 候选 exec；run 19–26 的记录即本轮全部真实用量。
- 本文所有哈希均来自本地实际字节（`evidence/raw/night/evidence-index.md` 列出 75 个证据文件及其 SHA256），未用旧构建结果代替。
- 六项中第 5、6 项**未取得完整闭环**，已在第 4 节逐条标注「未验证/待补」，不采用"静态链当作实测"的方式凑齐。
- 遗留：B 机器人工重启后，run 25 由 worker 用磁盘 stdout 收尾（failed「没留下结果」/unknown），run 26 会被领取并完成；A 侧判定脚本 `evidence/raw/night/judge_j5.py` 可一键复核（输出 `j5-verdict.json`）。
