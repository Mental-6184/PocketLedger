/**
 * 使用方法页 - 分模块讲解小程序功能
 */
Page({
  data: {
    // 当前展开的模块索引（-1 表示全部折叠）
    expandedIndex: 0,
    // 模块目录
    sections: [
      { id: 'overview', icon: '📱', title: '快速上手' },
      { id: 'record', icon: '✏️', title: '记一笔账' },
      { id: 'records', icon: '📋', title: '查看账单' },
      { id: 'budget', icon: '🎯', title: '月度预算' },
      { id: 'subscription', icon: '🔔', title: '订阅管理' },
      { id: 'calendar', icon: '📅', title: '扣款日历' },
      { id: 'currency', icon: '💱', title: '多币种换算' },
      { id: 'spread', icon: '📊', title: '年付分摊' },
      { id: 'account', icon: '💳', title: '账户管理' },
      { id: 'refund', icon: '🏷️', title: '退款与报销' },
      { id: 'stats', icon: '📈', title: '统计分析' },
      { id: 'data', icon: '💾', title: '数据管理' }
    ]
  },

  onLoad(options) {
    // 如果传入了 anchor 参数，自动展开对应模块
    if (options.anchor) {
      const index = this.data.sections.findIndex(s => s.id === options.anchor)
      if (index >= 0) {
        this.setData({ expandedIndex: index })
      }
    }
  },

  // 切换展开/折叠（目录和列表标题共用）
  toggleSection(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({
      expandedIndex: this.data.expandedIndex === index ? -1 : index
    })
  },

  // 点击目录项，滚动到对应位置并展开
  scrollToSection(e) {
    const id = e.currentTarget.dataset.id
    const index = this.data.sections.findIndex(s => s.id === id)
    if (index >= 0) {
      this.setData({ expandedIndex: index })
      wx.pageScrollTo({
        selector: '#section-' + id,
        duration: 300
      })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
