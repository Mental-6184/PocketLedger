/**
 * 订阅管理页
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')
const { SUBSCRIPTION_CYCLES } = require('../../utils/constants')
const exchange = require('../../utils/exchange')

Page({
  data: {
    subs: [],
    expiringSubs: [],
    monthlyCost: '0.00',
    yearlyCost: '0.00',
    currency: '¥',
    exchangeRates: null
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const settings = storage.getSettings()
    const subs = storage.getSubscriptions()
    const today = util.getToday()
    const rates = exchange.getRatesSync()

    // 格式化订阅数据（含汇率换算）
    const formattedSubs = subs.map(s => {
      const subCurrency = s.currency || 'CNY'
      const amount = parseFloat(s.amount) || 0
      const cnyAmount = exchange.convertToCNY(amount, subCurrency, rates)
      const showConversion = subCurrency !== 'CNY'

      return {
        ...s,
        amountFormatted: util.formatAmount(amount),
        cycleName: util.getCycleName(s.cycleId || s.cycle),
        nextDateFormatted: util.formatDateCN(s.nextDate),
        daysLeft: util.daysBetween(today, s.nextDate),
        subCurrency,
        cnyAmountFormatted: util.formatAmount(cnyAmount),
        showConversion,
        currencySymbol: util.getCurrencySymbol(subCurrency),
        spreadYearly: s.spreadYearly || false
      }
    })

    // 即将到期的订阅
    const expiringSubs = formattedSubs
      .filter(s => s.enabled && s.daysLeft <= (s.remindDays || 3))
      .sort((a, b) => a.daysLeft - b.daysLeft)

    // 计算月均/年均花费（人民币，含汇率换算+年付分摊）
    let monthlyTotal = 0
    subs.forEach(s => {
      monthlyTotal += util.calcEffectiveMonthlyCost(s, rates)
    })

    // 异步刷新汇率（下次 onShow 生效）
    exchange.getRates().then(({ rates: freshRates }) => {
      this.setData({ exchangeRates: freshRates })
    }).catch(() => {})

    this.setData({
      subs: formattedSubs,
      expiringSubs,
      monthlyCost: util.formatAmount(monthlyTotal),
      yearlyCost: util.formatAmount(monthlyTotal * 12),
      currency: settings.currency || '¥'
    })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/sub-edit/sub-edit' })
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/sub-edit/sub-edit?id=' + id })
  },

  toggleEnabled(e) {
    const id = e.currentTarget.dataset.id
    const subs = storage.getSubscriptions()
    const sub = subs.find(s => s.id === id)
    if (sub) {
      storage.updateSubscription(id, { enabled: !sub.enabled })
      this.loadData()
      wx.showToast({ title: sub.enabled ? '已暂停' : '已启用', icon: 'success' })
    }
  },

  onRenew(e) {
    const id = e.currentTarget.dataset.id
    const subs = storage.getSubscriptions()
    const sub = subs.find(s => s.id === id)
    if (sub) {
      const nextDate = util.calcNextDate(sub.nextDate, sub.cycleId || sub.cycle)
      storage.updateSubscription(id, { nextDate })
      this.loadData()
      wx.showToast({ title: '已续费至 ' + util.formatDateCN(nextDate), icon: 'success' })
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个订阅吗？',
      confirmColor: '#D4605A',
      success: (res) => {
        if (res.confirm) {
          storage.deleteSubscription(id)
          this.loadData()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }
})
