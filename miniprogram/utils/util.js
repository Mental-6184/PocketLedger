/**
 * 通用工具函数
 */

/**
 * 格式化金额，保留两位小数
 */
function formatAmount(amount) {
  const num = parseFloat(amount) || 0
  return num.toFixed(2)
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  if (typeof date === 'string') date = new Date(date)
  if (!(date instanceof Date) || isNaN(date)) date = new Date()
  const y = date.getFullYear()
  const m = padZero(date.getMonth() + 1)
  const d = padZero(date.getDate())
  return `${y}-${m}-${d}`
}

/**
 * 格式化日期为 MM月DD日
 */
function formatDateCN(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日`
}

/**
 * 格式化日期为 YYYY年MM月
 */
function formatMonthCN(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 2) return dateStr
  return `${parts[0]}年${parseInt(parts[1])}月`
}

/**
 * 获取当前月份字符串 YYYY-MM
 */
function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${padZero(now.getMonth() + 1)}`
}

/**
 * 获取今天日期字符串 YYYY-MM-DD
 */
function getToday() {
  return formatDate(new Date())
}

/**
 * 补零
 */
function padZero(n) {
  return n < 10 ? '0' + n : '' + n
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diff = d2.getTime() - d1.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * 获取分类信息（icon + name）
 */
function getCategoryInfo(categoryId, type) {
  const { EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require('./constants')
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return list.find(c => c.id === categoryId) || { id: categoryId, name: categoryId, icon: '📌' }
}

/**
 * 获取订阅周期名称
 */
function getCycleName(cycleId) {
  const { SUBSCRIPTION_CYCLES } = require('./constants')
  const cycle = SUBSCRIPTION_CYCLES.find(c => c.id === cycleId)
  return cycle ? cycle.name : cycleId
}

/**
 * 根据周期计算下次扣费日期
 */
function calcNextDate(currentDate, cycleId) {
  const { SUBSCRIPTION_CYCLES } = require('./constants')
  const cycle = SUBSCRIPTION_CYCLES.find(c => c.id === cycleId)
  if (!cycle) return currentDate
  const d = new Date(currentDate)
  switch (cycleId) {
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'quarterly':
      d.setMonth(d.getMonth() + 3)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return formatDate(d)
}

/**
 * 判断订阅是否即将到期
 */
function isSubExpiringSoon(sub) {
  if (!sub.enabled) return false
  const today = getToday()
  const days = daysBetween(today, sub.nextDate)
  return days <= (sub.remindDays || 3) && days >= 0
}

/**
 * 判断订阅是否已过期
 */
function isSubExpired(sub) {
  if (!sub.enabled) return false
  const today = getToday()
  return daysBetween(today, sub.nextDate) < 0
}

/**
 * 获取本月统计
 */
function getMonthStats(records, month) {
  const monthRecords = records.filter(r => r.date && r.date.startsWith(month))
  const income = monthRecords
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  const expense = monthRecords
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  return { income, expense, balance: income - expense }
}

/**
 * 按分类统计支出
 */
function getExpenseByCategory(records, month) {
  const monthRecords = records.filter(r => r.date && r.date.startsWith(month) && r.type === 'expense')
  const map = {}
  monthRecords.forEach(r => {
    const cat = r.category || 'other_expense'
    if (!map[cat]) map[cat] = 0
    map[cat] += parseFloat(r.amount) || 0
  })
  const { EXPENSE_CATEGORIES } = require('./constants')
  return Object.keys(map)
    .map(catId => {
      const catInfo = EXPENSE_CATEGORIES.find(c => c.id === catId) || { id: catId, name: catId, icon: '📌' }
      return { ...catInfo, amount: map[catId] }
    })
    .sort((a, b) => b.amount - a.amount)
}

/**
 * 获取收入分类统计
 */
function getIncomeByCategory(records, month) {
  const monthRecords = records.filter(r => r.date && r.date.startsWith(month) && r.type === 'income')
  const map = {}
  monthRecords.forEach(r => {
    const cat = r.category || 'other_income'
    if (!map[cat]) map[cat] = 0
    map[cat] += parseFloat(r.amount) || 0
  })
  const { INCOME_CATEGORIES } = require('./constants')
  return Object.keys(map)
    .map(catId => {
      const catInfo = INCOME_CATEGORIES.find(c => c.id === catId) || { id: catId, name: catId, icon: '📌' }
      return { ...catInfo, amount: map[catId] }
    })
    .sort((a, b) => b.amount - a.amount)
}

/**
 * 防抖
 */
function debounce(fn, delay) {
  let timer = null
  return function () {
    const args = arguments
    const ctx = this
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(ctx, args), delay)
  }
}

/**
 * 计算某订阅在指定月份内的所有扣费日
 * @param {Object} sub - 订阅对象
 * @param {number} year - 年份
 * @param {number} month - 月份（1-12）
 * @returns {Array<string>} 扣费日期数组 ['YYYY-MM-DD', ...]
 */
function getSubBillingDatesInMonth(sub, year, month) {
  if (!sub || !sub.enabled) return []

  const cycle = sub.cycleId || sub.cycle
  const nextDate = sub.nextDate
  if (!nextDate || !cycle) return []

  const dates = []
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0) // 当月最后一天
  const startDate = new Date(nextDate)

  // 从 nextDate 往前推算到月初之前，再往回找当月内的日期
  // 策略：从一个足够早的日期开始，按周期递增，收集落在当月内的日期
  let cursor = new Date(startDate)

  // 先往前推到月初之前（确保不遗漏）
  // 对于月扣/季扣/年扣，最多往前推1年；周扣往前推60周
  const maxBack = cycle === 'weekly' ? 60 * 7 : 400
  const earliestStart = new Date(monthStart)
  earliestStart.setDate(earliestStart.getDate() - maxBack)

  while (cursor > earliestStart) {
    const prev = cursor.getTime()
    cursor = new Date(cursor)
    switch (cycle) {
      case 'weekly': cursor.setDate(cursor.getDate() - 7); break
      case 'monthly': cursor.setMonth(cursor.getMonth() - 1); break
      case 'quarterly': cursor.setMonth(cursor.getMonth() - 3); break
      case 'yearly': cursor.setFullYear(cursor.getFullYear() - 1); break
    }
    // 安全检查：如果日期没有后退，跳出
    if (cursor.getTime() >= prev) break
  }

  // 从 cursor 开始按周期递增，收集当月内的日期
  const maxIter = cycle === 'weekly' ? 100 : 30 // 防止死循环
  let count = 0
  while (cursor <= monthEnd && count < maxIter) {
    if (cursor >= monthStart && cursor <= monthEnd) {
      dates.push(formatDate(cursor))
    }
    const prev = cursor.getTime()
    switch (cycle) {
      case 'weekly': cursor.setDate(cursor.getDate() + 7); break
      case 'monthly': cursor.setMonth(cursor.getMonth() + 1); break
      case 'quarterly': cursor.setMonth(cursor.getMonth() + 3); break
      case 'yearly': cursor.setFullYear(cursor.getFullYear() + 1); break
    }
    // 安全检查：如果日期没有前进，跳出
    if (cursor.getTime() <= prev) break
    count++
  }

  // 去重并排序
  return [...new Set(dates)].sort()
}

/**
 * 计算订阅的有效月均花费（人民币）
 * - 外币自动按汇率换算为人民币
 * - 年付可选均摊到每月
 * @param {Object} sub - 订阅对象
 * @param {Object} rates - 汇率表（可选）
 * @returns {number} 人民币月均金额
 */
function calcEffectiveMonthlyCost(sub, rates) {
  if (!sub || !sub.enabled) return 0

  const { convertToCNY } = require('./exchange')
  const amount = parseFloat(sub.amount) || 0
  const cycle = sub.cycleId || sub.cycle
  const currency = sub.currency || 'CNY'

  // 先换算为人民币
  const cnyAmount = convertToCNY(amount, currency, rates)

  // 按周期计算月均
  let monthlyCost = 0
  switch (cycle) {
    case 'weekly': monthlyCost = cnyAmount * 4.33; break
    case 'monthly': monthlyCost = cnyAmount; break
    case 'quarterly': monthlyCost = cnyAmount / 3; break
    case 'yearly':
      // 如果开启了年付分摊，则均摊到每月
      monthlyCost = sub.spreadYearly ? cnyAmount / 12 : 0
      break
    default: monthlyCost = cnyAmount
  }

  return monthlyCost
}

/**
 * 获取日历网格数据（6行×7列）
 * @param {number} year
 * @param {number} month - 1-12
 * @returns {Array<Array<{day, date, isToday, isCurrentMonth}>>}
 */
function getCalendarGrid(year, month) {
  const today = getToday()
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startWeekday = firstDay.getDay() // 0=周日
  const totalDays = lastDay.getDate()

  const grid = []
  let dayCounter = 1
  let nextMonthDay = 1

  for (let row = 0; row < 6; row++) {
    const week = []
    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col
      if (cellIndex < startWeekday) {
        // 上月末尾
        const prevMonthLastDay = new Date(year, month - 1, 0).getDate()
        const d = prevMonthLastDay - (startWeekday - cellIndex - 1)
        const m = month === 1 ? 12 : month - 1
        const y = month === 1 ? year - 1 : year
        const dateStr = `${y}-${padZero(m)}-${padZero(d)}`
        week.push({ day: d, date: dateStr, isToday: dateStr === today, isCurrentMonth: false })
      } else if (dayCounter <= totalDays) {
        const dateStr = `${year}-${padZero(month)}-${padZero(dayCounter)}`
        week.push({ day: dayCounter, date: dateStr, isToday: dateStr === today, isCurrentMonth: true })
        dayCounter++
      } else {
        // 下月开头
        const m = month === 12 ? 1 : month + 1
        const y = month === 12 ? year + 1 : year
        const dateStr = `${y}-${padZero(m)}-${padZero(nextMonthDay)}`
        week.push({ day: nextMonthDay, date: dateStr, isToday: dateStr === today, isCurrentMonth: false })
        nextMonthDay++
      }
    }
    grid.push(week)
    // 如果已经填满当月所有天且当前行已结束，可以停止
    if (dayCounter > totalDays && row >= 4) break
  }

  return grid
}

/**
 * 获取币种符号
 */
function getCurrencySymbol(code) {
  const { CURRENCIES } = require('./constants')
  const currency = CURRENCIES.find(c => c.code === code)
  return currency ? currency.symbol : '¥'
}

/**
 * 按账户统计月度收支
 * @param {Array} records - 所有记录
 * @param {Array} accounts - 所有账户
 * @param {string} month - YYYY-MM
 * @returns {Array<{account, income, expense, net}>}
 */
function getAccountStats(records, accounts, month) {
  const monthRecords = records.filter(r => r.date && r.date.startsWith(month) && r.accountId)
  return accounts.map(acc => {
    const accRecords = monthRecords.filter(r => r.accountId === acc.id)
    const income = accRecords.filter(r => r.type === 'income').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const expense = accRecords.filter(r => r.type === 'expense').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    return {
      account: acc,
      income,
      expense,
      net: income - expense,
      incomeFormatted: formatAmount(income),
      expenseFormatted: formatAmount(expense),
      netFormatted: formatAmount(Math.abs(income - expense))
    }
  }).filter(s => s.income > 0 || s.expense > 0)
}

/**
 * 计算退款/报销统计
 * @param {Array} records - 所有记录
 * @param {string} month - YYYY-MM
 * @returns {{pendingAmount, reimbursedAmount, pendingCount, reimbursedCount, linkedRefundAmount}}
 */
function getRefundStats(records, month) {
  const monthRecords = records.filter(r => r.date && r.date.startsWith(month))

  // 待报销的支出
  const pendingExpenses = monthRecords.filter(r => r.type === 'expense' && r.reimbursementStatus === 'pending')
  const pendingAmount = pendingExpenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  // 已报销的支出
  const reimbursedExpenses = monthRecords.filter(r => r.type === 'expense' && r.reimbursementStatus === 'reimbursed')
  const reimbursedAmount = reimbursedExpenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  // 关联退款/报销的收入（linkedRecordId 存在的 refund 类型收入）
  const linkedRefunds = monthRecords.filter(r => r.type === 'income' && r.linkedRecordId)
  const linkedRefundAmount = linkedRefunds.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  return {
    pendingAmount,
    reimbursedAmount,
    pendingCount: pendingExpenses.length,
    reimbursedCount: reimbursedExpenses.length,
    linkedRefundAmount,
    pendingAmountFormatted: formatAmount(pendingAmount),
    reimbursedAmountFormatted: formatAmount(reimbursedAmount),
    linkedRefundAmountFormatted: formatAmount(linkedRefundAmount)
  }
}

/**
 * 获取可报销的支出列表（当月及之前的未报销支出）
 * @param {Array} records - 所有记录
 * @param {string} beforeDate - YYYY-MM-DD，返回此日期及之前的记录
 * @returns {Array} 可关联的支出记录
 */
function getLinkableExpenses(records, beforeDate) {
  return records
    .filter(r => r.type === 'expense' && r.reimbursementStatus === 'pending' && r.date <= beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(r => {
      const catInfo = getCategoryInfo(r.category, r.type)
      return {
        ...r,
        categoryName: catInfo.name,
        categoryIcon: catInfo.icon,
        amountFormatted: formatAmount(r.amount)
      }
    })
}

module.exports = {
  formatAmount, formatDate, formatDateCN, formatMonthCN,
  getCurrentMonth, getToday, padZero, daysBetween,
  getCategoryInfo, getCycleName, calcNextDate,
  isSubExpiringSoon, isSubExpired,
  getMonthStats, getExpenseByCategory, getIncomeByCategory, debounce,
  getSubBillingDatesInMonth, calcEffectiveMonthlyCost,
  getCalendarGrid, getCurrencySymbol,
  getAccountStats, getRefundStats, getLinkableExpenses
}
