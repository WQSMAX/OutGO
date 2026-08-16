/* ============================================
   宅家激励 App — 任务系统
   负责：预设任务库、随机抽取、刷新、完成
   ============================================ */

const Tasks = (function () {
  'use strict';

  // ==================== 预设任务库 ====================
  // 共 21 条预设任务，按难度分三档
  const PRESET_TASKS = [
    // --- 简单 (30 积分) ---
    { id: 'preset_easy_1', title: '下楼散步 10 分钟', difficulty: 'easy', points: 30 },
    { id: 'preset_easy_2', title: '去楼下取快递', difficulty: 'easy', points: 30 },
    { id: 'preset_easy_3', title: '出门倒垃圾', difficulty: 'easy', points: 30 },
    { id: 'preset_easy_4', title: '去阳台晒 5 分钟太阳', difficulty: 'easy', points: 30 },
    { id: 'preset_easy_5', title: '去便利店买瓶水', difficulty: 'easy', points: 30 },
    { id: 'preset_easy_6', title: '在家门口站 5 分钟呼吸新鲜空气', difficulty: 'easy', points: 30 },
    { id: 'preset_easy_7', title: '去附近早餐店买个早餐', difficulty: 'easy', points: 30 },

    // --- 中等 (50 积分) ---
    { id: 'preset_medium_1', title: '去附近的公园坐坐', difficulty: 'medium', points: 50 },
    { id: 'preset_medium_2', title: '逛书店 20 分钟', difficulty: 'medium', points: 50 },
    { id: 'preset_medium_3', title: '去咖啡馆喝一杯', difficulty: 'medium', points: 50 },
    { id: 'preset_medium_4', title: '去超市买点东西', difficulty: 'medium', points: 50 },
    { id: 'preset_medium_5', title: '去操场走 5 圈', difficulty: 'medium', points: 50 },
    { id: 'preset_medium_6', title: '骑共享单车兜风 15 分钟', difficulty: 'medium', points: 50 },
    { id: 'preset_medium_7', title: '去菜市场买点水果', difficulty: 'medium', points: 50 },

    // --- 困难 (80 积分) ---
    { id: 'preset_hard_1', title: '去爬山', difficulty: 'hard', points: 80 },
    { id: 'preset_hard_2', title: '去博物馆参观', difficulty: 'hard', points: 80 },
    { id: 'preset_hard_3', title: '约朋友一起吃饭', difficulty: 'hard', points: 80 },
    { id: 'preset_hard_4', title: '骑行 5 公里', difficulty: 'hard', points: 80 },
    { id: 'preset_hard_5', title: '参加一个社区活动', difficulty: 'hard', points: 80 },
    { id: 'preset_hard_6', title: '去电影院看一场电影', difficulty: 'hard', points: 80 },
    { id: 'preset_hard_7', title: '去健身房锻炼 30 分钟', difficulty: 'hard', points: 80 }
  ];

  // ==================== 难度配置 ====================
  const DIFFICULTY_CONFIG = {
    easy: { label: '🌱 简单', points: 30, growthBonus: 10 },
    medium: { label: '🎯 中等', points: 50, growthBonus: 20 },
    hard: { label: '🔥 困难', points: 80, growthBonus: 35 }
  };

  // 积分刷新费用
  const REFRESH_COST = 20;

  // ==================== 任务完成激励话语库 ====================
  const COMPLETION_MOTIVATION = {
    easy: [
      '小小的开始，大大的进步！继续加油~',
      '每一步都算数，你很棒！',
      '出门就是胜利，今日份打卡完成！',
      '轻松搞定！别忘了外面的阳光正好~',
      '不错哦，一点点积累就是大改变！'
    ],
    medium: [
      '做得真好！你的宠物为你感到骄傲！',
      '坚持出门的你，比昨天更厉害了~',
      '又完成了一项！这份坚持很珍贵哦',
      '太棒了！积少成多，你在慢慢改变！',
      '很棒！出门活动一下身心都舒畅了吧~'
    ],
    hard: [
      '了不起！完成困难任务的你太强了！',
      '挑战成功！你是自己的英雄！',
      '这么难的任务都完成了，还有什么做不到的？',
      '🔥 燃起来了！你的宠物眼睛都亮了！',
      '太厉害了！这种挑战都能拿下，佩服！'
    ],
    levelUp: [
      '你的宠物又长大了一点！都是你的功劳~',
      '升级啦！陪伴是相互的成长呢',
      '看到宠物的变化了吗？这是你努力的证明！',
      '成长的不只是宠物，还有越来越好的你~'
    ],
    lowMood: [
      '你看，出门一趟心情好多了吧？宠物也是！',
      '完成任务让宠物重新开心起来了~你做得好！',
      '宠物因为你而开心起来，这就是陪伴的意义呀',
      '看！出门走走之后，一切都变好了呢~'
    ]
  };

  /**
   * 根据难度、是否升级、宠物之前的心情获取激励话语
   */
  function getMotivationalMessage(difficulty, leveledUp, petMoodBefore) {
    let messages;

    // 如果宠物之前心情很低，优先用低心情激励语
    if (petMoodBefore < 30) {
      messages = COMPLETION_MOTIVATION.lowMood;
    } else {
      messages = COMPLETION_MOTIVATION[difficulty] || COMPLETION_MOTIVATION.medium;
    }

    let msg = messages[Math.floor(Math.random() * messages.length)];

    // 如果升级了，在前面加上升级祝贺
    if (leveledUp) {
      const levelUpMsgs = COMPLETION_MOTIVATION.levelUp;
      const levelUpMsg = levelUpMsgs[Math.floor(Math.random() * levelUpMsgs.length)];
      msg = levelUpMsg + ' ' + msg;
    }

    return msg;
  }

  // ==================== 辅助函数 ====================

  /**
   * 获取全部可用任务（预设 + 自定义）
   * @returns {Array} 任务数组
   */
  function getAllTasks() {
    const customTasks = Storage.getCustomTasks();
    return [...PRESET_TASKS, ...customTasks];
  }

  /**
   * 天气感知任务权重映射
   * 根据天气代码调整各类任务的出现概率
   */
  function getWeatherWeightedTasks(weatherCode) {
    var all = getAllTasks();
    // 如果没有天气或任务太少，直接随机
    if (weatherCode === undefined || weatherCode === null || all.length < 3) {
      var idx = Math.floor(Math.random() * all.length);
      return all[idx];
    }

    // 根据天气给任务加权
    var scored = all.map(function (t) {
      var score = 1;
      var title = t.title;

      // 晴好天气：户外活动类加权
      if (weatherCode <= 2) {
        if (title.indexOf('公园') !== -1 || title.indexOf('散步') !== -1 || title.indexOf('爬山') !== -1 || title.indexOf('骑行') !== -1 || title.indexOf('兜风') !== -1) score += 3;
      }
      // 雨天：室内/半室内加权
      if (weatherCode >= 51 && weatherCode <= 65) {
        if (title.indexOf('书店') !== -1 || title.indexOf('咖啡') !== -1 || title.indexOf('博物馆') !== -1 || title.indexOf('超市') !== -1 || title.indexOf('便利店') !== -1 || title.indexOf('取快递') !== -1) score += 3;
        if (title.indexOf('爬山') !== -1 || title.indexOf('骑行') !== -1) score -= 2;
      }
      // 雪天
      if (weatherCode >= 71 && weatherCode <= 77) {
        if (title.indexOf('书店') !== -1 || title.indexOf('咖啡') !== -1 || title.indexOf('博物馆') !== -1 || title.indexOf('电影') !== -1) score += 3;
        if (title.indexOf('散步') !== -1 && title.indexOf('太阳') === -1) score -= 1;
      }
      // 高温
      if (weatherCode >= 80) {
        if (title.indexOf('书店') !== -1 || title.indexOf('咖啡') !== -1 || title.indexOf('电影') !== -1 || title.indexOf('博物馆') !== -1) score += 3;
        if (title.indexOf('爬山') !== -1 || title.indexOf('骑行') !== -1) score -= 3;
      }

      // 难度偏好影响
      var profile = Storage.getProfile();
      if (profile && profile.difficultyPreference !== 'auto') {
        if (t.difficulty === profile.difficultyPreference) score += 2;
      }

      return { task: t, score: Math.max(1, score) };
    });

    // 按权重随机选择
    var totalWeight = 0;
    for (var i = 0; i < scored.length; i++) { totalWeight += scored[i].score; }
    var rand = Math.random() * totalWeight;
    var cumulative = 0;
    for (var j = 0; j < scored.length; j++) {
      cumulative += scored[j].score;
      if (rand <= cumulative) return scored[j].task;
    }
    return scored[scored.length - 1].task;
  }

  /**
   * 随机抽取一个任务
   * @param {string|null} excludeId - 排除的任务 ID（避免连续重复）
   * @param {number|null} weatherCode - 天气代码（可选，用于加权）
   * @returns {object} 随机任务
   */
  function getRandomTask(excludeId, weatherCode) {
    let pool = getAllTasks();

    // 排除上一个任务（避免连续出现同一个）
    if (excludeId && pool.length > 1) {
      const filtered = pool.filter(t => t.id !== excludeId);
      if (filtered.length > 0) {
        pool = filtered;
      }
    }

    // 如果有天气信息，使用加权抽取
    if (weatherCode !== undefined && weatherCode !== null && pool.length >= 3) {
      return getWeatherWeightedTasks(weatherCode);
    }

    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  /**
   * 根据难度获取积分
   */
  function getPointsByDifficulty(difficulty) {
    const config = DIFFICULTY_CONFIG[difficulty];
    return config ? config.points : 50;
  }

  /**
   * 根据难度获取成长值奖励
   */
  function getGrowthByDifficulty(difficulty) {
    const config = DIFFICULTY_CONFIG[difficulty];
    return config ? config.growthBonus : 20;
  }

  // ==================== 核心操作 ====================

  /**
   * 刷新任务（换一个）
   * @returns {object} { success, task, message }
   */
  function refreshTask() {
    const data = Storage.getData();
    const user = data.user;

    // 检查免费次数
    if (user.freeRefreshesToday > 0) {
      // 使用免费刷新
      const newTask = getRandomTask(user.currentTaskId);
      user.freeRefreshesToday--;
      user.currentTaskId = newTask.id;
      Storage.saveData(data);
      return {
        success: true,
        task: newTask,
        freeRefreshesLeft: user.freeRefreshesToday,
        message: '已刷新任务！剩余免费刷新 ' + user.freeRefreshesToday + ' 次'
      };
    }

    // 免费次数用完，检查积分
    if (user.points >= REFRESH_COST) {
      user.points -= REFRESH_COST;
      const newTask = getRandomTask(user.currentTaskId);
      user.currentTaskId = newTask.id;
      Storage.saveData(data);
      return {
        success: true,
        task: newTask,
        freeRefreshesLeft: 0,
        cost: REFRESH_COST,
        message: '消耗 ' + REFRESH_COST + ' 积分刷新任务'
      };
    }

    // 积分也不够
    return {
      success: false,
      task: null,
      message: '积分不足！需要 ' + REFRESH_COST + ' 积分才能刷新，快去完成任务赚积分吧~'
    };
  }

  /**
   * 完成任务
   * @returns {object} { success, task, pointsEarned, growthEarned, message }
   */
  function completeTask() {
    const data = Storage.getData();
    const user = data.user;
    const pet = data.pet;

    // 获取当前任务
    const taskId = user.currentTaskId;
    const allTasks = getAllTasks();
    const task = allTasks.find(t => t.id === taskId);

    if (!task) {
      return { success: false, message: '没有可完成的任务，请先刷新获取一个任务' };
    }

    const pointsEarned = task.points || getPointsByDifficulty(task.difficulty);
    const growthEarned = getGrowthByDifficulty(task.difficulty);

    // 捕获宠物当前心情（提升前），用于生成激励语
    const petMoodBefore = pet.mood;

    // 增加积分
    user.points += pointsEarned;

    // 增加宠物成长值
    pet.growth += growthEarned;

    // 检查升级
    let leveledUp = false;
    while (pet.growth >= 100 && pet.level < 10) {
      pet.growth -= 100;
      pet.level++;
      leveledUp = true;
    }
    // 10 级封顶
    if (pet.level >= 10 && pet.growth > 100) {
      pet.growth = 100;
    }

    // 提升心情（完成任务让宠物开心）
    pet.mood = Math.min(100, pet.mood + 10);

    // 记录历史
    user.taskHistory.unshift({
      id: task.id,
      title: task.title,
      difficulty: task.difficulty,
      points: pointsEarned,
      completedAt: new Date().toISOString()
    });

    // 清除当前任务（下次打开时重新随机）
    user.currentTaskId = null;

    Storage.saveData(data);

    // 记录打卡和统计
    Storage.recordTaskCompleted();
    Storage.addPointsEarned(pointsEarned);

    let message = '🎉 任务完成！获得 ' + pointsEarned + ' 积分';
    if (leveledUp) {
      message += '\n🌟 宠物升级了！现在是 Lv.' + pet.level;
    }

    // 生成激励话语
    const motivation = getMotivationalMessage(task.difficulty, leveledUp, petMoodBefore);

    return {
      success: true,
      task: task,
      pointsEarned: pointsEarned,
      growthEarned: growthEarned,
      petLevel: pet.level,
      leveledUp: leveledUp,
      message: message,
      motivation: motivation
    };
  }

  /**
   * 获取当前展示的任务
   * - AI 已配置 + 有网络：异步加载 AI 路线（立即返回预设任务，加载完成后回调刷新 UI）
   * - 未配置/离线：返回预设任务
   *
   * @param {function} onAIRouteReady - AI 路线加载完成的回调
   * @returns {object} 任务对象（可能是预设任务或路线任务）
   */
  function getCurrentTask(onAIRouteReady) {
    const user = Storage.getUser();

    // 尝试找到保存的任务
    if (user.currentTaskId) {
      const allTasks = getAllTasks();
      const saved = allTasks.find(t => t.id === user.currentTaskId);
      if (saved) return saved;
    }

    // 没有或已失效，随机给一个
    const newTask = getRandomTask(null);
    const data = Storage.getData();
    data.user.currentTaskId = newTask.id;
    Storage.saveData(data);

    // 如果 AI 已配置，后台异步加载 AI 路线
    if (onAIRouteReady && isAIEnabled()) {
      generateAIRouteAsync(onAIRouteReady);
    }

    return newTask;
  }

  /**
   * 检查 AI 是否已启用
   */
  function isAIEnabled() {
    const config = Storage.getAIConfig();
    return config && config.enabled && config.endpoint && config.apiKey;
  }

  /**
   * 异步生成 AI 路线（不阻塞 UI）
   */
  async function generateAIRouteAsync(callback) {
    try {
      const config = Storage.getAIConfig();
      const profile = Storage.getProfile();
      const pet = Storage.getPet();

      // 如果用户还没有设置位置（城市或坐标），不自动触发 AI
      if (!profile.city && !profile.latitude && !profile.longitude) return;

      // 获取天气
      const posResult = await Location.getPosition();
      var weatherSummary = '';
      if (posResult.ok && posResult.lat) {
        const weatherResult = await Weather.getWeather(posResult.lat, posResult.lng);
        if (weatherResult.ok) {
          weatherSummary = weatherResult.summary;
        }

        // 搜索周边地点
        const placesResult = await Places.searchNearby(posResult.lat, posResult.lng, {
          style: profile.activityStyle || 'balanced',
          categories: profile.preferredCategories || [],
          excludeIds: profile.visitedPlaceIds || [],
          radius: 3000
        });

        var context = {
          profile: profile,
          pet: pet,
          config: config,
          weatherSummary: weatherSummary,
          places: placesResult.ok ? placesResult.places : []
        };

        var routeResult = await AIEngine.generateRoute(context);

        if (routeResult.ok && routeResult.route) {
          // 保存路线到缓存
          Storage.saveRouteCache(routeResult.route);

          // 更新 currentTaskId 为 AI 任务
          var data = Storage.getData();
          data.user.currentTaskId = 'ai_route_' + Date.now();
          Storage.saveData(data);

          // 回调通知 UI 刷新
          if (callback) callback(routeResult.route, routeResult.source);
        }
      }
    } catch (e) {
      console.log('[Tasks] AI 路线生成异常:', e);
      // 静默失败，UI 已显示预设任务
    }
  }

  /**
   * 获取当前 AI 路线（同步，从缓存读取）
   */
  function getCurrentRoute() {
    return Storage.getRouteCache();
  }

  /**
   * 获取免费刷新剩余次数
   */
  function getFreeRefreshes() {
    return Storage.getUser().freeRefreshesToday;
  }

  // ==================== 对外暴露 ====================
  return {
    PRESET_TASKS,
    DIFFICULTY_CONFIG,
    REFRESH_COST,
    getAllTasks,
    getRandomTask,
    getCurrentTask,
    refreshTask,
    completeTask,
    getFreeRefreshes,
    getPointsByDifficulty,
    getGrowthByDifficulty,
    // AI 扩展
    isAIEnabled,
    generateAIRouteAsync,
    getCurrentRoute
  };

})();
