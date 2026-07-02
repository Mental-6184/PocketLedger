# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

PocketLedger 是一个微信小程序记账应用，纯本地存储，无需后端。

## 技术栈

- 微信小程序原生框架 (WXML/WXSS/JS)
- 本地存储 API (`wx.getStorageSync` / `wx.setStorageSync`)

## 常用命令

```bash
# 安装依赖
npm install

# 用微信开发者工具打开项目目录运行
# 项目配置文件：project.config.json
# 小程序根目录：miniprogram/
```

无构建步骤、无测试框架、无 lint 配置。

## 项目结构

```
miniprogram/
├── app.js/json/wxss     # 应用入口
├── pages/
│   ├── index/           # 首页总览（财务驾驶舱）
│   ├── record/          # 记账新增/编辑
│   ├── records/         # 月度账单列表
│   ├── stats/           # 数据统计
│   ├── settings/        # 设置与数据管理
│   ├── subscription/    # 订阅列表
│   ├── sub-edit/        # 订阅新增/编辑
│   ├── accounts/        # 账户列表
│   ├── account-edit/    # 账户新增/编辑
│   └── guide/           # 使用指南
└── utils/
    ├── constants.js     # 分类、周期、币种、账户类型、默认配置、存储键名
    ├── storage.js       # 所有数据持久化的唯一出口（CRUD + 导入导出 + 余额同步）
    ├── exchange.js      # 汇率获取与 24h 缓存
    ├── export.js        # CSV/JSON 导出与微信分享
    └── util.js          # 日期、统计、日历、账户统计等工具函数
```

## 核心架构

### 数据层

所有数据读写必须通过 `utils/storage.js`，它是唯一的持久化出口。存储键名定义在 `utils/constants.js` 的 `STORAGE_KEYS` 中：

- `pocket_records` - 记账记录
- `pocket_subscriptions` - 订阅项目
- `pocket_accounts` - 账户
- `pocket_settings` - 设置（预算、货币）

### 账户余额同步

记账时自动同步账户余额是核心逻辑，由 `storage.syncAccountBalance(oldRecord, newRecord)` 处理：
- 新增记录：`oldRecord` 传 `null`
- 编辑记录：传入新旧记录，自动计算差值
- 删除记录：`newRecord` 传 `null`

支出减少余额，收入增加余额。该函数在 record 页面的保存/删除流程中调用。

### 订阅自动扣费

订阅到期检测在 `pages/subscription/subscription.js` 中：打开订阅页时自动检测过期项，弹窗确认后批量续费（生成支出记录 + 推进下次扣费日期 + 同步账户余额）。

### TabBar 页面

四个主 tab：首页(index)、记账(records)、统计(stats)、设置(settings)。注意记账的 tab 入口是 `records` 页面，实际记账表单在 `record` 页面。

## 编码约定

- 数据结构定义在 `constants.js`，页面通过 `require('../../utils/...')` 引入工具模块
- 页面使用 `data` + `setData` 驱动视图更新
- 分类用 `id` 引用（如 `'food'`），显示时从常量表查 `name`/`icon`
- ID 生成：`Date.now().toString(36) + Math.random().toString(36).substr(2, 6)`
