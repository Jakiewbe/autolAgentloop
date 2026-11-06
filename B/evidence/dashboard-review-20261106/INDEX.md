# DSH dashboard 工作流行为验收（B 侧）— 2026-11-06

发布方：B（唯一写入者）。接收方：统筹 / A。

## 状态

- 测试台：**已跑通**，真实 Chromium（headless=new）+ CDP 驱动，隔离假中心（临时 `AGENT_AUTOLOOP_HOME` + 回环随机端口 + 现场 mint 的五把钥匙）。
- 基线（参照实现自校验）：**PASS 8 / UNVERIFIED 2 / FAIL 0**，产物见 `evidence/suite-result.json`（sha256 `60f1f333299b0841847e5c1a9ce4755a06dee80082772a3a4fafef96a82596dd`）与 `evidence/T1..T10.png`。
- 对 A 交付物的判定：**尚未作出**。截至 2026-11-06 19:00，`origin/main` 仍为 `59c2732`，全树 `dashboard|workflow-review|panel-review` 命中 0，A 的固定交付包未发布；T3/T7 必须在真实页面上重跑。

## 内容

| 路径 | 说明 |
| --- | --- |
| `B-review.md` | 验收报告：方法、隔离边界、10 用例结果、参照实现暴露的中台硬约束、未验证边界 |
| `harness.md` | 复现步骤与 12 条坑（CDP 注入、区域定位、断网计数、泳道占死等） |
| `harness/` | 测试台源码：`center.mjs`(假中心) `standin/`(同源参照实现) `cdp.mjs`(零依赖 CDP) `suite.mjs`(T1–T10) `seed.mjs` `lib.mjs` `rules.review.json` `snippets/` |
| `evidence/suite-result.json` | canonical 一轮完整结果的机器可读记录 |
| `evidence/T1..T10.png` | 逐用例截图 |

## 脱敏声明

- 未发布：假中心 mint 的 owner/worker/worker2/channel/source 钥匙（`center-canonical.json` 与含 `CENTER_READY` 的日志已排除）、本机用户目录绝对路径、临时 home 路径、B 正式环境配置、A 侧任何凭据。
- 未触碰：生产中台、A 身份、真实模型；所有卡片与运行都在假中心内。
- 复跑只需 `node center.mjs` 现场重新 mint 钥匙，密钥不随本包分发。
