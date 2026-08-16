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
  const PLAY_MOOD_BOOST = 15;

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
   * 获取宠物完整状态
   */
  function getPetState() {
    const pet = Storage.getPet();
    const stageNum = getStageNumber(pet.level);
    return {
      ...pet,
      moodEmoji: getMoodEmoji(pet.mood),
      moodLabel: getMoodLabel(pet.mood),
      moodCssClass: getMoodCssClass(pet.mood),
      growthStage: getGrowthStage(pet.level),
      size: getPetSize(pet.level),
      encourageMessage: getEncourageMessage(pet.mood),
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

    // 检查是否已满
    if (pet.mood >= 100) {
      return {
        success: false,
        message: pet.name + '玩累了，让它休息一会儿吧~'
      };
    }

    // 消耗积分，提升心情
    user.points -= PLAY_COST;
    pet.mood = Math.min(100, pet.mood + PLAY_MOOD_BOOST);
    pet.lastPlayed = new Date().toISOString();

    Storage.saveData(data);

    return {
      success: true,
      mood: pet.mood,
      cost: PLAY_COST,
      message: '🎾 玩耍成功！' + pet.name + '的心情提升了 ' + PLAY_MOOD_BOOST + ' 点！'
    };
  }

  /**
   * 获取宠物类型列表（用于选择器）
   */
  function getPetTypes() {
    return Object.values(PET_TYPES);
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
    // 调试
    debugSetMood
  };

})();
