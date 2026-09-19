const storageKeys = {
  session: 'finverse-user-session'
};

const watchlist = [
  { name: 'Parag Parikh Flexi Cap', nav: '₹74.12', change: 1.25, type: 'positive' },
  { name: 'Motilal Midcap', nav: '₹88.91', change: 2.8, type: 'positive' },
  { name: 'Axis Bluechip', nav: '₹54.23', change: -0.9, type: 'negative' }
];

const notifications = [
  { title: 'KYC verification pending', message: 'Review customer profile before market close.', priority: 'High', icon: '⚠️' },
  { title: 'SIP installment due tomorrow', message: 'Auto-debit scheduled for 10:00 AM.', priority: 'Medium', icon: '💸' },
  { title: 'Portfolio review scheduled', message: 'Meeting with client on Friday, 4:30 PM.', priority: 'Low', icon: '📅' }
];

const transactions = [
  { id: 'TXN001', fund: 'PPFC', type: 'Buy', amount: 50000, status: 'Completed', date: '2026-09-12' },
  { id: 'TXN002', fund: 'Axis Bluechip', type: 'SIP', amount: 5000, status: 'Pending', date: '2026-09-10' },
  { id: 'TXN003', fund: 'Motilal Midcap', type: 'Buy', amount: 25000, status: 'Completed', date: '2026-09-09' },
  { id: 'TXN004', fund: 'HDFC Index', type: 'Sell', amount: 18000, status: 'Completed', date: '2026-09-08' },
  { id: 'TXN005', fund: 'Nippon SmallCap', type: 'SIP', amount: 7000, status: 'Pending', date: '2026-09-07' },
  { id: 'TXN006', fund: 'SBI Equity Hybrid', type: 'Buy', amount: 37000, status: 'Completed', date: '2026-09-04' }
];

const state = {
  searchTerm: '',
  sortDirection: 'desc',
  sortField: 'amount',
  currentPage: 1,
  pageSize: 4,
  unreadCount: notifications.length
};

function getSessionUser() {
  try {
    const raw = localStorage.getItem(storageKeys.session);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function redirectToLogin() {
  window.location.href = 'index.html';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(dateValue) {
  return new Date(dateValue).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  clearTimeout(showToast.timerId);
  showToast.timerId = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function setInitialSession() {
  const sessionUser = getSessionUser();
  const username = sessionUser.username || '';
  const userRole = sessionUser.role || '';

  if (!username || !userRole) {
    redirectToLogin();
    return null;
  }

  document.getElementById('sidebar-user-name').textContent = username;
  document.getElementById('profile-name').textContent = username;
  document.getElementById('sidebar-user-role').textContent = userRole;
  document.getElementById('profile-role').textContent = userRole;
  document.getElementById('welcome-text').textContent = `Welcome Back, ${username}`;
  document.getElementById('role-badge').textContent = userRole;
  document.getElementById('sidebar-avatar').textContent = username.charAt(0).toUpperCase();
  document.getElementById('profile-avatar').textContent = username.charAt(0).toUpperCase();

  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  return sessionUser;
}

function renderWatchlist() {
  const container = document.getElementById('watchlist-list');
  if (!container) return;

  const filtered = watchlist.filter((fund) => {
    const haystack = `${fund.name} ${fund.nav}`.toLowerCase();
    return haystack.includes(state.searchTerm.toLowerCase());
  });

  container.innerHTML = filtered.map((fund) => `
    <div class="watch-card">
      <div>
        <h4>${fund.name}</h4>
        <div class="nav-row">
          <span>NAV:</span>
          <strong>${fund.nav}</strong>
        </div>
      </div>
      <div class="change ${fund.type}">${fund.change > 0 ? '+' : ''}${fund.change}%</div>
    </div>
  `).join('');
}

function renderNotificationsPanel() {
  const container = document.getElementById('notification-panel-list');
  if (!container) return;

  container.innerHTML = notifications.map((item) => `
    <div class="notify-item">
      <div class="icon">${item.icon}</div>
      <div class="notify-copy">
        <strong>${item.title}</strong>
        <p>${item.message}</p>
      </div>
      <span class="notify-badge ${item.priority.toLowerCase()}">${item.priority}</span>
    </div>
  `).join('');
}

function renderNotificationDropdown() {
  const container = document.getElementById('notification-list');
  const badge = document.getElementById('notification-count');
  if (!container || !badge) return;

  container.innerHTML = notifications.map((item) => `
    <div class="notification-item">
      <span class="notification-dot" style="background:${item.priority === 'High' ? '#ef4444' : item.priority === 'Medium' ? '#f59e0b' : '#16a34a'}"></span>
      <div style="flex:1">
        <strong>${item.title}</strong>
        <span>${item.message}</span>
        <div class="priority-tag priority-${item.priority.toLowerCase()}">${item.priority}</div>
      </div>
    </div>
  `).join('');

  badge.textContent = Math.max(state.unreadCount, 0);
}

function getFilteredTransactions() {
  const filterValue = state.searchTerm.trim().toLowerCase();
  const list = [...transactions];

  const filtered = list.filter((txn) => {
    const haystack = `${txn.id} ${txn.fund} ${txn.type}`.toLowerCase();
    return haystack.includes(filterValue);
  });

  const sorted = filtered.sort((a, b) => {
    if (state.sortField === 'amount') {
      return state.sortDirection === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
    const aDate = new Date(a.date).getTime();
    const bDate = new Date(b.date).getTime();
    return state.sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
  });

  return sorted;
}

function renderTransactions() {
  const tableBody = document.getElementById('transaction-table-body');
  const pageIndicator = document.getElementById('page-indicator');
  if (!tableBody || !pageIndicator) return;

  const filtered = getFilteredTransactions();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  const items = filtered.slice(start, end);

  tableBody.innerHTML = items.map((txn) => `
    <tr>
      <td>${txn.id}</td>
      <td>${txn.fund}</td>
      <td>${txn.type}</td>
      <td>${formatCurrency(txn.amount)}</td>
      <td><span class="status-pill ${txn.status === 'Completed' ? 'status-completed' : 'status-pending'}">${txn.status}</span></td>
      <td>${formatDate(txn.date)}</td>
    </tr>
  `).join('');

  pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;

  document.getElementById('prev-page').disabled = state.currentPage === 1;
  document.getElementById('next-page').disabled = state.currentPage === totalPages;
}

function animateValue(element, targetValue, prefix = '', suffix = '') {
  if (!element) return;
  const duration = 1200;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = targetValue * eased;

    const formatted = Number.isInteger(targetValue)
      ? `${prefix}${Math.round(current).toLocaleString('en-IN')}${suffix}`
      : `${prefix}${current.toFixed(2)}${suffix}`;

    element.textContent = formatted;

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function renderKpis() {
  const cards = document.querySelectorAll('.card-value');
  cards.forEach((card) => {
    const target = Number(card.dataset.value || 0);
    const prefix = card.dataset.prefix || '';
    const suffix = card.dataset.suffix || '';
    animateValue(card, target, prefix, suffix);
  });
}

function setupGlobalSearch() {
  const searchInput = document.querySelector('[data-testid="global-search"]');
  if (!searchInput) return;

  searchInput.addEventListener('input', (event) => {
    state.searchTerm = event.target.value;
    renderWatchlist();
    renderTransactions();
  });
}

function setupNotificationBell() {
  const bellButton = document.querySelector('[data-testid="notification-icon"]');
  const dropdown = document.querySelector('[data-testid="notification-dropdown"]');
  const markReadButton = document.getElementById('mark-read-button');

  if (!bellButton || !dropdown) return;

  bellButton.addEventListener('click', () => {
    dropdown.classList.toggle('hidden');
  });

  markReadButton.addEventListener('click', () => {
    state.unreadCount = 0;
    renderNotificationDropdown();
    showToast('All notifications marked as read.', 'success');
  });

  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target) && !bellButton.contains(event.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

function setupProfileMenu() {
  const button = document.querySelector('[data-testid="profile-menu"]');
  const menu = document.querySelector('.profile-dropdown');
  const logout = document.getElementById('profile-logout');

  if (!button || !menu) return;

  button.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });

  logout.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && !button.contains(event.target)) {
      menu.classList.add('hidden');
    }
  });
}

function setupSidebarLogout() {
  const logoutButton = document.querySelector('[data-testid="logout-button"]');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
  });
}

function setupQuickActions() {
  const actions = document.querySelectorAll('.action-btn');
  actions.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      const redirectMap = {
        onboarding: 'onboarding.html',
        funds: 'funds.html',
        trade: 'trade-center.html',
        report: 'reports.html'
      };

      window.location.href = redirectMap[action] || 'index.html';
    });
  });
}

function setupTableControls() {
  const amountButton = document.getElementById('sort-amount');
  const dateButton = document.getElementById('sort-date');
  const searchInput = document.getElementById('transaction-search');
  const prevButton = document.getElementById('prev-page');
  const nextButton = document.getElementById('next-page');

  if (amountButton) {
    amountButton.addEventListener('click', () => {
      state.sortField = 'amount';
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      state.currentPage = 1;
      renderTransactions();
    });
  }

  if (dateButton) {
    dateButton.addEventListener('click', () => {
      state.sortField = 'date';
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      state.currentPage = 1;
      renderTransactions();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.searchTerm = event.target.value;
      state.currentPage = 1;
      renderTransactions();
    });
  }

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage -= 1;
        renderTransactions();
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      const filtered = getFilteredTransactions();
      const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
      if (state.currentPage < totalPages) {
        state.currentPage += 1;
        renderTransactions();
      }
    });
  }
}

function revealDashboardCards() {
  const cards = document.querySelectorAll('.kpi-card');
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 120 + index * 120);
  });
}

function initializeDashboard() {
  const sessionUser = setInitialSession();
  if (!sessionUser) return;

  renderKpis();
  renderWatchlist();
  renderNotificationsPanel();
  renderNotificationDropdown();
  renderTransactions();
  setupGlobalSearch();
  setupNotificationBell();
  setupProfileMenu();
  setupSidebarLogout();
  setupQuickActions();
  setupTableControls();
  revealDashboardCards();

  showToast('Portfolio refreshed successfully', 'success');

  const skeleton = document.getElementById('skeleton-overlay');
  if (skeleton) {
    setTimeout(() => {
      skeleton.classList.add('hidden');
    }, 1000);
  }
}

document.addEventListener('DOMContentLoaded', initializeDashboard);
