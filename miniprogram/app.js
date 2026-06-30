/**
 * 口袋账本 - PocketLedger
 * 轻量级本地记账小程序
 */
const storage = require('./utils/storage')

App({
  onLaunch() {
    // 初始化默认设置（首次启动）
    const settings = storage.getSettings()
    if (!wx.getStorageSync('pocket_settings')) {
      storage.saveSettings(settings)
    }
  },

  globalData: {
    // 全局可通过 getApp().globalData 访问
  }
})
