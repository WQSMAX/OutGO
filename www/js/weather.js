/* ============================================
   宅家激励 App — 天气模块
   负责：天气数据获取、缓存、摘要生成
   使用 Open-Meteo 免费 API（无需 key）
   ============================================ */

const Weather = (function () {
  'use strict';

  var cachedWeather = null;
  var cachedAt = null;
  var CACHE_TTL = 30 * 60 * 1000; // 30 分钟缓存

  // ==================== 天气代码 → 中文描述 ====================
  var WEATHER_CODES = {
    0:  { text: '晴天', emoji: '☀️', icon: 'sunny' },
    1:  { text: '大部晴朗', emoji: '🌤️', icon: 'sunny' },
    2:  { text: '多云', emoji: '⛅', icon: 'cloudy' },
    3:  { text: '阴天', emoji: '☁️', icon: 'overcast' },
    45: { text: '雾', emoji: '🌫️', icon: 'fog' },
    48: { text: '霜雾', emoji: '🌫️', icon: 'fog' },
    51: { text: '小毛毛雨', emoji: '🌦️', icon: 'drizzle' },
    53: { text: '毛毛雨', emoji: '🌦️', icon: 'drizzle' },
    55: { text: '大毛毛雨', emoji: '🌧️', icon: 'drizzle' },
    61: { text: '小雨', emoji: '🌦️', icon: 'rain' },
    63: { text: '中雨', emoji: '🌧️', icon: 'rain' },
    65: { text: '大雨', emoji: '🌧️', icon: 'rain' },
    71: { text: '小雪', emoji: '🌨️', icon: 'snow' },
    73: { text: '中雪', emoji: '🌨️', icon: 'snow' },
    75: { text: '大雪', emoji: '❄️', icon: 'snow' },
    77: { text: '雨夹雪', emoji: '🌨️', icon: 'snow' },
    80: { text: '阵雨', emoji: '🌦️', icon: 'rain' },
    81: { text: '大阵雨', emoji: '🌧️', icon: 'rain' },
    82: { text: '暴阵雨', emoji: '⛈️', icon: 'storm' },
    95: { text: '雷暴', emoji: '⛈️', icon: 'storm' },
    96: { text: '冰雹雷暴', emoji: '⛈️', icon: 'storm' },
    99: { text: '大冰雹雷暴', emoji: '⛈️', icon: 'storm' }
  };

  // ==================== 核心功能 ====================

  /**
   * 获取天气（带缓存）
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @returns {Promise<object>} { ok, weather, summary, fromCache, error }
   */
  async function getWeather(lat, lng) {
    // 检查缓存
    if (cachedWeather && cachedAt && (Date.now() - cachedAt < CACHE_TTL)) {
      console.log('[Weather] 使用缓存天气数据');
      return {
        ok: true,
        weather: cachedWeather,
        summary: buildSummary(cachedWeather),
        fromCache: true,
        error: null
      };
    }

    console.log('[Weather] 获取实时天气…');
    var result = await API.fetchWeather(lat, lng);

    if (!result.ok) {
      console.warn('[Weather] 获取失败:', result.error);
      // 如果有旧缓存，过期也先用着
      if (cachedWeather) {
        return {
          ok: true,
          weather: cachedWeather,
          summary: buildSummary(cachedWeather),
          fromCache: true,
          error: result.error
        };
      }
      return {
        ok: false,
        weather: null,
        summary: '天气数据不可用',
        fromCache: false,
        error: result.error
      };
    }

    cachedWeather = result.data;
    cachedAt = Date.now();
    console.log('[Weather] 天气已更新:', buildSummary(cachedWeather));

    return {
      ok: true,
      weather: result.data,
      summary: buildSummary(result.data),
      fromCache: false,
      error: null
    };
  }

  /**
   * 构建天气摘要文本
   * @param {object} weather
   * @returns {string} 例如 "☀️ 晴 24°C · 微风 · 宜出行"
   */
  function buildSummary(weather) {
    var code = weather.weatherCode;
    var wInfo = WEATHER_CODES[code] || { text: '未知', emoji: '🌡️' };
    var temp = Math.round(weather.temperature);

    var windDesc = '微风';
    var windSpeed = weather.windSpeed || 0;
    if (windSpeed > 30) windDesc = '大风';
    else if (windSpeed > 15) windDesc = '和风';

    var suggestion = getSuggestion(code, temp, windSpeed);

    return wInfo.emoji + ' ' + wInfo.text + ' ' + temp + '°C · ' + windDesc + ' · ' + suggestion;
  }

  /**
   * 根据天气给出出行建议关键词
   */
  function getSuggestion(code, temp, windSpeed) {
    // 极端天气优先
    if (code >= 95 && code <= 99) return '不建议远行 ⚠️';
    // 温度与天气综合考虑
    if (temp > 35 && (code === 0 || code === 1)) return '注意防暑 🧊';
    if (temp < 5 && (code >= 71 && code <= 77)) return '注意保暖 🧣 路滑小心';
    if (temp < 5) return '做好保暖 🧤';
    if (temp > 35) return '注意防暑 🧊';
    // 天气状况
    if (code >= 80 && code <= 82) return '不建议远行 ⚠️';
    if (code >= 51 && code <= 65) return '带伞出行 🌂';
    if (code >= 71 && code <= 77) return '注意保暖 🧣';
    if (windSpeed > 30) return '风大注意 ⚠️';
    if (code === 0 || code === 1) return '宜出行 ☑️';
    if (code === 2 || code === 3) return '可出行';
    return '宜出行 ☑️';
  }

  /**
   * 获取天气代码信息
   * @param {number} code
   * @returns {object} { text, emoji, icon }
   */
  function getWeatherCodeInfo(code) {
    return WEATHER_CODES[code] || { text: '未知天气', emoji: '🌡️', icon: 'unknown' };
  }

  // ==================== 调试 ====================

  function clearCache() {
    cachedWeather = null;
    cachedAt = null;
  }

  // ==================== 对外暴露 ====================
  return {
    getWeather,
    buildSummary,
    getWeatherCodeInfo,
    getSuggestion,
    clearCache
  };

})();
