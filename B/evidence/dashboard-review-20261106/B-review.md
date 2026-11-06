# B-review：DSH dashboard 工作流行为独立验收（B 侧）

- 验收方：B（唯一写入者），独立于 A 的实现与自测
- 时间：2026-11-06 18:20–18:57（Asia/Shanghai）
- 工作目录：`D:\AutoAgentloop\coordination\dashboard-workflow-review`
- 结论口径：只写实测。**未在 A 的真实 dashboard 上跑过一轮之前，本报告不构成对 A 交付物的通过判定**；下表是"测试台已就绪 + 参照实现自校验"的基线。

## 1. 方法与隔离

| 项 | 做法 |
| --- | --- |
| 被测页面 | 真实 Chromium（headless=new）+ CDP 驱动，不 mock 浏览器 |
| 中心 | `selftest/center.mjs` 起**隔离假中心**：临时 `AGENT_AUTOLOOP_HOME` + 回环随机端口（本次 3182），现场 mint owner/worker/worker2/channel/source 五把钥匙 |
| 页面宿主 | `selftest/standin/`：同源参照实现，owner 钥匙只在服务端，浏览器只打 `/api/*`（中台无 CORS，跨源客户端必然打不通，见 §5） |
| 触碰边界 | 不碰 B 正式环境、不碰 A 身份、不调真实模型、不向生产推回答/取消；所有卡片与运行都在假中心内 |
| 证据 | `evidence/suite-standin-canonical/`：`suite-result.json`（sha256 `60f1f333299b0841847e5c1a9ce4755a06dee80082772a3a4fafef96a82596dd`）+ `T1..T10.png` |

## 2. 十类用例基线结果（fresh center，一次完整跑）

| 用例 | 断言要点 | 结果 |
| --- | --- | --- |
| T1 选择与文字回答 | 选项回答落到决定且选项匹配；自由文字落库 | **PASS** |
| T2 notice 结案与 fyi 只读 | fyi 建档即 closed；通知区无可操作元素 | **PASS** |
| T3 已回答与后续完成分开 | 已回答语义与后续完成分两处呈现 | **UNVERIFIED** |
| T4 重复提交不重复派发 | 两次提交 200/200，卡片 decided，run 数 5→5 | **PASS** |
| T5 取消等待执行端确认 | 界面显示待确认，中心 run 仍 claimed | **PASS** |
| T6 时间线关联 | 时间线同时含卡片与其回答动作 | **PASS** |
| T7 分页与计划面 | 更早分页可翻；计划面含外部/延后 | **UNVERIFIED** |
| T8 断线保留旧数据并禁用操作 | 断线后旧数据仍在，禁用按钮 4 个 | **PASS** |
| T9 错误不自动重试 | 注入失败后 6 秒内 answer 请求恰好 1 次 | **PASS** |
| T10 凭据与能力链接不进网页 | 页面/存储/请求 URL 泄漏 0 处 | **PASS** |

汇总：**PASS 8 / UNVERIFIED 2 / FAIL 0**（FAIL 0 指的是参照实现无回归，不代表 A 的实现无缺陷）。

### 2.1 两个 UNVERIFIED 的原因（是测试台缺口，不是判定）

- **T3**：参照实现只把已答卡片标成 `decided` 状态文案，没有独立的「已回答」标签层，也没有把"卡片答复"与"运行完成结果"分成两个区块。缺 UI 结构 → 无法证伪。到 A 的真实 dashboard 上必须能区分这两者，这是本轮要复核的第一顺位。
- **T7**：假中心历史数据未超过一页（`/v1/state` 返回 `nextBefore=null`），翻页请求 0 条是数据量导致，不是分页坏。计划面只渲染了 `lines=2 / elsewhere=1`，外部计划与延后任务的呈现未覆盖。用 A 的 dashboard 时先注入足量历史再判。

## 3. 参照实现对照出的中台硬约束（写实现前必须知道）

1. **领活会被泳道占死**：`/v1/work?claim=…&capacity=1` 返回 null 的真因是 `app/kernel/decide.ts:236` 的 `!claimed.some(other => other.grp === run.grp && other.lane === run.lane)` —— 任何同组同泳道的 claimed run 都会堵住派发；而且**回答会派发一个新的后续 run**，不显式收尾就会一直占着泳道。
2. **answer 只第一次算数**（`app/docs/protocol.md` 195-273、`app/kernel/decide.ts:399`）：重复提交不报错也不改判，这正是 T4 的判据（run 数 5→5）。
3. **ask 收据校验**：`POST /v1/runs/:id/result` 的 ask 项必须 `title + text + 2~5 个 options`，否则 400；只给 1 个 option 会静默失败（T6 一度 FAIL 的根因）。
4. **取消语义**：`finish` 只有 outcome=`"cancelled"` 才置 cancelled 并清 `cancel_at`（`app/kernel/decide.ts:360`）；同 run 二次不同结果抛 Conflict。前端因此必须表达"已请求取消，等待执行端确认"，不能直接显示已取消。
5. **中台无 CORS**：全仓 grep `access-control`/`OPTIONS` 命中 0，浏览器只能同源访问或经服务端代理；任何"前端直连中台"的 dashboard 都会在浏览器里静默失败。
6. **fyi 建档即 closed**（`app/kernel/decide.ts:123-135`），通知类卡片天然只读。

## 4. 测试台自身可信度

- 每轮用例都核对中心侧状态（`/v1/state`、卡片、run），不只信页面文案；T4/T5 的判据落在中心状态上。
- 断网/失败注入不用"看截图猜"：T8 走 `Network.emulateNetworkConditions offline`，T9 走 `Fetch.enable + Fetch.failRequest` 统计真实重试次数。
- 出现过并被修正的**测量假象**（记录下来避免复现）：`Network.setBlockedURLs` 会连 `requestWillBeSent` 一起吞掉，导致"重试 0 次"的假结论；点击区域定位若取"最后一个匹配元素"会落到时间线 `<li>`（无按钮），已改为按"区域内可操作元素数最多 / 文本最短"打分；只读判定必须取"最紧凑"区域，否则祖先容器里其他卡片的按钮会污染结论。

## 5. 未验证与边界

- **未在 A 的真实交付包上运行**：截至 2026-11-06 18:56，origin/main 仍为 `59c2732`（A final-accept seq8），全树 `dashboard|workflow-review|panel-review` 命中 0，`incoming/` 为空。A 包到达后按"整包 + 成员 + before 哈希"核对，不匹配不强覆盖，再用同一 `suite.mjs` 打真实页面，重点复核 T3/T7。
- **未验证**：真实中台的 SSE 流式刷新（本台用轮询 + 手动刷新验证状态一致性）、多用户并发（owner/worker2 两角色仅用于越权观察）、移动端布局。
- **不涉及**：登录/身份/A 侧环境，一律未触碰。

## 6. 交付物清单

| 文件 | 内容 |
| --- | --- |
| `selftest/center.mjs` | 隔离假中心（临时 home、随机端口、mint 五钥匙） |
| `selftest/standin/{server.mjs,index.html,app.js}` | 同源参照实现（服务端持 owner 钥匙） |
| `selftest/cdp.mjs` | 零依赖 CDP 驱动：goto/eval/clickText/typeInto/offline/failRequests/screenshot |
| `selftest/suite.mjs` | T1–T10 用例，`--only=T1,T5` 可单跑 |
| `selftest/seed.mjs`、`rules.review.json` | 造数与规则 fixtures |
| `evidence/suite-standin-canonical/` | 基线结果 + 10 张截图 |
| `notes/harness.md` | 复现步骤与坑清单 |
