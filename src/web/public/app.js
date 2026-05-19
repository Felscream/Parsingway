// State Management
const state = {
  activeTab: 'active-reports',
  trackedReports: [],
  history: [],
  historySearchQuery: '',
  refreshInterval: null,
  countdownInterval: null
};

// Configuration
const MAX_TTL_SECONDS = 5400; // standard 90 minutes from server configuration

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const globalRefreshBtn = document.getElementById('global-refresh-btn');
const activeReportsGrid = document.getElementById('reports-grid');
const historyTableBody = document.getElementById('history-table-body');
const historySearchInput = document.getElementById('history-search');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const activeCountBadge = document.getElementById('active-count-badge');
const historyCountBadge = document.getElementById('history-count-badge');
const activeReportsCount = document.getElementById('active-reports-count');
const serverCount = document.getElementById('server-count');
const toastContainer = document.getElementById('toast-container');

// Initialize Lucide Icons
function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Navigation Tab Management
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabId = item.getAttribute('data-tab');
    switchTab(tabId);
  });
});

function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Update nav buttons
  navItems.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update sections
  tabContents.forEach(content => {
    if (content.id === `${tabId}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Update header text
  if (tabId === 'active-reports') {
    pageTitle.textContent = 'Tracked Reports';
    pageSubtitle.textContent = 'Real-time FF Logs active update dashboard';
    globalRefreshBtn.style.display = 'inline-flex';
  } else if (tabId === 'history') {
    pageTitle.textContent = 'History Log';
    pageSubtitle.textContent = 'List of all reports received from Discord messages';
    globalRefreshBtn.style.display = 'none';
  } else if (tabId === 'activity') {
    pageTitle.textContent = 'Activity Stats';
    pageSubtitle.textContent = 'Real-time bot performance and activity analytics';
    globalRefreshBtn.style.display = 'inline-flex';
  }

  fetchData();
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span class="toast-message">${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  initIcons();

  // Fade out and remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// Time Formatting Helpers
function formatRemainingTime(seconds) {
  if (seconds <= 0) return 'Expired';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

// Render Tracked Reports
function renderTrackedReports() {
  if (state.trackedReports.length === 0) {
    activeReportsGrid.innerHTML = `
      <div class="empty-state">
        <i data-lucide="shield-alert"></i>
        <h4>No active report trackers</h4>
        <p>Post an FF Logs link on Discord to automatically start tracking encounter progress.</p>
      </div>
    `;
    activeCountBadge.textContent = '0';
    activeReportsCount.textContent = '0';
    serverCount.textContent = '0';
    initIcons();
    return;
  }

  activeCountBadge.textContent = state.trackedReports.length;
  activeReportsCount.textContent = state.trackedReports.length;
  
  // Count unique servers
  const uniqueServers = new Set(state.trackedReports.map(r => r.serverId));
  serverCount.textContent = uniqueServers.size;

  activeReportsGrid.innerHTML = state.trackedReports.map(report => {
    const isError = report.errorCount > 0;
    const progressPercent = Math.min(100, Math.max(0, (report.remainingSeconds / MAX_TTL_SECONDS) * 100));
    const isCritical = report.remainingSeconds < 600; // less than 10 minutes left
    const remainingTimeStr = formatRemainingTime(report.remainingSeconds);
    const iconUrl = report.thumbnailUrl || 'https://xivapi.com/img-misc/chat_messengericon_raids.png';

    return `
      <div class="report-card" data-server-id="${report.serverId}">
        <div class="report-card-header">
          <img src="${iconUrl}" class="boss-icon" alt="Boss Icon">
          <div class="header-details">
            <a href="${report.reportUrl}" target="_blank" class="report-code-badge" title="Open FF Logs report">
              <span>${report.reportCode}</span>
              <i data-lucide="external-link"></i>
            </a>
            <span class="report-status-pill ${isError ? 'error' : 'tracking'}">
              ${isError ? `Error (${report.errorCount})` : 'Tracking'}
            </span>
          </div>
        </div>

        <div class="report-details">
          <div class="detail-row">
            <span class="detail-label">Submitter</span>
            <span class="detail-value">${report.owner}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Server ID</span>
            <span class="detail-value" title="${report.serverId}">${report.serverId.substring(0, 12)}...</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Channel ID</span>
            <span class="detail-value" title="${report.channelId}">${report.channelId.substring(0, 12)}...</span>
          </div>

          <div class="expiry-progress-container">
            <div class="expiry-label-row">
              <span>Time Tracking Remaining</span>
              <span class="countdown-text" data-remaining="${report.remainingSeconds}">${remainingTimeStr}</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${isCritical ? 'critical' : ''}" style="width: ${progressPercent}%"></div>
            </div>
          </div>
        </div>

        <div class="report-card-actions">
          <button class="btn btn-secondary btn-refresh-report" data-server-id="${report.serverId}">
            <i data-lucide="refresh-cw"></i>
            <span>Refresh</span>
          </button>
          <button class="btn btn-danger btn-delete-report" data-server-id="${report.serverId}">
            <i data-lucide="square-slash"></i>
            <span>Stop</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  initIcons();
  attachCardEvents();
}

// Card Event Handlers
function attachCardEvents() {
  // Refresh Button
  document.querySelectorAll('.btn-refresh-report').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverId = btn.getAttribute('data-server-id');
      const icon = btn.querySelector('i');
      
      icon.classList.add('spin-anim');
      btn.disabled = true;

      try {
        const response = await fetch(`/api/reports/${serverId}/refresh`, { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          if (data.updated) {
            showToast(`Report updated with new logs!`, 'success');
          } else {
            showToast(`Report checked. No new logs found on FF Logs.`, 'info');
          }
          fetchData();
        } else {
          const errData = await response.json();
          showToast(errData.error || 'Failed to trigger update', 'error');
        }
      } catch (err) {
        showToast('Error sending refresh command', 'error');
      } finally {
        icon.classList.remove('spin-anim');
        btn.disabled = false;
      }
    });
  });

  // Stop Tracking Button
  document.querySelectorAll('.btn-delete-report').forEach(btn => {
    let deleteTimeout = null;
    
    function resetDeleteButton() {
      if (deleteTimeout) {
        clearTimeout(deleteTimeout);
        deleteTimeout = null;
      }
      btn.classList.remove('confirming');
      const span = btn.querySelector('span');
      const icon = btn.querySelector('i');
      
      if (btn.dataset.originalText) {
        span.textContent = btn.dataset.originalText;
      }
      if (icon && btn.dataset.originalIcon) {
        icon.setAttribute('data-lucide', btn.dataset.originalIcon);
        if (window.lucide) window.lucide.createIcons();
      }
    }
    
    btn.addEventListener('click', async () => {
      const isConfirming = btn.classList.contains('confirming');
      const serverId = btn.getAttribute('data-server-id');
      
      if (!isConfirming) {
        btn.classList.add('confirming');
        const span = btn.querySelector('span');
        const icon = btn.querySelector('i');
        
        btn.dataset.originalText = span.textContent;
        if (icon) {
          btn.dataset.originalIcon = icon.getAttribute('data-lucide');
          icon.setAttribute('data-lucide', 'help-circle');
          if (window.lucide) window.lucide.createIcons();
        }
        
        span.textContent = 'Are you sure?';
        
        deleteTimeout = setTimeout(() => {
          resetDeleteButton();
        }, 3000);
      } else {
        resetDeleteButton();
        try {
          const response = await fetch(`/api/reports/${serverId}`, { method: 'DELETE' });
          if (response.ok) {
            showToast(`Stopped tracking report for server ${serverId}`, 'success');
            fetchData();
          } else {
            showToast('Failed to stop tracking', 'error');
          }
        } catch (err) {
          showToast('Error sending stop command', 'error');
        }
      }
    });
  });
}

// Render History Log
function renderHistory() {
  const filtered = state.history.filter(item => {
    const query = state.historySearchQuery.toLowerCase();
    return (
      item.reportCode.toLowerCase().includes(query) ||
      item.owner.toLowerCase().includes(query) ||
      item.serverId.toLowerCase().includes(query) ||
      item.channelId.toLowerCase().includes(query)
    );
  });

  historyCountBadge.textContent = state.history.length;

  if (filtered.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          <i data-lucide="history"></i>
          <p>${state.history.length === 0 ? 'No history logs found.' : 'No matching reports found.'}</p>
        </td>
      </tr>
    `;
    initIcons();
    return;
  }

  historyTableBody.innerHTML = filtered.map(item => {
    return `
      <tr>
        <td>
          <div class="time-stamp" title="${new Date(item.receivedAt).toLocaleString()}">
            ${formatRelativeTime(item.receivedAt)}
          </div>
        </td>
        <td>
          <div class="code-with-icon">
            <img src="${item.thumbnailUrl || 'https://xivapi.com/img-misc/chat_messengericon_raids.png'}" class="boss-icon-small" alt="Icon">
            <a href="${item.reportUrl}" target="_blank" class="report-code-badge" title="Open FF Logs report">
              <span>${item.reportCode}</span>
              <i data-lucide="external-link"></i>
            </a>
          </div>
        </td>
        <td><span class="detail-value">${item.owner}</span></td>
        <td><span class="time-stamp" title="${item.serverId}">${item.serverId.substring(0, 16)}...</span></td>
        <td><span class="time-stamp" title="${item.channelId}">${item.channelId.substring(0, 16)}...</span></td>
        <td>
          <a href="${item.reportUrl}" target="_blank" class="btn btn-secondary btn-icon-only" title="Open FF Logs">
            <i data-lucide="external-link"></i>
          </a>
        </td>
      </tr>
    `;
  }).join('');

  initIcons();
}

// Fetch Data from Server APIs
async function fetchData() {
  try {
    const [reportsRes, historyRes, activityRes] = await Promise.all([
      fetch('/api/reports'),
      fetch('/api/history'),
      fetch('/api/activity')
    ]);

    if (reportsRes.ok) {
      state.trackedReports = await reportsRes.json();
      activeCountBadge.textContent = state.trackedReports.length;
    }
    if (historyRes.ok) {
      state.history = await historyRes.json();
      historyCountBadge.textContent = state.history.length;
    }
    if (activityRes.ok) {
      state.activity = await activityRes.json();
    }

    if (state.activeTab === 'active-reports') {
      renderTrackedReports();
    } else if (state.activeTab === 'history') {
      renderHistory();
    } else if (state.activeTab === 'activity') {
      renderActivity(state.activity);
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    showToast('Failed to sync dashboard data with server', 'error');
  }
}

// Start Countdown Timers for UI
function startCountdowns() {
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  
  state.countdownInterval = setInterval(() => {
    document.querySelectorAll('.countdown-text').forEach(el => {
      let seconds = parseInt(el.getAttribute('data-remaining'), 10);
      if (isNaN(seconds)) return;
      
      if (seconds > 0) {
        seconds--;
        el.setAttribute('data-remaining', seconds);
        el.textContent = formatRemainingTime(seconds);
        
        // Update progress bar
        const card = el.closest('.report-card');
        if (card) {
          const fill = card.querySelector('.progress-bar-fill');
          if (fill) {
            const percent = Math.min(100, Math.max(0, (seconds / MAX_TTL_SECONDS) * 100));
            fill.style.width = `${percent}%`;
            if (seconds < 600) {
              fill.classList.add('critical');
            }
          }
        }
      } else {
        el.textContent = 'Expired';
        // Auto refresh reports data if one expires
        fetchData();
      }
    });
  }, 1000);
}

// Setup Event Listeners
globalRefreshBtn.addEventListener('click', () => {
  const icon = globalRefreshBtn.querySelector('i');
  icon.classList.add('spin-anim');
  globalRefreshBtn.disabled = true;
  
  fetchData().finally(() => {
    setTimeout(() => {
      icon.classList.remove('spin-anim');
      globalRefreshBtn.disabled = false;
      showToast('Dashboard data refreshed', 'success');
    }, 500);
  });
});

historySearchInput.addEventListener('input', (e) => {
  state.historySearchQuery = e.target.value;
  renderHistory();
});

let clearHistoryTimeout = null;

function resetClearHistoryButton() {
  if (clearHistoryTimeout) {
    clearTimeout(clearHistoryTimeout);
    clearHistoryTimeout = null;
  }
  clearHistoryBtn.classList.remove('confirming');
  const span = clearHistoryBtn.querySelector('span');
  const icon = clearHistoryBtn.querySelector('i');
  
  if (clearHistoryBtn.dataset.originalText) {
    span.textContent = clearHistoryBtn.dataset.originalText;
  }
  if (icon && clearHistoryBtn.dataset.originalIcon) {
    icon.setAttribute('data-lucide', clearHistoryBtn.dataset.originalIcon);
    if (window.lucide) window.lucide.createIcons();
  }
}

clearHistoryBtn.addEventListener('click', async () => {
  const isConfirming = clearHistoryBtn.classList.contains('confirming');
  
  if (!isConfirming) {
    clearHistoryBtn.classList.add('confirming');
    const span = clearHistoryBtn.querySelector('span');
    const icon = clearHistoryBtn.querySelector('i');
    
    clearHistoryBtn.dataset.originalText = span.textContent;
    if (icon) {
      clearHistoryBtn.dataset.originalIcon = icon.getAttribute('data-lucide');
      icon.setAttribute('data-lucide', 'help-circle');
      if (window.lucide) window.lucide.createIcons();
    }
    
    span.textContent = 'Are you sure?';
    
    clearHistoryTimeout = setTimeout(() => {
      resetClearHistoryButton();
    }, 3000);
  } else {
    resetClearHistoryButton();
    try {
      const response = await fetch('/api/history/clear', { method: 'DELETE' });
      if (response.ok) {
        showToast('Report history log cleared', 'success');
        fetchData();
      } else {
        showToast('Failed to clear history', 'error');
      }
    } catch (err) {
      showToast('Error sending clear command', 'error');
    }
  }
});

// Render Activity Stats Tab content
function renderActivity(stats) {
  // Elements
  const reqPerHourEl = document.getElementById('activity-req-per-hour');
  const uniqueServersEl = document.getElementById('activity-unique-servers');
  const uptimeEl = document.getElementById('activity-uptime');
  const memoryEl = document.getElementById('activity-memory');
  
  const avgFetchLatencyEl = document.getElementById('avg-fetch-latency');
  const avgResponseLatencyEl = document.getElementById('avg-response-latency');
  
  const successRatePctEl = document.getElementById('success-rate-pct');
  const successRateFillEl = document.getElementById('success-rate-fill');
  
  const metricSuccessCountEl = document.getElementById('metric-success-count');
  const metricFailureCountEl = document.getElementById('metric-failure-count');
  const metricCooldownCountEl = document.getElementById('metric-cooldown-count');

  if (reqPerHourEl) reqPerHourEl.textContent = stats.requestsPerHour;
  if (uniqueServersEl) uniqueServersEl.textContent = stats.uniqueServersCount;
  if (uptimeEl) uptimeEl.textContent = formatUptime(stats.uptimeSeconds);
  if (memoryEl) memoryEl.textContent = `${stats.memoryHeapUsedMb} MB`;
  
  if (avgFetchLatencyEl) avgFetchLatencyEl.textContent = `${stats.avgFetchTimeMs} ms`;
  if (avgResponseLatencyEl) avgResponseLatencyEl.textContent = `${stats.avgResponseTimeMs} ms`;
  
  const totalOps = stats.successCount + stats.failureCount;
  const successRate = totalOps === 0 ? 0 : Math.round((stats.successCount / totalOps) * 100);
  
  if (successRatePctEl) successRatePctEl.textContent = `${successRate}%`;
  if (successRateFillEl) successRateFillEl.style.width = `${successRate}%`;
  
  if (metricSuccessCountEl) metricSuccessCountEl.textContent = stats.successCount;
  if (metricFailureCountEl) metricFailureCountEl.textContent = stats.failureCount;
  if (metricCooldownCountEl) metricCooldownCountEl.textContent = stats.cooldownBlocks;

  // Draw sparkline SVG charts
  drawSparkline('fetch-sparkline', stats.fetchHistory, '#8b5cf6');
  drawSparkline('response-sparkline', stats.responseHistory, '#0ea5e9');
}

// Uptime Formatter
function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Dynamically draws responsive SVG sparklines with interactive tooltips
function drawSparkline(containerId, history, strokeColor = '#8b5cf6') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!history || history.length < 2) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:var(--text-muted);">
        Awaiting more activity data...
      </div>
    `;
    return;
  }
  
  const width = container.clientWidth || 400;
  const height = 90;
  const padding = 10;
  
  const minVal = Math.min(...history);
  const maxVal = Math.max(...history);
  const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;
  
  const points = history.map((val, idx) => {
    const x = padding + (idx / (history.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
    return { x, y, val };
  });
  
  const pathD = points.reduce((acc, p, idx) => {
    return acc + (idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
  }, '');
  
  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const gradId = `${containerId}-gradient`;
  
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${height/2}" x2="${width}" y2="${height/2}" class="sparkline-grid-line" />
      <line x1="0" y1="${height - padding}" x2="${width}" y2="${height - padding}" class="sparkline-grid-line" />
      <path d="${fillD}" class="sparkline-fill" fill="url(#${gradId})" />
      <path d="${pathD}" class="sparkline-path" stroke="${strokeColor}" />
      <line class="sparkline-tracker-line" x1="0" y1="0" x2="0" y2="${height}" style="display: none;" />
      <circle class="sparkline-tracker-dot" r="5" cx="0" cy="0" fill="${strokeColor}" style="display: none;" />
    </svg>
    <div class="sparkline-tooltip"></div>
  `;

  const svg = container.querySelector('svg');
  const trackerLine = container.querySelector('.sparkline-tracker-line');
  const trackerDot = container.querySelector('.sparkline-tracker-dot');
  const tooltip = container.querySelector('.sparkline-tooltip');

  function updateTracker(e) {
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    const svgWidth = rect.width;
    const scaleX = width / svgWidth;
    const svgMouseX = mouseX * scaleX;

    let closestPoint = points[0];
    let minDist = Math.abs(points[0].x - svgMouseX);
    let closestIndex = 0;
    
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - svgMouseX);
      if (dist < minDist) {
        minDist = dist;
        closestPoint = points[i];
        closestIndex = i;
      }
    }

    trackerLine.setAttribute('x1', closestPoint.x);
    trackerLine.setAttribute('x2', closestPoint.x);
    trackerLine.style.display = 'block';

    trackerDot.setAttribute('cx', closestPoint.x);
    trackerDot.setAttribute('cy', closestPoint.y);
    trackerDot.style.display = 'block';

    const tooltipX = closestPoint.x / scaleX;
    const scaleY = rect.height / height;
    const tooltipY = closestPoint.y * scaleY;

    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${tooltipY}px`;
    tooltip.style.display = 'block';

    const unit = containerId.includes('fetch') ? 'ms' : 'ms';
    tooltip.innerHTML = `
      <strong style="color: ${strokeColor}">Point #${closestIndex + 1}</strong>: ${closestPoint.val} ${unit}
    `;
  }

  function hideTracker() {
    trackerLine.style.display = 'none';
    trackerDot.style.display = 'none';
    tooltip.style.display = 'none';
  }

  container.addEventListener('mousemove', updateTracker);
  container.addEventListener('mouseleave', hideTracker);
}

// Setup Auto-sync every 10 seconds
// (Removed outdated inline confirm references)
function startAutoRefresh() {
  if (state.refreshInterval) clearInterval(state.refreshInterval);
  state.refreshInterval = setInterval(fetchData, 10000);
}

// Init Function
function init() {
  initIcons();
  fetchData();
  startCountdowns();
  startAutoRefresh();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
