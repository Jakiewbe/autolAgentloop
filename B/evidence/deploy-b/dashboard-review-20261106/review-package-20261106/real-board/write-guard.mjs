// write-guard.mjs：把「被拒时不发写入请求」的判据钉在有分母的形式上。
// 空录制（requests 为空）不再算通过 —— 这正是 A 指出的空真残留。
export function writeGuard(urls) {
  const all = [].concat(urls ?? []).map(String).filter((url) => url.indexOf("/api/") >= 0);
  const writes = all.filter((url) => url.indexOf("/api/cards/") >= 0).length;
  return { writes, total: all.length, ok: writes === 0 && all.length > 0 };
}
