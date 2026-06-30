/**
 * 首页 - 口袋账本
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')
const { EXPENSE_CATEGORIES } = require('../../utils/constants')
const exchange = require('../../utils/exchange')

Page({
  data: {
    currentMonthCN: '',
    incomeFormatted: '0.00',
    expenseFormatted: '0.00',
    balanceFormatted: '0.00',
    balance: 0,
    budget: 0,
    budgetFormatted: '0.00',
    budgetPercent: 0,
    currency: '¥',
    recentRecords: [],
    expiringSubs: [],
    subCount: 0,
    monthlyCost: '0.00',
    activeSubs: [],
    // 常用分类
    quickCategories: [],
    showQuickInput: false,
    quickCategory: null,
    quickAmount: '',
    // 扣款日历
    calendarGrid: [],
    calendarYear: 0,
    calendarMonth: 0,
    calendarMonthCN: '',
    billingDateMap: {},
    selectedDate: '',
    selectedDateBills: []
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const settings = storage.getSettings()
    const records = storage.getRecords()
    const subs = storage.getSubscriptions()
    const currentMonth = util.getCurrentMonth()

    // 月度统计
    const stats = util.getMonthStats(records, currentMonth)

    // 预算
    const budget = settings.monthlyBudget || 0
    const budgetPercent = budget > 0 ? Math.round((stats.expense / budget) * 100) : 0

    // 最近 3 条记录
    const recentRecords = records.slice(0, 3).map(r => {
      const catInfo = util.getCategoryInfo(r.category, r.type)
      return {
        ...r,
        amountFormatted: util.formatAmount(r.amount),
        categoryName: catInfo.name,
        categoryIcon: catInfo.icon,
        dateFormatted: util.formatDateCN(r.date)
      }
    })

    // 即将到期的订阅
    const today = util.getToday()
    const expiringSubs = subs
      .filter(s => s.enabled)
      .map(s => {
        const subCurrency = s.currency || 'CNY'
        return {
          ...s,
          amountFormatted: util.formatAmount(s.amount),
          nextDateFormatted: util.formatDateCN(s.nextDate),
          daysLeft: util.daysBetween(today, s.nextDate),
          currencySymbol: util.getCurrencySymbol(subCurrency),
          showConversion: subCurrency !== 'CNY'
        }
      })
      .filter(s => s.daysLeft <= (s.remindDays || 3))
      .sort((a, b) => a.daysLeft - b.daysLeft)

    // 订阅概览统计（使用汇率换算 + 年付分摊后的人民币月均）
    const rates = exchange.getRatesSync()
    let monthlyTotal = 0
    const activeSubs = subs
      .filter(s => s.enabled)
      .map(s => {
        monthlyTotal += util.calcEffectiveMonthlyCost(s, rates)
        const subCurrency = s.currency || 'CNY'
        return {
          ...s,
          amountFormatted: util.formatAmount(s.amount),
          cycleName: util.getCycleName(s.cycleId || s.cycle),
          currencySymbol: util.getCurrencySymbol(subCurrency),
          showConversion: subCurrency !== 'CNY'
        }
      })

    // 计算常用分类（最近30天使用频率最高的4个）
    const quickCategories = this.getQuickCategories(records)

    // 计算预算相关（含订阅预留）
    const subscriptionReserved = monthlyTotal
    const availableBudget = budget > 0 ? budget - stats.expense - subscriptionReserved : 0
    const budgetWithSub = budget > 0 ? Math.round(((stats.expense + subscriptionReserved) / budget) * 100) : 0

    this.setData({
      currentMonthCN: util.formatMonthCN(currentMonth),
      incomeFormatted: util.formatAmount(stats.income),
      expenseFormatted: util.formatAmount(stats.expense),
      balanceFormatted: util.formatAmount(Math.abs(stats.balance)),
      balance: stats.balance,
      budget,
      budgetFormatted: util.formatAmount(budget),
      budgetPercent,
      currency: settings.currency || '¥',
      recentRecords,
      expiringSubs,
      subCount: subs.length,
      monthlyCost: util.formatAmount(monthlyTotal),
      activeSubs: activeSubs.slice(0, 3),
      quickCategories,
      // 预算联动订阅
      subscriptionReserved: util.formatAmount(subscriptionReserved),
      availableBudget: util.formatAmount(Math.abs(availableBudget)),
      availableBudgetPositive: availableBudget >= 0,
      budgetWithSub: budgetWithSub > 100 ? 100 : budgetWithSub,
      showBudgetDetail: budget > 0 && subscriptionReserved > 0
    })

    // 构建扣款日历
    this.buildCalendar(subs)

    // 异步刷新汇率
    exchange.getRates().catch(() => {})
  },

  // 获取常用分类
  getQuickCategories(records) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0]

    // 统计最近30天各分类使用次数
    const categoryCount = {}
    records.forEach(r => {
      if (r.date >= dateStr && r.type === 'expense') {
        categoryCount[r.category] = (categoryCount[r.category] || 0) + 1
      }
    })

    // 排序取前4个
    const sorted = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => {
        const cat = EXPENSE_CATEGORIES.find(c => c.id === id)
        return cat || null
      })
      .filter(Boolean)

    // 如果不足4个，补充默认分类
    if (sorted.length < 4) {
      const defaults = EXPENSE_CATEGORIES.slice(0, 4)
      defaults.forEach(cat => {
        if (sorted.length < 4 && !sorted.find(c => c.id === cat.id)) {
          sorted.push(cat)
        }
      })
    }

    return sorted
  },

  // 点击常用分类 - 弹出快捷输入
  onQuickCategoryTap(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      showQuickInput: true,
      quickCategory: category,
      quickAmount: ''
    })
  },

  // 关闭快捷输入
  closeQuickInput() {
    this.setData({
      showQuickInput: false,
      quickCategory: null,
      quickAmount: ''
    })
  },

  // 快捷输入金额
  onQuickAmountInput(e) {
    this.setData({ quickAmount: e.detail.value })
  },

  // 快捷输入数字键盘
  onQuickKeyTap(e) {
    const key = e.currentTarget.dataset.key
    let amount = this.data.quickAmount

    if (key === 'delete') {
      amount = amount.slice(0, -1)
    } else if (key === '.') {
      if (!amount.includes('.')) {
        amount = amount || '0'
        amount += '.'
      }
    } else {
      // 限制小数点后2位
      if (amount.includes('.')) {
        const parts = amount.split('.')
        if (parts[1].length >= 2) return
      }
      amount += key
    }

    this.setData({ quickAmount: amount })
  },

  // 保存快捷记录
  saveQuickRecord() {
    const { quickCategory, quickAmount } = this.data
    if (!quickCategory || !quickAmount || parseFloat(quickAmount) <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }

    const settings = storage.getSettings()
    const record = {
      id: Date.now().toString(),
      type: 'expense',
      category: quickCategory.id,
      amount: parseFloat(quickAmount),
      date: util.getToday(),
      note: '',
      createdAt: new Date().toISOString()
    }

    storage.addRecord(record)
    this.closeQuickInput()
    this.loadData()
    wx.showToast({ title: '记账成功', icon: 'success' })
  },

  // ==================== 扣款日历 ====================

  /**
   * 构建日历数据
   */
  buildCalendar(subs) {
    const now = new Date()
    const year = this.data.calendarYear || now.getFullYear()
    const month = this.data.calendarMonth || (now.getMonth() + 1)
    const rates = exchange.getRatesSync()

    // 构建扣费日期映射：{ 'YYYY-MM-DD': [{name, amount, symbol, cnyAmount, cycleName}] }
    const billingDateMap = {}
    const enabledSubs = subs.filter(s => s.enabled)

    enabledSubs.forEach(s => {
      const dates = util.getSubBillingDatesInMonth(s, year, month)
      const subCurrency = s.currency || 'CNY'
      const symbol = util.getCurrencySymbol(subCurrency)
      const cnyAmount = exchange.convertToCNY(parseFloat(s.amount) || 0, subCurrency, rates)

      dates.forEach(date => {
        if (!billingDateMap[date]) billingDateMap[date] = []
        billingDateMap[date].push({
          id: s.id,
          name: s.name,
          amount: util.formatAmount(s.amount),
          symbol,
          cnyAmount: util.formatAmount(cnyAmount),
          showConversion: subCurrency !== 'CNY',
          cycleName: util.getCycleName(s.cycleId || s.cycle)
        })
      })
    })

    // 生成日历网格
    const grid = util.getCalendarGrid(year, month)

    // 为每个日期添加 hasBill 标记和 billCount
    grid.forEach(week => {
      week.forEach(cell => {
        const bills = billingDateMap[cell.date]
        cell.hasBill = !!bills && bills.length > 0
        cell.billCount = bills ? bills.length : 0
      })
    })

    this.setData({
      calendarGrid: grid,
      calendarYear: year,
      calendarMonth: month,
      calendarMonthCN: `${year}年${month}月`,
      billingDateMap,
      selectedDate: '',
      selectedDateBills: []
    })
  },

  /**
   * 切换到上个月
   */
  onCalendarPrev() {
    let { calendarYear, calendarMonth } = this.data
    calendarMonth--
    if (calendarMonth < 1) {
      calendarMonth = 12
      calendarYear--
    }
    this.setData({ calendarYear, calendarMonth })
    const subs = storage.getSubscriptions()
    this.buildCalendar(subs)
  },

  /**
   * 切换到下个月
   */
  onCalendarNext() {
    let { calendarYear, calendarMonth } = this.data
    calendarMonth++
    if (calendarMonth > 12) {
      calendarMonth = 1
      calendarYear++
    }
    this.setData({ calendarYear, calendarMonth })
    const subs = storage.getSubscriptions()
    this.buildCalendar(subs)
  },

  /**
   * 点击日历上的某天
   */
  onCalendarDayTap(e) {
    const date = e.currentTarget.dataset.date
    const bills = this.data.billingDateMap[date] || []

    // 如果点击已选中的日期，取消选中
    if (this.data.selectedDate === date) {
      this.setData({ selectedDate: '', selectedDateBills: [] })
      return
    }

    this.setData({
      selectedDate: date,
      selectedDateBills: bills
    })
  },

  // 阻止冒泡
  preventBubble() {},

  goAddRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  goAddSubscription() {
    wx.navigateTo({ url: '/pages/subscription/subscription' })
  },

  goRecords() {
    wx.switchTab({ url: '/pages/records/records' })
  },

  goSubscription() {
    wx.navigateTo({ url: '/pages/subscription/subscription' })
  },

  goEditRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/record/record?id=' + id })
  },

  goSubEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/sub-edit/sub-edit?id=' + id })
  }
})
