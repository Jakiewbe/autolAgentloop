B-20261110-01 交付：B 机接入生产模式

取件：
  git fetch origin deliver/prompt-B-20261110
  git show FETCH_HEAD:prompts/prompt-B-20261110.md > prompt-B-20261110.md
  git archive FETCH_HEAD:pkg | tar -x -C .

pkg/ 下六个文件必须在 B 机逐字节校验（见 INDEX.sha256 与 prompt 内的哈希表）。
prompt-B-20261110.md 的 sha256 = 435b714a18d35fc6b9e157f10974a822e804a527f0121c72e0c3a7dd7190ffa6
