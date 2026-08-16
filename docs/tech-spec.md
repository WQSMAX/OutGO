# 技术规范 — 宅家激励 App

> 版本：v1.0 | 日期：2026-08-03

---

## 1. 技术选型

| 层级 | 选择 | 版本 | 原因 |
|------|------|------|------|
| 原生包装 | Capacitor | 8.x | 将 web 代码包装为原生 Android APK |
| 页面结构 | HTML5 | - | 语义化标签 |
| 样式 | CSS3 | - | CSS 变量、Flexbox、动画 |
| 逻辑 | 原生 JavaScript | ES6+ | 零框架依赖、浏览器原生支持 |
| 数据存储 | localStorage | - | 数据量小（< 5MB），无需数据库 |
| 离线 | Service Worker | - | PWA 兼容保留，APK 中由原生层提供 |
| 图标 | Emoji + 内联 SVG | - | 无需额外资源文件 |

### 1.1 为什么用 Capacitor 包装？

- 保留全部已有 HTML/CSS/JS 代码，零重写
- 生成标准 Android Gradle 项目，可构建 APK
- 比 TWA（Trusted Web Activity）更像传统 App
- 未来可接入原生 API（通知、相机等）
- 业界标准方案（Ionic 团队维护）

---

## 2. 项目结构

```
d:\zhaijiajiliruanjian/
├── CLAUDE.md              # AI 助手指引文件
├── docs/                  # 项目文档
│   ├── requirements.md    # 产品需求文档
│   ├── tech-spec.md       # 技术规范（本文件）
│   ├── design-spec.md     # 设计规范
│   └── dev-plan.md        # 开发阶段计划
├── devlogs/               # 开发日志
│   └── YYYY-MM-DD.md      # 每日开发记录
├── index.html             # 主入口（SPA 单页）
├── manifest.json          # PWA 清单
├── sw.js                  # Service Worker
├── css/
│   └── style.css          # 全局样式
├── js/
│   ├── app.js             # 主控制器（导航、初始化）
│   ├── tasks.js           # 任务系统
│   ├── pet.js             # 宠物系统
│   ├── user.js            # 用户系统
│   └── storage.js         # 数据持久层
└── assets/
    └── icons/             # PWA 图标
```

---

## 3. 架构设计

### 3.1 SPA 架构

```
┌─────────────────────────────────┐
│           index.html            │
│  ┌───────────────────────────┐  │
│  │  页面容器                   │  │
│  │  ┌──────┐ ┌──────┐ ┌────┐ │  │
│  │  │ 首页  │ │ 宠物  │ │用户│ │  │  ← display: none/block 切换
│  │  │ 页面  │ │ 页面  │ │页面│ │  │
│  │  └──────┘ └──────┘ └────┘ │  │
│  │  ┌──────┐                 │  │
│  │  │ 设置  │                 │  │
│  │  │ 页面  │                 │  │
│  │  └──────┘                 │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  底部导航栏（固定底栏）     │  │
│  │  🏠首页 🐾宠物 👤用户 ⚙️设置│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 3.2 模块职责

| 文件 | 职责 | 对外暴露 |
|------|------|---------|
| `storage.js` | localStorage 读写、数据初始化、每日重置 | `getData()`, `saveData()`, `initData()`, `resetDaily()` |
| `tasks.js` | 预设任务库、随机抽取、刷新、完成 | `getRandomTask()`, `refreshTask()`, `completeTask()` |
| `pet.js` | 宠物状态计算、互动、鼓励语 | `getPetState()`, `feedPet()`, `playWithPet()`, `getEncourageMessage()` |
| `user.js` | 积分管理、成就判定、历史记录 | `getUserStats()`, `checkAchievements()`, `getHistory()` |
| `app.js` | 导航切换、页面渲染、事件绑定、初始化 | `init()`, `switchPage()`, `renderCurrentPage()` |

### 3.3 数据流

```
用户操作 → app.js 事件处理
              ↓
    tasks.js / pet.js / user.js 业务逻辑
              ↓
         storage.js 数据读写
              ↓
         localStorage
              ↓
    app.js 重新渲染页面 UI
```

### 3.4 事件驱动

所有页面交互通过事件委托或直接绑定处理：
- 底部导航：`click` → `switchPage(pageId)`
- 任务操作：`click` → `refreshTask()` / `completeTask()`
- 宠物互动：`click` → `feedPet()` / `playWithPet()`
- 设置变更：`change` → 直接更新存储

---

## 4. 数据模型

### 4.1 localStorage 存储结构

Key: `zhajiaji_data`

```javascript
{
  // 应用元数据
  version: "1.0",
  firstLaunch: true,          // 是否首次使用（用于触发引导）

  // 用户数据
  user: {
    points: 500,              // 初始赠送 500 积分
    freeRefreshesToday: 3,
    lastRefreshDate: null,    // "YYYY-MM-DD"
    currentTaskId: null,
    taskHistory: [
      {
        id: "t_preset_1",
        title: "去公园散步",
        difficulty: "easy",
        points: 30,
        completedAt: "2026-08-03T14:30:00"
      }
    ],
    achievements: ["first_task"]
  },

  // 宠物数据
  pet: {
    type: "cat",              // cat | dog | bunny | bird
    name: "小咪",
    level: 1,                 // 1-10
    growth: 0,                // 0-100，满 100 升级
    mood: 80,                 // 0-100
    lastFed: "2026-08-03T10:00:00",
    lastPlayed: null,
    accessory: null,          // 未来扩展：装扮 ID
    lastMoodDecay: "2026-08-03"  // 上次心情衰减日期
  },

  // 自定义任务
  customTasks: [
    {
      id: "custom_1",
      title: "去图书馆看书",
      difficulty: "medium",
      points: 50,
      createdAt: "2026-08-03"
    }
  ],

  // 用户设置
  settings: {
    dailyReminder: true,
    reminderTime: "09:00"
  }
}
```

### 4.2 预设任务数据结构

```javascript
// 硬编码在 tasks.js，不存入 localStorage
const PRESET_TASKS = [
  {
    id: "preset_easy_1",
    title: "下楼散步 10 分钟",
    difficulty: "easy",
    points: 30
  },
  // ... 总计 20+ 条
];
```

---

## 5. 关键算法

### 5.1 任务随机抽取
```
1. 合并预设任务库 + 自定义任务 → 全部任务池
2. 排除上一轮刚刷新过的任务（避免连续重复）
3. 从剩余任务中随机选取 1 个
4. 记录到 currentTaskId
```

### 5.2 每日重置
```
应用启动时检查 lastRefreshDate：
  if lastRefreshDate ≠ 今天:
    freeRefreshesToday = 3
    lastRefreshDate = 今天
```

### 5.3 心情衰减
```
应用启动时检查 lastMoodDecay：
  if lastMoodDecay ≠ 今天:
    计算间隔天数 N
    mood = max(0, mood - N × 15)
    lastMoodDecay = 今天
```

### 5.4 成长升级
```
完成任务后：
  growth += 任务成长值
  if growth >= 100:
    level = min(10, level + 1)
    growth = growth - 100
```

---

## 6. 浏览器兼容性

| 特性 | Chrome | Edge | Samsung Internet | 说明 |
|------|--------|------|------------------|------|
| localStorage | ✅ | ✅ | ✅ | 所有现代浏览器支持 |
| Service Worker | ✅ | ✅ | ✅ | PWA 核心 |
| CSS Variables | ✅ | ✅ | ✅ | 主题色管理 |
| Flexbox | ✅ | ✅ | ✅ | 布局 |
| Emoji | ✅ | ✅ | ✅ | 图标方案 |

目标最低版本：Chrome 90+（2021 年后手机均支持）

---

## 7. 开发与调试

### 7.1 本地开发
- 直接浏览器打开 `index.html` 即可
- 或用简单 HTTP 服务器：`npx serve .`（Service Worker 需要 HTTP 环境）

### 7.2 真机测试
- Android 手机 Chrome 访问局域网地址
- Chrome DevTools 远程调试

### 7.3 数据调试
- 浏览器控制台执行：`JSON.parse(localStorage.getItem('zhajiaji_data'))`
- 清空数据重建：`localStorage.removeItem('zhajiaji_data')` 后刷新页面
