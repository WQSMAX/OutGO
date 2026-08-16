/* ============================================
   宅家激励 App — 敏感信息加密模块
   负责：API Key 等敏感数据的 AES-GCM 加密存储
   使用设备随机密钥（Web Crypto），对用户无感
   密钥单独存放，导出备份时不会带出密钥材料
   ============================================ */

const SecureStore = (function () {
  'use strict';

  // 设备密钥单独存放（与主数据 zhajiaji_data 分开，导出备份不包含）
  const DEVICE_KEY_STORAGE = 'zhajiaji_securekey';

  // ==================== 工具函数 ====================

  /** ArrayBuffer → base64 字符串 */
  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  }

  /** base64 字符串 → ArrayBuffer */
  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }

  /** 当前环境是否支持 Web Crypto（需 secure context） */
  function isCryptoAvailable() {
    return typeof crypto !== 'undefined' && !!crypto.subtle &&
      typeof crypto.subtle.encrypt === 'function';
  }

  // ==================== 设备密钥 ====================

  /**
   * 获取设备加密密钥（首次使用时自动生成并持久化）
   * @returns {Promise<CryptoKey|null>} 环境不支持时返回 null
   */
  async function getDeviceKey() {
    if (!isCryptoAvailable()) return null;

    try {
      const rawB64 = localStorage.getItem(DEVICE_KEY_STORAGE);
      if (rawB64) {
        return await crypto.subtle.importKey(
          'raw', b64ToBuf(rawB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
        );
      }

      // 首次使用：生成 256 位随机密钥
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
      const raw = await crypto.subtle.exportKey('raw', key);
      localStorage.setItem(DEVICE_KEY_STORAGE, bufToB64(raw));
      return key;
    } catch (e) {
      console.error('[SecureStore] 设备密钥获取失败:', e);
      return null;
    }
  }

  // ==================== 通用加解密 ====================

  /**
   * 加密明文字符串
   * @returns {Promise<object|null>} { v, ct, iv } 或 null（环境不支持）
   */
  async function encrypt(plaintext) {
    const key = await getDeviceKey();
    if (!key) return null;

    try {
      const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM 推荐 12 字节
      const encoded = new TextEncoder().encode(plaintext);
      const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoded);
      return {
        v: 1,
        ct: bufToB64(cipherBuf),
        iv: bufToB64(iv)
      };
    } catch (e) {
      console.error('[SecureStore] 加密失败:', e);
      return null;
    }
  }

  /**
   * 解密存储对象
   * @returns {Promise<string>} 明文字符串；失败返回 ''
   */
  async function decrypt(blob) {
    if (!blob || !blob.ct || !blob.iv) return '';

    const key = await getDeviceKey();
    if (!key) return '';

    try {
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBuf(blob.iv) },
        key,
        b64ToBuf(blob.ct)
      );
      return new TextDecoder().decode(plainBuf);
    } catch (e) {
      console.warn('[SecureStore] 解密失败（设备密钥可能已变更）:', e);
      return '';
    }
  }

  // ==================== API Key 专用接口 ====================

  /**
   * 保存 API Key（加密后写入 aiConfig.apiKeyEnc，清空明文）
   * 传入空字符串表示清除已保存的 Key
   * @returns {Promise<boolean>} true=已加密保存；false=降级明文（环境不支持加密）
   */
  async function saveApiKey(plaintext) {
    const config = Storage.getAIConfig();
    const value = (plaintext || '').trim();

    if (!value) {
      // 清除已保存的 Key
      config.apiKey = '';
      config.apiKeyEnc = null;
      Storage.saveAIConfig(config);
      return true;
    }

    const blob = await encrypt(value);
    if (!blob) {
      // 环境不支持 Web Crypto：降级为明文存储并警告
      console.warn('[SecureStore] 当前环境不支持 Web Crypto，API Key 将以明文存储');
      config.apiKey = value;
      config.apiKeyEnc = null;
      Storage.saveAIConfig(config);
      return false;
    }

    config.apiKey = '';          // 清空明文，只保留密文
    config.apiKeyEnc = blob;
    Storage.saveAIConfig(config);
    return true;
  }

  /**
   * 读取并解密 API Key
   * @returns {Promise<string>} 明文 Key；无 Key 或解密失败返回 ''
   */
  async function getApiKey() {
    const config = Storage.getAIConfig();

    if (config.apiKeyEnc) {
      return await decrypt(config.apiKeyEnc);
    }
    // 兼容旧版明文 Key（由 migrateLegacyKey 统一迁移）
    return config.apiKey || '';
  }

  /** 是否已保存加密 Key（同步，供 UI 展示判断） */
  function hasEncryptedKey() {
    const config = Storage.getAIConfig();
    return !!(config && config.apiKeyEnc);
  }

  /**
   * 迁移旧版明文 Key → 加密存储（应用启动时调用一次）
   */
  async function migrateLegacyKey() {
    const config = Storage.getAIConfig();
    if (!config.apiKey) return; // 无明文 Key，无需迁移

    const blob = await encrypt(config.apiKey);
    if (blob) {
      config.apiKey = '';
      config.apiKeyEnc = blob;
      Storage.saveAIConfig(config);
      console.log('[SecureStore] 旧版明文 API Key 已迁移为加密存储');
    } else {
      console.warn('[SecureStore] 环境不支持加密，保留明文 Key');
    }
  }

  // ==================== 对外暴露 ====================
  return {
    isCryptoAvailable,
    getDeviceKey,
    encrypt,
    decrypt,
    saveApiKey,
    getApiKey,
    hasEncryptedKey,
    migrateLegacyKey
  };

})();
