# STRICT-V2-ACCEPT-20261106 阶段说明（A 发布）

- 阶段标识: STRICT-V2-ACCEPT-20261106
- 唯一 request_id: A-V2A-20261106-001
- A 角色: 唯一协调 / 规则写入 / 派发者；B 角色: 唯一 B 机器与 B 文件操作者
- 依据: evidence/coordination/v2-candidate-review-20261106/{review.md,stage-plan.md}（统筹已审 v2 候选）
- 固定 main: 73781d830d983c7cf8e8966cc8fdbeca012d7848
- 阶段开始（上海）: 2026-11-06T12:08:00+08:00；硬停: 2026-11-06T12:53:00+08:00（合计 45 分钟）
- 本阶段不重做六项、不做总验收；旧 T21 绑定原包保持 stale 记录，不覆写旧包、不删失败依赖

## 唯一材料

- 解析包（B 只应用这个）: `deploy/coordination/night-20261106/night-parse-strict-fulljson-v2.zip`
  - 14201 字节，SHA256 `5ff21499d4e0d98dddb2a9679e72fc8d907907454e139940d957101ee3bc4e23`
  - after: agent `c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74`(6141B) / agents `6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471`(2328B) / worker `8416191f470f6320c7ad058af61ea13232b1662b2768a234d4fc9a295baeef82`(17436B)
- 中心包仅核对:A 当前 after 已匹配则记 already applied，不覆盖、不重启中心

## A 侧步骤（按序，前置不符即停）

1. 按新固定 v2 建立正确版本验收记录（覆盖原相关回归 + Windows 执行端 + 离线类型检查 + 全流严格反例 + 两个固定包/成员哈希），命令输出为准，不用 claimed 代替
2. 发布阶段标识/request_id/固定包与本轮脱敏状态（本文与 A-status.json）
3. B PREPARED 后核对：包哈希、标准名入口路径、before 状态、B 当前无运行中/排队任务
4. 仅改 `agents.b-magicbook14.command[0]` 为 B 实际核对的标准名绝对路径；model `deepseek-v4.1-flash-1017`、cwd `D:\AutoAgentloop`、其余参数与 worker 不动；验证有效投影一致
5. 通知 B 启动一次（不重启 A 中心/隧道）
6. B 新进程/心跳/版本就绪后派本轮仅两条：初轮（真实 node_repl `nodeRepl.write(1+1)` 返回 2、指定回复、严格 JSON、原生退出码、真实 usage + 一张甲/乙卡片）→ A 选甲 → 第二轮 `exec resume` 同 session
7. 精确 test_id/event/run/attempt 计数，双侧核对；失败不原样重试、不换 auto、不加预算，立即停止后续

## B 侧步骤（摘要，细节见 B 提示词）

1. 仅用已下载官方 npm 完整 package 并列复制到 `C:\Users\19082\AppData\Local\agent-autoloop\tools\codex\0.166.0-alpha.5.1\package\`，主程序 `vendor\x86_64-pc-windows-msvc\bin\codex.exe` 必须 368970544B / `6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c`
2. 最多一次 CREATE_SUSPENDED 查初始完整性 Medium 后立即终止；`--version` 最多一次确认 `codex-cli 0.166.0-alpha.5.1`；不 exec、不碰 MCP
3. 回 PREPARED（路径/字节/完整 SHA/完整性/版本/before 核对/当前 worker PID 等元数据），不自行切路由
4. A 确认空闲后，B 维护停止当前单实例（核对 PID/创建时间/命令/up.pid，不硬编码）→ 备份 → 应用 v2 → 回 after 哈希
5. A 确认规则有效后 B 启动一次（隐藏窗口、重定向新日志、不 breakaway/不改 job 策略），核对单实例/up.pid/心跳
6. 仅执行 A 派发的两条测试，回脱敏摘要与完整哈希，不上传原始日志/配置/身份

## 预算（本阶段独立，不继承夜间剩余）

- A 新增正式执行: 最多 2 次（初轮 + 续接；自动重试也计 attempt）
- B: 不额外跑独立 CLI 模型回合；最多 1 次挂起令牌查询、1 次 --version、1 次本 worker 维护重启
- 45 分钟到点停止新增执行，清理仅本阶段未领取的重试/卡片并回报

## 版本边界（保留，不追认）

- 第 6 项真实登录触发: 仍未验证
- 取消/断线: 仅在旧 0.130 + 夜间字节上测过；对标称 0.166 标准名 + v2 这一组合**未重测**
- 改名 CLI（codex-0166.exe 等）的纯文本回退分支仍存在，未被批准为正式 Codex 命令形态
