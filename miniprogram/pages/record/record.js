/**
 * 记账编辑页 - 新增/编辑收入支出记录（带自定义数字键盘）
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require('../../utils/constants')

Page({
  data: {
    isNew: true,
    recordId: '',
    form: {
      type: 'expense',
      amount: '',
      category: '',
      date: '',
      note: ''
    },
    categories: EXPENSE_CATEGORIES,
    selectedCategory: '',
    currency: '¥',
    // 备注输入
    showNoteInput: false,
    // 键盘显示状态
    showKeyboard: false
  },

  onLoad(options) {
    const settings = storage.getSettings()
    this.setData({ currency: settings.currency || '¥' })

    if (options.id) {
      // 编辑模式
      const records = storage.getRecords()
      const record = records.find(r => r.id === options.id)
      if (record) {
        const categories = record.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
        this.setData({
          isNew: false,
          recordId: record.id,
          form: {
            type: record.type,
            amount: String(record.amount),
            category: record.category,
            date: record.date,
            note: record.note || ''
          },
          categories,
          selectedCategory: record.category
        })
        wx.setNavigationBarTitle({ title: '编辑记录' })
      }
    } else {
      // 新增模式，默认今天
      this.setData({
        'form.date': util.getToday(),
        selectedCategory: ''
      })
    }
  },

  setType(e) {
    const type = e.currentTarget.dataset.type
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    this.setData({
      'form.type': type,
      categories,
      selectedCategory: '',
      'form.category': ''
    })
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      selectedCategory: id,
      'form.category': id
    })
  },

  // 点击金额区域 - 显示键盘
  onAmountTap() {
    this.setData({ showKeyboard: true })
  },

  // 隐藏键盘（确认金额）
  hideKeyboard() {
    this.setData({ showKeyboard: false })
  },

  // 键盘内确认金额
  confirmAmount() {
    this.setData({ showKeyboard: false })
  },

  // 阻止键盘区域冒泡（防止点击键盘时收起）
  preventBubble() {},

  // 自定义数字键盘输入
  onKeyTap(e) {
    const key = e.currentTarget.dataset.key
    let amount = this.data.form.amount

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
      // 限制整数部分长度
      const intPart = amount.split('.')[0]
      if (intPart.length >= 8) return
      amount += key
    }

    this.setData({ 'form.amount': amount })
  },

  // 快捷金额（如 +10, +100）
  onQuickAmount(e) {
    const value = parseFloat(e.currentTarget.dataset.value)
    let current = parseFloat(this.data.form.amount) || 0
    current += value
    this.setData({ 'form.amount': String(current) })
  },

  // 清空金额
  clearAmount() {
    this.setData({ 'form.amount': '' })
  },

  // 显示/隐藏备注输入
  toggleNoteInput() {
    this.setData({ showNoteInput: !this.data.showNoteInput })
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  onSave() {
    const { form, isNew, recordId } = this.data

    // 校验
    if (!form.amount || parseFloat(form.amount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    if (!form.category) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }
    if (!form.date) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }

    const record = {
      type: form.type,
      amount: parseFloat(form.amount),
      category: form.category,
      date: form.date,
      note: form.note.trim()
    }

    if (isNew) {
      storage.addRecord(record)
      wx.showToast({ title: '已保存', icon: 'success' })
    } else {
      storage.updateRecord(recordId, record)
      wx.showToast({ title: '已更新', icon: 'success' })
    }

    setTimeout(() => wx.navigateBack(), 800)
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条记录吗？',
      confirmColor: '#D4605A',
      success: (res) => {
        if (res.confirm) {
          storage.deleteRecord(this.data.recordId)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 800)
        }
      }
    })
  }
})
