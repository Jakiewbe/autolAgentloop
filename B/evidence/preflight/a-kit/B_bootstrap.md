# B 机引导包（T3 交付：让 B 在本机真实采集并回传）

- 生成时间：2026-11-04 18:15 (+08:00)
- 生成者：A 侧 DSH（Lead）
- 目的：B 机上没有本仓库、也没有 DSH 会话时，仍能按任务书 T3 采集到「B 本机真实运行过」的盘点报告，并在 A 侧可核对来源与哈希。
- 状态：**引导包已完成并在 A 上自测通过；B 侧尚未执行**（A 目前没有任何到 B 的可达通道，见 `evidence/network.md` §1、`evidence/raw/preflight/20261104-181500-lan-probe.txt`）。

## 1 包内容

| 文件 | 作用 |
|---|---|
| `tools/b_preflight/collect_b.ps1` | B 侧只读采集脚本（约 19 KB，UTF-8 with BOM，PowerShell 5.1 兼容）。采集系统、工具链、Agent 入口与版本、凭据**存在性**、网络、自启动能力、项目盘点、中文/空格/长路径探针，生成 `B.md` 与 `raw/*.txt`，并打包成 zip + sha256 |
| `evidence/preflight/B_bootstrap.md` | 本文件：交付方式、执行步骤、回传通道、验收口径 |
| `evidence/preflight/B_expected.md`（随包发送） | B 侧一页式操作说明（可打印/粘贴给 B 上的人或 DSH） |

脚本只读、不改系统配置、不写注册表、不装服务、不复制项目数据；对 `token/secret/password/api_key/authtoken` 值、`sk-*`、`Bearer *` 做正则脱敏；凭据文件只记录「是否存在 / 大小 / 修改时间」。

## 2 B 侧执行步骤（3 条命令）

1. 把 `collect_b.ps1` 放到 B 任意可写目录（例如 `C:\Users\<user>\Desktop\collect_b.ps1`）。
2. 普通 PowerShell 窗口（**不需要管理员**）执行：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\<user>\Desktop\collect_b.ps1
   ```

   需要指定输出目录或别名时：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\collect_b.ps1 -OutDir D:\evidence_b -Alias B
   ```

3. 记录脚本末尾打印的三行：报告路径、打包路径、sha256；然后把 `B-bundle-*.zip` 与 `B-bundle-*.zip.sha256` 回传 A。

若 PowerShell ConstrainedLanguage 或执行策略拦截，改用：

```powershell
pwsh -NoProfile -File .\collect_b.ps1      # 若有 PowerShell 7
# 或
powershell -NoProfile -Command "& { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; .\collect_b.ps1 }"
```

## 3 回传通道（按可用性从上到下）

| 通道 | 操作 | 是否已验证 |
|---|---|---|
| 1. 手动文件搬运（U 盘 / 共享目录 / 远程桌面拖拽） | 把 zip + .sha256 放到 A 的 `D:\Vibe_coding-Project\autoAgentloop\evidence\raw\preflight\` | 通道本身无需验证；A 侧只校验文件名与哈希 |
| 2. 现有远程桌面（向日葵 16.5.0 / GameViewer，A 已安装） | 在会话里直接把文件拖到 A | 未验证（需要有人操作 A 的桌面） |
| 3. cpolar / Ngrok 隧道（A 已装：cpolar 3.3.18 服务运行中、ngrok 3.3.1） | A 起一个临时 HTTP 上传点（仅收文件、绑定 loopback + 隧道），B 用 curl 上传 | **未验证**：A 的 cpolar 现有两条隧道是 `website:8080` 与 `remoteDesktop:3389`，没有上传点；且出口经代理（见 network.md），隧道可用性未实测 |
| 4. 私网直连（Tailscale / ZeroTier） | 见 `evidence/network.md` 的方案选择 | 未安装、未验证 |

**A 侧收货动作（必须执行，否则报告无效）**：文件放到 `evidence/raw/preflight/` 后，先 `sha256sum -c B-bundle-*.zip.sha256`，通过再解压到 `evidence/raw/preflight/B-run-<stamp>/`，解压出的 `B.md` 复制为 `evidence/preflight/B.md`，并在文件头补一行「来源机器别名 = B、回传方式 = X、校验 = OK」。哈希不符或文件名不符一律不收。

## 4 A 侧已在 A 机自测（证明脚本可用，不是 B 的证据）

- 命令：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\b_preflight\collect_b.ps1 -OutDir evidence\raw\preflight\b-selftest -Alias A-selftest`
- 结果：exit 0，生成 `B.md` + 8 个 `raw/*.txt` + zip + sha256，`sha256sum -c` 通过（哈希 `366A1FAFB5E1EBDC7970F0439617166FF096451FF5E398116660026EDD64B380`）。
- 自测暴露并已修复的问题：脚本首版无 BOM，`powershell.exe` 5.1 按 ANSI 解析导致 `::1`、`"x" * 60` 等处语法错（`Unexpected token`）；加 UTF-8 BOM 后通过。
- 自测产出（可作为 B 报告的对照基线，**不得**当作 B 的证据）：`evidence/raw/preflight/b-selftest/`。
- 自测同时验证：脱敏规则未泄漏任何 `sk-*`/`Bearer`/`authtoken` 值（`grep -nEi` 扫描为空）。

## 5 B 报告到手后 A 侧要补的 4 项判断（任务书 T3 额外要求）

1. B 的实际管理目录、运行账户、软件入口 —— 与 A 的 `D:\Vibe_coding-Project\autoAgentloop`、`%USERPROFILE%\.agent-autoloop` 设计逐项对比，**不照抄 A 的绝对路径**。
2. 与 A 的版本差异 —— 填「A vs B 差异表」：OS build、node/pnpm/git/python 版本、codex/opencode/claude/dsh 安装版与路径、模型通道可用性（B 必须本机实测，不引用 A 的结论）。
3. 哪些项目是 B 的**唯一工作副本** —— 首版禁止两机同时写同一项目；A 侧据此决定哪个项目交给 B。
4. Codex 能否在 B 上直接复验 —— 若 B 只能给日志，就在这里明确写「仅日志」，后续 T11/T13 不得声称「B 上独立复验通过」。

## 6 未完成项（诚实标注）

- B 侧未执行：A 当前没有到 B 的可达通道，且无法确认 B 是哪台主机（172.16.184.0/24 扫描到 14 台有开放端口，`.234` 有 445+3389 是最强候选，但 `nbtstat` 全部无输出，不能用主机名确认）。
- 跨网络回传未验证：手动搬运之外的通道（隧道上传、私网直连）都还没有实测。
- 因此 `evidence/preflight/B.md` 尚不存在，T3 仍为 blocked。
