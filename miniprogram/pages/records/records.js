/**
 * 记账列表页 - 月份筛选、分类筛选、关键词搜索、删除
 */
const storage = require('../../utils/storage')
const util = require('../../utils/util')
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require('../../utils/constants')

Page({
  data: {
    currentMonth: '',
    currentMonthCN: '',
    filterType: 'all',
    filterCategory: '',
    searchKeyword: '',
    currentCategories: [],
    filteredRecords: [],
    groupedRecords: [],
    monthIncome: '0.00',
    monthExpense: '0.00',
    currency: '¥'
  },

  // 搜索防抖计时器
  _searchTimer: null,

  onShow() {
    const settings = storage.getSettings()
    const currentMonth = util.getCurrentMonth()
    this.setData({
      currentMonth,
      currentMonthCN: util.formatMonthCN(currentMonth),
      currency: settings.currency || '¥'
    })
    this.refreshList()
  },

  refreshList() {
    const records = storage.getRecords()
    const { currentMonth, filterType, filterCategory, searchKeyword } = this.data

    // 账户映射（提前构建，供搜索使用）
    const accounts = storage.getAccounts()
    const accountMap = {}
    accounts.forEach(a => { accountMap[a.id] = a })

    // 按月份筛选
    let filtered = records.filter(r => r.date && r.date.startsWith(currentMonth))

    // 按类型筛选
    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.type === filterType)
    }

    // 按分类筛选
    if (filterCategory) {
      filtered = filtered.filter(r => r.category === filterCategory)
    }

    // 按关键词搜索（备注 + 分类名 + 账户名）
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      filtered = filtered.filter(r => {
        const noteMatch = r.note && r.note.toLowerCase().includes(keyword)
        const catInfo = util.getCategoryInfo(r.category, r.type)
        const catMatch = catInfo.name && catInfo.name.toLowerCase().includes(keyword)
        const account = r.accountId ? accountMap[r.accountId] : null
        const accMatch = account && account.name && account.name.toLowerCase().includes(keyword)
        return noteMatch || catMatch || accMatch
      })
    }

    // 月度统计（全量，不受分类筛选影响）
    const monthRecords = records.filter(r => r.date && r.date.startsWith(currentMonth))
    const monthIncome = monthRecords
      .filter(r => r.type === 'income')
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    const monthExpense = monthRecords
      .filter(r => r.type === 'expense')
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

    // 格式化记录
    const formatted = filtered.map(r => {
      const catInfo = util.getCategoryInfo(r.category, r.type)
      const account = r.accountId ? accountMap[r.accountId] : null
      return {
        ...r,
        amountFormatted: util.formatAmount(r.amount),
        categoryName: catInfo.name,
        categoryIcon: catInfo.icon,
        accountName: account ? account.name : '',
        accountIcon: account ? account.icon : '',
        reimbursementStatus: r.reimbursementStatus || 'none'
      }
    })

    // 按日期分组
    const groupMap = {}
    formatted.forEach(r => {
      if (!groupMap[r.date]) groupMap[r.date] = []
      groupMap[r.date].push(r)
    })
    const groupedRecords = Object.keys(groupMap)
      .sort((a, b) => b.localeCompare(a))
      .map(date => {
        const recs = groupMap[date]
        const dayIncome = recs.filter(r => r.type === 'income').reduce((s, r) => s + parseFloat(r.amount), 0)
        const dayExpense = recs.filter(r => r.type === 'expense').reduce((s, r) => s + parseFloat(r.amount), 0)
        let dayTotal = ''
        if (dayIncome > 0) dayTotal += '收 ' + util.formatAmount(dayIncome) + ' '
        if (dayExpense > 0) dayTotal += '支 ' + util.formatAmount(dayExpense)
        return {
          date,
          dateFormatted: util.formatDateCN(date),
          dayTotal: dayTotal.trim(),
          records: recs
        }
      })

    this.setData({
      filteredRecords: formatted,
      groupedRecords,
      monthIncome: util.formatAmount(monthIncome),
      monthExpense: util.formatAmount(monthExpense)
    })
  },

  onMonthChange(e) {
    const month = e.detail.value // YYYY-MM
    this.setData({
      currentMonth: month,
      currentMonthCN: util.formatMonthCN(month)
    })
    this.refreshList()
  },

  setFilterType(e) {
    const type = e.currentTarget.dataset.type
    const categories = type === 'income' ? INCOME_CATEGORIES :
                       type === 'expense' ? EXPENSE_CATEGORIES : []
    this.setData({
      filterType: type,
      filterCategory: '',
      currentCategories: categories
    })
    this.refreshList()
  },

  setFilterCategory(e) {
    this.setData({ filterCategory: e.currentTarget.dataset.cat })
    this.refreshList()
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => {
      this.setData({ searchKeyword: keyword })
      this.refreshList()
    }, 300)
  },

  onClearSearch() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.setData({ searchKeyword: '' })
    this.refreshList()
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/record/record?id=' + id })
  },

  onLongPress(e) {
    const id = e.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/record/record?id=' + id })
        } else if (res.tapIndex === 1) {
          this.confirmDelete(id)
        }
      }
    })
  },

  confirmDelete(id) {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条记录吗？',
      confirmColor: '#D4605A',
      success: (res) => {
        if (res.confirm) {
          // 删除前读取旧记录，用于回退余额
          const oldRecords = storage.getRecords()
          const oldRecord = oldRecords.find(r => r.id === id)
          storage.deleteRecord(id)
          // 回退账户余额
          storage.syncAccountBalance(oldRecord, null)
          this.refreshList()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }
})
