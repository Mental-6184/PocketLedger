/**
 * 汇率换算模块
 * - 从 open.er-api.com 拉取实时汇率（以 CNY 为基准）
 * - 本地缓存 24 小时，过期重新拉取
 * - 网络失败时使用内置兜底汇率
 */

const STORAGE_KEY = 'pocket_exchange_rates'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24小时

// 兜底汇率（2024年参考值，以 CNY 为基准 → 1 外币 = ? CNY）
const FALLBACK_RATES = {
  CNY: 1,
  USD: 7.25,
  EUR: 7.88,
  GBP: 9.15,
  JPY: 0.048,
  HKD: 0.93,
  KRW: 0.0053
}

/**
 * 获取缓存的汇率数据
 */
function getCachedRates() {
  try {
    const cached = wx.getStorageSync(STORAGE_KEY)
    if (cached && cached.rates && cached.timestamp) {
      const age = Date.now() - cached.timestamp
      if (age < CACHE_DURATION) {
        return { rates: cached.rates, fromCache: true, age }
      }
    }
  } catch (e) {}
  return null
}

/**
 * 保存汇率到本地缓存
 */
function saveRates(rates) {
  try {
    wx.setStorageSync(STORAGE_KEY, {
      rates,
      timestamp: Date.now()
    })
  } catch (e) {}
}

/**
 * 从网络拉取最新汇率
 * API: open.er-api.com（免费，无需 key）
 * 返回以 CNY 为基准的汇率表：{ CNY: 1, USD: 7.25, ... }
 */
function fetchRatesFromNetwork() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://open.er-api.com/v6/latest/CNY',
      method: 'GET',
      timeout: 8000,
      success(res) {
        if (res.statusCode === 200 && res.data && res.data.rates) {
          // API 返回以 CNY=1 为基准的汇率
          const apiRates = res.data.rates
          const rates = {
            CNY: 1,
            USD: apiRates.USD || FALLBACK_RATES.USD,
            EUR: apiRates.EUR || FALLBACK_RATES.EUR,
            GBP: apiRates.GBP || FALLBACK_RATES.GBP,
            JPY: apiRates.JPY || FALLBACK_RATES.JPY,
            HKD: apiRates.HKD || FALLBACK_RATES.HKD,
            KRW: apiRates.KRW || FALLBACK_RATES.KRW
          }
          saveRates(rates)
          resolve(rates)
        } else {
          reject(new Error('Invalid response'))
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

/**
 * 获取汇率（优先缓存，其次网络，最后兜底）
 * @returns {Promise<{rates: Object, source: string}>}
 */
function getRates() {
  // 1. 检查缓存
  const cached = getCachedRates()
  if (cached) {
    return Promise.resolve({ rates: cached.rates, source: 'cache' })
  }

  // 2. 尝试网络拉取
  return fetchRatesFromNetwork()
    .then(rates => ({ rates, source: 'network' }))
    .catch(() => {
      // 3. 网络失败，使用兜底汇率
      saveRates(FALLBACK_RATES)
      return { rates: FALLBACK_RATES, source: 'fallback' }
    })
}

/**
 * 同步获取汇率（仅从缓存或兜底，不发网络请求）
 * 适用于页面渲染时不想等待异步的场景
 */
function getRatesSync() {
  const cached = getCachedRates()
  if (cached) return cached.rates
  return FALLBACK_RATES
}

/**
 * 将外币金额换算为人民币
 * @param {number} amount - 原币金额
 * @param {string} fromCurrency - 原币代码（如 'USD'）
 * @param {Object} rates - 汇率表（可选，默认用缓存/兜底）
 * @returns {number} 人民币金额
 */
function convertToCNY(amount, fromCurrency, rates) {
  if (!amount || isNaN(amount)) return 0
  if (!fromCurrency || fromCurrency === 'CNY') return parseFloat(amount) || 0

  const rateTable = rates || getRatesSync()
  const rate = rateTable[fromCurrency]
  if (!rate) return parseFloat(amount) || 0

  return (parseFloat(amount) || 0) * rate
}

module.exports = {
  getRates,
  getRatesSync,
  convertToCNY,
  saveRates,
  FALLBACK_RATES
}
