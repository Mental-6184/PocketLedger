/**
 * 订阅编辑页 - 新增/编辑订阅
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')
const { SUBSCRIPTION_CYCLES, CURRENCIES, EXPENSE_CATEGORIES } = require('../../utils/constants')
const exchange = require('../../utils/exchange')

Page({
  data: {
    isNew: true,
    subId: '',
    form: {
      name: '',
      amount: '',
      cycle: 'monthly',
      nextDate: '',
      remindDays: 3,
      note: '',
      enabled: true,
      currency: 'CNY',
      spreadYearly: false,
      category: 'other_expense'
    },
    categories: EXPENSE_CATEGORIES,
    cycles: SUBSCRIPTION_CYCLES,
    selectedCycle: 'monthly',
    remindOptions: [0, 1, 3, 5, 7],
    currency: '¥',
    // 币种相关
    currencies: CURRENCIES,
    selectedCurrency: 'CNY',
    showCurrencyPicker: false,
    // 汇率
    exchangeRates: null,
    cnyPreview: ''
  },

  onLoad(options) {
    const settings = storage.getSettings()
    this.setData({ currency: settings.currency || '¥' })

    // 加载汇率
    exchange.getRates().then(({ rates }) => {
      this.setData({ exchangeRates: rates })
    }).catch(() => {})

    if (options.id) {
      // 编辑模式
      const subs = storage.getSubscriptions()
      const sub = subs.find(s => s.id === options.id)
      if (sub) {
        const subCurrency = sub.currency || 'CNY'
        this.setData({
          isNew: false,
          subId: sub.id,
          form: {
            name: sub.name,
            amount: String(sub.amount),
            cycle: sub.cycleId || sub.cycle,
            nextDate: sub.nextDate,
            remindDays: sub.remindDays || 0,
            note: sub.note || '',
            enabled: sub.enabled !== false,
            currency: subCurrency,
            spreadYearly: sub.spreadYearly || false,
            category: sub.category || 'other_expense'
          },
          selectedCycle: sub.cycleId || sub.cycle,
          selectedCurrency: subCurrency
        })
        this.updateCnyPreview(sub.amount, subCurrency)
        wx.setNavigationBarTitle({ title: '编辑订阅' })
      }
    } else {
      // 新增模式，默认下个月今天
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      this.setData({
        'form.nextDate': util.formatDate(nextMonth)
      })
    }
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onAmountInput(e) {
    let val = e.detail.value
    val = val.replace(/[^\d.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) val = parts[0] + '.' + parts[1]
    if (parts[1] && parts[1].length > 2) val = parts[0] + '.' + parts[1].substring(0, 2)
    this.setData({ 'form.amount': val })
    this.updateCnyPreview(val, this.data.selectedCurrency)
  },

  // 币种选择
  toggleCurrencyPicker() {
    this.setData({ showCurrencyPicker: !this.data.showCurrencyPicker })
  },

  closeCurrencyPicker() {
    this.setData({ showCurrencyPicker: false })
  },

  selectCurrency(e) {
    const code = e.currentTarget.dataset.code
    this.setData({
      selectedCurrency: code,
      'form.currency': code,
      showCurrencyPicker: false
    })
    this.updateCnyPreview(this.data.form.amount, code)
  },

  // 更新人民币预览
  updateCnyPreview(amount, currencyCode) {
    if (!amount || currencyCode === 'CNY') {
      this.setData({ cnyPreview: '' })
      return
    }
    const rates = this.data.exchangeRates || exchange.getRatesSync()
    const cnyAmount = exchange.convertToCNY(parseFloat(amount), currencyCode, rates)
    if (cnyAmount > 0) {
      this.setData({ cnyPreview: '≈¥' + util.formatAmount(cnyAmount) })
    } else {
      this.setData({ cnyPreview: '' })
    }
  },

  // 年付分摊开关
  onSpreadYearlyChange(e) {
    this.setData({ 'form.spreadYearly': e.detail.value })
  },

  selectCycle(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      selectedCycle: id,
      'form.cycle': id
    })
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ 'form.category': id })
  },

  onNextDateChange(e) {
    this.setData({ 'form.nextDate': e.detail.value })
  },

  selectRemind(e) {
    this.setData({ 'form.remindDays': e.currentTarget.dataset.days })
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  onEnabledChange(e) {
    this.setData({ 'form.enabled': e.detail.value })
  },

  onSave() {
    const { form, isNew, subId } = this.data

    // 校验
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入订阅名称', icon: 'none' })
      return
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    if (!form.nextDate) {
      wx.showToast({ title: '请选择扣费日期', icon: 'none' })
      return
    }

    const sub = {
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      cycleId: form.cycle,
      nextDate: form.nextDate,
      remindDays: form.remindDays,
      note: form.note.trim(),
      enabled: form.enabled,
      currency: form.currency || 'CNY',
      spreadYearly: form.spreadYearly || false,
      category: form.category || 'other_expense'
    }

    if (isNew) {
      storage.addSubscription(sub)
      wx.showToast({ title: '已添加', icon: 'success' })
    } else {
      storage.updateSubscription(subId, sub)
      wx.showToast({ title: '已更新', icon: 'success' })
    }

    setTimeout(() => wx.navigateBack(), 800)
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个订阅吗？',
      confirmColor: '#D4605A',
      success: (res) => {
        if (res.confirm) {
          storage.deleteSubscription(this.data.subId)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 800)
        }
      }
    })
  }
})
