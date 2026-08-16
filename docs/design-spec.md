# 设计规范 — 宅家激励 App

> 版本：v1.0 | 日期：2026-08-03

---

## 1. 设计理念

- **关键词**：简洁、温馨、可爱、鼓励
- **设计语言**：圆角卡片、柔和阴影、大字体、丰富留白
- **情感目标**：让用户感到被陪伴和鼓励，而非被催促和施压

---

## 2. 色彩系统

### 2.1 主色调 — 温暖蓝

| 色值 | 名称 | 用途 |
|------|------|------|
| `#5B9BD5` | 主蓝色 Primary Blue | 导航栏、主按钮、强调元素 |
| `#7DB9E8` | 浅蓝色 Light Blue | 卡片背景、进度条底色 |
| `#3A7BBF` | 深蓝色 Dark Blue | 按钮按下态、文字链接 |
| `#E8F4FD` | 极浅蓝 Sky Blue | 页面背景、大面积底色 |

### 2.2 辅助色

| 色值 | 名称 | 用途 |
|------|------|------|
| `#FFB74D` | 暖橙色 Warm Orange | 积分、奖励、高亮数字 |
| `#81C784` | 温和绿 Soft Green | 成功状态、心情良好 |
| `#EF5350` | 温和红 Soft Red | 心情差、警告、删除按钮 |
| `#FFD54F` | 阳光黄 Sunny Yellow | 成就徽章、庆祝元素 |

### 2.3 中性色

| 色值 | 用途 |
|------|------|
| `#FFFFFF` | 卡片背景、内容区背景 |
| `#F5F7FA` | 页面底色 |
| `#E8ECF1` | 分割线、边框 |
| `#B0BEC5` | 次要文字、占位符 |
| `#607D8B` | 正文文字 |
| `#37474F` | 标题文字、重点内容 |

### 2.4 CSS 变量定义

```css
:root {
  /* 主色 */
  --color-primary: #5B9BD5;
  --color-primary-light: #7DB9E8;
  --color-primary-dark: #3A7BBF;
  --color-primary-bg: #E8F4FD;

  /* 辅助色 */
  --color-accent: #FFB74D;
  --color-success: #81C784;
  --color-danger: #EF5350;
  --color-celebrate: #FFD54F;

  /* 中性色 */
  --color-white: #FFFFFF;
  --color-bg: #F5F7FA;
  --color-border: #E8ECF1;
  --color-text-secondary: #B0BEC5;
  --color-text-body: #607D8B;
  --color-text-title: #37474F;

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-round: 50%;

  /* 阴影 */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);

  /* 间距 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* 字体 */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-size-xxl: 32px;
}
```

---

## 3. 字体规范

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| 大标题 | 24px | 700 (Bold) | 页面主标题 |
| 中标题 | 20px | 600 (SemiBold) | 卡片标题 |
| 小标题 | 16px | 600 (SemiBold) | 区块标题 |
| 正文 | 16px | 400 (Normal) | 任务内容、描述文字 |
| 辅助文字 | 14px | 400 (Normal) | 标签、时间、备注 |
| 小字 | 12px | 400 (Normal) | 次要信息、计数 |

中文字体栈：`"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif`
英文/数字字体栈：`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

---

## 4. 间距规范

| 层级 | 值 | 用途 |
|------|------|------|
| xs | 4px | 图标与文字、小元素间距 |
| sm | 8px | 列表项间距、标签内边距 |
| md | 16px | 卡片内边距、区块间距 |
| lg | 24px | 页面内边距、大区块间距 |
| xl | 32px | 页面顶部/底部留白 |

页面内容区左右内边距统一：`16px`

---

## 5. 组件规范

### 5.1 底部导航栏

```
高度: 60px
背景: #FFFFFF
顶部: 1px 分割线 #E8ECF1
图标: Emoji 24px
文字: 12px #607D8B
选中态: 文字变 #5B9BD5，图标略微放大
布局: flex space-around
```

### 5.2 任务卡片

```
背景: #FFFFFF
圆角: 16px
阴影: shadow-md
内边距: 24px
难度标签: 小圆角标签（8px），根据难度变颜色
  - 简单: #81C784 背景
  - 中等: #FFB74D 背景
  - 困难: #EF5350 背景（柔和版）
任务文字: 20px SemiBold，居中展示
积分预览: 🪙 + 橙色数字
按钮: 蓝色圆角按钮（主按钮）/ 灰色描边按钮（次按钮）
```

### 5.3 主按钮（Primary）

```
背景: #5B9BD5
文字: #FFFFFF 16px SemiBold
圆角: 12px
内边距: 12px 24px
最小宽度: 120px
阴影: shadow-sm
按下态: 背景变 #3A7BBF
```

### 5.4 次按钮（Secondary）

```
背景: transparent
边框: 1.5px solid #5B9BD5
文字: #5B9BD5 16px SemiBold
圆角: 12px
内边距: 12px 24px
```

### 5.5 进度条

```
高度: 8px
背景（底色）: #E8ECF1
填充色: 心情→#81C784 / #FFB74D / #EF5350（按数值变化）
       成长→#7DB9E8
圆角: 4px
过渡动画: 0.3s ease
```

### 5.6 宠物展示区

```
尺寸: 160px × 160px 圆形区域
背景: 浅蓝色渐变圆形
宠物图案: Emoji 组合 + CSS 动画（浮动/呼吸效果）
动画: @keyframes float (上下浮动 3s ease-in-out infinite)
```

### 5.7 话语气泡

```
背景: #E8F4FD
圆角: 16px (左上角尖角)
内边距: 12px 16px
文字: 14px
下方小三角: CSS border 技巧
```

### 5.8 成就徽章

```
尺寸: 60px × 60px
形状: 圆形
解锁态: 彩色背景 + Emoji
锁定态: #E8ECF1 背景 + 🔒 Emoji
下方文字: 12px
```

### 5.9 难度标签

| 难度 | 背景色 | 文字色 | Emoji |
|------|--------|--------|-------|
| 简单 | `#E8F5E9` | `#388E3C` | 🌱 |
| 中等 | `#FFF3E0` | `#F57C00` | 🎯 |
| 困难 | `#FFEBEE` | `#D32F2F` | 🔥 |

---

## 6. 页面布局规范

### 通用布局
```
┌──────────────────────────────┐
│      顶部状态区（可选）        │  ← 页面标题 + 可能的操作
│      高度: ~40-50px          │
├──────────────────────────────┤
│                              │
│      内容滚动区               │  ← flex: 1, overflow-y: auto
│      padding: 16px           │
│                              │
├──────────────────────────────┤
│      底部导航栏               │  ← 固定 60px
│      4 Tab                   │
└──────────────────────────────┘
```

### 最大宽度
- 手机竖屏为主：内容区 `max-width: 480px`，居中显示
- 适配平板/宽屏：保持居中，两侧留白

---

## 7. 动画规范

| 场景 | 动画 | 时长 | 缓动 |
|------|------|------|------|
| 页面切换 | 淡入淡出 opacity | 200ms | ease |
| 卡片出现 | 上滑 + 淡入 | 300ms | ease-out |
| 任务完成 | 卡片弹跳 + 🎉 emoji 炸开 | 500ms | ease-out |
| 进度条变化 | 宽度过渡 | 300ms | ease |
| 宠物浮动 | 上下循环浮动 | 3s | ease-in-out |
| 按钮点击 | 缩放 95% | 100ms | ease |
| 心情变化 | Emoji 切换 + 颜色过渡 | 300ms | ease |

---

## 8. Emoji 图标映射

| 用途 | Emoji |
|------|-------|
| 首页 Tab | 🏠 |
| 宠物 Tab | 🐾 |
| 用户 Tab | 👤 |
| 设置 Tab | ⚙️ |
| 积分 | 🪙 |
| 刷新 | 🔄 |
| 完成 | ✅ |
| 喂食 | 🍖 |
| 玩耍 | 🎾 |
| 成就 | 🏆 |
| 提醒 | 🔔 |
| 删除 | 🗑️ |
| 添加 | ➕ |
| 简单难度 | 🌱 |
| 中等难度 | 🎯 |
| 困难难度 | 🔥 |
| 宠物-猫 | 🐱 |
| 宠物-狗 | 🐶 |
| 宠物-兔 | 🐰 |
| 宠物-鸟 | 🐤 |
| 心情-开心 | 😊 |
| 心情-一般 | 😐 |
| 心情-差 | 😞 |
| 心情-生病 | 🤒 |
| 锁定 | 🔒 |

---

## 9. 参考截图（设计目标）

最终成品应该像：
- **首页**：一张白色大卡片在浅蓝背景上，卡片里有 emoji、任务文字、彩色难度标签、两个按钮
- **宠物页**：圆心蓝色渐变背景下的大 emoji 宠物，两条彩色进度条，两个互动按钮，一个可爱的对话气泡
- **用户页**：顶部积分大卡片，中间成就徽章网格，下方任务历史列表
- **设置页**：分组列表样式，每组有标题和操作项
