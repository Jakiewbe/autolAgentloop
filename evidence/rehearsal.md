# T12 演练与回退（A 机实测）

记录三次真实中断、两次真实恢复，以及恢复不了的部分。时间均为 Asia/Shanghai，机器 DESKTOP-LM7RKI1（A），中台 `127.0.0.1:3350`，接单程序 `desktop-lm7rki1`，`worker.capacity=1`。

原始日志：`evidence/raw/deploy/20261104-191000-rehearsal.log`（中断与恢复）、`evidence/raw/deploy/20261104-193000-rollback.log`（回退）。

## 1. 三次中断

| # | 开始 | 机器 | 触发事件 | 轮次 | 会话/进程 | 材料 | 动作 |
|---|---|---|---|---|---|---|---|
| 1 | 11-04 18:49:11 | A | `rehearsal.slow` / `rehearsal-2` | #3 | codex 0.166 子进程 | 规则版本 #157 | 18:49:32 强杀中台 |
| 2 | 11-04 18:52:27 | A | `rehearsal.cut` / `rehearsal-4` | #4 | codex 0.166 子进程 | — | 18:52:35 强杀中台 |
| 3 | 11-04 18:54:49 | A | `cuttest.slow` / `cuttest-2` | #5 | `cmd /c ping -n 40`（本机慢命令） | 规则版本 #207 | 18:55:00 强杀中台 |

第 3 次是**唯一一次干净的中途断电**：命令要跑约 39 秒，杀中台时还剩约 30 秒，子进程 `PING.EXE`（pid 40920）确实还活着。

前两次被 codex 账号额度打断（见 §4），不是断电造成的，但它们仍验证了「接单程序把跑完的结果带回中台」这条路径。

## 2. 第 3 次的完整时间线（`why 5`）

```
11-04 18:54:49  规则版本 #207
11-04 18:54:54  触发事件：来源 local · 类型 cuttest.slow · 对象 cuttest-2
11-04 18:54:54  desktop-lm7rki1 领取（慢测）
11-04 18:55:00  （中台被强杀，端口关闭，PING.EXE 仍存活）
11-04 18:55:08  重启 up：状态显示 在跑 1（接单程序从磁盘重新认领这一轮，继续盯着还活着的子进程）
11-04 18:55:34  结束：退出码 0
```

恢复后状态：`今天做完 3`，第 5 轮记为完成，**没有重复派发**（同一轮只有一条结束记录），子进程输出留在 `%USERPROFILE%\.agent-autoloop\worker\runs\5-1\`（`command-1.json`、`stdout-1.log`、`exit-1`=0）。

## 3. 恢复能力的边界（实测结论）

| 场景 | 结果 | 依据 |
|---|---|---|
| 中台进程被杀，子进程还在跑 | 重启后接单程序从 `worker/runs/*/entry.json` 认领回来，继续等子进程，结果照常回中台 | 第 3 次 |
| 中台死时一轮已经失败 | 失败原因随重启带回，进入退避重派（`not_before` = 失败 + 5 分钟） | 第 1、2 次（`why 3`/`why 4`） |
| 重试节奏 | 5 分钟起，翻倍，最多 60 分钟（`kernel/decide.ts:262`） | 第 1 次：18:49:32 → 重试时间 18:54:32 |
| 历史与卡片 | 重启后轮次、卡片、回答全在（Hub 状态在 `hub.db`，事实日志是权威） | 每次重启后 `status` 都还显示 #1、#2 与卡片答案 |
| 手工停止一轮 | `agent-autoloop stop 3` / `stop 4` 生效，记录为「停了」 | 第 1、2 次的收尾 |
| 中台进程与接单程序同进程 | `up` 一个进程里同时跑 hub + worker，杀它两个一起停；重启一起回来 | `host/up.ts:81-85` |

**没验证**：两台机器同时在线时一台断电（B 还没接入）；断电期间有人回答卡片（B 未接通道）。

## 4. 演练里撞到的真问题（都已留下原文）

1. **codex 账号额度耗尽**：`ERROR: You've hit your usage limit. Upgrade to Pro ... try again at 7:18 PM`（退出码 1）。这不是断电，但暴露了「额度是硬约束、未知费用」——T9 因此把轮数/时限当硬限，把费用记为未知。恢复时间按报错是 19:18，之后才谈 T13 的 Codex 独立验收。
2. **规则是累加的，从 `rules.json` 删掉规则不会让它在账本里失效**：`演练慢测`（`when.types=["rehearsal.*"]`）删掉后仍在接 `rehearsal.*` 的事件，把第 2、3 次演练都接走了。规避：换一个不重叠的类型（`cuttest.*`）。这是产品行为，不是我的脚本 bug，已作为限制记在 §6。
3. **规则写错时不会静默生效**：我写的 agent 编号 `慢测` 不合法、且少了 `worker` 字段，整份 `rules.json` 被拒，中台继续用旧规则，并推了一张卡「rules.json 写错了，还在用旧规则：Agent 的编号只能用小写字母和 -：慢测 / Agent 慢测 缺少 worker」。这是正确行为，也说明改规则必须跑 `agent-autoloop check`。
4. **规则热加载是靠文件监视**（`host/server.ts:97` + `host/runtime.ts:113` 按 mtime），修好字段后不重启也能生效（第 3 次演练就是这么跑起来的）。
5. **`cmd` 子进程的中文输出会乱码**：`ping & echo 慢测完成` 的 stdout 落盘是 GBK（`c2fd b2e2 cdea b3c9`），worker 按 UTF-8 读，时间线里显示成 `�������`。英文输出不受影响。用 `command` 适配器挂 Windows 原生命令时要避开中文输出，或先 `chcp 65001`。

## 5. 回退（详见 `evidence/rollback.md`）

已实测：把 `config.json` 换回改并发前的备份 → 重启 → 能起来、历史完整（3 轮、卡片答案都在）→ 再把 `capacity=1` 写回 → 重启 → 状态正常。整个过程没有丢数据，没有重复派发。

## 6. 现在这台机器上的状态（演练后）

- `rules.json`：`试一下`（`try.*` → `agent`）、`演练断电`（`cuttest.*` → `slowtest` 慢命令）；账本里还留着已从文件删除的 `演练慢测`（`rehearsal.*` → `agent`）。
- 轮次：#1、#2 试跑完成；#3、#4 因额度失败并停止；#5 断电演练完成。
- 未接规则的事件：`rehearsal.slow`、`cuttest.slow`（第一次那两条没规则接）、`anchor-bridge-test3 task.claimable`（T8 联调事件）。
- 三份演练现场的备份：`config.json.bak-20261104-190000`、`config.json.pre-rollback`、`evidence/raw/deploy/rules-before-rehearsal.json`。
