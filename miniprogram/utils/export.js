/**
 * 数据导出工具 - 支持 CSV 和 JSON 格式
 * CSV 是兼容性最强的表格格式，手机端 Excel/WPS/Numbers 都能直接打开
 */
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ACCOUNT_TYPES } = require('./constants')

// CSV 字段转义（处理逗号、换行、引号）
function csvField(val) {
  if (val == null) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

// 获取分类名称
function getCategoryName(categoryId, type) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const cat = list.find(c => c.id === categoryId)
  return cat ? cat.name : (categoryId || '未分类')
}

// 获取账户类型名称
function getAccountTypeName(typeId) {
  const t = ACCOUNT_TYPES.find(a => a.id === typeId)
  return t ? t.name : typeId
}

// 获取账户名称
function getAccountName(accountId, accounts) {
  if (!accountId) return '未指定'
  const acc = accounts.find(a => a.id === accountId)
  return acc ? acc.name : '未知账户'
}

// 报销状态中文
function getReimbursementLabel(status) {
  const map = { none: '', pending: '待报销', reimbursed: '已报销' }
  return map[status] || ''
}

// 周期名称
function getCycleLabel(cycleId) {
  const map = { monthly: '每月', quarterly: '每季', yearly: '每年', weekly: '每周' }
  return map[cycleId] || cycleId
}

/**
 * 生成 CSV 表格内容
 * 用空行分隔 4 个数据区域，方便用户查看
 */
function generateExcel(data) {
  const { records = [], subscriptions = [], accounts = [], settings = {} } = data
  const sortedRecords = [...records].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const BOM = '﻿'
  const lines = []

  // === 账目明细 ===
  lines.push('【账目明细】')
  lines.push('日期,类型,分类,金额,账户,备注,报销状态')
  sortedRecords.forEach(r => {
    lines.push([
      csvField(r.date || ''),
      csvField(r.type === 'income' ? '收入' : '支出'),
      csvField(getCategoryName(r.category, r.type)),
      csvField((r.amount || 0).toFixed(2)),
      csvField(getAccountName(r.accountId, accounts)),
      csvField(r.note || ''),
      csvField(getReimbursementLabel(r.reimbursementStatus))
    ].join(','))
  })

  lines.push('')

  // === 订阅服务 ===
  lines.push('【订阅服务】')
  lines.push('名称,金额,周期,下次扣款,提前提醒,币种,备注,状态')
  subscriptions.forEach(s => {
    lines.push([
      csvField(s.name || ''),
      csvField((s.amount || 0).toFixed(2)),
      csvField(getCycleLabel(s.cycleId || s.cycle)),
      csvField(s.nextDate || ''),
      csvField((s.remindDays || 0) + '天'),
      csvField(s.currency || 'CNY'),
      csvField(s.note || ''),
      csvField(s.enabled !== false ? '启用' : '停用')
    ].join(','))
  })

  lines.push('')

  // === 账户列表 ===
  lines.push('【账户列表】')
  lines.push('名称,类型,余额,计入总资产')
  accounts.forEach(a => {
    lines.push([
      csvField((a.icon || '') + ' ' + (a.name || '')),
      csvField(getAccountTypeName(a.type)),
      csvField((a.balance || 0).toFixed(2)),
      csvField(a.includeInTotal !== false ? '是' : '否')
    ].join(','))
  })

  lines.push('')

  // === 设置 ===
  lines.push('【设置】')
  lines.push('设置项,值')
  lines.push('每月预算,' + csvField((settings.monthlyBudget || 0).toFixed(2)))
  lines.push('货币符号,' + csvField(settings.currency || '¥'))

  return BOM + lines.join('\n')
}

/**
 * 生成 JSON 备份字符串
 */
function generateJsonBackup(data) {
  return JSON.stringify(data, null, 2)
}

/**
 * 将内容写入临时文件并分享
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名（不含扩展名）
 * @param {string} ext - 扩展名（.csv 或 .json）
 */
function exportToFile(content, filename, ext) {
  const fs = wx.getFileSystemManager()
  const filePath = `${wx.env.USER_DATA_PATH}/${filename}${ext}`

  return new Promise((resolve, reject) => {
    fs.writeFile({
      filePath: filePath,
      data: content,
      encoding: 'utf-8',
      success() {
        // 尝试分享文件
        wx.shareFileMessage({
          filePath: filePath,
          fileName: `${filename}${ext}`,
          fileType: 'file',
          success() { resolve('shared') },
          fail() {
            // 降级：尝试保存到磁盘
            if (wx.saveFileToDisk) {
              wx.saveFileToDisk({
                filePath: filePath,
                success() { resolve('saved') },
                fail() { resolve('clipboard') }
              })
            } else {
              resolve('clipboard')
            }
          }
        })
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = {
  generateExcel,
  generateJsonBackup,
  exportToFile
}
