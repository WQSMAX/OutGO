/* ============================================
   宅家激励 App — 宠物系统
   负责：宠物选择、成长、心情、互动、鼓励语
   ============================================ */

const Pet = (function () {
  'use strict';

  // ==================== 宠物类型定义 ====================
  const PET_TYPES = {
    cat: {
      id: 'cat',
      name: '小猫',
      emoji: '🐱',
      description: '温柔可爱的小猫咪，喜欢陪伴在你身边'
    },
    dog: {
      id: 'dog',
      name: '小狗',
      emoji: '🐶',
      description: '活泼热情的小狗狗，每天都想和你出去玩'
    },
    bunny: {
      id: 'bunny',
      name: '小兔',
      emoji: '🐰',
      description: '软萌的小兔子，安安静静地等你回家'
    },
    bird: {
      id: 'bird',
      name: '小鸟',
      emoji: '🐤',
      description: '自由的小鸟，会唱歌给你听'
    }
  };

  // ==================== 互动成本 ====================
  const FEED_COST = 20;
  const PLAY_COST = 10;
  const FEED_MOOD_BOOST = 20;
  const PLAY_GROWTH_BOOST = 10;  // 玩耍消耗积分，增加成长值

  // ==================== 心情表情映射 ====================
  function getMoodEmoji(mood) {
    if (mood >= 80) return '😊';
    if (mood >= 60) return '😄';
    if (mood >= 40) return '😐';
    if (mood >= 20) return '😞';
    return '🤒';  // 生病
  }

  function getMoodLabel(mood) {
    if (mood >= 80) return '非常开心';
    if (mood >= 60) return '开心';
    if (mood >= 40) return '一般';
    if (mood >= 20) return '不开心';
    return '生病了';
  }

  function getMoodCssClass(mood) {
    if (mood >= 60) return 'mood';
    if (mood >= 30) return 'mood warning';
    return 'mood danger';
  }

  // ==================== 成长阶段视觉配置 ====================
  const STAGE_VISUALS = {
    1: {
      name: '幼崽期', sizeMul: 0.8, bgClass: 'stage-baby',
      badge: '🌱', desc: '小小的一团，需要你的呵护',
      badgeClass: 'baby'
    },
    2: {
      name: '成长期', sizeMul: 1.0, bgClass: 'stage-growing',
      badge: '🌿', desc: '正在茁壮成长中！',
      badgeClass: 'growing'
    },
    3: {
      name: '成熟期', sizeMul: 1.2, bgClass: 'stage-mature',
      badge: '🌳', desc: '已经长大啦，是你最可靠的伙伴！',
      badgeClass: 'mature'
    },
    4: {
      name: '完全体', sizeMul: 1.4, bgClass: 'stage-ultimate',
      badge: '⭐', desc: '达到完全体！闪闪发光的存在！',
      badgeClass: 'ultimate'
    }
  };

  /**
   * 根据等级获取阶段编号（1-4）
   */
  function getStageNumber(level) {
    if (level <= 3) return 1;
    if (level <= 6) return 2;
    if (level <= 9) return 3;
    return 4;
  }

  // 保留向后兼容
  function getGrowthStage(level) {
    const sv = STAGE_VISUALS[getStageNumber(level)];
    return sv ? sv.name : '幼崽期';
  }

  function getPetSize(level) {
    const sv = STAGE_VISUALS[getStageNumber(level)];
    return sv ? sv.sizeMul : 1.0;
  }

  // ==================== AI 图片映射（未来扩展用） ====================
  const PET_STAGE_IMAGES = {
    cat:   { 1: 'assets/pets/cat-1.png',   2: 'assets/pets/cat-2.png',   3: 'assets/pets/cat-3.png',   4: 'assets/pets/cat-4.png' },
    dog:   { 1: 'assets/pets/dog-1.png',   2: 'assets/pets/dog-2.png',   3: 'assets/pets/dog-3.png',   4: 'assets/pets/dog-4.png' },
    bunny: { 1: 'assets/pets/bunny-1.png', 2: 'assets/pets/bunny-2.png', 3: 'assets/pets/bunny-3.png', 4: 'assets/pets/bunny-4.png' },
    bird:  { 1: 'assets/pets/bird-1.png',  2: 'assets/pets/bird-2.png',  3: 'assets/pets/bird-3.png',  4: 'assets/pets/bird-4.png' }
  };

  // ==================== 鼓励语句库 ====================
  const ENCOURAGE_MESSAGES = [
    // 高心情（>= 60）
    {
      minMood: 60,
      messages: [
        '今天天气一定很好，出去走走吧！',
        '你是我最棒的主人！完成任务回来陪我玩吧~',
        '加油！外面的世界在等着你呢！',
        '我在这儿等你回来，记得给我带好吃的哦~',
        '出去走走心情会变好的，相信我！'
      ]
    },
    // 中等心情（30-59）
    {
      minMood: 30,
      messages: [
        '你最近好像很少出门了…我们一起去散步好吗？',
        '我有点想看看外面的世界了呢…',
        '偶尔出去走走对身体好哦，我也会想你的！',
        '要不要今天试试出门？就一小会儿~'
      ]
    },
    // 低心情（< 30）
    {
      minMood: 0,
      messages: [
        '我觉得好孤单…你能带我出去走走吗？',
        '我已经好久没看到阳光了…我想和你一起出去！',
        '我好像生病了…可能是因为你太久没出门了…',
        '主人，你忘记我了吗？完成一个任务让我开心起来吧…'
      ]
    }
  ];

  function getEncourageMessage(mood) {
    const category = ENCOURAGE_MESSAGES.find(c => mood >= c.minMood);
    if (!category) return ENCOURAGE_MESSAGES[2].messages[0];

    const messages = category.messages;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // ==================== 宠物操作 ====================

  /**
   * 获取宠物状态（可接受 AI 生成的鼓励语覆盖）
   * @param {string|null} aiEncourageMessage - AI 生成的鼓励语（可选）
   */
  function getPetState(aiEncourageMessage) {
    const pet = Storage.getPet();
    const stageNum = getStageNumber(pet.level);
    const encourageMsg = aiEncourageMessage || getEncourageMessage(pet.mood);
    return {
      ...pet,
      moodEmoji: getMoodEmoji(pet.mood),
      moodLabel: getMoodLabel(pet.mood),
      moodCssClass: getMoodCssClass(pet.mood),
      growthStage: getGrowthStage(pet.level),
      size: getPetSize(pet.level),
      encourageMessage: encourageMsg,
      typeInfo: PET_TYPES[pet.type] || PET_TYPES.cat,
      stageVisual: STAGE_VISUALS[stageNum] || STAGE_VISUALS[1],
      stageImage: (PET_STAGE_IMAGES[pet.type] || {})[stageNum] || null
    };
  }

  /**
   * 选择宠物（首次使用或更换）
   * @param {string} type - 宠物类型 (cat/dog/bunny/bird)
   * @param {string} name - 宠物名字
   */
  function choosePet(type, name) {
    const petType = PET_TYPES[type];
    if (!petType) return { success: false, message: '无效的宠物类型' };

    Storage.updatePet({
      type: type,
      name: name || petType.name,
      level: 1,
      growth: 0,
      mood: 80,
      lastFed: null,
      lastPlayed: null,
      lastMoodDecay: Storage.getToday()
    });

    return { success: true, message: '欢迎 ' + (name || petType.name) + '！' };
  }

  /**
   * 切换宠物类型（保留等级和成长数据）
   * @param {string} type - 新宠物类型
   */
  function switchPetType(type) {
    const petType = PET_TYPES[type];
    if (!petType) return { success: false, message: '无效的宠物类型' };

    const currentPet = Storage.getPet();
    Storage.updatePet({
      type: type,
      name: currentPet.name  // 保留名字
      // level, growth, mood 等保持不变
    });

    return { success: true, message: '已切换为' + petType.name };
  }

  /**
   * 喂食宠物
   * @returns {object} 操作结果
   */
  function feedPet() {
    const data = Storage.getData();
    const user = data.user;
    const pet = data.pet;

    // 检查积分
    if (user.points < FEED_COST) {
      return {
        success: false,
        message: '积分不足！需要 ' + FEED_COST + ' 积分才能喂食，快去完成任务吧~'
      };
    }

    // 检查是否已满
    if (pet.mood >= 100) {
      return {
        success: false,
        message: pet.name + '已经吃得很饱了，不用再喂啦~'
      };
    }

    // 消耗积分，提升心情
    user.points -= FEED_COST;
    pet.mood = Math.min(100, pet.mood + FEED_MOOD_BOOST);
    pet.lastFed = new Date().toISOString();

    Storage.saveData(data);

    return {
      success: true,
      mood: pet.mood,
      cost: FEED_COST,
      message: '🍖 喂食成功！' + pet.name + '的心情提升了 ' + FEED_MOOD_BOOST + ' 点！'
    };
  }

  /**
   * 和宠物玩耍
   * @returns {object} 操作结果
   */
  function playWithPet() {
    const data = Storage.getData();
    const user = data.user;
    const pet = data.pet;

    // 检查积分
    if (user.points < PLAY_COST) {
      return {
        success: false,
        message: '积分不足！需要 ' + PLAY_COST + ' 积分才能玩耍，快去完成任务吧~'
      };
    }

    // 消耗积分，增加成长值（不设上限）
    user.points -= PLAY_COST;
    pet.growth += PLAY_GROWTH_BOOST;
    pet.lastPlayed = new Date().toISOString();

    // 检查升级
    var leveledUp = false;
    while (pet.growth >= 100 && pet.level < 10) {
      pet.growth -= 100;
      pet.level++;
      leveledUp = true;
    }
    if (pet.level >= 10 && pet.growth > 100) {
      pet.growth = 100;
    }

    Storage.saveData(data);

    var msg = '🎾 玩耍成功！' + pet.name + '的成长值 +' + PLAY_GROWTH_BOOST;
    if (leveledUp) {
      msg += '\n🌟 宠物升级了！现在是 Lv.' + pet.level;
    }

    return {
      success: true,
      growth: pet.growth,
      level: pet.level,
      leveledUp: leveledUp,
      cost: PLAY_COST,
      message: msg
    };
  }

  /**
   * 获取宠物类型列表（用于选择器）
   */
  function getPetTypes() {
    return Object.values(PET_TYPES);
  }

  // ==================== 随机事件系统（新增） ====================

  var RANDOM_EVENTS = [
    { type: 'happy', chance: 0.15, msg: '在窗台上看到了一只小鸟，兴奋地叫了起来！', effect: '心情+5', moodDelta: 5, growthDelta: 0 },
    { type: 'happy', chance: 0.10, msg: '追着自己的尾巴转圈，玩得不亦乐乎~', effect: '心情+3', moodDelta: 3, growthDelta: 0 },
    { type: 'growth', chance: 0.08, msg: '偷偷练习了新技能，感觉自己又成长了！', effect: '成长+5', moodDelta: 0, growthDelta: 5 },
    { type: 'neutral', chance: 0.12, msg: '把玩具藏到了沙发底下…你得找回来', effect: '无事发生', moodDelta: 0, growthDelta: 0 },
    { type: 'happy', chance: 0.09, msg: '在家里发现了你藏的零食，开心地分享给你', effect: '心情+8', moodDelta: 8, growthDelta: 0 },
    { type: 'growth', chance: 0.07, msg: '今天特别有活力，绕着屋子跑了十圈！', effect: '成长+3 心情+3', moodDelta: 3, growthDelta: 3 },
    { type: 'neutral', chance: 0.06, msg: '一整天都在睡觉…大概是昨晚熬夜守护你了', effect: '无事发生', moodDelta: 0, growthDelta: 0 },
    { type: 'happy', chance: 0.05, msg: '居然学会了给你开门！虽然只是推了一下门', effect: '心情+10 成长+5', moodDelta: 10, growthDelta: 5 },
    { type: 'sad', chance: 0.04, msg: '不小心打翻了水杯，现在躲在角落里不敢出来…', effect: '心情-5', moodDelta: -5, growthDelta: 0 },
    { type: 'growth', chance: 0.04, msg: '在窗边晒太阳，光合作用下好像长高了一点！', effect: '成长+8', moodDelta: 0, growthDelta: 8 },
    { type: 'happy', chance: 0.03, msg: '做梦梦到了你带它出去散步，醒来一直在门口等你', effect: '心情+5', moodDelta: 5, growthDelta: 0 },
    { type: 'sad', chance: 0.02, msg: '太久没出门了，趴在地板上叹气…', effect: '心情-8', moodDelta: -8, growthDelta: 0 }
  ];

  /**
   * 检查并触发随机事件（每次打开 App 时调用）
   * @returns {object|null} 事件对象或 null
   */
  function checkRandomEvent() {
    var pet = Storage.getPet();

    // 根据心情调整概率
    var moodModifier = pet.mood < 30 ? 0.3 : (pet.mood > 70 ? -0.1 : 0);

    // 随机决定是否触发事件（基础概率 40%）
    if (Math.random() > 0.4 + moodModifier) return null;

    // 随机选择一个事件
    var rand = Math.random();
    var cumulative = 0;
    var selected = null;
    for (var i = 0; i < RANDOM_EVENTS.length; i++) {
      cumulative += RANDOM_EVENTS[i].chance;
      if (rand <= cumulative) { selected = RANDOM_EVENTS[i]; break; }
    }
    if (!selected) selected = RANDOM_EVENTS[0];

    // 应用效果
    var data = Storage.getData();
    if (selected.moodDelta !== 0) {
      data.pet.mood = Math.max(0, Math.min(100, data.pet.mood + selected.moodDelta));
    }
    if (selected.growthDelta !== 0) {
      data.pet.growth += selected.growthDelta;
      // 检查升级
      while (data.pet.growth >= 100 && data.pet.level < 10) {
        data.pet.growth -= 100;
        data.pet.level++;
      }
      if (data.pet.level >= 10 && data.pet.growth > 100) {
        data.pet.growth = 100;
      }
    }
    Storage.saveData(data);

    // 记录事件
    var displayMsg = selected.msg.replace('你', '我'); // 微调视角
    Storage.addPetEvent({ type: selected.type, message: displayMsg, effect: selected.effect });

    return { message: displayMsg, effect: selected.effect, type: selected.type };
  }

  /**
   * 生成基于天气的气泡语（增强版）
   * @param {string} weatherSummary 天气摘要
   */
  function getWeatherAwareMessage(mood, weatherSummary) {
    var baseMsg = getEncourageMessage(mood);

    // 如果天气有特殊状况，替换为天气相关话语
    if (weatherSummary) {
      if (weatherSummary.indexOf('雨') !== -1) {
        var rainMessages = [
          '外面在下雨呢…不过雨天出去走走也很有情调哦~',
          '下雨天了怎么办？撑把伞去楼下便利店也不错！',
          '雨声真好听，但雨停了就出去走走吧~'
        ];
        return rainMessages[Math.floor(Math.random() * rainMessages.length)];
      }
      if (weatherSummary.indexOf('晴') !== -1 || weatherSummary.indexOf('阳光') !== -1) {
        var sunMessages = [
          '阳光正好！快点出门晒晒太阳吧！',
          '这么好的天气不出去太可惜了，我都想出去跑两圈！',
          '今天太阳公公笑得特别灿烂，它在等你出门呢~'
        ];
        return sunMessages[Math.floor(Math.random() * sunMessages.length)];
      }
      if (weatherSummary.indexOf('雪') !== -1) {
        return '下雪啦！出去踩雪一定很好玩，带上我嘛~';
      }
      if (weatherSummary.indexOf('风') !== -1 && weatherSummary.indexOf('微') === -1) {
        return '风有点大…不过穿暖和点出去走走也很舒服！';
      }
    }

    return baseMsg;
  }

  // ==================== 调试 ====================
  function debugSetMood(value) {
    Storage.updatePet({ mood: Math.max(0, Math.min(100, value)) });
    return getPetState();
  }

  // ==================== 对外暴露 ====================
  return {
    PET_TYPES,
    FEED_COST,
    PLAY_COST,
    STAGE_VISUALS,
    getPetState,
    getMoodEmoji,
    getMoodLabel,
    getMoodCssClass,
    getGrowthStage,
    getStageNumber,
    getEncourageMessage,
    choosePet,
    switchPetType,
    feedPet,
    playWithPet,
    getPetTypes,
    // 随机事件
    checkRandomEvent,
    getWeatherAwareMessage,
    // 调试
    debugSetMood
  };

})();
