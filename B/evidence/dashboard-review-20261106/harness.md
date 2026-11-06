# notes/harness.md — dashboard 验收测试台：复现步骤与坑

## 1. 起测试台（三步）

```bash
cd D:/AutoAgentloop/coordination/dashboard-workflow-review/selftest
# 1) 隔离假中心：临时 AGENT_AUTOLOOP_HOME + 回环随机端口，打印 CENTER_READY {port,publicUrl,home,keys}
node center.mjs > ../evidence/center-run.log 2>&1 &
#    日志里取 CENTER_READY 那行 JSON 存成 ../evidence/center-canonical.json
# 2) 参照实现（同源代理，服务端持 owner 钥匙），只打 /api/*
node standin/server.mjs ../evidence/center-canonical.json 8792 > ../evidence/standin.log 2>&1 &
# 3) 跑十类用例（真实 Chromium + CDP）
node suite.mjs http://127.0.0.1:8792/ ../evidence/center-canonical.json ../evidence/suite-run
#    单跑：--only=T3,T7
```

产物：`suite-result.json`（每个用例 status/detail/extra）+ `T1..T10.png`。退出码非 0 只代表套件异常，不代表用例失败；判据看 JSON。

## 2. 必须知道的坑

1. **Windows 上必须用 `pathToFileURL` 动态 import `app/host/runtime.ts` 与 `http.ts`**，直接字符串 import 在 win32 路径下会解析失败。
2. **临时 home 必须隔离**：`AGENT_AUTOLOOP_HOME` 指到 `%TEMP%\dashboard-review-center-*\home`，否则会写到真实 home 的库。
3. **随机端口 + 回环**：不要固定端口连跑多轮，上一轮残留的中心会让 `/v1/state` 数据串味（本轮清理了 4 个残留中心进程）。
4. **领活泳道占死**：`/v1/work` 的 claim 会因同 grp+lane 的 claimed run 返回 null（`app/kernel/decide.ts:236`）；答复又会派发新 run，必须显式收尾。
5. **ask 收据校验**：options 必须 2~5 个，否则 400；只给 1 个会静默失败。
6. **answer 只第一次算数**：重复提交 200 但不改判 —— 这是 T4 判据，不是 bug。
7. **取消要等执行端确认**：只有 `finish` outcome=`"cancelled"` 才真正置 cancelled（`decide.ts:360`），前端只能显示"等待确认"。
8. **中台无 CORS**：浏览器不能直连，必须同源代理；`grep -r "access-control" app/` = 0。
9. **断网/失败注入**：`Network.setBlockedURLs` 会把 `requestWillBeSent` 一起吞掉（计数恒 0）→ 断线用 `Network.emulateNetworkConditions offline`，统计重试次数用 `Fetch.enable + Fetch.failRequest`。Fetch 回调里 `sessionId` 取自 `base.sessionId`，`ws` 必须从 `launch()` 暴露出来。
10. **区域定位**：`clickText(label,{within})` 与 `hasActionableInside(text)` 要两套评分 —— 点击取"区域内可操作元素最多、文本最短"，只读判定取"最紧凑"（否则祖先容器里其他卡片的按钮会污染结论）。原来取"最后一个匹配元素"会落到时间线 `<li>`，导致 T5 假 UNVERIFIED。
11. **Chromium 自我重启**：`spawn` 父进程 exitCode≠0 不能判失败，轮询 `DevToolsActivePort` 拿端口。
12. **认活核对归属**：`job.context.events[].id` 必须包含本次事件 id，否则会劫持别人的后续 run 并卡成 claimed。

## 3. 打 A 的真实 dashboard 前

- 先核对整包 + 成员 + before 哈希，不匹配不强覆盖（解压到 `extract/`）。
- 真实 dashboard 若走 SSE（`/v1/stream`），本套件的"goto + 轮询"仍可用于断言中心状态，但页面刷新语义要单独看。
- T3/T7 必须在真实页面上重跑：T3 找独立的"已回答"与"运行结果"区块；T7 先注入足量历史让 `nextBefore` 非 null，再验外部计划与延后任务。
