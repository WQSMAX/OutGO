/* ============================================
   宅家激励 App — 主控制器
   负责：导航切换、页面渲染、事件协调
   ============================================ */

const App = (function () {
  'use strict';

  // ==================== 页面配置 ====================
  const PAGES = {
    home: { title: '☀️ 今日任务', sub: '完成户外任务，赚积分养宠物！' },
    travel: { title: '🗺️ 出行探索', sub: 'GPS 定位 + AI 路线规划' },
    pet: { title: '🐾 我的宠物', sub: '好好照顾你的小伙伴~' },
    user: { title: '👤 我的', sub: '查看积分和成就' },
    settings: { title: '⚙️ 设置', sub: '管理任务和偏好' }
  };

  // ==================== 引导状态 ====================
  let onboardSelectedPet = 'cat';

  // ==================== 初始化 ====================
  function init() {
    // 1. 每日重置检查
    Storage.checkDailyReset();

    // 2. 检查是否首次使用
    if (Storage.isFirstLaunch()) {
      showOnboarding();
      bindNavigation();
      return;
    }

    // 3. 检查宠物随机事件
    checkPetRandomEvent();

    // 4. 渲染所有页面
    renderAllPages();

    // 5. 绑定导航
    bindNavigation();

    // 6. 导航切换时自动刷新
    bindPageRefresh();

    // 7. 后台加载 AI 路线（如果已配置）
    loadAIRouteAsync();

    // 8. 检查是否需要展示 AI 教程
    checkAITutorial();

    // 9. 应用暗色模式
    applyDarkMode();

    console.log('🏠 宅家激励 App 已就绪');
  }

  function renderAllPages() {
    renderTaskCard();
    renderPetPage();
    renderUserPage();
  }

  // ==================== 首次引导 ====================
  function showOnboarding() {
    document.getElementById('onboardingModal').classList.remove('hidden');
    // 步骤 0：AI 教程（最先看到）
    document.getElementById('onboardStep0').classList.remove('hidden');
    document.getElementById('onboardStep1').classList.add('hidden');
    document.getElementById('onboardStep2').classList.add('hidden');
    document.getElementById('onboardStep3').classList.add('hidden');
    onboardSelectedPet = 'cat';
  }

  function onboardNext(step) {
    // 隐藏所有步骤
    document.getElementById('onboardStep0').classList.add('hidden');
    document.getElementById('onboardStep1').classList.add('hidden');
    document.getElementById('onboardStep2').classList.add('hidden');
    document.getElementById('onboardStep3').classList.add('hidden');

    // 显示目标步骤
    if (step === 1) {
      // 教程 → 欢迎选宠物
      document.getElementById('onboardStep1').classList.remove('hidden');
    } else if (step === 2) {
      document.getElementById('onboardStep2').classList.remove('hidden');
      // 重置选择
      onboardSelectPet('cat');
    } else if (step === 3) {
      document.getElementById('onboardStep3').classList.remove('hidden');
      // 更新宠物预览
      var petTypes = Pet.PET_TYPES;
      var pet = petTypes[onboardSelectedPet] || petTypes.cat;
      document.getElementById('onboardPetPreview').textContent = pet.emoji;
      document.getElementById('onboardPetName').value = pet.name;
      document.getElementById('onboardPetName').focus();
      document.getElementById('onboardStartBtn').disabled = false;
    }
  }

  function onboardSelectPet(type) {
    onboardSelectedPet = type;
    // 更新选择器高亮
    document.querySelectorAll('#onboardPetSelector .pet-option').forEach(function (el) {
      el.classList.toggle('selected', el.dataset.pet === type);
    });
    // 更新描述
    var petTypes = Pet.PET_TYPES;
    var pet = petTypes[type];
    if (pet) {
      document.getElementById('onboardPetDesc').textContent = pet.description;
    }
  }

  function onboardFinish() {
    var nameInput = document.getElementById('onboardPetName');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) return;

    // 创建宠物
    Pet.choosePet(onboardSelectedPet, name);

    // 初始化一个随机任务
    var task = Tasks.getRandomTask(null);
    var data = Storage.getData();
    data.user.currentTaskId = task.id;
    Storage.saveData(data);

    // 标记首次启动完成
    Storage.markFirstLaunchDone();

    // 隐藏引导
    document.getElementById('onboardingModal').classList.add('hidden');

    // 渲染所有页面
    renderAllPages();
    bindPageRefresh();

    showToast('🎉 欢迎 ' + name + '！开始你的第一项任务吧~');
  }

  // ==================== 页面导航 ====================
  function bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', function () {
        switchPage(this.dataset.page);
      });
    });
  }

  function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (targetNav) targetNav.classList.add('active');

    const config = PAGES[pageId];
    if (config) {
      document.querySelector('#pageHeader h1').textContent = config.title;
      document.querySelector('#pageHeader .header-sub').textContent = config.sub;
    }

    const content = document.getElementById('page-' + pageId);
    if (content) content.scrollTop = 0;
  }

  // 切换到某个页面时自动刷新该页数据
  function bindPageRefresh() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', function () {
        const pageId = this.dataset.page;
        if (pageId === 'home') renderTaskCard();
        if (pageId === 'travel') renderTravelPage();
        if (pageId === 'pet') renderPetPage();
        if (pageId === 'user') renderUserPage();
        if (pageId === 'settings') renderSettingsPage();
      });
    });
  }

  // ==================== 首页 — 任务卡片 ====================
  function renderTaskCard() {
    const task = Tasks.getCurrentTask();
    if (!task) return;

    const diffConfig = Tasks.DIFFICULTY_CONFIG[task.difficulty] || Tasks.DIFFICULTY_CONFIG.medium;

    const diffEl = document.getElementById('taskDifficulty');
    if (diffEl) {
      diffEl.textContent = diffConfig.label;
      diffEl.className = 'task-difficulty ' + task.difficulty;
    }

    const titleEl = document.getElementById('taskTitle');
    if (titleEl) titleEl.textContent = task.title;

    const pointsEl = document.getElementById('taskPoints');
    if (pointsEl) pointsEl.textContent = task.points || Tasks.getPointsByDifficulty(task.difficulty);

    updateRefreshCount();
    updateHomeStreak();

    // 如果出行页有路线，在首页提示
    updateHomeTravelLink();
  }

  function updateHomeStreak() {
    var streak = Storage.getStreak();
    var tip = document.getElementById('encourageTip');
    if (tip && streak.current > 0) {
      tip.innerHTML = '🔥 已连续出门 <strong>' + streak.current + '</strong> 天！继续加油<span class="heart">❤️</span>';
    }
  }

  function updateHomeTravelLink() {
    var cachedRoute = Storage.getRouteCache();
    var link = document.getElementById('aiTipHome');
    if (link && cachedRoute && cachedRoute.stops) {
      link.innerHTML = '🗺️ 出行页有已规划好的路线，<a href="#" onclick="App.switchPage(\'travel\');return false;" style="color:var(--color-primary);font-weight:600;">去看看 →</a>';
    }
  }

  function updateRefreshCount() {
    const countEl = document.getElementById('refreshCount');
    if (countEl) countEl.textContent = Tasks.getFreeRefreshes();
  }

  function refreshTask() {
    const result = Tasks.refreshTask();
    if (result.success) {
      renderTaskCard();
      renderUserPage();  // 积分可能变少
    }
    showToast(result.message);
  }

  function completeTask() {
    // 防止快速双击
    const btnComplete = document.getElementById('btnComplete');
    if (btnComplete) btnComplete.disabled = true;

    const result = Tasks.completeTask();
    if (result.success) {
      celebrateCompletion(result);
      showMotivationalMessage(result.motivation);  // 激励覆盖层
      setTimeout(function () {
        renderTaskCard();
        renderPetPage();
        renderUserPage();
        // 恢复按钮
        if (btnComplete) btnComplete.disabled = false;
      }, 600);
    } else {
      // 失败时立即恢复按钮
      if (btnComplete) btnComplete.disabled = false;
    }
    showToast(result.message);
  }

  // ==================== 宠物页 ====================
  function renderPetPage() {
    // 尝试获取 AI 路线中的宠物反应
    var aiMessage = null;
    var routeCache = Storage.getRouteCache();
    if (routeCache && routeCache.petReaction) {
      aiMessage = routeCache.petReaction;
    }
    const state = Pet.getPetState(aiMessage);
    const stageVis = state.stageVisual;

    // 宠物名和等级
    const nameEl = document.getElementById('petName');
    if (nameEl) nameEl.textContent = state.name;

    const levelEl = document.getElementById('petLevel');
    if (levelEl) levelEl.textContent = state.level;

    // 阶段徽章
    const badgeEl = document.getElementById('petStageBadge');
    if (badgeEl) {
      badgeEl.textContent = stageVis.badge + ' ' + stageVis.name;
      badgeEl.className = 'stage-badge ' + stageVis.badgeClass;
    }

    // 宠物展示容器 — 应用阶段 CSS 类
    const displayEl = document.getElementById('petDisplay');
    if (displayEl) {
      displayEl.className = 'pet-display ' + stageVis.bgClass;
    }

    // 宠物图片 / Emoji
    const emojiEl = document.getElementById('petEmoji');
    if (emojiEl) {
      if (state.stageImage) {
        // 使用 AI 生成的阶段图片
        const imgSize = Math.round(120 * stageVis.sizeMul);
        emojiEl.innerHTML = '<img src="' + state.stageImage +
          '" alt="' + state.name + ' ' + stageVis.name +
          '" style="width:' + imgSize + 'px;height:' + imgSize +
          'px;object-fit:contain;border-radius:50%;">';
      } else {
        // 降级为 emoji
        emojiEl.textContent = state.typeInfo.emoji;
        emojiEl.style.fontSize = (80 * stageVis.sizeMul) + 'px';
      }
    }

    // 鼓励话语
    const bubbleEl = document.getElementById('speechBubble');
    if (bubbleEl) bubbleEl.textContent = state.encourageMessage;

    // 心情条
    const moodLabel = document.getElementById('moodValue');
    if (moodLabel) {
      moodLabel.textContent = state.mood + ' / 100  ' + state.moodEmoji + ' ' + state.moodLabel;
    }
    const moodBar = document.getElementById('moodBar');
    if (moodBar) {
      moodBar.style.width = state.mood + '%';
      moodBar.className = 'progress-fill ' + state.moodCssClass;
    }

    // 成长条 — 显示阶段信息
    const growthLabel = document.getElementById('growthValue');
    if (growthLabel) {
      growthLabel.textContent = state.growth + ' / 100  ' + stageVis.badge + ' ' + stageVis.name;
    }
    const growthBar = document.getElementById('growthBar');
    if (growthBar) {
      growthBar.style.width = state.growth + '%';
    }
  }

  function feedPet() {
    const result = Pet.feedPet();
    if (result.success) {
      renderPetPage();
      renderUserPage();  // 积分减少
    }
    showToast(result.message);
  }

  function playWithPet() {
    const result = Pet.playWithPet();
    if (result.success) {
      renderPetPage();
      renderUserPage();  // 积分减少
    }
    showToast(result.message);
  }

  function selectPet(type) {
    // 切换高亮
    document.querySelectorAll('.pet-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.pet === type);
    });

    const result = Pet.switchPetType(type);
    if (result.success) {
      renderPetPage();
    }
    showToast(result.message);
  }

  // ==================== 用户页 ====================
  function renderUserPage() {
    const user = Storage.getUser();
    const pet = Storage.getPet();

    // 积分
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.textContent = user.points.toLocaleString();

    // 任务历史
    renderHistory(user.taskHistory);

    // 成就
    renderAchievements(user);
  }

  function renderHistory(history) {
    const listEl = document.getElementById('historyList');
    if (!listEl) return;

    if (!history || history.length === 0) {
      listEl.innerHTML = '<li class="history-item" style="justify-content:center;color:var(--color-text-secondary);">还没有完成任务，快去首页看看吧！</li>';
      return;
    }

    let html = '';
    history.slice(0, 20).forEach(function (item) {
      const date = item.completedAt ? item.completedAt.slice(0, 10) : '未知日期';
      html += `
        <li class="history-item">
          <div class="history-info">
            <div class="history-title">${escapeHtml(item.title)}</div>
            <div class="history-date">${date}</div>
          </div>
          <div class="history-points">+${item.points} 🪙</div>
        </li>
      `;
    });
    listEl.innerHTML = html;
  }

  function renderAchievements(user) {
    const grid = document.getElementById('achievementGrid');
    if (!grid) return;

    const achievements = user.achievements || [];
    const taskCount = (user.taskHistory || []).length;

    // 动态计算成就状态
    const allAchievements = [
      { key: 'first_task', icon: '🌱', name: '初次出门', unlocked: taskCount >= 1 },
      { key: 'five_tasks', icon: '🚶', name: '小小行者', unlocked: taskCount >= 5 },
      { key: 'twenty_tasks', icon: '🏃', name: '户外达人', unlocked: taskCount >= 20 },
      { key: 'hundred_tasks', icon: '💯', name: '百次挑战', unlocked: taskCount >= 100 },
      { key: 'hard_ten', icon: '⭐', name: '困难征服者', unlocked: checkHardTasks(user, 10) },
      { key: 'streak_7', icon: '🔥', name: '坚持一周', unlocked: checkStreak(user, 7) },
      { key: 'streak_30', icon: '👑', name: '月度之星', unlocked: checkStreak(user, 30) },
      { key: 'secret', icon: '❓', name: '???', unlocked: false }
    ];

    let html = '';
    allAchievements.forEach(function (ach) {
      html += `
        <div class="achievement-item">
          <div class="achievement-icon ${ach.unlocked ? 'unlocked' : 'locked'}">${ach.unlocked ? ach.icon : '🔒'}</div>
          <div class="achievement-name">${ach.name}</div>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  function checkHardTasks(user, count) {
    if (!user.taskHistory) return false;
    const hardTasks = user.taskHistory.filter(t => t.difficulty === 'hard');
    return hardTasks.length >= count;
  }

  function checkStreak(user, days) {
    if (!user.taskHistory || user.taskHistory.length === 0) return false;
    // 简单检测：任务数量足够多就行（精确的连续天数太复杂）
    return user.taskHistory.length >= days;
  }

  // ==================== 设置页 ====================
  function renderSettingsPage() {
    const data = Storage.getData();

    // 刷新宠物选择器
    document.querySelectorAll('.pet-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.pet === data.pet.type);
    });

    // 刷新提醒设置
    const toggleEl = document.getElementById('toggleReminder');
    if (toggleEl) toggleEl.checked = data.settings.dailyReminder;

    const timeEl = document.getElementById('reminderTime');
    if (timeEl) timeEl.value = data.settings.reminderTime;

    // 刷新 AI 设置
    var aiConfig = Storage.getAIConfig();
    var toggleAI = document.getElementById('toggleAI');
    if (toggleAI) toggleAI.checked = aiConfig.enabled;

    var aiDetail = document.getElementById('aiSettingsDetail');
    if (aiDetail) aiDetail.classList.toggle('hidden', !aiConfig.enabled);

    var apiKeyEl = document.getElementById('aiApiKey');
    if (apiKeyEl) apiKeyEl.value = aiConfig.apiKey || '';

    var routeLenEl = document.getElementById('aiRouteLength');
    if (routeLenEl) routeLenEl.value = (aiConfig.routeLength || 3).toString();

    // 刷新 GPS 状态
    detectGPS();

    // 手动城市输入
    var profile = Storage.getProfile();
    var cityEl = document.getElementById('manualCity');
    if (cityEl && profile.city && !cityEl.value) {
      cityEl.value = profile.city;
    }

    // 刷新偏好摘要
    renderPreferenceSummary();

    // 刷新自定义任务列表
    renderCustomTaskList();
  }

  function renderCustomTaskList() {
    const listEl = document.getElementById('customTaskList');
    if (!listEl) return;

    const tasks = Storage.getCustomTasks();

    if (!tasks || tasks.length === 0) {
      listEl.innerHTML = '<div class="settings-item" style="justify-content:center;color:var(--color-text-secondary);font-size:var(--font-size-sm);padding:var(--space-lg);">还没有自定义任务，快添加一个吧！</div>';
      return;
    }

    let html = '';
    tasks.forEach(function (task, index) {
      const diffLabel = Tasks.DIFFICULTY_CONFIG[task.difficulty] ?
        Tasks.DIFFICULTY_CONFIG[task.difficulty].label : '🎯 中等';
      html += `
        <div class="custom-task-item">
          <div class="task-info">
            <div class="task-name">${escapeHtml(task.title)}</div>
            <div class="task-diff-label">${diffLabel} · ${task.points} 积分</div>
          </div>
          <button class="btn btn-danger btn-small" onclick="App.deleteCustomTask(${index})">🗑️</button>
        </div>
      `;
    });
    listEl.innerHTML = html;
  }

  function toggleReminder() {
    const data = Storage.getData();
    data.settings.dailyReminder = !data.settings.dailyReminder;
    Storage.saveData(data);
    showToast(data.settings.dailyReminder ? '🔔 每日提醒已开启' : '🔕 每日提醒已关闭');
  }

  function setReminderTime() {
    const timeEl = document.getElementById('reminderTime');
    if (!timeEl) return;
    Storage.updateSettings({ reminderTime: timeEl.value });
    showToast('⏰ 提醒时间已设置为 ' + timeEl.value);
  }

  function addCustomTask() {
    const inputEl = document.getElementById('customTaskInput');
    const diffEl = document.getElementById('customTaskDifficulty');

    if (!inputEl || !diffEl) return;

    const title = inputEl.value.trim();
    if (!title) {
      showToast('请输入任务内容');
      return;
    }
    if (title.length < 3) {
      showToast('任务内容至少 3 个字');
      return;
    }

    const difficulty = diffEl.value;
    const points = Tasks.getPointsByDifficulty(difficulty);

    const tasks = Storage.getCustomTasks();
    tasks.push({
      id: 'custom_' + Date.now(),
      title: title,
      difficulty: difficulty,
      points: points,
      createdAt: Storage.getToday()
    });

    Storage.saveCustomTasks(tasks);
    inputEl.value = '';
    renderCustomTaskList();
    renderTaskCard();  // 任务池更新了
    showToast('✅ 自定义任务已添加');
  }

  function deleteCustomTask(index) {
    const tasks = Storage.getCustomTasks();
    if (index < 0 || index >= tasks.length) return;

    const title = tasks[index].title;
    tasks.splice(index, 1);
    Storage.saveCustomTasks(tasks);
    renderCustomTaskList();
    renderTaskCard();  // 任务池更新了
    showToast('🗑️ 已删除：' + title);
  }

  // ==================== 轻提示 ====================
  function showToast(message) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
      background: var(--color-text-title); color: white; padding: 12px 24px;
      border-radius: var(--radius-xl); font-size: var(--font-size-sm);
      font-family: var(--font-family); z-index: 300; white-space: pre-line;
      text-align: center; box-shadow: var(--shadow-lg); max-width: 320px;
      animation: toastIn 300ms ease, toastOut 300ms ease 2s forwards;
    `;
    document.body.appendChild(toast);

    if (!document.getElementById('toastStyles')) {
      const style = document.createElement('style');
      style.id = 'toastStyles';
      style.textContent = `
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes toastOut { from { opacity:1; } to { opacity:0; } }
      `;
      document.head.appendChild(style);
    }

    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 2500);
  }

  // ==================== 激励话语覆盖层 ====================
  function showMotivationalMessage(text) {
    if (!text) return;

    // 移除已有的激励覆盖层
    const existing = document.querySelector('.motivation-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'motivation-overlay';
    overlay.textContent = text;
    overlay.style.cssText = `
      position: fixed; top: 28%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(55,71,79,0.88); color: white;
      padding: 18px 28px; border-radius: 20px;
      font-size: 18px; font-weight: 600; font-family: var(--font-family);
      z-index: 350; text-align: center; max-width: 300px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      animation: motivationIn 400ms ease, motivationOut 400ms ease 2s forwards;
      pointer-events: none; line-height: 1.5;
    `;
    document.body.appendChild(overlay);

    // 确保动画关键帧存在
    if (!document.getElementById('motivationStyles')) {
      const style = document.createElement('style');
      style.id = 'motivationStyles';
      style.textContent = `
        @keyframes motivationIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes motivationOut {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          to   { opacity: 0; transform: translate(-50%, -50%) translateY(-10px) scale(0.9); }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(function () {
      if (overlay.parentNode) overlay.remove();
    }, 2600);
  }

  // ==================== 庆祝动画 ====================
  function celebrateCompletion(result) {
    const card = document.getElementById('taskCard');
    if (!card) return;

    card.style.transition = 'transform 500ms ease';
    card.style.transform = 'scale(1.05)';
    setTimeout(function () { card.style.transform = 'scale(1)'; }, 300);

    const emojis = ['🎉', '🌟', '🪙', '❤️', '✨', '💪', '🎊'];
    for (let i = 0; i < 12; i++) {
      setTimeout(function () {
        createParticle(emojis[Math.floor(Math.random() * emojis.length)]);
      }, i * 40);
    }
  }

  function createParticle(emoji) {
    const particle = document.createElement('span');
    particle.textContent = emoji;
    particle.style.cssText = `
      position: fixed; font-size: ${24 + Math.random() * 20}px;
      left: ${30 + Math.random() * 40}%; top: 50%; z-index: 400;
      pointer-events: none;
      animation: particleFly ${800 + Math.random() * 600}ms ease-out forwards;
    `;
    document.body.appendChild(particle);

    if (!document.getElementById('particleStyles')) {
      const style = document.createElement('style');
      style.id = 'particleStyles';
      style.textContent = `
        @keyframes particleFly {
          0% { opacity:1; transform:translate(0,0) scale(1); }
          100% { opacity:0; transform:translate(var(--dx,30px),-150px) scale(0.3); }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(function () { if (particle.parentNode) particle.remove(); }, 1500);
  }

  // ==================== AI 路线卡片渲染（新增） ====================

  /**
   * 后台异步加载 AI 路线
   */
  function loadAIRouteAsync() {
    if (!Tasks.isAIEnabled()) return;

    var cachedRoute = Storage.getRouteCache();
    if (cachedRoute) {
      console.log('[App] 使用缓存的 AI 路线');
      renderRouteCard(cachedRoute, cachedRoute.source || 'cached');
      return;
    }

    console.log('[App] 后台加载 AI 路线…');

    // 设置超时检测：如果 8 秒后还没有路线，弹出提示
    var aiTimeout = setTimeout(function () {
      var route = Storage.getRouteCache();
      if (!route || !route.stops) {
        // 只在用户正在看出行页时才弹窗
        var travelPage = document.getElementById('page-travel');
        if (travelPage && travelPage.classList.contains('active')) {
          showAIUnavailablePopup();
        }
      }
    }, 8000);

    Tasks.generateAIRouteAsync(function (route, source) {
      clearTimeout(aiTimeout);
      renderRouteCard(route, source);
    });
  }

  /**
   * 渲染 AI 路线卡片
   */
  function renderRouteCard(route, source) {
    // 使用出行页的路线卡片 ID
    var card = document.getElementById('travelRouteCard');
    var empty = document.getElementById('travelEmpty');
    var placesCard = document.getElementById('travelPlacesCard');
    if (!card) return;

    // 显示路线卡片，隐藏空状态和地点列表
    card.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');
    if (placesCard) placesCard.classList.add('hidden');

    // 来源标记
    var badge = document.getElementById('travelRouteBadge');
    if (badge) {
      if (source === 'ai') {
        badge.textContent = '✨ AI 智能路线';
        badge.className = 'route-badge ai-badge';
      } else if (source === 'local') {
        badge.textContent = '📍 本地推荐';
        badge.className = 'route-badge local-badge';
      } else {
        badge.textContent = '📋 今日任务';
        badge.className = 'route-badge preset-badge';
      }
    }

    // 状态
    var status = document.getElementById('travelRouteStatus');
    if (status) {
      status.textContent = source === 'ai' ? 'AI 为你规划' : (source === 'local' ? '附近推荐' : '');
    }

    // 天气
    var weatherEl = document.getElementById('travelWeather');
    if (weatherEl) {
      weatherEl.textContent = route.weatherNote || '';
      weatherEl.classList.remove('hidden');
    }

    // 站点列表
    renderTravelRouteStops(route);

    // 元信息
    var metaEl = document.getElementById('travelRouteMeta');
    if (metaEl) {
      metaEl.innerHTML =
        '<span class="route-time">⏱ ' + (route.totalMinutes || '--') + ' 分钟</span>' +
        '<span class="route-dist">📍 ' + (route.totalDistance || '--') + '</span>';
    }

    // 激励语
    var motEl = document.getElementById('travelRouteMotivation');
    if (motEl) motEl.textContent = route.motivation || '';

    // 宠物反应
    var petReact = document.getElementById('travelRoutePetReaction');
    if (petReact && route.petReaction) {
      petReact.classList.remove('hidden');
      petReact.textContent = '🐾 ' + route.petReaction;
    } else if (petReact) {
      petReact.classList.add('hidden');
    }

    // 地图按钮
    var btnMap = document.getElementById('btnTravelMap');
    if (btnMap) btnMap.style.display = (route.stops && route.stops.length > 1 && route.stops[0].lat) ? '' : 'none';
  }

  /**
   * 渲染出行页路线站点
   */
  function renderTravelRouteStops(route) {
    var container = document.getElementById('travelRouteStops');
    if (!container || !route.stops) return;

    var html = '';

    // 起点
    html += '<div class="route-stop">';
    html += '<div class="route-stop-marker"><div class="stop-dot start"></div><div class="stop-line"></div></div>';
    html += '<div class="route-stop-info">';
    html += '<div class="route-stop-name">🏠 从家出发</div>';
    html += '</div></div>';

    // 各站点
    for (var i = 0; i < route.stops.length; i++) {
      var stop = route.stops[i];
      var isLast = i === route.stops.length - 1;

      html += '<div class="route-stop">';
      html += '<div class="route-stop-marker">';
      html += '<div class="stop-dot"></div>';
      if (!isLast) html += '<div class="stop-line"></div>';
      html += '</div>';
      html += '<div class="route-stop-info">';
      html += '<div class="route-stop-name">' + escapeHtml(stop.name) + '</div>';
      if (stop.categoryLabel) {
        html += '<div class="route-stop-category">' + escapeHtml(stop.categoryLabel) + '</div>';
      }
      if (stop.aiReason) {
        html += '<div class="route-stop-reason">💬 ' + escapeHtml(stop.aiReason) + '</div>';
      }
      html += '<div class="route-stop-meta">';
      html += '<span>🚶 ' + escapeHtml(stop.walkingFromPrev || '—') + '</span>';
      html += '<span>⏱ ' + escapeHtml(stop.suggestedDuration || '—') + '</span>';
      html += '</div></div></div>';
    }

    // 终点
    html += '<div class="route-stop">';
    html += '<div class="route-stop-marker"><div class="stop-dot end"></div></div>';
    html += '<div class="route-stop-info">';
    html += '<div class="route-stop-name">🏠 回到温暖的家</div>';
    html += '</div></div>';

    container.innerHTML = html;
  }

  // ==================== 出行页（新增） ====================

  function renderTravelPage() {
    // 检测 GPS
    detectGPSOnTravel();

    // 尝试加载已有路线
    var cachedRoute = Storage.getRouteCache();
    if (cachedRoute) {
      renderRouteCard(cachedRoute, cachedRoute.source || 'cached');
    }
  }

  function detectGPSOnTravel() {
    var statusEl = document.getElementById('travelGpsStatus');
    Location.getPosition().then(function (pos) {
      if (pos.ok && pos.city) {
        if (statusEl) {
          statusEl.textContent = '📍 ' + pos.city + ' · GPS 已就绪';
          statusEl.className = 'gps-indicator online';
        }
      } else {
        var profile = Storage.getProfile();
        if (profile.city) {
          if (statusEl) {
            statusEl.textContent = '📍 ' + profile.city + ' (手动设置)';
            statusEl.className = 'gps-indicator online';
          }
        } else {
          if (statusEl) {
            statusEl.textContent = '⚠️ 点击下方按钮获取位置';
            statusEl.className = 'gps-indicator offline';
          }
        }
      }
    });
  }

  function exploreNearby() {
    showToast('📡 正在获取位置和周边信息…');

    // 获取位置
    Location.getPosition().then(function (pos) {
      if (!pos.ok && !pos.city) {
        showToast('⚠️ 无法获取位置，请先在设置中设置城市');
        return;
      }

      // 更新 GPS 状态
      var statusEl = document.getElementById('travelGpsStatus');
      if (statusEl) {
        statusEl.textContent = '⏳ 正在搜索周边…';
        statusEl.className = 'gps-indicator loading';
      }

      var lat = pos.lat;
      var lng = pos.lng;

      // 如果没有 lat/lng，尝试用地理编码获取
      var weatherPromise, placesPromise;

      if (lat && lng) {
        weatherPromise = Weather.getWeather(lat, lng);
        var profile = Storage.getProfile();
        placesPromise = Places.searchNearby(lat, lng, {
          style: profile.activityStyle || 'balanced',
          categories: profile.preferredCategories || [],
          excludeIds: profile.visitedPlaceIds || [],
          radius: 3000
        });
      } else if (pos.city) {
        // 只有城市名，需要地理编码
        weatherPromise = Promise.resolve(null);
        placesPromise = Promise.resolve({ ok: true, places: [] });
        // 尝试地理编码
        Location.setManualCity(pos.city).then(function (cityResult) {
          if (cityResult.ok) {
            Weather.getWeather(cityResult.lat, cityResult.lng).then(function (w) {
              updateTravelWeather(w);
            });
            Places.searchNearby(cityResult.lat, cityResult.lng, {
              style: 'balanced',
              radius: 3000
            }).then(function (p) {
              updateTravelPlaces(p);
            });
          }
        });
        return;
      } else {
        weatherPromise = Promise.resolve(null);
        placesPromise = Promise.resolve({ ok: true, places: [] });
      }

      Promise.all([weatherPromise, placesPromise]).then(function (results) {
        var weatherResult = results[0];
        var placesResult = results[1];

        // 更新天气
        if (weatherResult && weatherResult.ok) {
          updateTravelWeather(weatherResult);
        }

        // 更新周边地点列表
        if (placesResult && placesResult.ok && placesResult.places && placesResult.places.length > 0) {
          updateTravelPlaces(placesResult);
        }

        // 更新 GPS 状态
        if (statusEl) {
          statusEl.textContent = pos.city ? ('📍 ' + pos.city + ' · 已就绪') : '📍 已就绪';
          statusEl.className = 'gps-indicator online';
        }

        // 如果 AI 已启用，自动生成路线（loadAIRouteAsync 内置超时弹窗）
        if (Tasks.isAIEnabled()) {
          showToast('🤖 AI 正在规划路线…');
          loadAIRouteAsync();
        } else if (placesResult && placesResult.ok && placesResult.places.length > 0) {
          // 使用本地规则引擎
          var profile = Storage.getProfile();
          var localRoute = Places.buildLocalRoute(placesResult.places, {
            maxStops: 3,
            maxMinutes: profile.maxWalkingMinutes || 60,
            lat: lat || 0,
            lng: lng || 0
          });
          if (localRoute) {
            if (weatherResult && weatherResult.ok) {
              localRoute.weatherNote = weatherResult.summary;
            }
            renderRouteCard(localRoute, 'local');
          }
        }
      });
    });
  }

  function updateTravelWeather(weatherResult) {
    var el = document.getElementById('travelWeather');
    if (el && weatherResult.summary) {
      el.textContent = weatherResult.summary;
      el.classList.remove('hidden');
    }
  }

  function updateTravelPlaces(placesResult) {
    var card = document.getElementById('travelPlacesCard');
    var list = document.getElementById('travelPlacesList');
    if (!card || !list) return;

    card.classList.remove('hidden');

    if (!placesResult.places || placesResult.places.length === 0) {
      list.innerHTML = '<div class="text-center" style="padding:var(--space-lg);color:var(--color-text-secondary);">附近暂未找到合适的去处</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < Math.min(placesResult.places.length, 8); i++) {
      var p = placesResult.places[i];
      html += '<div class="travel-place-item">';
      html += '<div class="travel-place-info">';
      html += '<div class="travel-place-name">' + (p.categoryLabel || '📍') + ' ' + escapeHtml(p.name) + '</div>';
      html += '<div class="travel-place-meta">🚶 ' + (p.walkingMinutes || '?') + ' 分钟步行</div>';
      html += '</div>';
      html += '</div>';
    }
    list.innerHTML = html;
  }

  function refreshAIRoute() {
    showToast('🔄 正在重新规划路线…');
    var btn = document.getElementById('btnTravelRefresh');
    if (btn) btn.disabled = true;

    Storage.clearRouteCache();
    loadAIRouteAsync();

    setTimeout(function () {
      if (btn) btn.disabled = false;
      showToast('✨ 路线已刷新');
    }, 3000);
  }

  function completeRoute() {
    var route = Storage.getRouteCache();
    if (!route || !route.stops || route.stops.length === 0) {
      showToast('路线已过期，请重新生成');
      loadAIRouteAsync();
      return;
    }

    var data = Storage.getData();
    var user = data.user;
    var pet = data.pet;

    var pointsEarned = 50 + (route.stops ? route.stops.length * 10 : 0);

    user.points += pointsEarned;

    var growthEarned = 20;
    pet.growth += growthEarned;

    var leveledUp = false;
    while (pet.growth >= 100 && pet.level < 10) {
      pet.growth -= 100;
      pet.level++;
      leveledUp = true;
    }
    if (pet.level >= 10 && pet.growth > 100) pet.growth = 100;

    pet.mood = Math.min(100, pet.mood + 10);

    var firstStopName = route.stops[0] ? route.stops[0].name : '散心路线';
    user.taskHistory.unshift({
      id: 'route_' + Date.now(),
      title: '🗺️ ' + firstStopName + ' 等 ' + (route.stops ? route.stops.length : 0) + ' 站散心路线',
      difficulty: 'medium',
      points: pointsEarned,
      completedAt: new Date().toISOString()
    });

    if (route.stops) {
      for (var i = 0; i < route.stops.length; i++) {
        if (route.stops[i].name) {
          Storage.markPlaceVisited(route.stops[i].name);
        }
      }
    }

    user.currentTaskId = null;
    Storage.saveData(data);
    Storage.clearRouteCache();
    Storage.recordRouteCompleted(route.stops ? route.stops.length : 0);
    Storage.addPointsEarned(pointsEarned);
    Storage.recordTaskCompleted();

    celebrateCompletion({ pointsEarned: pointsEarned });

    var msg = '🎉 路线完成！获得 ' + pointsEarned + ' 积分';
    if (leveledUp) msg += '\n🌟 宠物升级了！现在是 Lv.' + pet.level;
    if (route.motivation) showMotivationalMessage(route.motivation);
    showToast(msg);

    // 显示路线反馈
    setTimeout(function () {
      showRouteFeedback();
    }, 3000);

    // 恢复出行页状态
    var card = document.getElementById('travelRouteCard');
    var empty = document.getElementById('travelEmpty');
    if (card) card.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');

    setTimeout(function () {
      renderPetPage();
      renderUserPage();
    }, 600);
  }

  // ==================== AI 设置（新增） ====================

  function toggleAI() {
    var toggle = document.getElementById('toggleAI');
    var detail = document.getElementById('aiSettingsDetail');
    var config = Storage.getAIConfig();

    config.enabled = toggle.checked;
    Storage.saveAIConfig(config);

    if (detail) {
      detail.classList.toggle('hidden', !toggle.checked);
    }

    if (toggle.checked) {
      showToast('🤖 AI 推荐已开启（优先使用免费 AI）');
      loadAIRouteAsync();
    } else {
      showToast('AI 推荐已关闭');
      var card = document.getElementById('travelRouteCard');
      var empty = document.getElementById('travelEmpty');
      if (card) card.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
    }
  }

  function saveAISettings() {
    var config = Storage.getAIConfig();

    var apiKey = document.getElementById('aiApiKey');
    var routeLen = document.getElementById('aiRouteLength');

    if (apiKey) config.apiKey = apiKey.value.trim();
    if (routeLen) config.routeLength = parseInt(routeLen.value, 10) || 3;

    Storage.saveAIConfig(config);
  }

  function testAIConnection() {
    saveAISettings();
    var config = Storage.getAIConfig();

    if (!config.endpoint || !config.apiKey) {
      showToast('⚠️ 请先填写 API 地址和 Key');
      return;
    }

    showToast('🔌 正在测试连接…');

    API.callLLM(
      '请回复"OK"。',
      '测试连接，回复 OK。',
      config
    ).then(function (result) {
      if (result.ok) {
        showToast('✅ 连接成功！AI 功能已就绪');
      } else {
        showToast('❌ 连接失败：' + (result.error || '未知错误'));
      }
    });
  }

  // ==================== 定位（新增） ====================

  function detectGPS() {
    Location.getPosition().then(function (pos) {
      var statusEl = document.getElementById('gpsStatus');
      if (pos.ok && pos.city) {
        if (statusEl) {
          statusEl.textContent = '✅ ' + pos.city;
          statusEl.className = 'gps-indicator online';
        }
      } else {
        if (statusEl) {
          statusEl.textContent = '⚠️ 未获取位置';
          statusEl.className = 'gps-indicator offline';
        }
      }
    });
  }

  function setManualCity() {
    var input = document.getElementById('manualCity');
    if (!input || !input.value.trim()) {
      showToast('请输入城市名');
      return;
    }

    showToast('🔍 正在搜索城市…');

    Location.setManualCity(input.value.trim()).then(function (result) {
      if (result.ok) {
        showToast('📍 已定位：' + result.city);
        detectGPS();
        // 更新偏好摘要
        renderPreferenceSummary();
        // 触发路线加载
        if (Tasks.isAIEnabled()) {
          Storage.clearRouteCache();
          loadAIRouteAsync();
        }
      } else {
        showToast('❌ ' + (result.error || '未找到该城市'));
      }
    });
  }

  // ==================== 偏好设置向导（新增） ====================

  var _selectedInterests = [];
  var _selectedStyle = 'balanced';
  var _walkMinutes = 60;

  function closePreferenceWizard() {
    var modal = document.getElementById('preferenceModal');
    if (modal) modal.classList.add('hidden');
  }

  function showPreferenceWizard() {
    var profile = Storage.getProfile();

    // 加载现有偏好
    _selectedInterests = profile.interests ? profile.interests.slice() : [];
    _selectedStyle = profile.activityStyle || 'balanced';
    _walkMinutes = profile.maxWalkingMinutes || 60;

    // 重置 UI
    renderPreferenceWizardUI();

    // 显示弹窗
    var modal = document.getElementById('preferenceModal');
    if (modal) modal.classList.remove('hidden');
  }

  function renderPreferenceWizardUI() {
    // 兴趣 chips
    var chips = document.querySelectorAll('#interestChips .chip');
    chips.forEach(function (chip) {
      var cat = chip.dataset.cat;
      if (_selectedInterests.indexOf(cat) !== -1) {
        chip.classList.add('selected');
      } else {
        chip.classList.remove('selected');
      }
    });

    // 风格
    var styleRadios = document.querySelectorAll('input[name="activityStyle"]');
    styleRadios.forEach(function (radio) {
      radio.checked = (radio.value === _selectedStyle);
    });
    // 更新样式选中态
    document.querySelectorAll('.style-option').forEach(function (opt) {
      var radio = opt.querySelector('input[name="activityStyle"]');
      if (radio && radio.checked) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });

    // 步行时长
    var slider = document.getElementById('walkTimeSlider');
    if (slider) slider.value = _walkMinutes;
    var label = document.getElementById('walkTimeLabel');
    if (label) label.textContent = _walkMinutes + ' 分钟';
  }

  function toggleChip(el) {
    var cat = el.dataset.cat;
    el.classList.toggle('selected');
    var idx = _selectedInterests.indexOf(cat);
    if (idx === -1) {
      _selectedInterests.push(cat);
    } else {
      _selectedInterests.splice(idx, 1);
    }
  }

  function selectStyle(style) {
    _selectedStyle = style;
    renderPreferenceWizardUI();
  }

  function updateWalkTimeLabel(value) {
    _walkMinutes = parseInt(value, 10);
    var label = document.getElementById('walkTimeLabel');
    if (label) label.textContent = value + ' 分钟';
  }

  function savePreferences() {
    var profile = Storage.getProfile();
    profile.interests = _selectedInterests;
    profile.activityStyle = _selectedStyle;
    profile.maxWalkingMinutes = _walkMinutes;
    profile.preferredCategories = _selectedInterests; // 兴趣标签也作为偏好类别
    profile.setupCompleted = true;
    Storage.saveProfile(profile);

    // 关闭弹窗
    var modal = document.getElementById('preferenceModal');
    if (modal) modal.classList.add('hidden');

    // 更新摘要
    renderPreferenceSummary();

    showToast('✅ 偏好已保存');

    // 触发路线刷新
    if (Tasks.isAIEnabled()) {
      Storage.clearRouteCache();
      loadAIRouteAsync();
    }
  }

  function renderPreferenceSummary() {
    var summary = document.getElementById('preferenceSummary');
    if (!summary) return;

    var profile = Storage.getProfile();
    var parts = [];

    if (profile.city) parts.push('📍 ' + profile.city);
    if (profile.interests && profile.interests.length > 0) {
      parts.push('❤️ ' + profile.interests.length + ' 个偏好');
    }
    if (profile.activityStyle) {
      var styleLabels = { quiet: '🧘 安静独处', social: '👥 社交聚会', active: '🏃 运动活力', balanced: '🎲 随心所欲' };
      parts.push(styleLabels[profile.activityStyle] || profile.activityStyle);
    }
    if (profile.maxWalkingMinutes) {
      parts.push('🚶 ' + profile.maxWalkingMinutes + ' 分钟');
    }

    if (parts.length > 0) {
      summary.textContent = parts.join(' · ');
    } else {
      summary.textContent = '尚未设置偏好，AI 将使用默认配置';
    }
  }

  // ==================== 地图弹窗（新增） ====================

  function showRouteMap() {
    var route = Storage.getRouteCache();
    if (!route || !route.stops || route.stops.length === 0) {
      showToast('暂无可用路线');
      return;
    }

    var modal = document.getElementById('mapModal');
    if (modal) modal.classList.remove('hidden');

    // 构建静态地图 URL（OpenStreetMap）
    renderStaticMap(route);

    // 填充路线列表
    var list = document.getElementById('mapRouteList');
    if (list && route.stops) {
      var html = '';
      for (var i = 0; i < route.stops.length; i++) {
        var stop = route.stops[i];
        html += '<div class="map-route-item">';
        html += '<span class="map-stop-num">' + (i + 1) + '</span>';
        html += '<span>' + escapeHtml(stop.name) + '</span>';
        html += '</div>';
      }
      list.innerHTML = html;
    }
  }

  function renderStaticMap(route) {
    var mapEl = document.getElementById('miniMap');
    if (!mapEl) return;

    // 收集所有坐标
    var markers = [];
    if (route.stops) {
      for (var i = 0; i < route.stops.length; i++) {
        if (route.stops[i].lat && route.stops[i].lng) {
          markers.push(route.stops[i]);
        }
      }
    }

    if (markers.length === 0) {
      mapEl.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:48px;">🗺️</div><div>暂无坐标数据</div></div>';
      return;
    }

    // 计算边界
    var minLat = markers[0].lat, maxLat = markers[0].lat;
    var minLng = markers[0].lng, maxLng = markers[0].lng;
    for (var j = 1; j < markers.length; j++) {
      if (markers[j].lat < minLat) minLat = markers[j].lat;
      if (markers[j].lat > maxLat) maxLat = markers[j].lat;
      if (markers[j].lng < minLng) minLng = markers[j].lng;
      if (markers[j].lng > maxLng) maxLng = markers[j].lng;
    }

    // 使用 OSM 静态地图渲染（免费）
    var centerLat = (minLat + maxLat) / 2;
    var centerLng = (minLng + maxLng) / 2;
    var zoom = 15;

    var html = '<div style="text-align:center;padding:20px;background:var(--color-primary-bg);border-radius:var(--radius-md);">';
    html += '<div style="font-size:48px;margin-bottom:12px;">🗺️</div>';
    html += '<div style="font-weight:600;color:var(--color-text-title);margin-bottom:8px;">路线概览</div>';

    for (var k = 0; k < markers.length; k++) {
      html += '<div style="font-size:var(--font-size-sm);color:var(--color-text-body);margin:4px 0;">';
      html += '<strong>' + (k + 1) + '.</strong> ' + escapeHtml(markers[k].name);
      html += ' <span style="color:var(--color-text-secondary);">(' + markers[k].lat.toFixed(4) + ', ' + markers[k].lng.toFixed(4) + ')</span>';
      html += '</div>';
    }

    html += '<div style="margin-top:12px;font-size:var(--font-size-xs);color:var(--color-text-secondary);">';
    html += '📍 ' + markers.length + ' 个站点 · 请在系统地图中打开查看详细地图</div>';
    html += '</div>';

    mapEl.innerHTML = html;
  }

  function closeMap() {
    var modal = document.getElementById('mapModal');
    if (modal) modal.classList.add('hidden');
  }

  function openInMapApp() {
    var route = Storage.getRouteCache();
    if (!route || !route.stops || route.stops.length === 0) return;

    // 构建 Google Maps / Apple Maps / 通用地图 URL
    var markers = [];
    for (var i = 0; i < route.stops.length; i++) {
      if (route.stops[i].lat && route.stops[i].lng) {
        markers.push(route.stops[i]);
      }
    }

    if (markers.length === 0) return;

    // 使用 geo: URI（通用）或 Google Maps web URL
    var first = markers[0];
    var url;

    // Google Maps directions URL（同时兼容国内使用）
    if (markers.length > 1) {
      // 多站路线：Google Maps
      var origin = first.lat + ',' + first.lng;
      var destination = markers[markers.length - 1].lat + ',' + markers[markers.length - 1].lng;
      var waypoints = '';
      if (markers.length > 2) {
        waypoints = '&waypoints=';
        for (var j = 1; j < markers.length - 1; j++) {
          if (j > 1) waypoints += '|';
          waypoints += markers[j].lat + ',' + markers[j].lng;
        }
      }
      url = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + destination + waypoints + '&travelmode=walking';
    } else {
      url = 'https://www.google.com/maps/search/?api=1&query=' + first.lat + ',' + first.lng;
    }

    window.open(url, '_blank');
  }

  // ==================== AI 首次使用教程（新增） ====================

  function checkAITutorial() {
    // AI 教程已整合入首次使用引导（步骤 0）
    // 非首次使用的用户不弹出教程
  }

  function aiTutorialNext() {
    // 保留兼容：AI 教程现已整合入首次使用引导
    switchPage('settings');
    setTimeout(function () {
      renderSettingsPage();
      var detail = document.getElementById('aiSettingsDetail');
      var toggle = document.getElementById('toggleAI');
      if (toggle) toggle.checked = true;
      if (detail) detail.classList.remove('hidden');
      var config = Storage.getAIConfig();
      config.enabled = true;
      Storage.saveAIConfig(config);
    }, 400);
  }

  function skipAITutorial() {
    // 保留兼容
  }

  // ==================== AI 状态弹窗（新增） ====================

  function showAIUnavailablePopup() {
    var existing = document.querySelector('.ai-unavailable-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'ai-unavailable-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:400;display:flex;align-items:center;justify-content:center;animation:fadeIn 200ms ease;';

    overlay.innerHTML = '<div style="background:var(--color-white);border-radius:var(--radius-xl);padding:var(--space-xl);margin:var(--space-lg);max-width:340px;text-align:center;box-shadow:var(--shadow-lg);">' +
      '<div style="font-size:48px;margin-bottom:var(--space-md);">🤖</div>' +
      '<h3 style="color:var(--color-text-title);margin-bottom:var(--space-sm);">AI 服务暂未配置</h3>' +
      '<div style="font-size:var(--font-size-sm);color:var(--color-text-body);text-align:left;line-height:1.8;margin-bottom:var(--space-lg);">' +
      '<p>DeepSeek 提供 <strong>免费 API</strong>，注册即送 500 万 tokens：</p>' +
      '<p style="margin-top:4px;">📋 <strong>两步搞定</strong>：</p>' +
      '<p>1️⃣ 打开 <span style="color:var(--color-primary);">platform.deepseek.com</span></p>' +
      '<p>2️⃣ 注册 → API Keys → 创建 → 粘贴</p>' +
      '<p style="margin-top:var(--space-sm);color:var(--color-success);font-weight:600;">✅ 本地推荐引擎已自动启用</p>' +
      '<p style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">不影响周边搜索和路线规划</p>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="App.openDeepSeekReg()" style="width:100%;">🔑 获取免费 Key</button>' +
      '<button class="btn btn-secondary btn-small" onclick="App.openDeepSeekChat();this.closest(\'.ai-unavailable-overlay\').remove();" style="width:100%;margin-top:var(--space-sm);">💬 使用网页对话</button>' +
      '<button style="background:none;border:none;color:var(--color-text-secondary);padding:8px;cursor:pointer;width:100%;margin-top:4px;" onclick="this.closest(\'.ai-unavailable-overlay\').remove()">关闭</button>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ==================== DeepSeek 辅助（新增） ====================

  function openDeepSeekReg() {
    window.open('https://platform.deepseek.com/api_keys', '_blank');
    showToast('📋 注册后在 API Keys 页面创建 Key，粘贴到设置中即可');
  }

  function openDeepSeekChat() {
    // 构建上下文
    var profile = Storage.getProfile();
    var pref = [];
    if (profile.city) pref.push('我在' + profile.city);
    if (profile.interests && profile.interests.length > 0) pref.push('喜欢去' + profile.interests.join('、'));
    if (profile.maxWalkingMinutes) pref.push('步行不超过' + profile.maxWalkingMinutes + '分钟');

    var context = pref.length > 0
      ? '你好！' + pref.join('，') + '。请根据我的情况，推荐一条 2-3 站的户外散心路线，包含具体地点和步行时间。'
      : '你好！请根据天气和位置，为我推荐一条 2-3 站的户外散心路线。';

    // 打开 DeepSeek 网页对话
    API.openDeepSeekWebChat(context);
    showToast('💬 已打开 DeepSeek，粘贴上下文即可获得路线推荐');
  }

  // ==================== 路线反馈（新增） ====================

  function showRouteFeedback() {
    // 简单的 toast 式反馈
    var existing = document.querySelector('.feedback-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'feedback-toast';
    toast.innerHTML = '<span>这条路怎么样？</span>' +
      '<button onclick="App.submitRouteFeedback(\'like\')">👍 喜欢</button>' +
      '<button onclick="App.submitRouteFeedback(\'dislike\')">👎 不太合适</button>' +
      '<button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:14px;cursor:pointer;">✕</button>';
    toast.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:white;padding:12px 20px;border-radius:20px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:300;display:flex;align-items:center;gap:12px;font-size:14px;font-family:var(--font-family);animation:toastIn 300ms ease;';
    document.body.appendChild(toast);

    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 15000);
  }

  function submitRouteFeedback(rating) {
    var route = Storage.getRouteCache() || {};
    var name = (route.stops && route.stops[0]) ? route.stops[0].name : '';
    Storage.addRouteFeedback({ routeName: name, rating: rating });
    showToast(rating === 'like' ? '👍 谢谢反馈！下次会推荐类似的~' : '👎 收到，下次会调整推荐方向');
    var toast = document.querySelector('.feedback-toast');
    if (toast) toast.remove();
  }

  // ==================== 宠物随机事件（新增） ====================

  function checkPetRandomEvent() {
    var event = Pet.checkRandomEvent();
    if (event) {
      var toast = document.createElement('div');
      toast.className = 'pet-event-toast';
      toast.innerHTML = '<span style="font-size:24px;">🐾</span><div><strong>你的宠物有新动态！</strong><br>' + event.message + '<br><small style="color:var(--color-accent);">' + event.effect + '</small></div>';
      toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:white;padding:14px 18px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:300;display:flex;align-items:center;gap:12px;font-size:13px;max-width:320px;font-family:var(--font-family);animation:toastIn 400ms ease, toastOut 300ms ease 4s forwards;';
      document.body.appendChild(toast);
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 4500);
    }
  }

  // ==================== 暗色模式（新增） ====================

  function applyDarkMode() {
    var settings = Storage.getSettings();
    var mode = settings.darkMode || 'auto';
    var isDark;

    if (mode === 'auto') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = mode === 'dark';
    }

    document.documentElement.classList.toggle('dark-mode', isDark);
  }

  function toggleDarkMode() {
    var settings = Storage.getSettings();
    var modes = ['auto', 'light', 'dark'];
    var current = modes.indexOf(settings.darkMode || 'auto');
    var next = modes[(current + 1) % 3];
    settings.darkMode = next;
    Storage.updateSettings({ darkMode: next });
    applyDarkMode();
    showToast('🌓 外观：' + (next === 'auto' ? '跟随系统' : (next === 'dark' ? '深色模式' : '浅色模式')));
  }

  // ==================== 用户页 — 增强版（新增） ====================

  function renderUserPage() {
    var user = Storage.getUser();
    var pet = Storage.getPet();

    // 积分
    var pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.textContent = user.points.toLocaleString();

    // 打卡信息
    renderStreakSection();

    // 统计面板
    renderStatsPanel();

    // 成就（带进度条）
    renderAchievements(user);

    // 任务历史
    renderHistory(user.taskHistory);
  }

  function renderStreakSection() {
    var container = document.getElementById('streakSection');
    if (!container) return;

    var streak = Storage.getStreak();
    var today = Storage.getToday();
    var history = streak.streakHistory || [];

    // 最近 7 天打卡热力图
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var dateStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      days.push({
        date: dateStr,
        day: d.getDate(),
        weekday: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        completed: history.indexOf(dateStr) !== -1,
        isToday: dateStr === today
      });
    }

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm);">';
    html += '<h3 style="font-size:var(--font-size-md);color:var(--color-text-title);margin:0;">🔥 连续打卡</h3>';
    html += '<span style="font-size:var(--font-size-lg);font-weight:700;color:var(--color-accent);">' + streak.current + ' 天</span>';
    html += '</div>';
    html += '<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-bottom:var(--space-md);">最长连续 ' + streak.longest + ' 天</div>';

    // 7 天热力图
    html += '<div style="display:flex;gap:6px;justify-content:center;margin-bottom:var(--space-md);">';
    for (var j = 0; j < days.length; j++) {
      var day = days[j];
      var bg = day.completed ? 'var(--color-success)' : 'var(--color-border)';
      var border = day.isToday ? '2px solid var(--color-primary)' : '2px solid transparent';
      var color = day.completed ? 'white' : 'var(--color-text-secondary)';
      html += '<div style="text-align:center;">';
      html += '<div style="width:32px;height:32px;border-radius:8px;background:' + bg + ';border:' + border + ';display:flex;align-items:center;justify-content:center;color:' + color + ';font-size:10px;font-weight:600;">' + day.day + '</div>';
      html += '<div style="font-size:10px;color:var(--color-text-secondary);margin-top:2px;">' + day.weekday + '</div>';
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
  }

  function renderStatsPanel() {
    var container = document.getElementById('statsPanel');
    if (!container) return;

    var stats = Storage.getStats();
    var items = [
      { label: '累计出行', value: stats.totalTrips || 0, icon: '🚶' },
      { label: '赚取积分', value: stats.totalPointsEarned || 0, icon: '🪙' },
      { label: '探索地点', value: stats.totalPlacesExplored || 0, icon: '📍' },
      { label: '完成路线', value: stats.totalRoutesCompleted || 0, icon: '🗺️' }
    ];

    var html = '<h3 style="font-size:var(--font-size-md);color:var(--color-text-title);margin-bottom:var(--space-sm);">📊 使用统计</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      html += '<div style="background:var(--color-bg);border-radius:var(--radius-sm);padding:var(--space-sm) var(--space-md);text-align:center;">';
      html += '<div style="font-size:20px;">' + item.icon + '</div>';
      html += '<div style="font-size:var(--font-size-lg);font-weight:700;color:var(--color-text-title);">' + item.value.toLocaleString() + '</div>';
      html += '<div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">' + item.label + '</div>';
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;
  }

  function renderAchievements(user) {
    var grid = document.getElementById('achievementGrid');
    if (!grid) return;

    var achievements = user.achievements || [];
    var taskCount = (user.taskHistory || []).length;
    var streak = Storage.getStreak();

    // 动态计算成就状态（含进度）
    var allAchievements = [
      { key: 'first_task', icon: '🌱', name: '初次出门', unlocked: taskCount >= 1, progress: Math.min(taskCount, 1), target: 1 },
      { key: 'five_tasks', icon: '🚶', name: '小小行者', unlocked: taskCount >= 5, progress: Math.min(taskCount, 5), target: 5 },
      { key: 'twenty_tasks', icon: '🏃', name: '户外达人', unlocked: taskCount >= 20, progress: Math.min(taskCount, 20), target: 20 },
      { key: 'hundred_tasks', icon: '💯', name: '百次挑战', unlocked: taskCount >= 100, progress: Math.min(taskCount, 100), target: 100 },
      { key: 'hard_ten', icon: '⭐', name: '困难征服者', unlocked: checkHardTasks(user, 10), progress: Math.min(countHardTasks(user), 10), target: 10 },
      { key: 'streak_7', icon: '🔥', name: '坚持一周', unlocked: streak.current >= 7 || streak.longest >= 7, progress: Math.min(streak.current, 7), target: 7 },
      { key: 'streak_30', icon: '👑', name: '月度之星', unlocked: streak.current >= 30 || streak.longest >= 30, progress: Math.min(streak.current, 30), target: 30 }
    ];

    var html = '';
    for (var k = 0; k < allAchievements.length; k++) {
      var ach = allAchievements[k];
      var pct = Math.round((ach.progress / ach.target) * 100);
      html += '<div class="achievement-item">';
      html += '<div class="achievement-icon ' + (ach.unlocked ? 'unlocked' : 'locked') + '">' + (ach.unlocked ? ach.icon : '🔒') + '</div>';
      html += '<div class="achievement-name">' + ach.name + '</div>';
      if (!ach.unlocked) {
        html += '<div class="achievement-progress">' + ach.progress + '/' + ach.target + '</div>';
      }
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  function countHardTasks(user) {
    if (!user.taskHistory) return 0;
    var count = 0;
    for (var i = 0; i < user.taskHistory.length; i++) {
      if (user.taskHistory[i].difficulty === 'hard') count++;
    }
    return count;
  }

  // ==================== 设置页 — 导入导出（新增） ====================

  function exportAppData() {
    var ok = Storage.exportData();
    if (ok) showToast('📦 数据已导出为 JSON 文件');
  }

  function importAppData() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var result = Storage.importData(ev.target.result);
        showToast(result.message);
        if (result.ok) {
          setTimeout(function () { location.reload(); }, 1500);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ==================== 辅助 ====================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==================== 对外暴露 ====================
  return {
    init,
    switchPage,
    refreshTask,
    completeTask,
    feedPet,
    playWithPet,
    selectPet,
    toggleReminder,
    setReminderTime,
    addCustomTask,
    deleteCustomTask,
    renderTaskCard,
    renderPetPage,
    renderUserPage,
    // 引导
    onboardNext,
    onboardSelectPet,
    onboardFinish,
    // 出行页
    exploreNearby,
    refreshAIRoute,
    completeRoute,
    loadAIRouteAsync,
    renderTravelPage,
    // AI 设置
    toggleAI,
    saveAISettings,
    testAIConnection,
    // 定位
    setManualCity,
    // 偏好
    showPreferenceWizard,
    closePreferenceWizard,
    toggleChip,
    selectStyle,
    updateWalkTimeLabel,
    savePreferences,
    // 地图
    showRouteMap,
    closeMap,
    openInMapApp,
    // 教程
    aiTutorialNext,
    skipAITutorial,
    // 反馈
    submitRouteFeedback,
    showAIUnavailablePopup,
    // 暗色模式
    toggleDarkMode,
    // 导入导出
    exportAppData,
    importAppData,
    // DeepSeek
    openDeepSeekReg,
    openDeepSeekChat
  };

})();

document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
