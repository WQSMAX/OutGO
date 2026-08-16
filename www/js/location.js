/* ============================================
   宅家激励 App — 定位模块
   负责：GPS 定位（浏览器/ Capacitor）、手动输入、坐标缓存
   隐私：所有位置数据仅存储在本机 localStorage
   ============================================ */

const Location = (function () {
  'use strict';

  var cachedPosition = null;
  var cachedCity = null;
  var cachedAt = null;
  var CACHE_TTL = 30 * 60 * 1000; // 30 分钟坐标缓存（常量）

  // ==================== GPS 定位 ====================

  /**
   * 获取当前位置
   * 优先级：1. 缓存坐标 → 2. 浏览器 Geolocation → 3. Capacitor Geolocation → 4. 手动城市
   * @returns {Promise<object>} { ok, lat, lng, city, source, error }
   */
  async function getPosition() {
    // 1. 先检查缓存
    if (cachedPosition && cachedAt && (Date.now() - cachedAt < CACHE_TTL)) {
      console.log('[Location] 使用缓存坐标');
      return {
        ok: true,
        lat: cachedPosition.lat,
        lng: cachedPosition.lng,
        city: cachedCity,
        source: 'cache',
        error: null
      };
    }

    // 2. 尝试浏览器 Geolocation API
    console.log('[Location] 尝试浏览器 GPS…');
    var browserResult = await getBrowserPosition();
    if (browserResult.ok) {
      cachedPosition = { lat: browserResult.lat, lng: browserResult.lng };
      cachedAt = Date.now();
      // 反向地理编码获取城市名
      var revResult = await API.reverseGeocode(browserResult.lat, browserResult.lng);
      if (revResult.ok && revResult.city) {
        cachedCity = revResult.city + (revResult.district ? ' ' + revResult.district : '');
      }
      return {
        ok: true,
        lat: browserResult.lat,
        lng: browserResult.lng,
        city: cachedCity || '',
        source: 'gps',
        error: null
      };
    }

    // 3. 尝试 Capacitor Geolocation（如果可用）
    var capacitorResult = await getCapacitorPosition();
    if (capacitorResult.ok) {
      cachedPosition = { lat: capacitorResult.lat, lng: capacitorResult.lng };
      cachedAt = Date.now();
      var revResult2 = await API.reverseGeocode(capacitorResult.lat, capacitorResult.lng);
      if (revResult2.ok && revResult2.city) {
        cachedCity = revResult2.city + (revResult2.district ? ' ' + revResult2.district : '');
      }
      return {
        ok: true,
        lat: capacitorResult.lat,
        lng: capacitorResult.lng,
        city: cachedCity || '',
        source: 'gps',
        error: null
      };
    }

    // 4. 无缓存但可能有手动城市
    var profile = Storage.getProfile();
    if (profile.city) {
      return { ok: false, lat: null, lng: null, city: profile.city, source: 'manual', error: 'GPS 不可用，请使用手动城市' };
    }

    return { ok: false, lat: null, lng: null, city: null, source: 'none', error: '无法获取位置，请开启 GPS 或手动输入城市' };
  }

  /**
   * 浏览器 Geolocation API
   */
  function getBrowserPosition() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) {
        resolve({ ok: false, lat: null, lng: null, error: '浏览器不支持 GPS' });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (position) {
          resolve({
            ok: true,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            error: null
          });
        },
        function (err) {
          var msg;
          switch (err.code) {
            case err.PERMISSION_DENIED: msg = '用户拒绝 GPS 权限'; break;
            case err.POSITION_UNAVAILABLE: msg = 'GPS 信号不可用'; break;
            case err.TIMEOUT: msg = 'GPS 定位超时'; break;
            default: msg = 'GPS 定位失败';
          }
          resolve({ ok: false, lat: null, lng: null, error: msg });
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  /**
   * Capacitor Geolocation 插件（APK 环境）
   */
  async function getCapacitorPosition() {
    try {
      // 动态检测 Capacitor 是否可用
      if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Geolocation) {
        var position = await Capacitor.Plugins.Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000
        });
        if (position && position.coords) {
          return {
            ok: true,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            error: null
          };
        }
      }
    } catch (e) {
      console.log('[Location] Capacitor GPS 不可用:', e.message);
    }
    return { ok: false, lat: null, lng: null, error: 'Capacitor GPS 不可用' };
  }

  // ==================== 手动设置位置 ====================

  /**
   * 手动设置城市（通过地理编码获取坐标）
   * @param {string} city - 城市名
   * @returns {Promise<object>} { ok, lat, lng, city, error }
   */
  async function setManualCity(city) {
    if (!city || city.trim().length < 2) {
      return { ok: false, lat: null, lng: null, city: null, error: '请输入有效城市名' };
    }

    var result = await API.geocode(city.trim());

    if (!result.ok) {
      return { ok: false, lat: null, lng: null, city: null, error: result.error || '未找到该城市' };
    }

    cachedPosition = { lat: result.lat, lng: result.lng };
    cachedCity = result.name + (result.country ? ', ' + result.country : '');
    cachedAt = Date.now();

    // 同步写入用户画像
    var profile = Storage.getProfile();
    profile.city = cachedCity;
    profile.latitude = result.lat;
    profile.longitude = result.lng;
    Storage.saveProfile(profile);

    return {
      ok: true,
      lat: result.lat,
      lng: result.lng,
      city: cachedCity,
      source: 'manual',
      error: null
    };
  }

  // ==================== 权限状态 ====================

  /**
   * 检查 GPS 权限状态
   * @returns {Promise<string>} "granted" | "denied" | "prompt" | "unavailable"
   */
  async function checkPermission() {
    if (!navigator.permissions) {
      return 'unavailable';
    }
    try {
      var result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state; // "granted" | "denied" | "prompt"
    } catch (e) {
      return 'unavailable';
    }
  }

  /**
   * 获取位置摘要文本（用于 UI 显示）
   * @returns {Promise<string>}
   */
  async function getLocationLabel() {
    var pos = await getPosition();
    if (pos.ok && pos.city) {
      return '📍 ' + pos.city + ' (GPS)';
    }
    var profile = Storage.getProfile();
    if (profile.city) {
      return '📍 ' + profile.city + ' (手动)';
    }
    return '📍 未设置位置';
  }

  // ==================== 缓存管理 ====================

  function clearCache() {
    cachedPosition = null;
    cachedCity = null;
    cachedAt = null;
  }

  function getCachedCity() {
    return cachedCity;
  }

  // ==================== 对外暴露 ====================
  return {
    getPosition,
    setManualCity,
    checkPermission,
    getLocationLabel,
    clearCache,
    getCachedCity
  };

})();
