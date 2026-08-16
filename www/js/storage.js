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
      reminderTime: '09:00'
    }
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
    debugPrint,
    debugReset
  };

})();
