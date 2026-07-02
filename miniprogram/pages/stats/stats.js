/**
 * 统计页 - 月度统计、分类占比、趋势图、账户统计
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require('../../utils/constants')

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
    incomeCategoryStats: [],
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

    // 单次遍历，收集月度统计 + 分类统计 + 待报销统计
    let income = 0, expense = 0, recordCount = 0
    const expenseByCategory = {}
    const incomeByCategory = {}
    let pendingAmount = 0, reimbursedAmount = 0, linkedRefundAmount = 0
    let pendingCount = 0, reimbursedCount = 0

    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      if (!r || !r.date || !r.date.startsWith(currentMonth)) continue

      recordCount++
      const amount = parseFloat(r.amount) || 0

      if (r.type === 'income') {
        income += amount
        const cat = r.category || 'other_income'
        incomeByCategory[cat] = (incomeByCategory[cat] || 0) + amount
        if (r.linkedRecordId) linkedRefundAmount += amount
      } else {
        expense += amount
        const cat = r.category || 'other_expense'
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amount
        if (r.reimbursementStatus === 'pending') {
          pendingCount++
          pendingAmount += amount
        } else if (r.reimbursementStatus === 'reimbursed') {
          reimbursedCount++
          reimbursedAmount += amount
        }
      }
    }

    // 消费占比
    const expenseRatio = income > 0 ? Math.round((expense / income) * 100) : 0

    // 格式化支出分类统计
    const totalExpense = Object.values(expenseByCategory).reduce((s, v) => s + v, 0)
    const categoryStats = Object.entries(expenseByCategory)
      .map(([catId, amount], i) => {
        const catInfo = EXPENSE_CATEGORIES.find(c => c.id === catId) || { id: catId, name: catId, icon: '📌' }
        return {
          ...catInfo,
          amount,
          amountFormatted: util.formatAmount(amount),
          percent: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
          percentText: totalExpense > 0 ? (amount / totalExpense * 100).toFixed(1) : '0.0',
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
        }
      })
      .sort((a, b) => b.amount - a.amount)

    // 格式化收入分类统计
    const totalIncome = Object.values(incomeByCategory).reduce((s, v) => s + v, 0)
    const incomeCategoryStats = Object.entries(incomeByCategory)
      .map(([catId, amount], i) => {
        const catInfo = INCOME_CATEGORIES.find(c => c.id === catId) || { id: catId, name: catId, icon: '📌' }
        return {
          ...catInfo,
          amount,
          amountFormatted: util.formatAmount(amount),
          percent: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
          percentText: totalIncome > 0 ? (amount / totalIncome * 100).toFixed(1) : '0.0',
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
        }
      })
      .sort((a, b) => b.amount - a.amount)

    // 第一批 setData：核心统计数据
    this.setData({
      stats: {
        income,
        expense,
        incomeFormatted: util.formatAmount(income),
        expenseFormatted: util.formatAmount(expense),
        balanceFormatted: util.formatAmount(Math.abs(income - expense)),
        balance: income - expense
      },
      recordCount,
      expenseRatio,
      expenseRatioText: String(expenseRatio),
      categoryStats,
      incomeCategoryStats,
      refundStats: {
        pendingAmount,
        reimbursedAmount,
        pendingCount,
        reimbursedCount,
        linkedRefundAmount,
        pendingAmountFormatted: util.formatAmount(pendingAmount),
        reimbursedAmountFormatted: util.formatAmount(reimbursedAmount),
        linkedRefundAmountFormatted: util.formatAmount(linkedRefundAmount)
      }
    })

    // 第二批 setData：趋势数据（延迟执行，让第一帧先渲染）
    setTimeout(() => {
      const trendData = this.calcTrend(records, currentMonth)
      const maxVal = Math.max(...trendData.map(d => Math.max(d.income, d.expense)), 1)
      const step = this.calcStep(maxVal)
      const chartLineLabels = []
      for (let i = 0; i <= 4; i++) {
        chartLineLabels.push(this.formatShortAmount(step * i))
      }
      this.setData({ trendData, chartLineLabels })
    }, 50)

    // 第三批 setData：账户统计（延迟执行）
    setTimeout(() => {
      const accounts = storage.getAccounts()
      const accountStats = util.getAccountStats(records, accounts, currentMonth)
      this.setData({ accountStats })
    }, 100)
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
