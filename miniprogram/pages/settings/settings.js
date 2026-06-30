/**
 * 设置页 - 偏好、功能、数据管理
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')
const { generateExcel, generateJsonBackup, exportToFile } = require('../../utils/export')

Page({
  data: {
    budgetInput: '',
    budget: 0,
    currency: '¥',
    currencyOptions: ['¥', '$', '€', '£', '₩', '₹'],
    recordCount: 0,
    subCount: 0,
    accountCount: 0,
    showCurrency: false,
    showExportSheet: false,
    monthlySpent: '0.00',
    budgetRemaining: '0.00',
    budgetProgress: 0,
    budgetProgressColor: '#2aa198',
    budgetStatusClass: 'none',
    budgetStatusText: '未设置'
  },

  onShow() {
    this.loadSettings()
  },

  loadSettings() {
    const settings = storage.getSettings()
    const records = storage.getRecords()
    const subs = storage.getSubscriptions()
    const accounts = storage.getAccounts()

    const budget = settings.monthlyBudget || 0
    const monthlySpent = this.calcMonthlySpent(records)
    const budgetRemaining = Math.max(0, budget - monthlySpent)
    const budgetProgress = budget > 0 ? Math.min(100, (monthlySpent / budget) * 100) : 0

    let budgetProgressColor = '#2aa198'
    let budgetStatusClass = 'none'
    let budgetStatusText = '未设置'

    if (budget > 0) {
      if (budgetProgress < 70) {
        budgetProgressColor = '#2aa198'
        budgetStatusClass = 'safe'
        budgetStatusText = '正常'
      } else if (budgetProgress < 100) {
        budgetProgressColor = '#f59e0b'
        budgetStatusClass = 'warning'
        budgetStatusText = '接近上限'
      } else {
        budgetProgressColor = '#d4605a'
        budgetStatusClass = 'over'
        budgetStatusText = '已超支'
      }
    }

    this.setData({
      budgetInput: budget > 0 ? String(budget) : '',
      budget,
      currency: settings.currency || '¥',
      recordCount: records.length,
      subCount: subs.length,
      accountCount: accounts.length,
      monthlySpent: monthlySpent.toFixed(2),
      budgetRemaining: budgetRemaining.toFixed(2),
      budgetProgress,
      budgetProgressColor,
      budgetStatusClass,
      budgetStatusText
    })
  },

  calcMonthlySpent(records) {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    return records
      .filter(r => {
        if (r.type !== 'expense') return false
        const d = new Date(r.date)
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth
      })
      .reduce((sum, r) => sum + Math.abs(r.amount), 0)
  },

  onBudgetInput(e) {
    let val = e.detail.value
    val = val.replace(/[^\d.]/g, '')
    this.setData({ budgetInput: val })
  },

  saveBudget() {
    const budget = parseFloat(this.data.budgetInput) || 0
    storage.updateSettings({ monthlyBudget: budget })
    this.loadSettings() // 重新计算预算状态
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
    this.setData({ showExportSheet: true })
  },

  hideExportSheet() {
    this.setData({ showExportSheet: false })
  },

  onExportExcel() {
    this.setData({ showExportSheet: false })
    wx.showLoading({ title: '生成中...' })

    const data = storage.exportAllData()
    const csv = generateExcel(data)
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

    exportToFile(csv, `口袋账本_${timestamp}`, '.csv').then(result => {
      wx.hideLoading()
      if (result === 'shared') {
        wx.showToast({ title: '已发送', icon: 'success' })
      } else if (result === 'saved') {
        wx.showToast({ title: '已保存', icon: 'success' })
      } else {
        // 降级：复制到剪贴板
        wx.setClipboardData({
          data: csv,
          success: () => {
            wx.showModal({
              title: '提示',
              content: '文件分享不可用，数据已复制到剪贴板。',
              showCancel: false
            })
          }
        })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
    })
  },

  onExportJson() {
    this.setData({ showExportSheet: false })
    wx.showLoading({ title: '生成中...' })

    const data = storage.exportAllData()
    const jsonStr = generateJsonBackup(data)
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

    exportToFile(jsonStr, `口袋账本_${timestamp}`, '.json').then(result => {
      wx.hideLoading()
      if (result === 'shared') {
        wx.showToast({ title: '已发送', icon: 'success' })
      } else if (result === 'saved') {
        wx.showToast({ title: '已保存', icon: 'success' })
      } else {
        // 降级：复制到剪贴板
        wx.setClipboardData({
          data: jsonStr,
          success: () => {
            wx.showModal({
              title: '提示',
              content: '文件分享不可用，数据已复制到剪贴板。',
              showCancel: false
            })
          }
        })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
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
