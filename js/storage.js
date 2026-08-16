/* ============================================
   宅家激励 App — 数据持久层
   负责：localStorage 读写、初始化、每日重置
   所有数据操作必须通过此模块，禁止直接操作 localStorage
   ============================================ */

const Storage = (function () {
  'use strict';

  const STORAGE_KEY = 'zhajiaji_data';
  const CURRENT_VERSION = '1.0';

  // ==================== 默认数据模板 ====================
  const DEFAULT_DATA = {
    version: CURRENT_VERSION,
    firstLaunch: true,

    user: {
      points: 500,
      freeRefreshesToday: 3,
      lastRefreshDate: null,       // "YYYY-MM-DD"
      currentTaskId: null,
      taskHistory: [],
      achievements: []
    },

    pet: {
      type: 'cat',
      name: '小咪',
      level: 1,
      growth: 0,
      mood: 80,
      lastFed: null,
      lastPlayed: null,
      lastMoodDecay: null          // "YYYY-MM-DD"
    },

    customTasks: [],

    settings: {
      dailyReminder: true,
      reminderTime: '09:00',
      darkMode: 'auto'            // 'auto' | 'light' | 'dark'
    },

    // 打卡与统计
    streak: {
      current: 0,                  // 当前连续天数
      longest: 0,                  // 最长连续天数
      lastCompletedDate: null,     // "YYYY-MM-DD" 最后完成任务日期
      streakHistory: []            // ["YYYY-MM-DD", ...] 最近 60 天打卡日期
    },

    stats: {
      totalTrips: 0,              // 累计出行次数
      totalPointsEarned: 0,       // 累计获取积分
      totalPlacesExplored: 0,     // 探索地点数
      totalRoutesCompleted: 0     // 完成路线数
    },

    // 用户画像（AI 推荐用）
    profile: {
      city: '',
      latitude: null,
      longitude: null,
      interests: [],
      difficultyPreference: 'auto',
      activityStyle: 'balanced',
      maxWalkingMinutes: 60,
      preferredCategories: [],
      visitedPlaceIds: [],
      setupCompleted: false
    },

    // AI 引擎配置
    aiConfig: {
      enabled: false,
      endpoint: 'https://api.deepseek.com/v1',
      apiKey: '',        // 旧版明文 Key（已废弃，迁移后清空）
      apiKeyEnc: null,   // 加密后的 Key { v, ct, iv }（SecureStore 管理）
      model: 'deepseek-chat',
      maxTokens: 800,
      temperature: 0.8,
      routeLength: 3
    },

    // 路线缓存
    routeCache: {
      route: null,
      generatedAt: null,
      expiresAt: null
    },

    // 路线反馈
    routeFeedback: [],

    // 宠物事件日志
    petEvents: []
  };

  // ==================== 核心读写 ====================

  /**
   * 获取全部应用数据
   * @returns {object} 应用数据对象
   */
  function getData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // 首次使用，初始化数据
        const data = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData(data);
        return data;
      }
      const data = JSON.parse(raw);

      // 版本迁移（未来升级用）
      if (!data.version) {
        data.version = CURRENT_VERSION;
      }

      return data;
    } catch (e) {
      console.error('读取数据失败，使用默认数据:', e);
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  /**
   * 保存全部应用数据
   * @param {object} data - 要保存的数据对象
   */
  function saveData(data) {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      console.error('保存数据失败:', e);
      // localStorage 满了或其他错误，提示用户
      alert('数据保存失败，请检查手机存储空间');
    }
  }

  /**
   * 清除所有数据（重置应用）
   */
  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ==================== 初始化与重置 ====================

  /**
   * 获取今天的日期字符串 "YYYY-MM-DD"
   */
  function getToday() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /**
   * 检查并执行每日重置
   * - 重置免费刷新次数
   * - 计算心情衰减
   * 应在应用启动时调用
   */
  function checkDailyReset() {
    const data = getData();
    const today = getToday();
    let changed = false;

    // --- 每日刷新次数重置 ---
    if (data.user.lastRefreshDate !== today) {
      data.user.freeRefreshesToday = 3;
      data.user.lastRefreshDate = today;
      changed = true;
    }

    // --- 心情值每日衰减 ---
    if (data.pet.lastMoodDecay !== today) {
      // 计算间隔天数
      if (data.pet.lastMoodDecay) {
        const lastDate = new Date(data.pet.lastMoodDecay);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          // 每过一天，心情 -15
          const decay = diffDays * 15;
          data.pet.mood = Math.max(0, data.pet.mood - decay);
        }
      }

      data.pet.lastMoodDecay = today;
      changed = true;
    }

    if (changed) {
      saveData(data);
    }

    return data;
  }

  /**
   * 获取用户数据
   */
  function getUser() {
    return getData().user;
  }

  /**
   * 获取宠物数据
   */
  function getPet() {
    return getData().pet;
  }

  /**
   * 获取设置
   */
  function getSettings() {
    return getData().settings;
  }

  /**
   * 获取自定义任务列表
   */
  function getCustomTasks() {
    return getData().customTasks || [];
  }

  /**
   * 更新用户数据
   */
  function updateUser(updates) {
    const data = getData();
    Object.assign(data.user, updates);
    saveData(data);
  }

  /**
   * 更新宠物数据
   */
  function updatePet(updates) {
    const data = getData();
    Object.assign(data.pet, updates);
    saveData(data);
  }

  /**
   * 更新设置
   */
  function updateSettings(updates) {
    const data = getData();
    Object.assign(data.settings, updates);
    saveData(data);
  }

  /**
   * 保存自定义任务
   */
  function saveCustomTasks(tasks) {
    const data = getData();
    data.customTasks = tasks;
    saveData(data);
  }

  /**
   * 标记首次启动已完成
   */
  function markFirstLaunchDone() {
    const data = getData();
    data.firstLaunch = false;
    saveData(data);
  }

  /**
   * 检查是否首次启动
   */
  function isFirstLaunch() {
    return getData().firstLaunch !== false;
  }

  // ==================== 用户画像 (Profile) ====================

  /**
   * 获取用户画像
   */
  function getProfile() {
    return getData().profile;
  }

  /**
   * 保存用户画像
   */
  function saveProfile(profile) {
    var data = getData();
    data.profile = profile;
    saveData(data);
  }

  // ==================== AI 配置 ====================

  /**
   * 获取 AI 配置
   */
  function getAIConfig() {
    return getData().aiConfig;
  }

  /**
   * 保存 AI 配置
   */
  function saveAIConfig(aiConfig) {
    var data = getData();
    data.aiConfig = aiConfig;
    saveData(data);
  }

  // ==================== 路线缓存 ====================

  /**
   * 获取缓存的路线
   * @returns {object|null} 路线对象或 null（如果已过期）
   */
  function getRouteCache() {
    var cache = getData().routeCache;
    if (!cache.route || !cache.expiresAt) return null;

    // 检查是否过期
    if (new Date().toISOString() > cache.expiresAt) {
      clearRouteCache();
      return null;
    }

    return cache.route;
  }

  /**
   * 保存路线到缓存（2 小时有效）
   */
  function saveRouteCache(route) {
    var data = getData();
    var now = new Date();
    var expires = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h 有效期
    data.routeCache = {
      route: route,
      generatedAt: now.toISOString(),
      expiresAt: expires.toISOString()
    };
    saveData(data);
  }

  /**
   * 清除路线缓存
   */
  function clearRouteCache() {
    var data = getData();
    data.routeCache = { route: null, generatedAt: null, expiresAt: null };
    saveData(data);
  }

  /**
   * 标记地点已访问（用于去重）
   */
  function markPlaceVisited(placeId) {
    var profile = getProfile();
    if (!profile.visitedPlaceIds) profile.visitedPlaceIds = [];
    if (profile.visitedPlaceIds.indexOf(placeId) === -1) {
      profile.visitedPlaceIds.push(placeId);
      // 只保留最近 30 条
      if (profile.visitedPlaceIds.length > 30) {
        profile.visitedPlaceIds = profile.visitedPlaceIds.slice(-30);
      }
      saveProfile(profile);
    }
  }

  // ==================== 打卡与统计 ====================

  function getStreak() { return getData().streak; }
  function getStats() { return getData().stats; }

  function recordTaskCompleted() {
    var data = getData();
    var today = getToday();
    var streak = data.streak;
    var stats = data.stats;

    // 更新打卡
    if (streak.lastCompletedDate !== today) {
      // 检查是否连续
      if (streak.lastCompletedDate) {
        var lastDate = new Date(streak.lastCompletedDate);
        var todayDate = new Date(today);
        var diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak.current++;
        } else if (diffDays > 1) {
          streak.current = 1; // 断了，重新开始
        }
      } else {
        streak.current = 1;
      }

      if (streak.current > streak.longest) {
        streak.longest = streak.current;
      }

      streak.lastCompletedDate = today;
      streak.streakHistory.push(today);
      // 只保留最近 90 天
      if (streak.streakHistory.length > 90) {
        streak.streakHistory = streak.streakHistory.slice(-90);
      }
    }

    // 更新统计
    stats.totalTrips = (stats.totalTrips || 0) + 1;
    stats.totalPointsEarned = (stats.totalPointsEarned || 0) + 0; // 由调用者更新

    saveData(data);
  }

  function addPointsEarned(points) {
    var data = getData();
    data.stats.totalPointsEarned = (data.stats.totalPointsEarned || 0) + points;
    saveData(data);
  }

  function recordRouteCompleted(placesCount) {
    var data = getData();
    data.stats.totalRoutesCompleted = (data.stats.totalRoutesCompleted || 0) + 1;
    data.stats.totalPlacesExplored = (data.stats.totalPlacesExplored || 0) + (placesCount || 0);
    data.stats.totalTrips = (data.stats.totalTrips || 0) + 1;
    saveData(data);
  }

  // ==================== 路线反馈 ====================

  function addRouteFeedback(feedback) {
    var data = getData();
    data.routeFeedback.push({
      route: feedback.routeName || '',
      rating: feedback.rating || 'like', // 'like' | 'dislike'
      timestamp: new Date().toISOString()
    });
    // 只保留最近 50 条
    if (data.routeFeedback.length > 50) {
      data.routeFeedback = data.routeFeedback.slice(-50);
    }
    saveData(data);
  }

  // ==================== 宠物事件 ====================

  function addPetEvent(event) {
    var data = getData();
    data.petEvents.push({
      type: event.type || 'random',
      message: event.message || '',
      effect: event.effect || '',
      timestamp: new Date().toISOString()
    });
    if (data.petEvents.length > 100) {
      data.petEvents = data.petEvents.slice(-100);
    }
    saveData(data);
  }

  function getPetEvents(count) {
    var events = getData().petEvents || [];
    count = count || 10;
    return events.slice(-count).reverse();
  }

  // ==================== 数据导出/导入 ====================

  function exportData() {
    var data = getData();
    // 剥离敏感信息：API Key 明文与密文均不导出，备份文件不含任何密钥材料
    var exportCopy = JSON.parse(JSON.stringify(data));
    if (exportCopy.aiConfig) {
      exportCopy.aiConfig.apiKey = '';
      exportCopy.aiConfig.apiKeyEnc = null;
    }
    var json = JSON.stringify(exportCopy, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'outgo_backup_' + getToday() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  function importData(jsonStr) {
    try {
      var imported = JSON.parse(jsonStr);
      if (!imported.version || !imported.user) {
        return { ok: false, message: '备份文件格式不正确' };
      }
      // 合并导入（保留当前 AI 配置和设置）
      var current = getData();
      imported.aiConfig = current.aiConfig;
      imported.settings = current.settings;
      imported.profile = current.profile;
      saveData(imported);
      return { ok: true, message: '数据已恢复，请刷新页面' };
    } catch (e) {
      return { ok: false, message: '文件解析失败：' + e.message };
    }
  }

  // ==================== 调试工具 ====================

  /**
   * 在控制台打印当前数据（调试用）
   */
  function debugPrint() {
    const data = getData();
    console.log('📦 当前应用数据:', JSON.stringify(data, null, 2));
    return data;
  }

  /**
   * 重置应用（调试用）
   */
  function debugReset() {
    if (confirm('确定要清除所有数据并重置应用吗？此操作不可恢复！')) {
      clearAll();
      location.reload();
    }
  }

  // ==================== 对外暴露 ====================
  return {
    STORAGE_KEY,
    getData,
    saveData,
    clearAll,
    getToday,
    checkDailyReset,
    getUser,
    getPet,
    getSettings,
    getCustomTasks,
    updateUser,
    updatePet,
    updateSettings,
    saveCustomTasks,
    markFirstLaunchDone,
    isFirstLaunch,
    // 新增
    getProfile,
    saveProfile,
    getAIConfig,
    saveAIConfig,
    getRouteCache,
    saveRouteCache,
    clearRouteCache,
    markPlaceVisited,
    // 打卡与统计
    getStreak, getStats, recordTaskCompleted, addPointsEarned, recordRouteCompleted,
    // 反馈
    addRouteFeedback,
    // 宠物事件
    addPetEvent, getPetEvents,
    // 导入导出
    exportData, importData,
    // 调试
    debugPrint,
    debugReset
  };

})();
