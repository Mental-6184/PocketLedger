/**
 * 订阅管理页 - 订阅列表、到期提醒、自动扣费
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')
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
    this.checkExpiredSubs()
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

  /**
   * 检测过期订阅，弹窗提示用户续费
   */
  checkExpiredSubs() {
    const subs = storage.getSubscriptions()
    const today = util.getToday()

    // 找出已过期（nextDate < 今天）且启用中的订阅
    const expiredSubs = subs.filter(s => {
      if (!s.enabled) return false
      return s.nextDate && s.nextDate < today
    })

    if (expiredSubs.length === 0) return

    // 单个过期订阅：直接弹确认
    if (expiredSubs.length === 1) {
      const sub = expiredSubs[0]
      wx.showModal({
        title: '订阅到期',
        content: `「${sub.name}」已于 ${util.formatDateCN(sub.nextDate)} 到期，是否生成扣费记录？`,
        confirmText: '续费',
        confirmColor: '#2AA198',
        success: (res) => {
          if (res.confirm) {
            this._doRenew(sub.id)
          }
        }
      })
      return
    }

    // 多个过期订阅：弹 ActionSheet 列表
    const itemList = expiredSubs.map(s =>
      `${s.name}（${util.formatDateCN(s.nextDate)}到期）`
    )
    itemList.push('全部续费')

    wx.showActionSheet({
      itemList,
      success: (res) => {
        if (res.tapIndex < expiredSubs.length) {
          // 选了单个订阅
          this._doRenew(expiredSubs[res.tapIndex].id)
        } else {
          // 全部续费
          expiredSubs.forEach(s => this._doRenew(s.id))
        }
      }
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
    this._doRenew(id)
  },

  /**
   * 执行续费：生成支出记录 + 更新下次扣费日期
   */
  _doRenew(subId) {
    const subs = storage.getSubscriptions()
    const sub = subs.find(s => s.id === subId)
    if (!sub) return

    // 生成支出记录
    const record = {
      type: 'expense',
      amount: parseFloat(sub.amount) || 0,
      category: sub.category || 'other_expense',
      date: sub.nextDate || util.getToday(),
      note: sub.name + ' - 订阅扣费',
      accountId: 'acc_wechat'
    }
    const savedRecord = storage.addRecord(record)
    storage.syncAccountBalance(null, savedRecord)

    // 更新下次扣费日期
    const nextDate = util.calcNextDate(sub.nextDate, sub.cycleId || sub.cycle)
    storage.updateSubscription(subId, { nextDate })

    this.loadData()
    wx.showToast({ title: '已续费并生成扣费记录', icon: 'success' })
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
