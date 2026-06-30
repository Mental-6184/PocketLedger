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

    // 首次启动检测 — 标记需要显示使用方法引导
    if (!wx.getStorageSync('pocket_first_launch_done')) {
      this.globalData.showGuideHint = true
    }
  },

  /**
   * 标记首次启动已完成
   */
  markFirstLaunchDone() {
    wx.setStorageSync('pocket_first_launch_done', true)
    this.globalData.showGuideHint = false
  },

  globalData: {
    showGuideHint: false
  }
})
