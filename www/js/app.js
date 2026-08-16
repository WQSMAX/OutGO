/* ============================================
   宅家激励 App — 主控制器
   负责：导航切换、页面渲染、事件协调
   ============================================ */

const App = (function () {
  'use strict';

  // ==================== 页面配置 ====================
  const PAGES = {
    home: { title: '☀️ 今日任务', sub: '完成户外任务，赚积分养宠物！' },
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

    // 3. 渲染所有页面
    renderAllPages();

    // 4. 绑定导航
    bindNavigation();

    // 5. 导航切换时自动刷新
    bindPageRefresh();

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
    document.getElementById('onboardStep1').classList.remove('hidden');
    document.getElementById('onboardStep2').classList.add('hidden');
    document.getElementById('onboardStep3').classList.add('hidden');
    onboardSelectedPet = 'cat';
  }

  function onboardNext(step) {
    // 隐藏所有步骤
    document.getElementById('onboardStep1').classList.add('hidden');
    document.getElementById('onboardStep2').classList.add('hidden');
    document.getElementById('onboardStep3').classList.add('hidden');

    // 显示目标步骤
    if (step === 2) {
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
    const state = Pet.getPetState();
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
    // 阶段 6 完整实现
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
    onboardFinish
  };

})();

document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
