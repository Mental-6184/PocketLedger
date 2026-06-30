/**
 * 统计页 - 月度统计、分类占比、趋势图、账户统计
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')

// 分类颜色（柔和色调）
const CATEGORY_COLORS = [
  '#2AA198', '#D4605A', '#F39C12', '#3498DB',
  '#9B59B6', '#1ABC9C', '#E67E22', '#34495E',
  '#16A085', '#C0524C', '#27AE60', '#8E44AD'
]

Page({
  data: {
    currentMonth: '',
    currentMonthCN: '',
    currency: '¥',
    recordCount: 0,
    expenseRatio: 0,
    expenseRatioText: '0',
    stats: {
      incomeFormatted: '0.00',
      expenseFormatted: '0.00',
      balanceFormatted: '0.00',
      balance: 0
    },
    categoryStats: [],
    trendData: [],
    chartLines: [0, 25, 50, 75, 100],
    chartLineLabels: [],
    accountStats: [],
    refundStats: null
  },

  onShow() {
    const settings = storage.getSettings()
    this.setData({
      currentMonth: util.getCurrentMonth(),
      currentMonthCN: util.formatMonthCN(util.getCurrentMonth()),
      currency: settings.currency || '¥'
    })
    this.loadStats()
  },

  loadStats() {
    const records = storage.getRecords()
    const { currentMonth } = this.data

    // 月度统计
    const stats = util.getMonthStats(records, currentMonth)

    // 当月记录数
    const monthRecords = records.filter(r => r.date && r.date.startsWith(currentMonth))

    // 消费占比
    const expenseRatio = stats.income > 0 ? Math.round((stats.expense / stats.income) * 100) : 0

    // 分类统计
    const categoryData = util.getExpenseByCategory(records, currentMonth)
    const totalExpense = categoryData.reduce((s, c) => s + c.amount, 0)
    const categoryStats = categoryData.map((c, i) => ({
      ...c,
      amountFormatted: util.formatAmount(c.amount),
      percent: totalExpense > 0 ? Math.round((c.amount / totalExpense) * 100) : 0,
      percentText: totalExpense > 0 ? (c.amount / totalExpense * 100).toFixed(1) : '0.0',
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
    }))

    // 趋势数据（近6个月）
    const trendData = this.calcTrend(records, currentMonth)

    // 计算图表刻度线
    const maxVal = Math.max(...trendData.map(d => Math.max(d.income, d.expense)), 1)
    const step = this.calcStep(maxVal)
    const chartLineLabels = []
    for (let i = 0; i <= 4; i++) {
      chartLineLabels.push(this.formatShortAmount(step * i))
    }

    // 账户统计
    const accounts = storage.getAccounts()
    const accountStats = util.getAccountStats(records, accounts, currentMonth)

    // 退款/报销统计
    const refundStats = util.getRefundStats(records, currentMonth)

    this.setData({
      stats: {
        income: stats.income,
        expense: stats.expense,
        incomeFormatted: util.formatAmount(stats.income),
        expenseFormatted: util.formatAmount(stats.expense),
        balanceFormatted: util.formatAmount(Math.abs(stats.balance)),
        balance: stats.balance
      },
      recordCount: monthRecords.length,
      expenseRatio,
      expenseRatioText: String(expenseRatio),
      categoryStats,
      trendData,
      chartLineLabels,
      accountStats,
      refundStats
    })
  },

  calcTrend(records, currentMonth) {
    const [curYear, curMonth] = currentMonth.split('-').map(Number)
    const months = []

    for (let i = 5; i >= 0; i--) {
      let m = curMonth - i
      let y = curYear
      while (m <= 0) { m += 12; y-- }
      const monthStr = `${y}-${util.padZero(m)}`
      const stats = util.getMonthStats(records, monthStr)
      months.push({
        month: monthStr,
        monthLabel: `${m}月`,
        income: stats.income,
        expense: stats.expense
      })
    }

    // 计算柱高百分比
    const maxVal = Math.max(...months.map(d => Math.max(d.income, d.expense)), 1)
    return months.map(d => ({
      ...d,
      incomeFormatted: util.formatAmount(d.income),
      expenseFormatted: util.formatAmount(d.expense),
      incomeShort: this.formatShortAmount(d.income),
      expenseShort: this.formatShortAmount(d.expense),
      incomeHeight: Math.round((d.income / maxVal) * 100),
      expenseHeight: Math.round((d.expense / maxVal) * 100)
    }))
  },

  calcStep(maxVal) {
    if (maxVal <= 100) return 25
    if (maxVal <= 500) return 125
    if (maxVal <= 1000) return 250
    if (maxVal <= 5000) return 1250
    if (maxVal <= 10000) return 2500
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
    return Math.ceil(maxVal / 4 / magnitude) * magnitude
  },

  formatShortAmount(val) {
    if (val >= 10000) return (val / 10000).toFixed(1) + 'w'
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k'
    return String(Math.round(val))
  },

  prevMonth() {
    const [y, m] = this.data.currentMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    const month = `${d.getFullYear()}-${util.padZero(d.getMonth() + 1)}`
    this.setData({
      currentMonth: month,
      currentMonthCN: util.formatMonthCN(month)
    })
    this.loadStats()
  },

  nextMonth() {
    const [y, m] = this.data.currentMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    const month = `${d.getFullYear()}-${util.padZero(d.getMonth() + 1)}`
    this.setData({
      currentMonth: month,
      currentMonthCN: util.formatMonthCN(month)
    })
    this.loadStats()
  },

  onMonthChange(e) {
    const month = e.detail.value
    this.setData({
      currentMonth: month,
      currentMonthCN: util.formatMonthCN(month)
    })
    this.loadStats()
  }
})
