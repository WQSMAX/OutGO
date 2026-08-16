/* ============================================
   宅家激励 App — AI 推荐引擎
   负责：聚合天气+位置+POI+画像 → LLM prompt → 路线生成
   支持完整降级链：LLM → 本地规则 → 预设任务
   ============================================ */

const AIEngine = (function () {
  'use strict';

  // ==================== System Prompt ====================

  var SYSTEM_PROMPT = [
    '你是一个温暖贴心的"出行规划师"，专门为喜欢宅在家里的中国用户设计轻松的户外散心路线。',
    '',
    '你的任务是根据实时天气、用户位置、周边地点、用户偏好和宠物状态，规划一条 2-4 站的环形步行散心路线。',
    '',
    '要求：',
    '1. 路线起点和终点都在用户住所附近（环形路线）',
    '2. 每站之间有合理的步行距离（5-20 分钟）',
    '3. 结合天气给出具体的穿搭/时间建议（如"下午3点后阳光正好"）',
    '4. 每个推荐理由要具体、有画面感，不要套话',
    '5. 语气温暖鼓励，像关心你的朋友，偶尔可以幽默',
    '6. 总时长控制在用户偏好范围内',
    '7. 优先推荐评分高、有特色的地点',
    '8. 如果天气不好（雨/大风/高温），给出室内备选或调整建议',
    '',
    '输出必须严格 JSON 格式（不要 markdown 代码块包裹，直接输出 JSON）：',
    '{',
    '  "weatherNote": "天气总结+穿搭建议",',
    '  "totalMinutes": 45,',
    '  "totalDistance": "约2.3公里",',
    '  "motivation": "整体温暖鼓励语，50字以内",',
    '  "stops": [',
    '    {',
    '      "order": 1,',
    '      "name": "地点全名",',
    '      "category": "park|cafe|restaurant|bookstore|viewpoint|museum|garden|square|market|other",',
    '      "aiReason": "为什么推荐这一站（结合评分/特色/天气），30字以内",',
    '      "walkingFromPrev": "从家出发 或 步行约X分钟",',
    '      "suggestedDuration": "15-20分钟"',
    '    }',
    '  ],',
    '  "petReaction": "宠物看到这条路线的反应语，10字以内"',
    '}'
  ].join('\n');

  // ==================== 核心方法 ====================

  /**
   * 生成个性化散心路线
   * @param {object} context - 上下文
   *   - profile: 用户画像
   *   - pet: 宠物状态
   *   - weather: 天气数据 (可选)
   *   - places: 周边 POI 列表 (可选)
   *   - config: AI 配置
   * @returns {Promise<object>} { ok, route, source, error }
   *   source: "ai" | "local" | "preset" — 标记路线来源
   */
  async function generateRoute(context) {
    context = context || {};
    var config = context.config;
    var profile = context.profile;
    var pet = context.pet;
    var weatherSummary = context.weatherSummary || '天气数据不可用';
    var places = context.places || [];
    var lat = profile.latitude;
    var lng = profile.longitude;

    // 确定使用何种 AI
    var useAI = config && config.enabled;
    var hasOwnKey = config && config.apiKey;

    // 构造用户 prompt
    var userPrompt = buildUserPrompt(context);

    if (useAI && hasOwnKey) {
      // === 用户配置了 API Key → 直接调用 ===
      console.log('[AIEngine] 调用 DeepSeek/用户 API…');
      var result = await API.callLLM(SYSTEM_PROMPT, userPrompt, config);

      if (result.ok) {
        var route = parseLLMResponse(result.content);
        if (route) {
          route.generatedAt = new Date().toISOString();
          route.isAI = true;
          route.source = 'ai';
          return { ok: true, route: route, source: 'ai', error: null };
        }
        console.warn('[AIEngine] API 响应解析失败');
      } else {
        console.warn('[AIEngine] API 调用失败:', result.error);
      }
      // API 失败，降级到本地引擎
      return fallbackToLocal(context, result.error || 'API 调用失败');
    }

    if (useAI && !hasOwnKey) {
      // === AI 已启用但未配置 Key → 尝试使用 DeepSeek 免费 API ===
      console.log('[AIEngine] 尝试 DeepSeek 免费 API…');
      var fullPrompt = SYSTEM_PROMPT + '\n\n' + userPrompt;
      var freeResult = await API.callFreeAI(fullPrompt);

      if (freeResult.ok) {
        var freeRoute = parseLLMResponse(freeResult.content);
        if (freeRoute) {
          freeRoute.generatedAt = new Date().toISOString();
          freeRoute.isAI = true;
          freeRoute.source = 'ai';
          return { ok: true, route: freeRoute, source: 'ai', error: null };
        }
      }

      // DeepSeek 免费 API 不可用，返回明确错误让 UI 提示用户
      console.warn('[AIEngine] DeepSeek API 不可用:', freeResult.error);
      return fallbackToLocal(context, freeResult.error || 'DeepSeek API 不可用，请获取免费 Key');
    }

    // === 降级：本地规则引擎 ===
    console.log('[AIEngine] 使用本地规则引擎');

    if (places && places.length > 0 && lat && lng) {
      var localRoute = Places.buildLocalRoute(places, {
        maxStops: config ? (config.routeLength || 3) : 3,
        maxMinutes: profile.maxWalkingMinutes || 60,
        lat: lat,
        lng: lng
      });
      if (localRoute) {
        localRoute.weatherNote = weatherSummary;
        if (pet) {
          var petState = Pet.getPetState();
          localRoute.motivation = generateLocalMotivation(petState, weatherSummary);
          localRoute.petReaction = petState.encourageMessage;
        }
        return { ok: true, route: localRoute, source: 'local', error: null };
      }
    }

    // 最终回退
    return generatePresetTask(profile, pet, weatherSummary);
  }

  /**
   * 生成单个 AI 任务（兼容原任务系统）
   * @returns {Promise<object>} 任务对象 { id, title, difficulty, points, aiRecommended, aiReason }
   */
  async function generateTask(context) {
    var routeResult = await generateRoute(context);
    if (!routeResult.ok || !routeResult.route) {
      // 完全降级：返回 null 让预设系统接管
      return null;
    }

    var route = routeResult.route;
    return {
      id: 'ai_route_' + Date.now(),
      title: '🗺️ ' + route.stops[0].name + (route.stops.length > 1 ? ' 等 ' + route.stops.length + ' 站散心路线' : ''),
      difficulty: 'medium',
      points: 50 + route.stops.length * 10,
      aiRecommended: true,
      aiSource: routeResult.source,
      route: route
    };
  }

  // ==================== Prompt 构造 ====================

  function buildUserPrompt(context) {
    var profile = context.profile || {};
    var pet = context.pet || {};
    var places = context.places || [];

    var parts = [];

    // 时间
    parts.push('当前时间：' + new Date().toLocaleString('zh-CN'));

    // 天气
    parts.push('天气：' + (context.weatherSummary || '未知'));

    // 位置
    if (profile.city) {
      parts.push('位置：' + profile.city + '，坐标(' + profile.latitude + ', ' + profile.longitude + ')');
    } else {
      parts.push('位置：未设置');
    }

    // 用户偏好
    var interests = profile.interests && profile.interests.length > 0 ? profile.interests.join('、') : '不限';
    parts.push('用户兴趣：' + interests);
    parts.push('出行风格：' + (profile.activityStyle || 'balanced') + '（quiet=安静/独处 social=社交 active=运动 balanced=随心）');
    parts.push('最大步行时长：' + (profile.maxWalkingMinutes || 60) + ' 分钟');

    // 宠物
    if (pet && pet.type) {
      parts.push('宠物：' + (pet.name || '未命名') + '（Lv.' + (pet.level || 1) + '，心情 ' + (pet.mood || 80) + '/100）');
    }

    // 周边地点
    if (places.length > 0) {
      var placesStr = places.slice(0, 10).map(function (p, i) {
        return (i + 1) + '. [' + p.categoryLabel + '] ' + p.name + '（约' + p.walkingMinutes + '分钟步行）' + (p.rating ? ' ⭐' + p.rating : '');
      }).join('\n');
      parts.push('周边地点（按距离排序）：\n' + placesStr);
    } else {
      parts.push('周边地点：暂无数据，请根据城市推荐常见去处');
    }

    // 路线站数
    var routeLength = context.config ? (context.config.routeLength || 3) : 3;
    parts.push('路线站数目标：' + routeLength + ' 站');

    // 历史去重
    if (profile.visitedPlaceIds && profile.visitedPlaceIds.length > 0) {
      parts.push('注意：请避免推荐用户近期已访问过的地点');
    }

    return parts.join('\n');
  }

  // ==================== 响应解析 ====================

  function parseLLMResponse(content) {
    if (!content) return null;

    // 尝试直接解析
    var json = tryParseJSON(content);
    if (json && json.stops && json.stops.length > 0) {
      return validateAndClean(json);
    }

    // 尝试从 markdown 代码块中提取
    var codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      json = tryParseJSON(codeMatch[1]);
      if (json && json.stops && json.stops.length > 0) {
        return validateAndClean(json);
      }
    }

    // 尝试从文本中提取 JSON 对象
    var bracketMatch = content.match(/\{[\s\S]*\}/);
    if (bracketMatch) {
      json = tryParseJSON(bracketMatch[0]);
      if (json && json.stops && json.stops.length > 0) {
        return validateAndClean(json);
      }
    }

    return null;
  }

  function tryParseJSON(str) {
    try {
      return JSON.parse(str.trim());
    } catch (e) {
      return null;
    }
  }

  /**
   * 验证并清理路线数据
   */
  function validateAndClean(route) {
    // 确保必要字段存在
    if (!route.stops || !Array.isArray(route.stops)) return null;
    if (route.stops.length === 0) return null;

    route.weatherNote = route.weatherNote || '';
    route.motivation = route.motivation || '出门走走，一切都会更好的~';
    route.petReaction = route.petReaction || '';
    route.totalMinutes = route.totalMinutes || 45;
    route.totalDistance = route.totalDistance || '步行可达';

    // 验证每个站
    for (var i = 0; i < route.stops.length; i++) {
      var stop = route.stops[i];
      stop.order = stop.order || (i + 1);
      stop.name = stop.name || '未命名地点';
      stop.category = stop.category || 'other';
      stop.aiReason = stop.aiReason || '';
      stop.walkingFromPrev = stop.walkingFromPrev || (i === 0 ? '从家出发' : '步行可达');
      stop.suggestedDuration = stop.suggestedDuration || '15-20 分钟';
    }

    return route;
  }

  // ==================== 降级链 ====================

  /**
   * 降级到本地规则引擎
   */
  function fallbackToLocal(context, reason) {
    var profile = context.profile || {};
    var pet = context.pet || {};
    var places = context.places || [];
    var weatherSummary = context.weatherSummary || '';
    var config = context.config || {};

    if (places.length > 0 && profile.latitude && profile.longitude) {
      var localRoute = Places.buildLocalRoute(places, {
        maxStops: config.routeLength || 3,
        maxMinutes: profile.maxWalkingMinutes || 60,
        lat: profile.latitude,
        lng: profile.longitude
      });

      if (localRoute) {
        localRoute.weatherNote = weatherSummary;

        if (pet && pet.type) {
          var petState = Pet.getPetState();
          localRoute.motivation = generateLocalMotivation(petState, weatherSummary);
          localRoute.petReaction = petState.encourageMessage;
        }

        return {
          ok: true,
          route: localRoute,
          source: 'local',
          error: reason || 'AI 不可用，已使用本地推荐'
        };
      }
    }

    // 完全回退
    return generatePresetTask(profile, pet, weatherSummary);
  }

  /**
   * 降级到预设任务
   */
  function generatePresetTask(profile, pet, weatherSummary) {
    var task = Tasks.getRandomTask(null);
    if (!task) return { ok: false, route: null, source: 'preset', error: '无可用任务' };

    return {
      ok: true,
      route: {
        generatedAt: new Date().toISOString(),
        isAI: false,
        source: 'preset',
        weatherNote: weatherSummary || '天气数据不可用',
        totalMinutes: 30,
        totalDistance: '步行可达',
        motivation: '今天也要加油出门哦！完成一个简单任务就是胜利~',
        stops: [{
          order: 1,
          name: task.title,
          category: 'other',
          categoryLabel: '📍 任务',
          rating: null,
          aiReason: '来自任务库推荐',
          walkingFromPrev: '从家出发',
          suggestedDuration: '20-30 分钟',
          difficulty: task.difficulty,
          points: task.points
        }],
        petReaction: pet ? Pet.getPetState().encourageMessage : ''
      },
      source: 'preset',
      error: null
    };
  }

  /**
   * 生成本地激励语（非 AI）
   */
  function generateLocalMotivation(petState, weatherSummary) {
    var petMoodMsg = petState.mood < 40
      ? '你的' + petState.name + '心情不太好，带它出去散散心吧~'
      : '天气不错，带着' + petState.name + '一起出门享受阳光吧！';

    var messages = [
      petMoodMsg,
      '这条路线精选了附近的好去处，跟着走就行~',
      '每一步都是对自己的温柔对待 🌿'
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  // ==================== 对外暴露 ====================
  return {
    generateRoute,
    generateTask,
    parseLLMResponse,
    SYSTEM_PROMPT
  };

})();
