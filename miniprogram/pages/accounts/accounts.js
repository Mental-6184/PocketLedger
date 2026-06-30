/**
 * 账户管理页 - 查看、添加、编辑、删除账户
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')

Page({
  data: {
    accounts: [],
    totalBalance: '0.00',
    currency: '¥'
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const settings = storage.getSettings()
    const accounts = storage.getAccounts()
    const records = storage.getRecords()
    const currentMonth = util.getCurrentMonth()

    // 计算各账户本月收支和余额
    const formatted = accounts.map(acc => {
      const accRecords = records.filter(r => r.accountId === acc.id)
      const monthRecords = accRecords.filter(r => r.date && r.date.startsWith(currentMonth))
      const monthIncome = monthRecords.filter(r => r.type === 'income').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      const monthExpense = monthRecords.filter(r => r.type === 'expense').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

      return {
        ...acc,
        balanceFormatted: util.formatAmount(acc.balance || 0),
        monthIncomeFormatted: util.formatAmount(monthIncome),
        monthExpenseFormatted: util.formatAmount(monthExpense),
        hasActivity: monthIncome > 0 || monthExpense > 0
      }
    })

    // 计算总资产（只统计 includeInTotal 的账户）
    const totalBalance = accounts
      .filter(a => a.includeInTotal !== false)
      .reduce((s, a) => s + (parseFloat(a.balance) || 0), 0)

    this.setData({
      accounts: formatted,
      totalBalance: util.formatAmount(totalBalance),
      currency: settings.currency || '¥'
    })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/account-edit/account-edit' })
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/account-edit/account-edit?id=' + id })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const account = this.data.accounts.find(a => a.id === id)
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${account ? account.name : ''}"账户吗？已关联的记录不会被删除。`,
      confirmColor: '#D4605A',
      success: (res) => {
        if (res.confirm) {
          storage.deleteAccount(id)
          this.loadData()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }
})
