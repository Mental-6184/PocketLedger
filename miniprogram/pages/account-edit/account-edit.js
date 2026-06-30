/**
 * 账户编辑页 - 新增/编辑账户
 */
const storage = require('../../utils/storage')
const { ACCOUNT_TYPES } = require('../../utils/constants')

// 常用账户图标
const ACCOUNT_ICONS = ['💬', '🔵', '💳', '💵', '🏦', '💰', '🪙', '💎', '📱', '🏧', '🎁', '🐷']

Page({
  data: {
    isNew: true,
    accountId: '',
    form: {
      name: '',
      icon: '💳',
      type: 'ewallet',
      balance: '',
      includeInTotal: true
    },
    accountTypes: ACCOUNT_TYPES,
    selectedType: 'ewallet',
    icons: ACCOUNT_ICONS,
    showIconPicker: false,
    currency: '¥'
  },

  onLoad(options) {
    const settings = storage.getSettings()
    this.setData({ currency: settings.currency || '¥' })

    if (options.id) {
      const accounts = storage.getAccounts()
      const account = accounts.find(a => a.id === options.id)
      if (account) {
        this.setData({
          isNew: false,
          accountId: account.id,
          form: {
            name: account.name,
            icon: account.icon || '💳',
            type: account.type || 'ewallet',
            balance: String(account.balance || 0),
            includeInTotal: account.includeInTotal !== false
          },
          selectedType: account.type || 'ewallet'
        })
        wx.setNavigationBarTitle({ title: '编辑账户' })
      }
    }
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onBalanceInput(e) {
    let val = e.detail.value
    val = val.replace(/[^\d.\-]/g, '')
    // 允许负数（信用卡）
    if (val.startsWith('-')) {
      val = '-' + val.substring(1).replace(/-/g, '')
    }
    const parts = val.split('.')
    if (parts.length > 2) val = parts[0] + '.' + parts[1]
    if (parts[1] && parts[1].length > 2) val = parts[0] + '.' + parts[1].substring(0, 2)
    this.setData({ 'form.balance': val })
  },

  selectType(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      selectedType: id,
      'form.type': id
    })
  },

  toggleIconPicker() {
    this.setData({ showIconPicker: !this.data.showIconPicker })
  },

  closeIconPicker() {
    this.setData({ showIconPicker: false })
  },

  selectIcon(e) {
    const icon = e.currentTarget.dataset.icon
    this.setData({
      'form.icon': icon,
      showIconPicker: false
    })
  },

  onIncludeChange(e) {
    this.setData({ 'form.includeInTotal': e.detail.value })
  },

  preventBubble() {},

  onSave() {
    const { form, isNew, accountId } = this.data

    if (!form.name.trim()) {
      wx.showToast({ title: '请输入账户名称', icon: 'none' })
      return
    }

    const account = {
      name: form.name.trim(),
      icon: form.icon || '💳',
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      includeInTotal: form.includeInTotal
    }

    if (isNew) {
      storage.addAccount(account)
      wx.showToast({ title: '已添加', icon: 'success' })
    } else {
      storage.updateAccount(accountId, account)
      wx.showToast({ title: '已更新', icon: 'success' })
    }

    setTimeout(() => wx.navigateBack(), 800)
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个账户吗？已关联的记录不会被删除。',
      confirmColor: '#D4605A',
      success: (res) => {
        if (res.confirm) {
          storage.deleteAccount(this.data.accountId)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 800)
        }
      }
    })
  }
})
