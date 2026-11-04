# autoAgentloop — 进度（程序生成，请勿手工编辑）

账本修订: 43
总任务: 15；有效任务: 15；已完成: 3；完成率: 20%
[####----------------]

## 里程碑

| 里程碑 | 完成 / 有效任务 |
| --- | --- |
| 交接准备 | 1 / 1 |
| 平台约定更新 | 1 / 1 |
| 独立验收 | 0 / 1 |
| 真实试运行 | 0 / 1 |
| 程序适配 | 0 / 4 |
| 部署 | 0 / 2 |
| 部署前置 | 1 / 4 |
| 部署自测 | 0 / 1 |

## 当前活跃

| ID | 标题 | 计划 | 依赖 / 阻塞 |
| --- | --- | --- | --- |

## 阻塞任务

| ID | 标题 | 计划 | 依赖 / 阻塞 |
| --- | --- | --- | --- |
| T3 | B环境、通道和项目盘点 | approved | B 机不可达：A 侧无 Tailscale/ZeroTier/WireGuard/OpenVPN，LAN 内无确认的 B 主机，cpolar 只有 A 侧出站配置。引导包已交付（evidence/preflight/B_bootstrap.md + B_expected.md，采集脚本 tools/b_preflight/collect_b.ps1 已在 A 自测 exit 0），等 B 落地后回传 B.md。四条回传通道：手动搬运（已验证可行）/向日葵·GameViewer（未验证）/cpolar·ngrok 隧道（未验证）/私网直连（未装）。 |

## 最近完成

| ID | 标题 | 计划 | 依赖 / 阻塞 |
| --- | --- | --- | --- |
| T15 | 记录Windows或WSL均可的部署与验收范围 | approved |  |
| T2 | A环境、通道和项目盘点 | approved | T1 |
| T1 | 编制双机部署任务书与验收交接 | approved |  |

## 下一阶段

| ID | 标题 | 计划 | 依赖 / 阻塞 |
| --- | --- | --- | --- |
| T4 | 跨网络连接和身份设计 | draft | T2, T3 |
| T5 | fork源码基线与实施设计 | approved | T2, T3 |
| T6 | 选定运行环境的执行与生命周期适配 | draft | T5 |
| T7 | 工具模型接口与会话接通 | draft | T6 |
| T8 | Project Anchor任务与验收桥接 | draft | T6 |
| T9 | 路由并发额度和停止规则 | draft | T7, T8 |
| T10 | A中心执行端与管理入口部署 | draft | T4, T9 |
| T11 | B执行端同版本部署 | draft | T10 |
| T12 | 双机演练回退与证据汇总 | draft | T11 |
| T13 | Codex独立代码审查与双机复验 | draft | T12 |
| T14 | 两个指定真实项目小范围启用 | draft | T13 |
