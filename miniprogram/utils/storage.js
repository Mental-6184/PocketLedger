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

// ==================== 记账记录 ====================

function getRecords() {
  return wx.getStorageSync(STORAGE_KEYS.RECORDS) || []
}

function saveRecords(records) {
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
  return wx.getStorageSync(STORAGE_KEYS.SUBSCRIPTIONS) || []
}

function saveSubscriptions(subs) {
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
  let accounts = wx.getStorageSync(STORAGE_KEYS.ACCOUNTS)
  if (!accounts || accounts.length === 0) {
    // 首次使用，初始化默认账户
    const { DEFAULT_ACCOUNTS } = require('./constants')
    accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a, createdAt: Date.now() }))
    saveAccounts(accounts)
  }
  return accounts
}

function saveAccounts(accounts) {
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
  saveAccounts(filtered)
  return filtered.length < accounts.length
}

// ==================== 设置 ====================

function getSettings() {
  const settings = wx.getStorageSync(STORAGE_KEYS.SETTINGS)
  return { ...DEFAULT_SETTINGS, ...settings }
}

function saveSettings(settings) {
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
  if (!data || typeof data !== 'object') {
    return { success: false, msg: '数据格式无效' }
  }
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
}

module.exports = {
  generateId,
  getRecords, saveRecords, addRecord, updateRecord, deleteRecord,
  getSubscriptions, saveSubscriptions, addSubscription, updateSubscription, deleteSubscription,
  getAccounts, saveAccounts, addAccount, updateAccount, deleteAccount,
  getSettings, saveSettings, updateSettings,
  exportAllData, importAllData, clearAllData
}
