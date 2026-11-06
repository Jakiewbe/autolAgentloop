# dashboard 独立工作流验收 v2（B 侧）

- 受审包：`deploy/coordination/dashboard-fix-20261106/dashboard-item-key-cancel-v2.zip`，main 提交 `9fabbe9ae096418ea3e809be45518950af690b04`
- 包字节 58408，SHA256 `c66a3c64db5f1a5c2270d0cf1130a5ac764d2dcee7eaffefd0d1808d0309a525`
- 成员核对：`PATCH.json` 13/13 bytes+sha256 一致（解包后二次复算仍 13/13）
- 受审前端字节未被修改：`public/app.js` `fc7c6ba3947d956fe05b65af2423ab30259bdfdc5dd8855c480c7b7ff0ed2926`、`public/workflow.mjs` `11babc0eacbc109f46c891a44941b1a58de52fa97dc2fabd0cdf2b532db8af4a`

## 结果

- 真实面板判据 T1–T14：**14 PASS / 0 FAIL / 0 UNVERIFIED / 0 SKIP**（进程 exit 0）
- 判据负例自测：**15/15 CAUGHT，MISSED 0**（进程 exit 0）
- 包内 `node --test`（B 本地复跑）：34 pass / 0 fail
- 未验：生产中心 3350 联调、包内 `browser-qa.mjs` 11/11（A 自报）、真实链路 `/c/` 与取消确认时序

## 内容

| 路径 | 说明 |
| --- | --- |
| `B-review-v2.md` | 完整验收报告（6009B `1c847a7ecc359ed89d2bc709f4e052198f5f584d738136ca2ee876238e7487eb`） |
| `B-review-v2.json` | 机器可读结论（受审物/测试台/结果哈希/未验项） |
| `harness/` | 自建测试台：隔离中心 + 受审面板 launcher + CDP 页面适配器 + 14 条判据 + 15 条负例 |
| `evidence/suite-real-canonical-2026-11-06T13-47-23-542Z/suite-real-result.json` | 正向逐条 checks（`ae6dc4e84b9223bcbf45e8eadb1ea64492afa4cd072d48d5eee4477189d84a04`） |
| `evidence/negatives-real-2026-11-06T13-46-51-013Z/negatives-real-result.json` | 负例 15 对断言（`488c5c3f247ef24f7da3494fc30b613070170e75f7440fd686e7d7913f1f7aec`） |
| `evidence/screens/T1..T14.png` | 每例独立浏览器实测截图 |

## 测试台版本

`dashboard-real-suite-v2.1.0`（`harness/suite-real.mjs` `7fdfe0293382de4d1cb85a1f90cd5f45cd2473c3e3953537fe062328cebac71a`）

驱动方式：零依赖 CDP + Chromium 真浏览器，全部按真实 DOM 语义操作（可见文案/表单/按钮），不依赖任何 `data-*` 测试属性；断言同时核对页面与隔离中心的 `/v1/state`、`/v1/runs/:id/why`。

## 脱敏与边界

- 未包含：隔离中心 mint 的五把钥匙、`~/.agent-autoloop` 配置、owner/source 凭据、中心日志、主机名/用户名、本机绝对路径（`workDir` 已改写为相对路径）
- 生产环境未改动：未碰生产中心 3350/3351、未重启 worker、未改权限/身份/MCP/登录项、未派发真实模型
- 全部结论来自隔离中心（临时 `AGENT_AUTOLOOP_HOME` + 回环随机端口）

## 复现

```bash
# 1) 解包到新目录并核对 PATCH.json
# 2) 指向解包目录
REVIEW_EXTRACT=/abs/path/to/extract-v2 node harness/suite-real.mjs       # 正向
REVIEW_EXTRACT=/abs/path/to/extract-v2 node harness/negatives-real.mjs   # 负例
```

（`harness/` 原样引用 `coordination/dashboard-workflow-review/selftest-v2/{center.mjs,cdp.mjs,lib2.mjs,rules-v2.json}`，这些是中台侧支撑件，未随本目录发布。）
