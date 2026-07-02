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
    // 快捷记账-账户选择
    accounts: [],
    quickAccountId: '',
    quickAccountName: '不指定',
    showQuickAccountPicker: false,
    // 扣款日历
    calendarGrid: [],
    calendarYear: 0,
    calendarMonth: 0,
    calendarMonthCN: '',
    billingDateMap: {},
    selectedDate: '',
    selectedDateBills: [],
    // 待报销
    pendingReimburseCount: 0,
    pendingReimburseAmount: '0.00'
  },

  onShow() {
    this.loadData()
    // 首次启动引导
    this.checkFirstLaunch()
  },

  // 缓存订阅数据，避免重复读取
  _cachedSubs: null,

  // 检查是否首次启动，引导阅读使用方法
  checkFirstLaunch() {
    const app = getApp()
    if (app.globalData.showGuideHint) {
      // 延迟弹出，等页面渲染完成
      setTimeout(() => {
        wx.showModal({
          title: '👋 欢迎使用口袋账本',
          content: '首次使用建议先阅读「使用方法」，快速了解各项功能的用法。',
          confirmText: '去看看',
          cancelText: '稍后再看',
          success: (res) => {
            app.markFirstLaunchDone()
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/guide/guide' })
            }
          }
        })
      }, 500)
    }
  },

  loadData() {
    const settings = storage.getSettings()
    const records = storage.getRecords()
    const subs = storage.getSubscriptions()
    const currentMonth = util.getCurrentMonth()

    // 缓存订阅数据
    this._cachedSubs = subs

    // 单次遍历 records，收集月度统计 + 最近记录 + 常用分类 + 待报销统计
    let income = 0, expense = 0
    const recentRecords = []
    const categoryCount = {}
    let pendingCount = 0, pendingAmount = 0
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      if (!r || !r.date) continue

      // 月度统计 + 待报销
      if (r.date.startsWith(currentMonth)) {
        const amount = parseFloat(r.amount) || 0
        if (r.type === 'income') {
          income += amount
        } else {
          expense += amount
          if (r.reimbursementStatus === 'pending') {
            pendingCount++
            pendingAmount += amount
          }
        }
      }

      // 最近 3 条记录
      if (i < 3) {
        const catInfo = util.getCategoryInfo(r.category, r.type)
        recentRecords.push({
          ...r,
          amountFormatted: util.formatAmount(r.amount),
          categoryName: catInfo.name,
          categoryIcon: catInfo.icon,
          dateFormatted: util.formatDateCN(r.date)
        })
      }

      // 常用分类统计（最近30天）
      if (r.date >= thirtyDaysAgoStr && r.type === 'expense') {
        categoryCount[r.category] = (categoryCount[r.category] || 0) + 1
      }
    }

    // 预算
    const budget = settings.monthlyBudget || 0
    const budgetPercent = budget > 0 ? Math.round((expense / budget) * 100) : 0

    // 即将到期的订阅（单次遍历）
    const today = util.getToday()
    const rates = exchange.getRatesSync()
    let monthlyTotal = 0
    const expiringSubs = []
    const activeSubs = []

    for (let i = 0; i < subs.length; i++) {
      const s = subs[i]
      if (!s.enabled) continue

      // 订阅概览统计
      monthlyTotal += util.calcEffectiveMonthlyCost(s, rates)
      const subCurrency = s.currency || 'CNY'
      const currencySymbol = util.getCurrencySymbol(subCurrency)
      const showConversion = subCurrency !== 'CNY'
      const amountFormatted = util.formatAmount(s.amount)

      activeSubs.push({
        ...s,
        amountFormatted,
        cycleName: util.getCycleName(s.cycleId || s.cycle),
        currencySymbol,
        showConversion
      })

      // 即将到期
      const daysLeft = util.daysBetween(today, s.nextDate)
      if (daysLeft <= (s.remindDays || 3)) {
        expiringSubs.push({
          ...s,
          amountFormatted,
          nextDateFormatted: util.formatDateCN(s.nextDate),
          daysLeft,
          currencySymbol,
          showConversion
        })
      }
    }
    expiringSubs.sort((a, b) => a.daysLeft - b.daysLeft)

    // 账户列表
    const accounts = storage.getAccounts()

    // 常用分类（取前4个）
    const quickCategories = this.getQuickCategoriesFromCount(categoryCount)

    // 计算预算相关（含订阅预留）
    const subscriptionReserved = monthlyTotal
    const availableBudget = budget > 0 ? budget - expense - subscriptionReserved : 0
    const budgetWithSub = budget > 0 ? Math.round(((expense + subscriptionReserved) / budget) * 100) : 0

    this.setData({
      currentMonthCN: util.formatMonthCN(currentMonth),
      incomeFormatted: util.formatAmount(income),
      expenseFormatted: util.formatAmount(expense),
      balanceFormatted: util.formatAmount(Math.abs(income - expense)),
      balance: income - expense,
      budget,
      budgetFormatted: util.formatAmount(budget),
      budgetPercent,
      currency: settings.currency || '¥',
      accounts,
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
      showBudgetDetail: budget > 0 && subscriptionReserved > 0,
      pendingReimburseCount: pendingCount,
      pendingReimburseAmount: util.formatAmount(pendingAmount)
    })

    // 构建扣款日历
    this.buildCalendar(subs)

    // 异步刷新汇率
    exchange.getRates().catch(() => {})
  },

  // 获取常用分类（从已统计的 categoryCount 中取前4个）
  getQuickCategoriesFromCount(categoryCount) {
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
      quickAmount: '',
      quickAccountId: '',
      quickAccountName: '不指定'
    })
  },

  // 关闭快捷输入
  closeQuickInput() {
    this.setData({
      showQuickInput: false,
      quickCategory: null,
      quickAmount: '',
      quickAccountId: '',
      quickAccountName: '不指定'
    })
  },

  // 切换快捷记账账户选择器
  toggleQuickAccountPicker() {
    this.setData({ showQuickAccountPicker: !this.data.showQuickAccountPicker })
  },

  // 关闭快捷记账账户选择器
  closeQuickAccountPicker() {
    this.setData({ showQuickAccountPicker: false })
  },

  // 选择快捷记账账户
  selectQuickAccount(e) {
    const id = e.currentTarget.dataset.id
    const account = id ? this.data.accounts.find(a => a.id === id) : null
    this.setData({
      quickAccountId: id || '',
      quickAccountName: account ? account.name : '不指定',
      showQuickAccountPicker: false
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
    const { quickCategory, quickAmount, quickAccountId } = this.data
    if (!quickCategory || !quickAmount || parseFloat(quickAmount) <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }

    const record = {
      type: 'expense',
      category: quickCategory.id,
      amount: parseFloat(quickAmount),
      date: util.getToday(),
      note: '',
      accountId: quickAccountId || ''
    }

    storage.addRecord(record)
    // 同步账户余额
    storage.syncAccountBalance(null, record)
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
    // 使用缓存的订阅数据，避免重复读取
    this.buildCalendar(this._cachedSubs || storage.getSubscriptions())
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
    // 使用缓存的订阅数据，避免重复读取
    this.buildCalendar(this._cachedSubs || storage.getSubscriptions())
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
