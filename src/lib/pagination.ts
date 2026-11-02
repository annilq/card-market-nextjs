/**
 * 分页页码窗口。纯函数：不读路由、不读语言，便于直接断言。
 *
 * 返回的数组按升序排列，始终含首页与末页，最多 7 个槽位；
 * `null` 表示省略号（…），不会出现相邻两个省略号，也不会在还放得下数字处插省略号。
 *
 *   pageWindow(1, 1)    -> [1]
 *   pageWindow(3, 5)    -> [1, 2, 3, 4, 5]
 *   pageWindow(1, 20)   -> [1, 2, 3, 4, 5, null, 20]
 *   pageWindow(10, 20)  -> [1, null, 9, 10, 11, null, 20]
 *   pageWindow(20, 20)  -> [1, null, 16, 17, 18, 19, 20]
 */
export function pageWindow(
  page: number,
  totalPages: number,
): (number | null)[] {
  const last = Math.max(1, Math.floor(totalPages))
  const current = Math.min(Math.max(1, Math.floor(page)), last)

  // 页数少到能一次列完，就不必省略
  const SLOTS = 7
  if (last <= SLOTS) {
    return Array.from({ length: last }, (_, i) => i + 1)
  }

  // 靠近开头：左侧连续，右侧省略
  if (current <= 4) {
    return [1, 2, 3, 4, 5, null, last]
  }
  // 靠近结尾：右侧连续，左侧省略
  if (current >= last - 3) {
    return [1, null, last - 4, last - 3, last - 2, last - 1, last]
  }
  // 中间：当前页左右各一页
  return [1, null, current - 1, current, current + 1, null, last]
}
