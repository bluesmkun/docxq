/**
 * One line a day, picked from the local calendar rather than at random: a
 * visitor who reloads, opens the page on their phone, or comes back after lunch
 * sees the same sentence. Nothing here is fetched — a status page should not
 * depend on a quote API being up, and a hub error would leave the line blank.
 */

export type Quote = { text: string; author: string }

const BUILTIN: Quote[] = [
  { text: "我们唯一拥有的东西是时间，而时间是不可逆的。", author: "凯文·凯利" },
  { text: "简单是可靠的前提。", author: "Edsger Dijkstra" },
  { text: "过早的优化是万恶之源。", author: "Donald Knuth" },
  { text: "让程序保持简单，剩下的交给编译器。", author: "Rob Pike" },
  { text: "运维的第一原则是：你无法监控你没测量的东西。", author: "佚名" },
  { text: "任何足够复杂的技术都与魔法无异。", author: "Arthur C. Clarke" },
  { text: "好设计是尽可能少的设计。", author: "Dieter Rams" },
  { text: "先让它跑起来，再让它正确，最后让它快。", author: "Kent Beck" },
  { text: "系统不会因为一次大故障而崩溃，通常是因为许多小问题叠加。", author: "佚名" },
  { text: "复杂性会累积，简洁需要不断维护。", author: "佚名" },
  { text: "预测未来的最好方式是创造未来。", author: "Alan Kay" },
  { text: "软件就像熵，总是倾向于走向混乱。", author: "Andrew Hunt" },
  { text: "把复杂留给系统，把简单留给用户。", author: "佚名" },
  { text: "如果你不能把它解释清楚，说明你还没真正理解它。", author: "Richard Feynman" },
  { text: "可用性的秘诀不是增加功能，而是减少打扰。", author: "佚名" },
  { text: "稳定性不是没有故障，而是故障后能迅速恢复。", author: "佚名" },
  { text: "度量，不要猜测。", author: "佚名" },
  { text: "每一个抽象都有代价，问题在于你是否需要它。", author: "佚名" },
  { text: "慢即是稳，稳即是快。", author: "佚名" },
  { text: "工具应当放大人的意图，而不是取代它。", author: "Douglas Engelbart" },
  { text: "文档是写给未来的自己的一封信。", author: "佚名" },
  { text: "永远不要相信没有备份的系统。", author: "佚名" },
  { text: "简单的事情要简单做，复杂的事情要尽可能地简单做。", author: "佚名" },
  { text: "对机器宽容，对人苛求，是不对的；应当反过来。", author: "佚名" },
  { text: "所有模型都是错的，但有些是有用的。", author: "George Box" },
  { text: "让每一次部署都成为一次小的、可回退的冒险。", author: "佚名" },
  { text: "计算机科学并不只研究计算机，正如天文学不只研究望远镜。", author: "Edsger Dijkstra" },
  { text: "写代码时，想着将来维护它的人会知道你是谁。", author: "佚名" },
  { text: "清晰优于聪明。", author: "Rob Pike" },
  { text: "不读书的人并不比不能读书的人强多少。", author: "Mark Twain" },
  { text: "性能问题往往不在你怀疑的地方。", author: "佚名" },
  { text: "好的界面让人忘记自己在使用界面。", author: "佚名" },
  { text: "日志是写给未来的证词。", author: "佚名" },
  { text: "任何可以被自动化两次的事情，都值得被自动化。", author: "佚名" },
  { text: "沉默的监控最危险：它会让你以为一切正常。", author: "佚名" },
  { text: "设计不是让东西看起来怎么样，而是让它运作起来怎么样。", author: "Steve Jobs" },
  { text: "真理越辩越明，系统越简化越稳。", author: "佚名" },
  { text: "你无法管理你无法度量的东西，但也不要只管理你能度量的东西。", author: "佚名" },
  { text: "最贵的停机是没人发现的那次。", author: "佚名" },
  { text: "代码是写给人读的，只是顺带让机器执行。", author: "Harold Abelson" },
  { text: "保持好奇，保持谦逊，保持备份。", author: "佚名" },
  { text: "不要重复自己，也不要重复造轮子——除非你在学造轮子。", author: "佚名" },
]

/** Lines from the theme setting, in order, with blanks and stray whitespace dropped. */
function custom(spec: string): Quote[] {
  return spec
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // "正文 —— 作者" keeps the author optional: an operator pasting a list of
      // sentences should not have to invent one.
      const cut = line.split(/\s*(?:——|--)\s*/)
      return cut.length > 1
        ? { text: cut[0].trim(), author: cut.slice(1).join(" ").trim() }
        : { text: line, author: "" }
    })
}

/** Whole days since the epoch on the visitor's own calendar, so the line turns over at midnight. */
function dayNumber(now: Date): number {
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000)
}

/**
 * The line for today. A custom list replaces the built-in one entirely rather
 * than merging with it: an operator who wrote ten sentences means those ten.
 */
export function quoteOfTheDay(spec: string, now = new Date()): Quote | null {
  const list = custom(spec)
  const pool = list.length ? list : BUILTIN
  if (!pool.length) return null
  const day = dayNumber(now)
  // `%` in JS keeps the sign, and a pre-1970 clock would index backwards.
  return pool[((day % pool.length) + pool.length) % pool.length]
}
