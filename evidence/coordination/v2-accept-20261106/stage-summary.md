# STRICT-V2-ACCEPT-20261106 — A 侧阶段汇总（12:41+08）

阶段：strict-v2 候选正式通道验收（不重做六项、不宣布总验收）
硬停：2026-11-06T12:53:00+08:00　唯一 request 前缀：A-V2A-20261106-*

## 结论

严格 v2 解析包已在 B 机器落地并与 A 侧字节一致，command[0] 已切到 0.166 标准名入口，其余模型/cwd/参数/worker/MCP 未动。
本阶段两条真实正式执行 **2/2 通过、0 失败、0 自动重试**；第二轮在同一 session 续接成功（证明 0.166 exec resume 通道成立）。
A 侧能证明的（run 状态、原样回复、token、usage、卡片闭环、hub 已加载路由）全部成立；MCP 返回 2、原生退出码、stdout 行数属 B 端日志证据，待 B 回 seq 4，A 不替代声明。

## 唯一当前构建（跨机同一份字节）

| 文件 | 字节 | SHA256 | 两侧核对 |
|---|---|---|---|
| plugins/command/agent.ts | 6141 | c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74 | A 工作树 = 包 after = B runtime_after |
| worker/worker.ts | 17436 | 8416191f470f6320c7ad058af61ea13232b1662b2768a234d4fc9a295baeef82 | 同上 |
| worker/agents.ts | 2328 | 6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471 | 已同值，B 未覆盖 |

- 包：deploy/coordination/night-20261106/night-parse-strict-fulljson-v2.zip 14201B sha256 5ff21499d4e0d98dddb2a9679e72fc8d907907454e139940d957101ee3bc4e23（v1 撤销保留，不以 v1 冒充可用）
- 中心包：night-center-rules-reload-v2.zip 12928B sha256 1106c14ddf523457fa9711cd38b1b21459d48a0782356727433cdb7536631e5c（本阶段只核对未覆盖、未重启）
- 基座运行时：d504e4876d07501e0a5288242a4575ae60dea685c1191c0598949bd9f9c99ebc
- 0.166 入口：C:\Users\19082\AppData\Local\agent-autoloop\tools\codex\0.166.0-alpha.5.1\package\vendor\x86_64-pc-windows-msvc\bin\codex.exe（368970544B sha256 6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c）
- 路由：rules.json 13283B sha256 3af89c9f57ebdd06b10c73f4c0eb211eae35f304f5fdf56bc5de69cc01a0340f（10 条规则，仅 b-magicbook14.command[0] 变更，备份 rules.json.bak-v2accept-route）

## 真实验证逐条

| # | 项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 初轮真实 MCP 调用 | 通过（A 侧到格式级） | run 29 done attempts 0，summary 逐字「V2 初轮通过：V2A-D45D004B」，session 01a1af1f-ba77-7451-9963-e14049e17b99，usage 1009471/2730/998144 |
| 2 | 甲乙卡片 | 通过 | card 10 title「V2 验收初轮：选甲或乙」options [甲,乙]，12:32:02 创建、12:32:16 被回答、12:32:41 关单 |
| 3 | 同 session 续接 | 通过 | run 30 done attempts 0，同 session 01a1af1f-…，summary 逐字「V2 续接通过：乙：V2A-D45D004B」，usage 1462654/3365/1431936 |
| 4 | 严格 JSON 判分未放宽 | 通过（离线+现网） | 现网 0.166 输出被判分器接受且回复原样；离线 30/30 测试、13 条反例（终态后噪声必失败、0.166 实际 argv 全非法流必报错） |
| 5 | 路由真实切换 | 通过 | GET /v1/runs/29/why 回读 hub 已加载 config：command[0]=0.166 exe、model=deepseek-v4.1-flash-1017 |
| 6 | B 端取值（MCP 返回 2 / 原生退出码 / 行数） | 通过（B 日志，已回收） | B seq 4（b 分支 1b79099）：exec1 stdout 29 行/终态第 29 行/0 非 JSON/native exit 0/26633B cb5d2368…；exec2 14 行/终态第 14 行/0 非 JSON/native exit 0/8475B a70bcde2…；node_repl 返回 2 与 4；usage 与 hub 逐数字相同；B 另用 v2 适配器离线回放同字节被接受 |

## 阶段总账（更正版，2026-11-06 13:00 静态收口）

- run 29、run 30：**正式验收执行 2/2 通过**（attempts 0，无自动重试），计入 2 次正式 exec 上限。
- run 27：**另有一次真实模型调用**（V2-准备回合）。模型确实执行过并产生真实 usage（input 7951169 / output 45430 / cached 7772544，session 01a1af0b-7d8f-7ec0-9552-f3ec198390e0）。它不算“正式验收 exec”，但**是本阶段真实模型调用，不能记成 0**。⇒ 本阶段真实模型调用 **≥3 次**（27 / 29 / 30）。
- run 28：从未被任何 worker 领取（claimedAt null、attempts 0），04:27:43Z 取消 ⇒ **不算一次执行**，不进入真实调用计数。
- B 维护重启 **1/1**（12:21 停止 → 12:29 启动，一次维护级重启）。

## 调度原因记录（run 27 与 B 端双写）

- run 27 的内容是“准备 + 包核对 + 发回执”，本该由 B 端 DSH 直接做。当时 A 用中心事件（A-V2PREP-20261106-001 / v2.prep.item1）把它派给了被测模型，理由只是“B 的协调端只在 hub 有活时才醒”。代价很直接：多花一次真实模型调用；而且模型与 B 端 DSH 同时写同一路径 B/evidence/deploy-b/v2-accept-20261106/B-status.json，产生 stray 回执（966e7634 / blocked=true）。A 只采用 DSH 的权威版，stray 版不采用。
- 固定做法（后续）：**准备、维护、发布由 B 端 DSH 完成，不派给被测模型**；hub 事件只用于“需要被测模型真实执行”的验收回合。

## 规则收尾（只移除本阶段三条临时规则）

- 移除：V2-准备、V2-验收、V2-应用（本阶段为调度临时加的）。保留：试一下、演练断电、A-Claude只读验收、B-接线验证、B-临时目录、B-接续验证、B-断线恢复。
- rules.json：13283B 3af89c9f57ebdd06b10c73f4c0eb211eae35f304f5fdf56bc5de69cc01a0340f（10 条）→ 6650B 639bf9b3dbfef400b7b2ae676239a3ddc707b97ad0a7ac63367484c06b3fee54（7 条）；备份 rules.json.bak-v2accept-cleanup（13283B）。
- 除 rules 数组外，其余顶层键与 agents.b-magicbook14 逐字未变（脚本比对 True）：正式入口仍是 0.166 标准名 codex.exe，模型仍是 deepseek-v4.1-flash-1017。
- 热加载已确认（读 hub 事实库，不是读文件推断）：最新 rules 行 seq 8095 / 04:55:58Z，规则 7 条，command[0] 仍指向 0.166 的 codex.exe。
- 无待执行任务：/v1/state 中 queued/claimed/running 为空（27 cancelled、28 cancelled、29 done、30 done）。

## 当前技术基线

- 统筹本轮认可：**0.166 标准名入口 + 严格 v2 全流 JSON 判定**为当前正式技术基线。
- 仍未宣布六项跨机联调总验收；六项不在本阶段重做。


## 偏差（按事实记录）

- B 在 seq5 ROUTE_READY 发布前（12:29:15+08）自行启动 worker；A 已于 12:28 完成 command[0] 切换，故启动时路由已是 0.166，未出现旧入口执行。
- A 回答卡片传 choice=1（选项「乙」），与阶段文字示例「选甲」不同；续接目的不受影响。
- run 27 模型已发布 B 回执却上报「远端提交被取消」，A 按事实记为 cancelled 并保留回执。

## 剩余最小人工动作

1. 统筹复核本轮收口材料（A seq6/seq7/seq8 + B seq4）：总账（正式 2/2、真实模型调用 ≥3）、调度规则、三条临时规则移除与热加载确认、基线认可。
2. 六项跨机联调未在本阶段重做；若要在 0.166 + 严格 v2 组合下重验，需另行授权并给新的 run 预算。
3. 中心包 night-center-rules-reload-v2.zip（1106c14d…）仍只核对未部署未重启，需要部署时由统筹点头。

## 不做的事

未改判分、未过滤非 JSON、未关 MCP、未重装、未改身份/标签/权限/ACL/登录项、未重启 A 中心、未部署中心包、未上传原始 stdout/stderr/rollout/argv/env。
