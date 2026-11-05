# 给 B 的一页纸：环境盘点怎么做（只读，5 分钟）

你在做的是 DSH 双机部署任务书里的 T3：把 B 这台机器的真实环境采集回来，交给 A 侧做跨机方案。**不要照抄 A 的路径和结论**。

## 只需要 3 步

1. 把 `collect_b.ps1` 存到本机任意目录，例如桌面。
2. 打开**普通** PowerShell 窗口（不用管理员），执行：

   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Desktop\collect_b.ps1" -Alias B
   ```

3. 把结尾打印的 `B-bundle-*.zip` 和 `B-bundle-*.zip.sha256` 两个文件发回 A（U 盘 / 共享目录 / 远程桌面拖过去都行），并把结尾那行 sha256 一起发给 A 核对。

## 它采集什么（都只读）

- 系统：OS build、CPU/内存/磁盘、时区、代码页、长路径开关、是否管理员
- 工具链：node/npm/pnpm/git/python/pwsh/codex/opencode/claude/dsh 的路径与版本、PATH、PATHEXT
- Agent：同目录下其它版本二进制（codex 曾出现两个版本行为不同）、`~/.codex`/`~/.claude`/`~/.opencode`/`~/.dsh`/`~/.agent-autoloop` 的**文件名与大小**
- 凭据：**只记录文件是否存在、大小、修改时间**，不读内容；环境变量只记名字和长度
- 网络：网卡、默认路由、DNS、VPN/隧道软件（Tailscale/ZeroTier/WireGuard/clash/cpolar/向日葵/ToDesk/GameViewer/ngrok）、非 loopback 监听端口、出口 IP、防火墙配置
- 常驻能力：用户 Startup 目录、Run 键、含 agent/dsh/autoloop 关键字的计划任务、自建服务
- 项目：`<盘>:\Vibe_coding-Project` 等候选根目录下一层每个项目的 git HEAD/分支/脏文件数、是否有 `.agent` 账本、文件数与体积
- 兼容探针：在临时目录建「中文 + 空格」路径、跑一个 `.cmd` 和一个 `.ps1`、建一条 >260 字符的长路径，跑完删除

## 它不做什么

不改注册表、不装服务、不改执行策略（只在本次进程内 `-ExecutionPolicy Bypass`）、不复制项目文件、不联网上传（只有一次 `ipinfo.io` 查出口 IP）、不打包任何 secrets。

## 你要额外回答 A 的 4 个问题（脚本采不到）

1. 这台机器上你实际在哪个目录、哪个账户下干活？和 A 的 `D:\Vibe_coding-Project\autoAgentloop` 相比结构差在哪？
2. 哪个项目在这台机器上是**唯一一份**（A 上没有）？首版不让两台机器同时写同一个项目。
3. 这台机器上 codex / opencode / claude / dsh 哪些能真正跑起来？跑一条最小命令把输出贴回来，别用「应该可以」。
4. 如果要让 Codex 以后在这台机器上独立复验，它能直接跑吗？还是只能给你日志？

## 卡住了怎么办

- 报「无法加载文件，未对文件进行数字签名」→ 用上面的命令（已带 `-ExecutionPolicy Bypass`），不要改全局策略。
- 报 ConstrainedLanguage → 换 `pwsh -NoProfile -File .\collect_b.ps1 -Alias B`。
- 报某个命令 Not Found（例如 `git`）→ 不用管，脚本会记成 `(absent)`，这本身就是 A 需要的信息。
