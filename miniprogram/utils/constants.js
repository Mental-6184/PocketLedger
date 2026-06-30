/**
 * 常量定义 - 分类、周期、默认值
 */

// 支出分类
const EXPENSE_CATEGORIES = [
  { id: 'food', name: '餐饮', icon: '🍜' },
  { id: 'transport', name: '交通', icon: '🚌' },
  { id: 'shopping', name: '购物', icon: '🛒' },
  { id: 'housing', name: '住房', icon: '🏠' },
  { id: 'entertainment', name: '娱乐', icon: '🎮' },
  { id: 'medical', name: '医疗', icon: '💊' },
  { id: 'education', name: '教育', icon: '📚' },
  { id: 'communication', name: '通讯', icon: '📱' },
  { id: 'clothing', name: '服饰', icon: '👔' },
  { id: 'gift', name: '人情', icon: '🎁' },
  { id: 'pet', name: '宠物', icon: '🐱' },
  { id: 'other_expense', name: '其他', icon: '📌' }
]

// 收入分类
const INCOME_CATEGORIES = [
  { id: 'salary', name: '工资', icon: '💰' },
  { id: 'bonus', name: '奖金', icon: '🎉' },
  { id: 'parttime', name: '兼职', icon: '💼' },
  { id: 'invest', name: '投资', icon: '📈' },
  { id: 'refund', name: '退款', icon: '💸' },
  { id: 'gift_income', name: '红包', icon: '🧧' },
  { id: 'other_income', name: '其他', icon: '📌' }
]

// 订阅周期
const SUBSCRIPTION_CYCLES = [
  { id: 'monthly', name: '每月', days: 30 },
  { id: 'quarterly', name: '每季', days: 90 },
  { id: 'yearly', name: '每年', days: 365 },
  { id: 'weekly', name: '每周', days: 7 }
]

// 币种列表
const CURRENCIES = [
  { code: 'CNY', name: '人民币', symbol: '¥' },
  { code: 'USD', name: '美元', symbol: '$' },
  { code: 'EUR', name: '欧元', symbol: '€' },
  { code: 'GBP', name: '英镑', symbol: '£' },
  { code: 'JPY', name: '日元', symbol: '¥' },
  { code: 'HKD', name: '港币', symbol: 'HK$' },
  { code: 'KRW', name: '韩元', symbol: '₩' }
]

// 账户类型
const ACCOUNT_TYPES = [
  { id: 'ewallet', name: '电子钱包', icon: '📱' },
  { id: 'debit', name: '储蓄卡', icon: '💳' },
  { id: 'credit', name: '信用卡', icon: '💎' },
  { id: 'cash', name: '现金', icon: '💵' }
]

// 默认账户
const DEFAULT_ACCOUNTS = [
  { id: 'acc_wechat', name: '微信钱包', icon: '💬', type: 'ewallet', balance: 0, includeInTotal: true },
  { id: 'acc_alipay', name: '支付宝', icon: '🔵', type: 'ewallet', balance: 0, includeInTotal: true },
  { id: 'acc_bank', name: '储蓄卡', icon: '💳', type: 'debit', balance: 0, includeInTotal: true },
  { id: 'acc_cash', name: '现金', icon: '💵', type: 'cash', balance: 0, includeInTotal: true }
]

// 默认设置
const DEFAULT_SETTINGS = {
  monthlyBudget: 5000,
  currency: '¥'
}

// 存储键名
const STORAGE_KEYS = {
  RECORDS: 'pocket_records',
  SUBSCRIPTIONS: 'pocket_subscriptions',
  SETTINGS: 'pocket_settings',
  ACCOUNTS: 'pocket_accounts'
}

module.exports = {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  SUBSCRIPTION_CYCLES,
  CURRENCIES,
  ACCOUNT_TYPES,
  DEFAULT_ACCOUNTS,
  DEFAULT_SETTINGS,
  STORAGE_KEYS
}
