# B7 交付：证据包与推送闭环

## 1. 交付物

| 项 | 值 |
| --- | --- |
| 私库 | `https://github.com/Jakiewbe/autolAgentloop.git`（**只推这里**，未碰 KKKKhazix 上游、未改 origin） |
| 分支 | **b-final-20261108**（从 b-final-20261107 / b12ec1c 拉出，线性追加，未重写历史） |
| 提交 | 分支 tip（终版）；历史线性：b12ec1c → 交付包 → `*.log` 补入 → 终版，见 `git log b-final-20261108` |
| 包内路径 | `evidence/20261108-final/` |
| INDEX | `evidence/20261108-final/INDEX.sha256`，路径相对 `evidence/`，格式 `<64hex> *20261108-final/<相对路径>` |
| 校验命令 | `cd evidence && sha256sum -c 20261108-final/INDEX.sha256` |

## 2. 推送过程（含踩到的两个坑，照实写）

**坑一：CRLF 转换会让 INDEX 在 clone 后校验失败。**
第一次提交时 git 报 `warning: in the working copy of '...b3/01-before-migration.txt', CRLF will be replaced by LF` —— 根 `.gitattributes` 是 `* text=auto eol=lf`，证据包里的 CRLF 文本会被改写成 LF，clone 后 sha256 全变。处理：包内加 `evidence/20261108-final/.gitattributes` 写 `* -text`（只影响该目录，不动根配置），并把已暂存的文件重新 `git rm --cached` + `git add` 规范化后再提交。校验方式：`git show HEAD:<file> | sha256sum` 与工作区 `sha256sum` 逐字节相同（b3/01-before-migration.txt、b6/before.txt 均 SAME）。

**坑二：根 `.gitignore` 的 `*.log` 把 4 个证据日志吞了。**
`git check-ignore -v` 指向 `.gitignore:3:*.log`，被忽略的是：`b2/run-b8-criterion.log`、`b4/ip-proxy.log`、`b6/test-windows.log`、`b7/package.log`。INDEX 有 46 条而仓库里只有 43 个文件，clone 后必然缺文件。处理：`git add -f` 补入（**没有改 .gitignore**，避免影响仓库其他部分），单独一个提交说明原因。

**推送**：`git -c http.proxy=http://127.0.0.1:18080 -c https.proxy=... push origin b-final-20261108`，两次推送各 **1 次尝试即成功**（4 s / 2 s）。直连 github.com 不通的原因与代理方案见 B4-network-and-clone.md；代理只在本机 127.0.0.1:18080 临时起，用完即停，未改 hosts、未改全局 git 配置。

## 3. 新 clone 复验（这才是闭环）

```
git clone --branch b-final-20261108 --depth 1 https://github.com/Jakiewbe/autolAgentloop.git _night/b7-clone   # 2 s
cd _night/b7-clone/evidence && sha256sum -c 20261108-final/INDEX.sha256
→ rc=0，OK 55，bad 0
→ HEAD 与 INDEX sha256 见包外日志 evidence/20261108-final-INDEX-verify.txt
```

证据：b7/verify-fresh-clone.txt（中间一轮的 46 行 OK 全文，保留作过程记录）、b7/push2.log、b7/package.log、b7/package2.log、b7/final-pass.log、b7/final-pass2.log、b7/*.sh。

INDEX 终版（含 B7 报告与本文件后重算）的条数、sha256 与 clone 复验结果见 `B-final-report.md` §7 与包外校验日志 `evidence/20261108-final-INDEX-verify.txt`（该日志刻意放在包外：它是「校验这个 INDEX」的产物，放进包内会形成自指）。

## 4. 未验 / 限制

- 推送与 clone **走的是本机 CONNECT 代理**（钉 IP），不是直连 github.com。A 侧若要求「直连闭环」，这条不成立。
- `--depth 1` 的复验只证明该分支 tip 的包可校验，不证明历史完整性。
- 包内 `b7/verify-fresh-clone.txt` 是对**上一个提交**的校验记录，终版提交的校验在包外日志里。
## 5. 坑三（终版才暴露）

终版把 `evidence/20261108-final` 整个 `rm -rf` 后 `cp -a` 重灌，再用 `git add -A` —— 结果那 4 个 `.log` **又被根 `.gitignore` 忽略**（`git add -A` 不会因为「之前被 -f 加过」而继续收录已删除重建的文件）。第一次复验就是 55 条 INDEX、51 OK、2 个文件读不到。
处理：整包 `git add -f -A evidence/20261108-final`，然后重算 INDEX 再推。**教训：这个仓库里凡带 `*.log` 的证据必须 `-f` 加，且每次重灌包之后都要重新 `-f`。**
