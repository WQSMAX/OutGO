/* ============================================
   宅家激励 App — HTTP API 客户端
   负责：LLM 调用、天气获取、地图 POI 搜索、地理编码
   统一超时、重试、错误处理
   ============================================ */

const API = (function () {
  'use strict';

  const DEFAULT_TIMEOUT = 8000;  // LLM 超时 8s
  const MAP_TIMEOUT = 5000;      // 地图 API 超时 5s

  // ==================== 通用 HTTP 请求 ====================

  /**
   * 发起 HTTP 请求（支持超时）
   * @param {string} url
   * @param {object} options - fetch options
   * @param {number} timeout - 超时毫秒数
   * @returns {Promise<object>} { ok, data, status, error }
   */
  async function request(url, options = {}, timeout = DEFAULT_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);

      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        ok: response.ok,
        status: response.status,
        data: data,
        error: response.ok ? null : ('HTTP ' + response.status + ': ' + response.statusText)
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { ok: false, status: 0, data: null, error: '请求超时' };
      }
      return { ok: false, status: 0, data: null, error: err.message || '网络错误' };
    }
  }

  // ==================== LLM API 调用 ====================

  /**
   * 调用 OpenAI 兼容的 LLM API
   */
  async function callLLM(systemPrompt, userPrompt, config) {
    const endpoint = (config.endpoint || '').replace(/\/+$/, '');
    const url = endpoint + '/v1/chat/completions';

    const body = {
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: config.maxTokens || 500,
      temperature: config.temperature || 0.8
    };

    const result = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (config.apiKey || '')
      },
      body: JSON.stringify(body)
    }, DEFAULT_TIMEOUT);

    if (!result.ok) {
      return { ok: false, content: null, error: result.error || 'LLM API 调用失败' };
    }

    try {
      var choices = result.data.choices || [];
      if (choices.length === 0) {
        return { ok: false, content: null, error: 'LLM 返回空结果' };
      }
      var content = choices[0].message.content;
      return { ok: true, content: content, error: null };
    } catch (e) {
      return { ok: false, content: null, error: 'LLM 响应格式异常' };
    }
  }

  // ==================== DeepSeek 免费 AI 对话 ====================

  // DeepSeek 提供免费 API 额度，注册即送：https://platform.deepseek.com
  // API 兼容 OpenAI 格式，直接复用 callLLM

  /**
   * 使用 DeepSeek 免费 API 调用（需用户在 platform.deepseek.com 获取免费 Key）
   * DeepSeek 新用户注册即送 500 万 tokens 免费额度
   */
  async function callFreeAI(prompt) {
    // 使用 DeepSeek 默认配置
    var config = {
      endpoint: 'https://api.deepseek.com/v1',
      apiKey: '',  // 需要用户配置
      model: 'deepseek-chat',
      maxTokens: 800,
      temperature: 0.8
    };

    // 尝试从 Storage 获取已配置的 API Key
    try {
      var aiConfig = Storage.getAIConfig();
      if (aiConfig && aiConfig.apiKey) {
        config.apiKey = aiConfig.apiKey;
      }
      if (aiConfig && aiConfig.endpoint) {
        config.endpoint = aiConfig.endpoint;
      }
    } catch (e) {}

    // 如果没有 API Key，无法调用 API
    if (!config.apiKey) {
      return {
        ok: false, content: null,
        error: '请先获取 DeepSeek 免费 API Key（platform.deepseek.com → API Keys → 创建）',
        errorType: 'no_key'
      };
    }

    console.log('[DeepSeek] 调用 API…');
    return await callLLM('', prompt, config);
  }

  /**
   * 打开 DeepSeek 免费网页对话（无需 API Key，在浏览器中直接使用）
   * @param {string} prefillText - 预填的提示文本
   */
  function openDeepSeekWebChat(prefillText) {
    // 将上下文复制到剪贴板
    if (prefillText) {
      try {
        // 使用 Clipboard API
        if (navigator.clipboard) {
          navigator.clipboard.writeText(prefillText).then(function () {
            console.log('[DeepSeek] 上下文已复制到剪贴板');
          });
        }
      } catch (e) {}
    }

    // 打开 DeepSeek 网页对话
    var url = 'https://chat.deepseek.com/';
    window.open(url, '_blank');

    return prefillText ? '上下文已复制，在 DeepSeek 中粘贴即可' : '已打开 DeepSeek 对话';
  }

  function resetFreeAIRetry() {
    // DeepSeek API 使用标准 HTTP，无需特殊重试逻辑
  }

  // ==================== 天气 API (Open-Meteo 免费) ====================

  /**
   * 获取实时天气
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @returns {Promise<object>} { ok, data, error }
   */
  async function fetchWeather(lat, lng) {
    const url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + lat +
      '&longitude=' + lng +
      '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
      '&daily=sunshine_duration' +
      '&timezone=auto' +
      '&forecast_days=1';

    const result = await request(url, {}, MAP_TIMEOUT);

    if (!result.ok) {
      return { ok: false, data: null, error: result.error || '天气 API 请求失败' };
    }

    try {
      const current = result.data.current;
      const daily = result.data.daily;
      return {
        ok: true,
        data: {
          temperature: current.temperature_2m,
          humidity: current.relative_humidity_2m,
          weatherCode: current.weather_code,
          windSpeed: current.wind_speed_10m,
          sunshineDuration: daily ? (daily.sunshine_duration[0] || 0) : 0
        },
        error: null
      };
    } catch (e) {
      return { ok: false, data: null, error: '天气数据解析失败' };
    }
  }

  // ==================== 地理编码 (Open-Meteo Geocoding) ====================

  /**
   * 城市名 → 坐标
   * @param {string} city - 城市名
   * @returns {Promise<object>} { ok, lat, lng, name, country, error }
   */
  async function geocode(city) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search' +
      '?name=' + encodeURIComponent(city) +
      '&count=5' +
      '&language=zh';

    const result = await request(url, {}, MAP_TIMEOUT);

    if (!result.ok) {
      return { ok: false, lat: null, lng: null, error: result.error || '地理编码请求失败' };
    }

    try {
      const results = result.data.results || [];
      if (results.length === 0) {
        return { ok: false, lat: null, lng: null, error: '未找到该城市' };
      }
      const top = results[0];
      return {
        ok: true,
        lat: top.latitude,
        lng: top.longitude,
        name: top.name,
        country: top.country || '',
        error: null
      };
    } catch (e) {
      return { ok: false, lat: null, lng: null, error: '地理编码解析失败' };
    }
  }

  /**
   * 坐标 → 城市名（反向地理编码）
   * 使用 OSM Nominatim
   */
  async function reverseGeocode(lat, lng) {
    const url = 'https://nominatim.openstreetmap.org/reverse' +
      '?lat=' + lat +
      '&lon=' + lng +
      '&format=json' +
      '&accept-language=zh';

    const result = await request(url, {
      headers: { 'User-Agent': 'OutGO-App/1.0' }
    }, MAP_TIMEOUT);

    if (!result.ok || !result.data) {
      return { ok: false, city: null, district: null, error: '反向地理编码失败' };
    }

    try {
      const addr = result.data.address || {};
      const city = addr.city || addr.town || addr.county || addr.state || '';
      const district = addr.suburb || addr.district || addr.city_district || '';
      return { ok: true, city: city, district: district, fullAddress: result.data.display_name || '', error: null };
    } catch (e) {
      return { ok: false, city: null, district: null, error: '反向地理编码解析失败' };
    }
  }

  // ==================== 地图 POI 搜索 (OSM Overpass) ====================

  /**
   * 搜索周边 POI
   * 使用 OSM Overpass API
   * @param {number} lat - 中心纬度
   * @param {number} lng - 中心经度
   * @param {number} radiusMeters - 搜索半径（米）
   * @param {Array<string>} categories - 类别列表
   * @returns {Promise<object>} { ok, places, error }
   */
  async function searchNearby(lat, lng, radiusMeters, categories) {
    if (!categories || categories.length === 0) {
      categories = ['park', 'cafe', 'restaurant', 'viewpoint', 'bookstore'];
    }

    // 构建 Overpass 查询
    // 搜索节点和路径的兴趣点
    const tags = categories.map(function (cat) {
      switch (cat) {
        case 'park':       return '["leisure"="park"]';
        case 'cafe':       return '["amenity"="cafe"]';
        case 'restaurant': return '["amenity"="restaurant"]';
        case 'bar':        return '["amenity"="bar"]';
        case 'bookstore':  return '["shop"="books"]';
        case 'viewpoint':  return '["tourism"="viewpoint"]';
        case 'museum':     return '["tourism"="museum"]';
        case 'garden':     return '["leisure"="garden"]';
        case 'square':     return '["place"="square"]';
        case 'market':     return '["amenity"="marketplace"]';
        case 'bakery':     return '["shop"="bakery"]';
        case 'icecream':   return '["amenity"="ice_cream"]';
        case 'flowers':    return '["shop"="florist"]';
        case 'art':        return '["tourism"="gallery"]';
        case 'library':    return '["amenity"="library"]';
        case 'mall':       return '["shop"="mall"]';
        case 'stadium':    return '["leisure"="stadium"]';
        default:           return '["name"~"' + cat + '",i]';
      }
    }).join('');

    const query =
      '[out:json][timeout:10];' +
      '(' +
      '  node' + tags + '(around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
      '  way' + tags + '(around:' + radiusMeters + ',' + lat + ',' + lng + ');' +
      ');' +
      'out center 30;';

    const url = 'https://overpass-api.de/api/interpreter';
    const result = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query)
    }, MAP_TIMEOUT);

    if (!result.ok) {
      return { ok: false, places: [], error: result.error || 'POI 搜索失败' };
    }

    try {
      const elements = result.data.elements || [];
      const places = elements.map(function (el) {
        const tags = el.tags || {};
        return {
          id: el.id,
          name: tags.name || tags['name:zh'] || '未命名地点',
          category: getCategoryFromTags(tags, categories),
          lat: el.lat || (el.center ? el.center.lat : lat),
          lng: el.lon || (el.center ? el.center.lon : lng),
          // OSM 标签映射
          openingHours: tags.opening_hours || null,
          phone: tags.phone || null,
          website: tags.website || null,
          // 评分 OSM 没有，但可以用其他信息替代
          rating: tags.stars ? parseFloat(tags.stars) : null,
          description: tags.description || tags['description:zh'] || null
        };
      });

      return { ok: true, places: places, error: null };
    } catch (e) {
      return { ok: false, places: [], error: 'POI 数据解析失败' };
    }
  }

  /**
   * 根据 OSM 标签推断 POI 类别
   */
  function getCategoryFromTags(tags, preferredCategories) {
    if (tags.leisure === 'park' || tags.leisure === 'garden') return 'park';
    if (tags.amenity === 'cafe') return 'cafe';
    if (tags.amenity === 'restaurant') return 'restaurant';
    if (tags.shop === 'books') return 'bookstore';
    if (tags.tourism === 'viewpoint') return 'viewpoint';
    if (tags.tourism === 'museum') return 'museum';
    if (tags.amenity === 'marketplace') return 'market';
    if (tags.shop === 'bakery') return 'bakery';
    if (tags.amenity === 'ice_cream') return 'icecream';
    if (tags.shop === 'florist') return 'flowers';
    if (tags.tourism === 'gallery') return 'art';
    if (tags.amenity === 'library') return 'library';
    if (tags.shop === 'mall') return 'mall';
    if (tags.leisure === 'stadium') return 'stadium';
    if (tags.place === 'square') return 'square';
    // 尝试匹配首选类别
    if (tags.name && preferredCategories) {
      for (var i = 0; i < preferredCategories.length; i++) {
        if (tags.name.indexOf(preferredCategories[i]) !== -1) return preferredCategories[i];
      }
    }
    return 'other';
  }

  /**
   * 计算两点之间的距离（Haversine 公式）
   * @returns {number} 距离（米）
   */
  function haversineDistance(lat1, lng1, lat2, lng2) {
    var R = 6371000; // 地球半径（米）
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ==================== 对外暴露 ====================
  return {
    request,
    callLLM,
    callFreeAI,
    openDeepSeekWebChat,
    resetFreeAIRetry,
    fetchWeather,
    geocode,
    reverseGeocode,
    searchNearby,
    haversineDistance
  };

})();
