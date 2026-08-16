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
   * 随机抽取一个任务
   * @param {string|null} excludeId - 排除的任务 ID（避免连续重复）
   * @returns {object} 随机任务
   */
  function getRandomTask(excludeId) {
    let pool = getAllTasks();

    // 排除上一个任务（避免连续出现同一个）
    if (excludeId && pool.length > 1) {
      const filtered = pool.filter(t => t.id !== excludeId);
      if (filtered.length > 0) {
        pool = filtered;
      }
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
   * 如果有 currentTaskId 就找对应的，否则随机给一个新的
   */
  function getCurrentTask() {
    const user = Storage.getUser();
    const allTasks = getAllTasks();

    // 尝试找到保存的任务
    if (user.currentTaskId) {
      const saved = allTasks.find(t => t.id === user.currentTaskId);
      if (saved) return saved;
    }

    // 没有或已失效，随机给一个
    const newTask = getRandomTask(null);
    const data = Storage.getData();
    data.user.currentTaskId = newTask.id;
    Storage.saveData(data);
    return newTask;
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
    getGrowthByDifficulty
  };

})();
