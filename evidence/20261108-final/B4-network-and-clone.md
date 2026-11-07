# B4 推送闭环（新 clone b-final-20261107 → sha256sum -c 57/57）

证据目录：evidence/20261108-final/b4/

## 1. 结果

| 项 | 值 |
| --- | --- |
| clone 尝试次数 | **1**（首次即成功） |
| 耗时 | **3 s**（19:39:10Z → 19:39:13Z） |
| 目标 | `https://github.com/Jakiewbe/autolAgentloop.git`，`--branch b-final-20261107` |
| HEAD | `b12ec1ceeb110de2b7c710e0fb12b08ab5158d42`（= b12ec1c，与 A 侧记录一致） |
| 当前分支 | b-final-20261107 |
| `sha256sum -c 20261107-final/INDEX.sha256` | **rc=0，57 行全 OK，0 行失败** |
| INDEX 行数 | 57 |
| 只推自己的私库分支 | 是（未碰 KKKKhazix 上游，未改 origin，未重写历史） |

证据：b4/03-clone-via-proxy.txt（全过程）、b4/02-verify.txt（57 行校验输出，末尾 `...snap.ps1: OK`）。

## 2. 先说网络这一关（不许美化）

**直连 github.com 是断的。** 首次尝试（b4/01-clone.txt，19:31:45Z–19:33:23Z）4 次全失败，原文：

```
fatal: unable to access 'https://github.com/Jakiewbe/autolAgentloop.git/': Recv failure: Connection was reset
fatal: unable to access '...': Failed to connect to github.com:443 after 21076 ms: Could not connect to server
error: RPC failed; curl 28 ... (19:31Z–19:33Z)
```

诊断（19:37Z）：

| 探测 | 结果 |
| --- | --- |
| `nslookup github.com` | 20.205.243.166（DNS 114.114.114.114） |
| `curl https://github.com/` | **超时 20 s（000）** |
| `curl --resolve github.com:443:140.82.121.3` | **200**（2.36 s） |
| `curl --resolve github.com:443:20.27.177.113` | **200**（0.89 s，TLS 0.22 s） |
| `curl --resolve github.com:443:20.205.243.166` | 超时（就是 DNS 给的那个） |
| `curl https://api.github.com/` | 200（0.24 s） |
| `curl https://codeload.github.com/` | 301（0.47 s） |
| `curl https://obconic-subtetanic-tamika.ngrok-free.dev/` | 404（0.62 s，中台可达） |
| `git credential fill` | username=Jakiewbe，password 已存在（Windows 凭据管理器） |
| 代理环境变量 / git http.proxy | 都没有 |
| 是否管理员 | 否（`net session` 失败）→ 不能改 hosts |

结论：**不是 GitHub 挂了，是本机 DNS 解析到的那个 IP（20.205.243.166）的 443 被掐**；同一域名换 IP 立刻 200。凭据本来就有，卡点纯粹在 TCP 落地。

## 3. 处理方式（可复现、可回滚、不动系统）

不能改 hosts（非管理员），也不装全局代理，只在**本机进程内**做 TCP 落地：

- `b4/ip-proxy.js`：一个只监听 `127.0.0.1:18080` 的 HTTP CONNECT 隧道代理，把发往 `github.com:443`（以及 codeload / objects.githubusercontent / api.github.com）的连接钉到可用 IP 列表 `20.27.177.113,140.82.121.3,140.82.112.3`，逐个失败就换下一个。
- git 侧只用一次性参数：`git -c http.proxy=http://127.0.0.1:18080 -c https.proxy=http://127.0.0.1:18080 clone ...`。**没有写任何全局 git 配置**，TLS/SNI/Host 仍是 github.com，证书校验照常通过。

启动：

```bash
cd /d/AutoAgentloop/evidence/20261108-final/b4 && node ip-proxy.js &   # 监听 127.0.0.1:18080
curl -sS -x http://127.0.0.1:18080 -o /dev/null -w "%{http_code}\n" https://github.com/   # 200
```

clone + 校验脚本：`b4/run-b4-proxy.sh`（最多 8 次重试，成功即自动 `sha256sum -c` 并落 b4/02-verify.txt）。

## 4. 关掉代理

```bash
pkill -f "node ip-proxy.js"     # 或 taskkill /F /IM node.exe 前先确认 pid
```

关掉后本机网络状态与 B4 之前一致（没有任何持久化改动：hosts 未改、git 全局配置未改、环境变量未改）。

## 5. 未验 / 待 A 侧确认

- 本轮 clone 走的是代理，**不是直连**。如果 A 侧要求「直连成功」才算闭环，这条不成立，需要等 20.205.243.166 这条路恢复。
- 3 s 的 clone 耗时只反映小仓库 + 本地代理，不代表正常网络下的耗时。
