# 本地审核包 dashboard-review-package-20261106

用途：把本轮看板验收用到的**测试台依赖 + 受审面板 + 隔离中心内核**打成一份可独立转交的目录，换台机器（或换目录）只靠本目录即可复跑，不依赖原作者工作区的隐藏文件。
本包**不含**：任何密钥、能力链接（/c/ token）、中心配置、登录材料、运行日志、截图、生产 HOME。

## 组成

| 目录 | 内容 | 来源 |
|---|---|---|
| real-board/ | 测试台：board.mjs(起隔离中心+受审面板)、launcher.mjs(原样挂载受审 server.mjs)、page-real.mjs(真实页面驱动)、suite-real.mjs(14 条正向)、negatives-real.mjs(15 条负例)、supplement.mjs(时序A/B、宽度、/c/ 面板侧)、centry-real.mjs(旧版真实内核 /c/ 探针，依赖外部 home)、q4-centry.mjs + kernel-host.mjs(Q4 自包含 /c/ 头与有效期探针)、q4-texts.mjs(Q4 三处文案 + 心跳折叠 + 现场 unknown)、q4-fold-unit.mjs(折叠判据模块级核对)、build-lock.mjs(受审构建字节锁：5 个 served 文件 + 按 SUBJECT.json 断言源 ZIP 身份；给 REVIEW_ZIP 时再核真实字节)、write-guard.mjs + t9-guard-unit.mjs(T9「被拒时不发写入请求」的分母判据：空录制不再空真通过)、q3-viewports.mjs(Q3 两档真实视口 + DPR + 逐档独立截图)、q5-order.mjs(Q5 两处取消时序的请求顺序账本：注入落在第几次读、该次结果、写次数与分母)、probe-snapshot.js.txt(页面内探针) | B 本机编写，哈希见 MANIFEST.json |
| selftest/center.mjs | 隔离假中心：临时 AGENT_AUTOLOOP_HOME + 回环随机端口 + 只读复制 fixture 规则；密钥在运行时由 runtime.addKey 现生成，不落盘 | B 本机编写 |
| selftest-v2/ | cdp.mjs(零依赖 CDP 驱动，含 requests 快照修复)、lib2.mjs(中心 API 客户端)、rules-v2.json(测试 fixture 规则，无凭据) | B 本机编写 |
| extract-v2-c66a3c64/dashboard/ | **受审对象**：A 的 dashboard-item-key-cancel-v2 包解出的面板源码，一个字节未改 | ZIP sha256 c66a3c64db5f1a5c2270d0cf1130a5ac764d2dcee7eaffefd0d1808d0309a525（58408B，15 成员） |
| app/ | 隔离中心内核（被 center.mjs 以 REVIEW_APP_DIR 指向），来自 main 提交 9fabbe9ae096418ea3e809be45518950af690b04 的 app/ 子树，git archive 导出，无 .git、无 node_modules | 上游 main 9fabbe9 |

## 运行前置

- Node.js 24 或更新（内核 TS 直接运行，无需 npm install；app/ 无 runtime 依赖）
- 本机 Chrome 或 Edge（cdp.mjs 从 Program Files 的固定路径探测，零依赖，不装 puppeteer）
- 不需要网络：中心是 127.0.0.1 随机端口的隔离实例

## 最短启动

```bash
cd dashboard-review-package-20261106
node verify-deps.mjs        # 依赖与哈希自检，应输出 DEPS ... bad=0
node real-board/build-lock.mjs  # 受审构建字节锁，应输出 BUILD_LOCK {ok:true,provenance:{ok:true,members:15}} 且退出码 0（./run.sh 会自动先跑一次）
./run.sh guard              # T9 分母判据的 4 条单元正负例（秒级，空录制必须 false）
REVIEW_ZIP=/path/to/dashboard-item-key-cancel-v2.zip node real-board/build-lock.mjs  # 逐项核对真实 ZIP 的全部 15 个成员（路径/字节数/哈希）+ ZIP 本体身份
node real-board/build-lock-directed.mjs  # 定向自检 5 项：默认登记模式、真实 ZIP 模式、65 位哈希、64 位改一位、指定不存在的 ZIP
./run.sh                    # 全部 14 条正向用例（约 3-5 分钟）
./run.sh T8 T9              # 只跑指定用例
./run.sh negatives          # 15 条负例
./run.sh supplement         # 补充用例（时序A/B、宽度、/c/ 面板侧）
./run.sh q3                 # Q3：1440x900 / 390x844 两档视口的 innerWidth、scrollWidth、横向滚动、DPR、独立截图
./run.sh q5-hold            # Q5：时序A（刷新未返回时提交）的 /api/* 顺序账本与分母
./run.sh q5-history         # Q5：时序B（历史页提交、最新读取失败、回落读取成功）的顺序账本与分母
node real-board/q4-centry.mjs   # Q4：真实内核 /c/ 的 CSP 与安全头（自建临时 HOME，跑完可删 incoming/q4-home）
node real-board/q4-fold-unit.mjs # Q4：心跳折叠判据（合成输入，秒级）
node real-board/q4-texts.mjs    # Q4：三处文案 + 心跳折叠 + 现场 unknown（约 7 分钟，含真实 5 分钟租约等待）
node real-board/q4-expiry.mjs   # Q4：/c/ 合法访问、无效访问、303 回跳、CSP、7 天过期（可控时钟，秒级）
```

产物写到 ./evidence/（脚本自带 mkdir），每例一个 real-<label>-<T#>-<stamp>/ 目录，含 record 与 screen.png，汇总在 suite-real-<label>-<stamp>/suite-real-result.json。

## 环境变量（run.sh 已设好，手工跑时需要）

- REVIEW_APP_DIR=<包>/app
- REVIEW_EXTRACT=<包>/extract-v2-c66a3c64
- REVIEW_RULES=<包>/selftest-v2/rules-v2.json
- SUITE_LABEL=pkgcheck

## 已知边界

- 受审面板不提供 /c/ 路由（真实 /c/ 语义在内核，见 centry-real.mjs，需另起内核实例与隔离 home，不属本包默认用例）。
- rules 里 channels.*.links 打开时内核才挂 /c/；本包 rules-v2.json 是 fixture，改它等于改测试前提。
- 一次运行会起真实 Chrome 无头实例，结束自动关；不需要用户桌面会话。
- q4-centry.mjs 在**系统临时目录**自建临时 HOME（fixture rules.json + 内核自建库与 master.key），跑完即自动删；本包不携带任何 HOME、密钥或 /c/ token。需要保留现场时用 `REVIEW_Q4_HOME=<path>` 指定（指定后不再自动清理）。
- q4-texts.mjs 的 unknown 段落靠真实租约（RUN_LEASE=5 分钟）现场生成，期间只发心跳保活、不改时钟、不改数据库，因此整轮约 7 分钟。
- centry-real.mjs 是早期版本，需要外部预置的 home（`incoming/center-home-link`）；只作历史对照，新环境请用 q4-centry.mjs。
- **行尾口径**：本包 `app/` 是从 Windows 工作区导出的 CRLF 副本（例如 `app/host/server.ts` 4564B `0e87488f…`），仓库 blob 是 LF（4422B `5e988129…`）。跨机比对请先 LF 归一（`\r\n`→`\n`）再比 sha256，两边同时给原始与归一后的字节数/哈希。
- **受审 ZIP 身份**：登记在包根 `SUBJECT.json`（58408B `c66a3c64…` + 15 个成员逐个哈希，全部 64 位小写十六进制，由 build-lock 强制校验）。
- **build-lock 两种模式与退出码**：不给 `REVIEW_ZIP` 时走 `provenance-only`，输出里明确写「仅核来源登记，未核实际ZIP」；给了 `REVIEW_ZIP` 时走 `actual`，逐项核 15 个成员的路径/字节数/哈希并核 ZIP 本体。退出码 0=通过，1=不匹配（含 64 位但改一位、65 位这类登记错误），2=用法/输入错误（`REVIEW_ZIP` 指定了但不存在的文件、SUBJECT 缺失）。**`REVIEW_ZIP` 指向不存在的文件绝不降级为只核登记**。
- `q4-centry.mjs` 的两条过期分支保留为**仅源码断言**（`ok:null, sourceOnly:true`），不计入通过数；过期的运行证据改由 `q4-expiry.mjs` 提供（它直接构造内核 Services 的 `now()`，不动系统时间与数据库）。