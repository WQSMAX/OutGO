# CLAUDE.md — 宅家激励 App

> 本文件是 AI 助手（Claude Code）的工作入口。每次对话开始时，AI 应首先阅读本文件以了解项目状态。

---

## 项目概述

**项目名称**：宅家激励 App
**项目类型**：Android 原生 App（Capacitor + HTML/CSS/JS）
**目标用户**：宅家人士，需要外出动力
**核心机制**：户外任务 → 积分奖励 → 宠物养成
**设计风格**：简洁、温馨、蓝色主色调

---

## 文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 产品需求 | [docs/requirements.md](docs/requirements.md) | 完整功能需求，需求不清时查阅 |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) | 技术选型、架构、数据模型 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | 颜色、字体、组件、动画规范 |
| 开发计划 | [docs/dev-plan.md](docs/dev-plan.md) | 分阶段执行计划和进度跟踪 |

---

## 开发日志

开发日志存放在 [devlogs/](devlogs/) 文件夹，以 `YYYY-MM-DD.md` 命名。

每次开发会话结束时，AI 应更新当日日志，记录：
- 完成了哪些阶段/步骤
- 当前待办事项
- 遇到的问题
- 下次计划

---

## 项目结构

```
d:\zhaijiajiliruanjian/
├── CLAUDE.md              ← 本文件（AI 助手指引）
├── package.json           ← npm 项目配置
├── capacitor.config.ts    ← Capacitor 配置
├── docs/                  ← 项目标准文档（需求/技术/设计/计划）
├── devlogs/               ← 每日开发日志
├── www/                   ← Web 源码（Capacitor 构建源）
│   ├── index.html         ← 主入口 SPA
│   ├── manifest.json      ← PWA 清单（保留兼容）
│   ├── sw.js              ← Service Worker（保留兼容）
│   ├── css/
│   │   └── style.css      ← 全局样式
│   ├── js/
│   │   ├── app.js         ← 主控制器
│   │   ├── tasks.js       ← 任务系统
│   │   ├── pet.js         ← 宠物系统
│   │   ├── storage.js     ← 数据持久层
│   │   ├── api.js         ← HTTP 客户端（LLM+天气+地图）
│   │   ├── weather.js     ← 天气模块（Open-Meteo）
│   │   ├── location.js    ← GPS 定位模块
│   │   ├── places.js      ← POI 搜索与评分模块
│   │   └── ai-engine.js   ← AI 推荐引擎
│   └── assets/
│       └── icons/         ← PWA 图标
├── android/               ← Android 原生项目（Capacitor 自动生成）
│   └── app/src/main/assets/public/  ← 构建产出的 web 资源
├── index.html             ← 根目录备份（浏览器直接打开用）
├── css/ js/ assets/       ← 根目录备份（与 www/ 保持同步）
└── node_modules/          ← npm 依赖
```

---

## 当前开发状态

| 项目 | 状态 |
|------|------|
| 阶段 0-8 | ✅ 全部完成 |
| PWA → 原生 App 转换 | ✅ 完成（2026-08-04） |
| 宠物阶段形象变化 | ✅ 完成（2026-08-08） |
| 应用图标优化 | ✅ 完成（2026-08-08） |
| 任务完成激励话语 | ✅ 完成（2026-08-08） |
| APK 构建 | ✅ 完成（2026-08-08） |
| AI 智能出行助手（阶段 10） | ✅ 完成（2026-08-09） |
| API Key 加密存储 | ✅ 完成（2026-08-16） |
| 下一步 | 真机安装测试 / AI 功能联调验证 |

### 构建环境
- **JDK**：D:\Android\Android Studio\jbr (JDK 25)
- **SDK**：D:\Android\SDK (platform 37, build-tools 36)
- **Gradle**：9.4.1 | **AGP**：9.0.1 | **compileSdk**：37
- **APK**：`android/app/build/outputs/apk/debug/app-debug.apk`

---

## AI 工作规范

### 开发时遵循
1. **阅读文档**：开始任何开发前，确认需求、技术、设计规范
2. **按阶段推进**：严格依照 [docs/dev-plan.md](docs/dev-plan.md) 的阶段顺序，不跳步
3. **每步验证**：每个阶段完成后在浏览器中验证效果
4. **更新日志**：每次会话结束前更新 `devlogs/` 当日日志
5. **更新状态**：本文件中"当前开发状态"需保持最新

### 代码风格
- 使用 ES6+ 语法（const/let、箭头函数、模板字符串）
- 注释使用中文
- 函数命名使用小驼峰（camelCase）
- CSS 使用 CSS 变量管理颜色和间距
- HTML 使用语义化标签

### 数据存储规范
- localStorage key 统一使用 `zhajiaji_data`
- 所有读写通过 `js/storage.js` 封装的函数
- 不要在业务逻辑中直接操作 localStorage

### 修改 web 源码时
- **主要修改 `www/` 下的文件**，根目录同名文件需保持同步
- 修改后运行 `npx cap sync` 同步到 Android 项目
- 运行 `npm run android` 打开 Android Studio 构建 APK

### 验证方式
- **浏览器测试**：直接打开 `www/index.html` 进行功能验证
- **APK 构建**：`npm run android` → Android Studio → Build APK
- **数据调试**：Chrome DevTools 查看 localStorage（浏览器模式）或 `adb logcat`（APK 模式）

---

## 关键约定

- **页面切换**：4 个页面用 CSS `display: none/block` 切换，无路由库
- **最大宽度**：内容区 `max-width: 480px`，适配手机屏幕
- **首次使用**：检测 `firstLaunch` 字段，展示选宠物引导
- **每日重置**：通过 `lastRefreshDate` 和 `lastMoodDecay` 判断跨天
- **无后端**：所有数据纯前端存储，无网络请求
- **构建 APK**：需安装 Android Studio + Android SDK
