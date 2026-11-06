# B 独立工作流验收报告（v2 固定包）

- 受审物：`deploy/coordination/dashboard-fix-20261106/dashboard-item-key-cancel-v2.zip`，提交 `9fabbe9ae096418ea3e809be45518950af690b04`
- 包字节：58408；SHA256 `c66a3c64db5f1a5c2270d0cf1130a5ac764d2dcee7eaffefd0d1808d0309a525`（本地重算一致）
- 解包目录：`coordination/dashboard-workflow-review/extract-v2-c66a3c64`（新目录，解包前确认不存在；原 ZIP 保留；未覆盖旧目录/生产 runtime）
- 成员核对：按 `PATCH.json`（5576B `c68264b63da6cf1916b6d30ed3cf4ff7f3717741c5e7561601d5576b6fd0aa034`）逐条核对 bytes+sha256 → **MATCH 13/13**，解包后二次复算仍 13/13
- 受审前端字节（未改一个字节）：`dashboard/public/app.js` 40117 `fc7c6ba3947d956fe05b65af2423ab30259bdfdc5dd8855c480c7b7ff0ed2926`；`workflow.mjs` 5843 `11babc0eacbc109f46c891a44941b1a58de52fa97dc2fabd0cdf2b532db8af4a`；`index.html` 4472 `ba59799d3567bfd64ffe9d9f242c88883d671e62e9d26053edaba527cace4070`；`styles.css` 31148 `8b7ece17c4b94a08376a1613574fb1dd640bdf8fabf8d42ca4b0886b0ca6bb0f`；`server.mjs` 16373 `744c7b9d168fc3bccb067bfd1a0e621597637fb1336b00f7eee1634611db34b8`
- 生产环境：未改动（不碰 `~/.agent-autoloop`、不碰生产 3350/3351、不重启 worker、不改权限/身份/MCP/登录项、不派发模型）

## 结论

| 项 | 结果 |
| --- | --- |
| 包成员完整性 | 13/13 一致 |
| 包内单测 `node --test` | 34 pass / 0 fail（B 本地重跑） |
| 真实面板判据 T1–T14 | **14 PASS / 0 FAIL / 0 UNVERIFIED / 0 SKIP** |
| 判据负例自测 | **15/15 全部 CAUGHT（0 MISSED）** |
| 未复跑项 | 包内 `browser-qa.mjs`（11/11 为 A 自报）、`probe-live*.mjs`（需真实生产中心） |

## 测试台（B 自建，位于 `coordination/dashboard-workflow-review/real-board/`）

- `board.mjs` 2874 `cf4839bfb3f027b940791547a4a2bac43c6d3458c220e2bce80185aec97a957c`：spawn `../selftest/center.mjs` 起隔离中心（临时 `AGENT_AUTOLOOP_HOME`、回环随机端口、mint 五把钥匙），再 spawn launcher 起受审面板
- `launcher.mjs` 859 `b1c72d7de5a2b4c3917e9a8b0c8dd412a9b28a40fadbc4cc6158c480626cb139`：动态 import 受审包 `server.mjs` 的 `createDashboard({owner, hubUrl})`，`listen(0,'127.0.0.1')`
- `page-real.mjs` 9889 `595280022120913da80e49e2a68a77079c8d4495ef367dd1f721aefee3a6e6ef`：按真实 DOM 语义驱动（无 `data-*` 依赖，全部走可见文案/表单/按钮），并支持观察层突变用于负例
- `probe-snapshot.js.txt` 5499 `607fd5bfa76a412cc90e6b84f45cf53b4b004fd012c7c11a4ca869b97ca339ae`：页面内快照 IIFE（cards/runs/plan/items/dialog/links 解析）
- `suite-real.mjs` 35105 `7fdfe0293382de4d1cb85a1f90cd5f45cd2473c3e3953537fe062328cebac71a`：版本 `dashboard-real-suite-v2.1.0`，14 条判据，每例独立起中心+面板+浏览器
- `negatives-real.mjs` 2555 `d904c15a618ddbec5933ddbaccb328c62bd07be71f37676729ad3586ce78e55c`：15 对破坏-判据断言

驱动方式：零依赖 CDP（`selftest-v2/cdp.mjs`），Chromium 真浏览器、真实点击表单提交；断言同时查页面与中台 `/v1/state`、`/v1/runs/:id/why`。

## 判据落地要点（真实页面语义）

- T1 选择题/文字题都经页面表单提交，核对中台 `choice`/`answer` 与卡片「我的回答」行
- T2 notice 卡「查看并处理」→ resolve+原因；`result===reason`；fyi 卡 closed 且无可操作
- T3 后续轮由 worker 真领（`card:<id>`）并 finish done；运行结果与卡片结论分别呈现，卡片正文保留原问题
- T4 二次提交被拒（409 或 `changed===false`）；只结一次、只派一条后续轮、页面只渲染一次
- T5 取消必须经 `#run-detail` → `#action-dialog` 的 `form#cancel-form`；提交前无 stopping、提交后只记「等待停止确认」、执行端确认后才「已取消」
- T6 时间线按 `span.tag` 的「执行/事件/卡片/复查/规则 #id」与 `why()` 事实表逐条对账，伪造 id 必被抓（`fabricate-fact` 负例证明）
- T7 62 条历史撑过一页 → `#older-page` 真换内容且不重叠；计划面含中心定时规则、外部计划、等待重试
- T8 只查卡片自身操作（open ask 有、fyi 历史卡无），不拿页面任意 disabled 按钮充数
- T9 `/api/state` 失败+离线 → stale 提示 + 重试；过期点操作被拒且**不发任何写入请求**；恢复后可操作
- T10 五视图文本、`<a>` 目标、以及页面内 `/api/state` 投影都不出现钥匙或能力链接
- T11/T12 排队立即取消 vs 执行中必须等执行端确认，文案与状态机一致
- T13 done/cancelled 终态 `#run-detail` 无 `[data-stop-run]`
- T14 空 lane 同规则只留一条续接轮（why 的 `run_events` 覆盖两个事件）、recheck 跨规则不阻塞、parallel 两条泳道各自领活、items 按泳道分组

## 负例自测（判据不是摆设）

15 对全部 CAUGHT：drop-answer→T1、drop-reason→T2、strip-summary→T3、dup-card→T4、no-form→T5、fabricate-fact→T6、drop-plan 与 same-page→T7、force-actionable→T8、stale-off→T9、leak-key→T10、strip-cancel→T11、strip-cancel→T12、fake-stop→T13、drop-items→T14。MISSED 为空，进程 exit 0。

## 证据文件

- 正向：`evidence/suite-real-canonical-2026-11-06T13-47-23-542Z/suite-real-result.json` 13809 `ae6dc4e84b9223bcbf45e8eadb1ea64492afa4cd072d48d5eee4477189d84a04`
- 负例：`evidence/negatives-real-2026-11-06T13-46-51-013Z/negatives-real-result.json` 3875 `488c5c3f247ef24f7da3494fc30b613070170e75f7440fd686e7d7913f1f7aec`
- 每例独立证据目录 `evidence/real-canonical-<T>-<stamp>/`（页面快照 JSON + 截图）

## 未验项

1. 真实生产中心（3350）联调未做——本报告全部在隔离中心完成，生产未动
2. 包内 `browser-qa.mjs` 11/11 未由 B 复跑（结论仅引用 A）
3. 生产 `/c/`、真实 worker 的取消确认时序未在真实链路上复验

环境：Windows 11 26200 / node v24.12.0 / 浏览器 Chromium（CDP）。
