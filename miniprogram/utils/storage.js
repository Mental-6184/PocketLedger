/**
 * 本地存储工具 - 所有数据持久化的唯一出口
 */
const { STORAGE_KEYS, DEFAULT_SETTINGS } = require('./constants')

/**
 * 生成唯一 ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
}

// ==================== 内存缓存 ====================
// 避免每次读取都访问 wx.getStorageSync

const _cache = {
  records: null,
  subscriptions: null,
  accounts: null,
  settings: null
}

function _invalidateCache(key) {
  _cache[key] = null
}

// ==================== 记账记录 ====================

function getRecords() {
  if (_cache.records === null) {
    _cache.records = wx.getStorageSync(STORAGE_KEYS.RECORDS) || []
  }
  return _cache.records
}

function saveRecords(records) {
  _cache.records = records
  wx.setStorageSync(STORAGE_KEYS.RECORDS, records)
}

function addRecord(record) {
  const records = getRecords()
  record.id = generateId()
  record.createdAt = Date.now()
  records.unshift(record)
  saveRecords(records)
  return record
}

function updateRecord(id, data) {
  const records = getRecords()
  const index = records.findIndex(r => r.id === id)
  if (index > -1) {
    records[index] = { ...records[index], ...data }
    saveRecords(records)
    return records[index]
  }
  return null
}

function deleteRecord(id) {
  const records = getRecords()
  const filtered = records.filter(r => r.id !== id)
  saveRecords(filtered)
  return filtered.length < records.length
}

// ==================== 订阅项目 ====================

function getSubscriptions() {
  if (_cache.subscriptions === null) {
    _cache.subscriptions = wx.getStorageSync(STORAGE_KEYS.SUBSCRIPTIONS) || []
  }
  return _cache.subscriptions
}

function saveSubscriptions(subs) {
  _cache.subscriptions = subs
  wx.setStorageSync(STORAGE_KEYS.SUBSCRIPTIONS, subs)
}

function addSubscription(sub) {
  const subs = getSubscriptions()
  sub.id = generateId()
  sub.createdAt = Date.now()
  subs.push(sub)
  saveSubscriptions(subs)
  return sub
}

function updateSubscription(id, data) {
  const subs = getSubscriptions()
  const index = subs.findIndex(s => s.id === id)
  if (index > -1) {
    subs[index] = { ...subs[index], ...data }
    saveSubscriptions(subs)
    return subs[index]
  }
  return null
}

function deleteSubscription(id) {
  const subs = getSubscriptions()
  const filtered = subs.filter(s => s.id !== id)
  saveSubscriptions(filtered)
  return filtered.length < subs.length
}

// ==================== 账户 ====================

function getAccounts() {
  if (_cache.accounts === null) {
    let accounts = wx.getStorageSync(STORAGE_KEYS.ACCOUNTS)
    if (!accounts || accounts.length === 0) {
      // 首次使用，初始化默认账户
      const { DEFAULT_ACCOUNTS } = require('./constants')
      accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a, createdAt: Date.now() }))
      saveAccounts(accounts)
    }
    _cache.accounts = accounts
  }
  return _cache.accounts
}

function saveAccounts(accounts) {
  _cache.accounts = accounts
  wx.setStorageSync(STORAGE_KEYS.ACCOUNTS, accounts)
}

function addAccount(account) {
  const accounts = getAccounts()
  account.id = generateId()
  account.createdAt = Date.now()
  account.balance = account.balance || 0
  account.includeInTotal = account.includeInTotal !== false
  accounts.push(account)
  saveAccounts(accounts)
  return account
}

function updateAccount(id, data) {
  const accounts = getAccounts()
  const index = accounts.findIndex(a => a.id === id)
  if (index > -1) {
    accounts[index] = { ...accounts[index], ...data }
    saveAccounts(accounts)
    return accounts[index]
  }
  return null
}

function deleteAccount(id) {
  const accounts = getAccounts()
  const filtered = accounts.filter(a => a.id !== id)
  if (filtered.length === accounts.length) return false

  // 清理关联记录的 accountId
  const records = getRecords()
  let recordsChanged = false
  for (const r of records) {
    if (r.accountId === id) {
      r.accountId = ''
      recordsChanged = true
    }
  }
  if (recordsChanged) saveRecords(records)

  // 清理关联订阅的 accountId
  const subs = getSubscriptions()
  let subsChanged = false
  for (const s of subs) {
    if (s.accountId === id) {
      s.accountId = ''
      subsChanged = true
    }
  }
  if (subsChanged) saveSubscriptions(subs)

  saveAccounts(filtered)
  return true
}

// ==================== 设置 ====================

function getSettings() {
  if (_cache.settings === null) {
    const settings = wx.getStorageSync(STORAGE_KEYS.SETTINGS)
    _cache.settings = { ...DEFAULT_SETTINGS, ...settings }
  }
  return _cache.settings
}

function saveSettings(settings) {
  _cache.settings = settings
  wx.setStorageSync(STORAGE_KEYS.SETTINGS, settings)
}

function updateSettings(data) {
  const settings = getSettings()
  const updated = { ...settings, ...data }
  saveSettings(updated)
  return updated
}

// ==================== 数据导入导出 ====================

function exportAllData() {
  return {
    version: '1.1.0',
    exportTime: new Date().toISOString(),
    records: getRecords(),
    subscriptions: getSubscriptions(),
    accounts: getAccounts(),
    settings: getSettings()
  }
}

function importAllData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { success: false, msg: '数据格式无效：不是有效的对象' }
  }

  // 校验 records
  if (data.records) {
    if (!Array.isArray(data.records)) {
      return { success: false, msg: '数据格式无效：records 应为数组' }
    }
    const validTypes = ['income', 'expense']
    for (let i = 0; i < data.records.length; i++) {
      const r = data.records[i]
      if (!r || typeof r !== 'object') {
        return { success: false, msg: `records[${i}] 格式无效` }
      }
      if (!validTypes.includes(r.type)) {
        return { success: false, msg: `records[${i}].type 必须为 income 或 expense` }
      }
      if (typeof r.amount !== 'number' || r.amount < 0) {
        return { success: false, msg: `records[${i}].amount 必须为非负数字` }
      }
    }
  }

  // 校验 subscriptions
  if (data.subscriptions) {
    if (!Array.isArray(data.subscriptions)) {
      return { success: false, msg: '数据格式无效：subscriptions 应为数组' }
    }
    for (let i = 0; i < data.subscriptions.length; i++) {
      const s = data.subscriptions[i]
      if (!s || typeof s !== 'object') {
        return { success: false, msg: `subscriptions[${i}] 格式无效` }
      }
      if (typeof s.amount !== 'number' || s.amount < 0) {
        return { success: false, msg: `subscriptions[${i}].amount 必须为非负数字` }
      }
    }
  }

  // 校验 accounts
  if (data.accounts) {
    if (!Array.isArray(data.accounts)) {
      return { success: false, msg: '数据格式无效：accounts 应为数组' }
    }
    for (let i = 0; i < data.accounts.length; i++) {
      const a = data.accounts[i]
      if (!a || typeof a !== 'object') {
        return { success: false, msg: `accounts[${i}] 格式无效` }
      }
    }
  }

  // 校验 settings
  if (data.settings && typeof data.settings !== 'object') {
    return { success: false, msg: '数据格式无效：settings 应为对象' }
  }

  // 全部校验通过，执行导入
  if (data.records) saveRecords(data.records)
  if (data.subscriptions) saveSubscriptions(data.subscriptions)
  if (data.accounts) saveAccounts(data.accounts)
  if (data.settings) saveSettings(data.settings)
  return { success: true, msg: '导入成功' }
}

function clearAllData() {
  wx.removeStorageSync(STORAGE_KEYS.RECORDS)
  wx.removeStorageSync(STORAGE_KEYS.SUBSCRIPTIONS)
  wx.removeStorageSync(STORAGE_KEYS.ACCOUNTS)
  wx.removeStorageSync(STORAGE_KEYS.SETTINGS)
  // 清空所有缓存
  _cache.records = null
  _cache.subscriptions = null
  _cache.accounts = null
  _cache.settings = null
}

// ==================== 账户余额同步 ====================

/**
 * 记账后同步账户余额
 * - 新增记录：oldRecord 传 null
 * - 编辑记录：传入 oldRecord 和 newRecord（自动计算差值）
 * - 删除记录：newRecord 传 null
 * @param {Object|null} oldRecord - 旧记录（编辑/删除时传入）
 * @param {Object|null} newRecord - 新记录（新增/编辑时传入）
 */
function syncAccountBalance(oldRecord, newRecord) {
  const accounts = getAccounts()
  let changed = false

  // 回退旧记录对账户余额的影响
  if (oldRecord && oldRecord.accountId) {
    const oldAccount = accounts.find(a => a.id === oldRecord.accountId)
    if (oldAccount) {
      const amount = parseFloat(oldRecord.amount) || 0
      if (oldRecord.type === 'expense') {
        oldAccount.balance += amount // 支出回退 → 加回来
      } else if (oldRecord.type === 'income') {
        oldAccount.balance -= amount // 收入回退 → 减回去
      }
      changed = true
    }
  }

  // 应用新记录对账户余额的影响
  if (newRecord && newRecord.accountId) {
    const newAccount = accounts.find(a => a.id === newRecord.accountId)
    if (newAccount) {
      const amount = parseFloat(newRecord.amount) || 0
      if (newRecord.type === 'expense') {
        newAccount.balance -= amount // 支出 → 减余额
      } else if (newRecord.type === 'income') {
        newAccount.balance += amount // 收入 → 加余额
      }
      changed = true
    }
  }

  if (changed) saveAccounts(accounts)
}

module.exports = {
  generateId,
  getRecords, saveRecords, addRecord, updateRecord, deleteRecord,
  getSubscriptions, saveSubscriptions, addSubscription, updateSubscription, deleteSubscription,
  getAccounts, saveAccounts, addAccount, updateAccount, deleteAccount,
  getSettings, saveSettings, updateSettings,
  exportAllData, importAllData, clearAllData,
  syncAccountBalance
}
