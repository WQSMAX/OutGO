/* ============================================
   宅家激励 App — 地点搜索与评分模块
   负责：周边 POI 搜索、过滤排序、去重、本地降级引擎
   使用 OSM Overpass API（免费，无需 key）
   ============================================ */

const Places = (function () {
  'use strict';

  // POI 类别中文映射
  var CATEGORY_LABELS = {
    park: '🌳 公园绿地',
    cafe: '☕ 咖啡馆',
    restaurant: '🍽️ 餐厅',
    bookstore: '📚 书店',
    viewpoint: '🏞️ 观景点',
    museum: '🏛️ 博物馆',
    garden: '🌸 花园',
    square: '🏛️ 广场',
    market: '🛍️ 市场',
    bakery: '🥐 面包店',
    icecream: '🍦 甜品店',
    flowers: '💐 花店',
    art: '🎨 美术馆',
    library: '📖 图书馆',
    mall: '🏬 商场',
    stadium: '🏟️ 体育馆',
    other: '📍 其他'
  };

  // 类别 → 出行风格映射
  var STYLE_CATEGORIES = {
    quiet:    ['park', 'bookstore', 'library', 'museum', 'garden', 'art', 'flowers'],
    social:   ['cafe', 'restaurant', 'bar', 'market', 'mall', 'icecream'],
    active:   ['park', 'viewpoint', 'stadium', 'square', 'garden'],
    balanced: ['park', 'cafe', 'bookstore', 'viewpoint', 'restaurant', 'garden', 'museum']
  };

  // ==================== 主搜索函数 ====================

  /**
   * 搜索周边地点
   * @param {number} lat - 纬度
   * @param {number} lng - 经度
   * @param {object} options - 配置
   *   - radius: 搜索半径（米），默认 3000
   *   - categories: 指定类别，null 为根据 style 自动选择
   *   - style: 出行风格 "quiet"|"social"|"active"|"balanced"
   *   - excludeIds: 排除的 POI ID 列表（去重）
   *   - maxResults: 最大返回数，默认 15
   * @returns {Promise<object>} { ok, places, error }
   */
  async function searchNearby(lat, lng, options) {
    options = options || {};
    var radius = options.radius || 3000;
    var style = options.style || 'balanced';
    var excludeIds = options.excludeIds || [];
    var maxResults = options.maxResults || 15;

    // 确定搜索类别
    var categories;
    if (options.categories && options.categories.length > 0) {
      categories = options.categories;
    } else {
      categories = STYLE_CATEGORIES[style] || STYLE_CATEGORIES.balanced;
    }

    // 搜索两轮：公园类 + 消费类，合并结果
    var natureCats = categories.filter(function (c) {
      return ['park', 'viewpoint', 'garden', 'square'].indexOf(c) !== -1;
    });
    var venueCats = categories.filter(function (c) {
      return ['cafe', 'restaurant', 'bookstore', 'museum', 'market', 'bakery', 'icecream', 'art', 'library', 'mall', 'bar', 'flowers', 'stadium'].indexOf(c) !== -1;
    });

    var allPlaces = [];

    // 并行搜索
    var promises = [];
    if (natureCats.length > 0) {
      promises.push(API.searchNearby(lat, lng, radius, natureCats));
    }
    if (venueCats.length > 0) {
      promises.push(API.searchNearby(lat, lng, Math.round(radius * 0.6), venueCats));
    }

    var results = await Promise.all(promises);

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r && r.ok && r.places && r.places.length) {
        allPlaces.push.apply(allPlaces, r.places);
      }
    }

    if (allPlaces.length === 0) {
      return { ok: true, places: [], error: '周边未找到合适的去处' };
    }

    // 去重（按 ID 和名称相似度）
    allPlaces = dedupPlaces(allPlaces, excludeIds);

    // 按分类优先级排序：把用户偏好类别放前面
    var prefCats = categories;
    allPlaces.sort(function (a, b) {
      var aIdx = prefCats.indexOf(a.category);
      var bIdx = prefCats.indexOf(b.category);
      if (aIdx === -1) aIdx = 999;
      if (bIdx === -1) bIdx = 999;
      return aIdx - bIdx;
    });

    // 截断
    allPlaces = allPlaces.slice(0, maxResults);

    // 计算距离并附加类别标签
    for (var j = 0; j < allPlaces.length; j++) {
      allPlaces[j].distance = Math.round(API.haversineDistance(lat, lng, allPlaces[j].lat, allPlaces[j].lng));
      allPlaces[j].categoryLabel = CATEGORY_LABELS[allPlaces[j].category] || CATEGORY_LABELS.other;
      allPlaces[j].walkingMinutes = Math.max(1, Math.round(allPlaces[j].distance / 80)); // 步行 80m/min
    }

    return { ok: true, places: allPlaces, error: null };
  }

  // ==================== 本地规则引擎（无 LLM 降级） ====================

  /**
   * 使用本地规则引擎生成简单路线（无需 LLM）
   * 贪心算法：最近优先，聚类成路线
   * @param {Array} places - 地点列表（已排序过滤）
   * @param {object} options - { maxStops, maxMinutes, lat, lng }
   * @returns {object} 路线对象
   */
  function buildLocalRoute(places, options) {
    options = options || {};
    var maxStops = options.maxStops || 3;
    var maxMinutes = options.maxMinutes || 60;
    var homeLat = options.lat || 0;
    var homeLng = options.lng || 0;

    if (!places || places.length === 0) {
      return null;
    }

    // 贪心选取：从最近的开始，逐站添加
    var stops = [];
    var totalTime = 0;
    var usedIds = [];

    for (var i = 0; i < places.length && stops.length < maxStops; i++) {
      var place = places[i];
      if (usedIds.indexOf(place.id) !== -1) continue;

      // 计算从上一站到这里的步行时间
      var fromLat = stops.length === 0 ? homeLat : stops[stops.length - 1].lat;
      var fromLng = stops.length === 0 ? homeLng : stops[stops.length - 1].lng;
      var walkTo = Math.round(API.haversineDistance(fromLat, fromLng, place.lat, place.lng));
      var walkMins = Math.max(1, Math.round(walkTo / 80));

      // 估算本站停留时间
      var stayMins = estimateStayTime(place.category);

      // 估算回到家的时间
      var walkHome = Math.round(API.haversineDistance(place.lat, place.lng, homeLat, homeLng));
      var walkHomeMins = Math.max(1, Math.round(walkHome / 80));

      // 总时间检查
      var newTotal = totalTime + walkMins + stayMins;
      if (stops.length === 0) newTotal += walkHomeMins; // 回家的时间
      if (newTotal > maxMinutes) {
        // 看能不能加一个短停留的站
        if (stops.length > 0 && newTotal - stayMins + 15 > maxMinutes) continue;
      }

      stops.push({
        order: stops.length + 1,
        name: place.name,
        category: place.category,
        categoryLabel: place.categoryLabel,
        rating: place.rating,
        reviewSummary: place.description || '',
        aiReason: '根据你的偏好和距离为你推荐这里',
        walkingFromPrev: stops.length === 0 ? '从家出发' : ('步行约 ' + walkMins + ' 分钟'),
        suggestedDuration: stayMins + ' 分钟',
        lat: place.lat,
        lng: place.lng,
        distance: place.distance,
        walkingMinutesFromPrev: walkMins
      });

      totalTime += walkMins + stayMins;
      usedIds.push(place.id);
    }

    if (stops.length === 0) return null;

    // 回家
    var lastStop = stops[stops.length - 1];
    var walkHome = Math.round(API.haversineDistance(lastStop.lat, lastStop.lng, homeLat, homeLng));
    var walkHomeMins = Math.max(1, Math.round(walkHome / 80));
    totalTime += walkHomeMins;

    // 总距离
    var totalDist = 0;
    var prevPt = { lat: homeLat, lng: homeLng };
    for (var k = 0; k < stops.length; k++) {
      totalDist += API.haversineDistance(prevPt.lat, prevPt.lng, stops[k].lat, stops[k].lng);
      prevPt = stops[k];
    }
    totalDist += API.haversineDistance(prevPt.lat, prevPt.lng, homeLat, homeLng);

    return {
      generatedAt: new Date().toISOString(),
      isAI: false,
      weatherNote: '暂未获取天气',
      totalMinutes: totalTime,
      totalDistance: formatDistance(totalDist),
      motivation: '出去走走吧，附近的风景在等你 ☀️',
      stops: stops,
      petReaction: ''
    };
  }

  // ==================== 辅助函数 ====================

  /**
   * 去重：按 ID 和名称相似度
   */
  function dedupPlaces(places, excludeIds) {
    excludeIds = excludeIds || [];
    var seen = {};
    var result = [];

    for (var i = 0; i < places.length; i++) {
      var p = places[i];

      // 排除已访问过的
      if (excludeIds.indexOf(p.id) !== -1) continue;

      // 按 ID 去重
      if (seen[p.id]) continue;
      seen[p.id] = true;

      // 按名称去重（简单版：完全相同则去重）
      var nameLower = p.name.toLowerCase();
      var duplicate = false;
      for (var j = 0; j < result.length; j++) {
        if (result[j].name.toLowerCase() === nameLower) {
          duplicate = true;
          break;
        }
      }
      if (duplicate) continue;

      result.push(p);
    }

    return result;
  }

  /**
   * 估算在某类地点的停留时间（分钟）
   */
  function estimateStayTime(category) {
    switch (category) {
      case 'park':       return 25;
      case 'garden':     return 20;
      case 'cafe':       return 25;
      case 'restaurant': return 40;
      case 'bookstore':  return 25;
      case 'museum':     return 45;
      case 'viewpoint':  return 15;
      case 'market':     return 25;
      case 'bakery':     return 15;
      case 'icecream':   return 15;
      case 'flowers':    return 15;
      case 'art':        return 30;
      case 'library':    return 30;
      case 'mall':       return 40;
      case 'square':     return 15;
      case 'stadium':    return 30;
      default:           return 20;
    }
  }

  /**
   * 格式化距离
   */
  function formatDistance(meters) {
    if (meters < 1000) return '约 ' + meters + ' 米';
    return '约 ' + (meters / 1000).toFixed(1) + ' 公里';
  }

  /**
   * 格式化步行时间
   */
  function formatWalkingTime(minutes) {
    if (minutes < 60) return '约 ' + minutes + ' 分钟';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    if (m === 0) return '约 ' + h + ' 小时';
    return '约 ' + h + ' 小时 ' + m + ' 分钟';
  }

  // ==================== 对外暴露 ====================
  return {
    searchNearby,
    buildLocalRoute,
    CATEGORY_LABELS,
    STYLE_CATEGORIES,
    estimateStayTime,
    formatDistance,
    formatWalkingTime
  };

})();
