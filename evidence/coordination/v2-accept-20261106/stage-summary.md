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
| 6 | B 端取值（MCP 返回 2 / 原生退出码 / 行数） | 未由 A 证明 | 待 B seq 4；A 不从 hub 推断 |

真实执行预算：A 中心本阶段 run 27(cancelled)、28(cancelled 多余派发)、29(done)、30(done)；正式 exec **2/2**；B 维护重启 **1/1**。

## 偏差（按事实记录）

- B 在 seq5 ROUTE_READY 发布前（12:29:15+08）自行启动 worker；A 已于 12:28 完成 command[0] 切换，故启动时路由已是 0.166，未出现旧入口执行。
- A 回答卡片传 choice=1（选项「乙」），与阶段文字示例「选甲」不同；续接目的不受影响。
- run 27 模型已发布 B 回执却上报「远端提交被取消」，A 按事实记为 cancelled 并保留回执。

## 剩余最小人工动作

1. B 写 B-status seq 4（只取证不重跑）：exec1/exec2 的 stdout 行数、终态行号、终态后非 JSON 行数、native exit code、最终消息两行、node_repl 是否返回 2、usage；脱敏。
2. 统筹复核 A seq6 与 B seq4 后决定是否把 0.166 + 严格 v2 定为正式通道；A 不自行宣布总验收。
3. 六项跨机联调未在本阶段重做；如需在 0.166 组合下重验，另行授权。

## 不做的事

未改判分、未过滤非 JSON、未关 MCP、未重装、未改身份/标签/权限/ACL/登录项、未重启 A 中心、未部署中心包、未上传原始 stdout/stderr/rollout/argv/env。
