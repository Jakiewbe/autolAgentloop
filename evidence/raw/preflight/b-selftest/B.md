# A-selftest 机环境盘点（本地原始报告）

> 由 collect_b.ps1 于 2026-11-04T18:13:16+08:00 在主机 DESKTOP-LM7RKI1、账户 DESKTOP-LM7RKI1\chs 上实际运行生成。
> 报告不含凭据内容；raw/ 保留每节原始输出，供 A 侧逐条核对。

## 0 采集元信息
- 机器别名：A-selftest
- 主机名：DESKTOP-LM7RKI1
- 运行账户：DESKTOP-LM7RKI1\chs
- 采集时间：2026-11-04T18:13:16+08:00
- 管理员权限：False
- 采集目录：evidence\raw\preflight\b-selftest

## 1 系统
- OS：Microsoft Windows 10 家庭版 build 19045
- 时区：China Standard Time
- 原始：raw/01-system.txt

## 2 工具链
- node：v24.12.0
- pnpm：11.9.0
- git：git version 2.52.0.windows.1
- python：Python 3.7.1
- 原始：raw/02-toolchain.txt

## 3 Agent 入口与版本
- codex：
- opencode：C:\Users\chs\AppData\Roaming\npm\opencode.ps1
- claude：C:\Users\chs\AppData\Roaming\npm\claude.ps1
- dsh：
- 原始：raw/03-agents.txt（含同目录其它版本二进制、配置目录清单）

## 4 凭据存在性（不含内容）
- 原始：raw/04-credentials.txt（逐项列出 .dsh/.codex/.claude/.opencode/.agent-autoloop 下凭据文件是否存在、大小、修改时间）

## 5 网络
- 原始：raw/05-network.txt（适配器、默认路由、DNS、VPN/隧道组件、非 loopback 监听端口、出网 IP、防火墙配置）

## 6 常驻与自启动能力
- 原始：raw/06-autostart.txt（Startup 目录、Run 键、计划任务、相关服务）

## 7 项目盘点
- 原始：raw/07-projects.txt（候选根目录下一层的 git 状态、.agent 账本存在性、文件数与体积）
- 唯一工作副本判定：由人工补充，本脚本只采集事实。

## 8 路径/编码兼容探针
- 原始：raw/08-path-probe.txt（中文+空格目录、.cmd/.ps1 入口、长路径）

## 9 待人工补充（A 侧判断项）
- B 的实际管理目录与运行账户是否符合设计，还是需要另定。
- 哪些项目是唯一工作副本；首版禁止两机同时写同一项目。
- Codex 后续能否在 B 上直接复验；若只能提供日志，明确标注为「仅日志」。
- 与 A 的版本差异结论（回传后由 A 侧填写差异表，对照 evidence/preflight/A.md）。

## 10 校验
- 报告与 raw/ 一并打包为 zip 并附 sha256；A 侧解压前先校验哈希。
