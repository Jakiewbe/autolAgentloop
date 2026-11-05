# B 节点交付区（T3 部署前置盘点）

> 本目录属于 **B**（主机 Magicbook14-zz，账户 chs）。A 的内容在仓库 `main` 分支；B 的内容全部放在 `b` 分支的 `B/` 目录下。合并时两边不会互相覆盖。

| 字段 | 值 |
|---|---|
| 来源机器别名 | B（Magicbook14-zz / MAGICBOOK14-ZZ / chs） |
| 对应任务 | DSH_DEPLOYMENT_TASKBOOK.md T3（B 的环境、账户通道和项目盘点），并为 T11 提供输入 |
| 采集时间窗 | 2026-11-04T17:36:00+08:00 ~ 2026-11-04T21:53:00+08:00（Asia/Shanghai），收官时间见 `manifest.json` 的 `collected_at_end` |
| 分支 | `b`（单提交，从 A 的 `main` 最新提交拉出，只新增 `B/`） |
| 原始证据根（B 本机） | D:\AutoAgentloop\evidence\preflight\ |
| 文件数 / 体积 | 51 个文件（含 17 份 raw 原件 + A 脚本两次实跑产物） |

## 内容

```text
B/
├── README.md                            # 本文件
├── .gitattributes                       # * -text：禁止行尾规范化，保证证据逐字节保真
└── evidence/preflight/
    ├── B.md                             # T3 报告正文（309 行；[实测]/[文件确认]/[未验证] 三级标注）
    ├── manifest.json                    # 材料哈希 + 15 个复验场景 + 阻塞项 + 采集脚本运行记录
    ├── b-preflight.json                 # B 机事实快照，便于程序化对比 A
    ├── verify-on-B.sh                   # 自证脚本（env 模式已在 B 上 PASS，full 模式为三次真实模型调用）
    ├── raw/                             # 17 份原始日志/脚本/补丁，未改动的原件
    ├── verify-runs/                     # verify-on-B.sh full 模式的实测日志（失败态 + 通过态）
    └── a-kit/                           # A 的采集脚本 + B 本机两次真实运行产物
        ├── collect_b.ps1                # 从 origin/main 原样取出（18363 字节，一字未改）
        ├── B_bootstrap.md               # A 侧的接收要求
        ├── B_expected.md                # A 侧期望 B 回答的问题清单
        ├── run/                         # 第 1 次运行（未给 -ProjectRoots）
        └── run2/                        # 第 2 次运行（给 B 的真实根）
```

## 与 A 的区分规则

- **分支隔离**：`main` = A 的内容；`b` = B 的内容。B 没有向 `main` 提交过任何东西，也没有改动 `main` 的指针。
- **目录隔离**：B 的全部文件都在 `B/` 前缀下；A 的路径不带这个前缀。`git diff --name-only origin/main origin/b` 的结果全部落在 `B/` 下。
- **身份区分**：B 的提交作者是 `B Magicbook14-zz <b@magicbook14-zz.local>`；A 的提交作者是 `chs <chs@localhost>`（仓库最早一次 Initial commit 是 `Jakiec <chenobc@foxmail.com>`）。
- **去重键**：跨机对账用「场景编号 + 任务号」（如 `T3-S5`、`T11`），不使用时间戳，也不依赖提交哈希。

## 快速核对

1. 报告每条结论都带日志文件名与耗时/退出码，日志在 `evidence/preflight/raw/`；
2. 材料哈希在 `manifest.json` 的 `materials` 字段，逐个跑 `git cat-file blob origin/b:<path> | sha256sum` 与清单比对，应全等；
3. 在 B 上复验：`bash evidence/preflight/verify-on-B.sh env`（应输出 `== 结果: PASS ==`）；`full` 模式追加三次真实模型调用，用 `-m deepseek-v4.1-flash-1017` 避开 B 上已冷却的默认模型；
4. A 的采集脚本要复跑：`powershell -Command "& '.\collect_b.ps1' -ProjectRoots 'D:\Hactk','D:\Virtuals'"`，`-File` 模式传数组参数会报 `PositionalParameterNotFound`。

## 边界

B 未创建调度中心、未启动第二个 DSH 服务端、未接管 A 的数据库、未复制 A 的登录文件、未修改 A 的 `.agent` 账本；raw 日志保留原样，脚本自带 `oc_s<RED>` 脱敏，未含任何密钥值。T11 仍未开始：等 A 给出同版本部署包与连接参数。

## 第二轮（2026-11-04T23:45+08:00）：执行端部署 T11 · 第一轮盘点与阻塞

这一轮做的是「B 端执行端部署」的前置盘点与受阻记录，内容在：

| 路径 | 说明 |
| --- | --- |
| `B/evidence/deployment/B.md` | 部署报告 13 节：环境、Windows 原生核验、审核包核验、连接前提、模型实测、6 项联调状态、安装流程与守卫自测、边界、Codex 复验方法、材料哈希、未验证项 |
| `B/evidence/deploy-b/B-install-state.json` | 脱敏状态机：`phase=blocked_before_install`、8 项检查、4 项待 A 输入、6 项跨机联调、边界事实 |
| `B/evidence/deploy-b/install-b-when-ready.ps1` | 就绪后一键安装脚本（缺项即停，不删不绕，不打印 key） |
| `B/evidence/deploy-b/collect-b-deploy.ps1` | 只读事实采集脚本，可复跑 |
| `B/evidence/deploy-b/*.log` `*.txt` | B 机原始日志（模型调用、Windows 原生 CLI、环境事实），GBK 原件与 UTF-8 副本并存 |
| `B/reviews/` | 每轮给 Codex 的独立审核 prompt（版本化保存） |

结论口径：通过 3 项（Node 24 + Windows 原生 CLI、worker 写入路径与覆盖保护、模型真实调用 2/2）、未通过 1 项（`B-reviewed-delivery.zip` 与 `install-b.mjs` / `verify-b.ps1` 在 B 与远端均不存在）、未验证 8 项（连接前提 3 + 跨机联调 6）。

这一轮同样没有建第二中心、没有复用 A 的管理员身份、没有复制 A 的配置、没有开公网端口、没有动真实 HOME。

## 第三轮（2026-11-05T10:10+08:00）：审核包已到、中心可达、模型判分通过，仍卡在一把 key

这一轮把「能不能装」推进到只剩一个输入。要点：

| 事项 | 结论 |
| --- | --- |
| 审核包 B-reviewed-delivery.zip | 已收到并逐字节校验：414436 字节、sha256 e0b4fb5b…94d853，与要求一致；包内 6 项 artifact 与 delivery.json 全等 |
| 中心地址 | A 的 ngrok 隧道 https://obconic-subtetanic-tamika.ngrok-free.dev，09:41 失败（curl 56）、09:53:59 /healthz 200 且无键 /v1/work 401；隧道会抖动，A 换地址需重新通知 |
| 模型通道 | claude 与 codex 原生退出码均 0、包内 agent_result.mjs 判分 passed、各有会话号 |
| 包内 verify-b.ps1 | 在 Windows 上必然失败（stderr 触发 Stop、codex 等 stdin、沙箱 taskkill 继承句柄污染 JSONL），属包缺陷，需 A 修 |
| 安装 | 未执行。唯一硬阻塞是 A 为 B 单独签发的 worker 身份文件未送到 B |
| 未验证 | 3 项输入 + 6 项跨机联调 = 9 项 |

新增/更新的文件：

| 路径 | 说明 |
| --- | --- |
| `B/evidence/deployment/B.md` | 第三轮部署报告，18 节；含审核包校验表、搜索分布、中心探测、模型三条目、22 例守卫自测、回执契约、9 项未验证口径、Codex 复验指引 |
| `B/evidence/deploy-b/install-b-when-ready.ps1` | 守卫 v4（13 步，先验后装 + 装后复查，22 例自测全过） |
| `B/evidence/deploy-b/collect-b-deploy.ps1` | 采集器 v6（三根四模式、命中分 FIXTURE/RECEIVED/CLONE/real、错误全列） |
| `B/evidence/deploy-b/B-install-state.json` | 状态机 schema 3（含 22 例、三条模型探测、8 条审核意见对照，不含自身哈希） |
| `B/evidence/deploy-b/guard-selftest-v4.json` | 22 例自测结果（cases_ok=22, cases_bad=0） |
| `B/evidence/deploy-b/verify-b-pkg/` | verify-b.ps1 失败日志 + 等价 Node 实现（filtered）与其判分日志 |
| `B/evidence/deploy-b/MATERIALS.sha256` | 全量材料哈希（318 项，严格 sha256sum 格式，B 本机可 -c 校验） |
| `B/MATERIALS.repo.sha256` | 仓库内 `B/` 子集的哈希清单（任何 clone 都能自我校验） |
| `B/reviews/2026-11-05-t11-round3.md` | 第三轮 Codex 审核 prompt（固定提交、证据位置、判定标准） |

复验命令见 `B/evidence/deployment/B.md` §17；不可当作通过的事项（缺 key、隧道漂移、只验守卫与模型）在 §17 末段单独列出。

## 第四轮（2026-11-05T10:30+08:00）：独立复核通过、门禁序列固定、等 key

这一轮不做功能改动，只做三件事：用**重新克隆**的方式自证（不复用本地工作副本）、把 Codex/模型实测结果回传、把安装与联调的先后门禁写死。

| 事项 | 结果 |
| --- | --- |
| 独立复核 | `_probe/recheck-b.sh` 从 GitHub 重克隆 → HEAD `d536485`、父 `d71f32e`、main `d07b412`；差异 118 个且全为 `A`、`B/` 之外 0 个；main 无 B 的提交；仓库清单 117/117 OK；密钥扫描 0 命中；key/config 类文件 0 个 |
| Codex 路径与版本 | `C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe` = codex-cli 0.130.0-alpha.5（主用）；`C:\Users\19082\.codex\.sandbox-bin\codex.exe` = 0.164.0-alpha.11.1（非 PATH） |
| claude | `C:\Users\19082\.local\bin\claude.exe` = 2.1.310 |
| 模型复测 | codex 原生 0 / passed / session `01a1a983…db70`；claude 第 1 次原生 1（我方脚本漏 `--settings`，原文留档），补参后原生 0 / passed / session `e1bd4c0c…b5eb` |
| 身份文件 | 仍未到达；落点与回传协议已就位（只回传路径/字节/哈希，不回传内容） |
| 门禁 | key 到位 → 独立复核通过 → 真实安装 + 合规回执 → A 给联调许可 → 六项联调；取消测试与断线重启测试在同一执行端**依次**进行，不并行 |

新增文件：`evidence/deploy-b/report-key-file.ps1`（只输出元数据，文件缺失 exit 2）、`evidence/deploy-b/key-receipt-protocol.md`、`evidence/deploy-b/recheck-20261105T102109.log`、`evidence/deploy-b/verify-b-pkg/recheck-*`、报告 §18。
