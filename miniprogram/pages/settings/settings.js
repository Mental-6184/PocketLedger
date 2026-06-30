/**
 * 设置页 - 偏好、功能、数据管理
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')

Page({
  data: {
    budgetInput: '',
    currency: '¥',
    currencyOptions: ['¥', '$', '€', '£', '₩', '₹'],
    recordCount: 0,
    subCount: 0,
    accountCount: 0,
    showCurrency: false
  },

  onShow() {
    this.loadSettings()
  },

  loadSettings() {
    const settings = storage.getSettings()
    const records = storage.getRecords()
    const subs = storage.getSubscriptions()
    const accounts = storage.getAccounts()

    this.setData({
      budgetInput: settings.monthlyBudget ? String(settings.monthlyBudget) : '',
      currency: settings.currency || '¥',
      recordCount: records.length,
      subCount: subs.length,
      accountCount: accounts.length
    })
  },

  onBudgetInput(e) {
    let val = e.detail.value
    val = val.replace(/[^\d.]/g, '')
    this.setData({ budgetInput: val })
  },

  saveBudget() {
    const budget = parseFloat(this.data.budgetInput) || 0
    storage.updateSettings({ monthlyBudget: budget })
    if (budget > 0) {
      wx.showToast({ title: '预算已保存', icon: 'success' })
    }
  },

  onCurrencyTap() {
    this.setData({ showCurrency: true })
  },

  hideCurrency() {
    this.setData({ showCurrency: false })
  },

  setCurrency(e) {
    const currency = e.currentTarget.dataset.currency
    storage.updateSettings({ currency })
    this.setData({ currency, showCurrency: false })
    wx.showToast({ title: '货币已切换', icon: 'success' })
  },

  goSubscription() {
    wx.navigateTo({ url: '/pages/subscription/subscription' })
  },

  goAccounts() {
    wx.navigateTo({ url: '/pages/accounts/accounts' })
  },

  goGuide() {
    wx.navigateTo({ url: '/pages/guide/guide' })
  },

  onExport() {
    const data = storage.exportAllData()
    const jsonStr = JSON.stringify(data, null, 2)

    wx.setClipboardData({
      data: jsonStr,
      success: () => {
        wx.showModal({
          title: '导出成功',
          content: '数据已复制到剪贴板，您可以粘贴保存到文件中。',
          showCancel: false,
          confirmText: '知道了'
        })
      }
    })
  },

  onImport() {
    wx.showModal({
      title: '导入数据',
      content: '请将 JSON 数据复制到剪贴板，点击确定后将从剪贴板导入。',
      success: (res) => {
        if (res.confirm) {
          wx.getClipboardData({
            success: (clipRes) => {
              try {
                const data = JSON.parse(clipRes.data)
                const result = storage.importAllData(data)
                if (result.success) {
                  wx.showToast({ title: '导入成功', icon: 'success' })
                  this.loadSettings()
                } else {
                  wx.showToast({ title: result.msg, icon: 'none' })
                }
              } catch (e) {
                wx.showToast({ title: '剪贴板数据不是有效JSON', icon: 'none' })
              }
            }
          })
        }
      }
    })
  },

  onClearData() {
    wx.showModal({
      title: '⚠️ 警告',
      content: '此操作将清空所有记账记录、订阅和设置数据，且无法恢复。确定要继续吗？',
      confirmText: '确认清空',
      confirmColor: '#D4605A',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '最后确认',
            content: '真的要删除所有数据吗？',
            confirmText: '删除',
            confirmColor: '#D4605A',
            success: (res2) => {
              if (res2.confirm) {
                storage.clearAllData()
                this.loadSettings()
                wx.showToast({ title: '已清空', icon: 'success' })
              }
            }
          })
        }
      }
    })
  }
})
