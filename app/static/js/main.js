/* ============================================================================
   Gap2Growth - Main JavaScript
   ============================================================================ */

// ========== DOM CONTENT LOADED ==========
document.addEventListener('DOMContentLoaded', function () {
    console.log('Gap2Growth - Application Loaded');

    // Auto-dismiss alerts after 5 seconds (except persistent ones)
    const alerts = document.querySelectorAll('.alert:not(.persistent)');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });

    // Staggered card animation
    const cards = document.querySelectorAll('.card, .stat-card, .activity-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
        card.classList.add('fade-in');
    });

    // Form select state handler
    document.querySelectorAll('.form-select').forEach(select => {
        select.addEventListener('change', function () {
            if (this.value) {
                this.classList.add('has-value');
            } else {
                this.classList.remove('has-value');
            }
        });
    });

    // Initialize notification polling if container or badge is present
    if (typeof notifications !== 'undefined' && notifications.init) {
        notifications.init();
    }
});


// ========== API CLIENT ==========
const api = {
    async get(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        } catch (error) {
            console.error('API GET Error:', error);
            throw error;
        }
    },

    async post(url, data = {}) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        } catch (error) {
            console.error('API POST Error:', error);
            throw error;
        }
    }
};


// ========== NOTIFICATIONS SERVICE ==========
const notifications = {
    items: [],
    count: 0,
    badge: null,
    container: null,

    init() {
        this.badge = document.getElementById('notification-badge');
        this.container = document.getElementById('notification-list');
        if (this.badge || this.container) {
            this.fetch();
            this.startPolling();
        }
    },

    async fetch() {
        try {
            const data = await api.get('/api/notifications');
            this.items = data.notifications || [];
            this.count = data.unread_count || 0;
            this.updateBadge();
            this.render();
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    },

    updateBadge() {
        if (!this.badge) return;
        if (this.count > 0) {
            this.badge.textContent = this.count > 99 ? '99+' : this.count;
            this.badge.style.display = 'flex';
        } else {
            this.badge.style.display = 'none';
        }
    },

    render() {
        if (!this.container) return;
        if (this.items.length === 0) {
            this.container.innerHTML = '<div class="empty-state">No notifications</div>';
            return;
        }
        this.container.innerHTML = this.items.slice(0, 5).map(n => `
            <div class="notification-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
                <div class="notification-icon ${n.type || 'info'}">
                    <i class="bi bi-${this.getIcon(n.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${escapeHtml(n.title)}</div>
                    <div class="notification-message">${escapeHtml(n.message)}</div>
                    <div class="notification-time">${formatTime(n.created_at)}</div>
                </div>
            </div>
        `).join('');

        this.container.querySelectorAll('.notification-item.unread').forEach(item => {
            item.addEventListener('click', () => this.markAsRead(item.dataset.id));
        });
    },

    getIcon(type) {
        const icons = {
            free_time: 'clock',
            recommendation: 'lightbulb',
            cancellation: 'x-circle',
            announcement: 'megaphone',
            reminder: 'bell',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    },

    async markAsRead(id) {
        try {
            await api.post(`/api/notifications/${id}/read`);
            const item = this.items.find(n => n.id === id);
            if (item) item.is_read = true;
            this.count = Math.max(0, this.count - 1);
            this.updateBadge();
            this.render();
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    },

    startPolling() {
        setInterval(() => this.fetch(), 30000);
    }
};

// Mark a single notification as read
function markNotificationRead(notificationId) {
    api.post(`/student/notifications/${notificationId}/read`)
        .then(() => {
            const item = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (item) item.classList.remove('unread');
        })
        .catch(err => console.error('Failed to mark notification as read:', err));
}

// Mark all notifications as read
function markAllNotificationsRead() {
    api.post('/api/notifications/read-all')
        .then(() => {
            document.querySelectorAll('.notification-item.unread')
                .forEach(item => item.classList.remove('unread'));
            showToast('All notifications marked as read', 'success');
        })
        .catch(err => console.error('Failed to mark all notifications as read:', err));
}


// ========== STUDENT ACTIVITY TRACKING ==========
function startActivity(activityId) {
    api.post(`/student/activity/${activityId}/start`)
        .then(data => {
            if (data.success) {
                showToast('Activity started! Good luck!', 'success');
                sessionStorage.setItem('currentActivityLog', data.log_id);
                setTimeout(() => location.reload(), 1500);
            }
        })
        .catch(err => {
            console.error('Failed to start activity:', err);
            showToast('Failed to start activity. Please try again.', 'danger');
        });
}

function completeActivity(logId) {
    api.post(`/student/activity/${logId}/complete`)
        .then(data => {
            if (data.success) {
                showToast('Activity completed! Great job! 🎉', 'success');
                sessionStorage.removeItem('currentActivityLog');
                setTimeout(() => location.reload(), 1500);
            }
        })
        .catch(err => {
            console.error('Failed to complete activity:', err);
            showToast('Failed to complete activity. Please try again.', 'danger');
        });
}


// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container') || document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;

    const icons = {
        success: '✅',
        danger: '❌',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-text">${escapeHtml(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        font-size: 14px;
        animation: slideIn 0.3s ease;
        border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'danger' || type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Inject animation styles if not already present
if (!document.querySelector('#toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        .toast-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #9ca3af;
            padding: 0;
            line-height: 1;
        }
        .toast-close:hover { color: #374151; }
    `;
    document.head.appendChild(style);
}


// ========== UTILITY FUNCTIONS ==========

/**
 * Format time string in 12-hour format
 * @param {string} timeString - Time in 24-hour format (HH:MM)
 * @returns {string} Time in 12-hour format
 */
function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Format a date object or string into a readable format
 * @param {Date|string} date - Date to format
 * @param {string} format - 'short', 'medium', 'long'
 * @returns {string} Formatted date string
 */
function formatDate(date, format = 'medium') {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';

    const options = {
        short: { month: 'numeric', day: 'numeric' },
        medium: { month: 'short', day: 'numeric', year: 'numeric' },
        long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    };

    return d.toLocaleDateString('en-US', options[format] || options.medium);
}

/**
 * Format duration in minutes into readable text
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0 mins';
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Calculate duration between two times
 * @param {string} start - Start time (HH:MM)
 * @param {string} end - End time (HH:MM)
 * @returns {string} Duration in human-readable format
 */
function calculateDuration(start, end) {
    if (!start || !end) return '';
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
}

/**
 * Format relative time (e.g. "5 mins ago")
 * @param {string} dateString
 * @returns {string}
 */
function formatRelativeTime(dateString) {
    if (!dateString) return 'Just now';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
}

/**
 * Debounce a function to limit execution rate
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Escape HTML special characters
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Show confirmation dialog
 * @param {string} message
 * @param {Function} callback
 */
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

/**
 * Delete item with confirmation
 * @param {string} url
 * @param {string} itemName
 */
function deleteItem(url, itemName) {
    confirmAction(`Are you sure you want to delete ${itemName}?`, () => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = url;
        document.body.appendChild(form);
        form.submit();
    });
}

/**
 * Initialize table search
 * @param {string} searchInputId
 * @param {string} tableId
 */
function initializeTableSearch(searchInputId, tableId) {
    const searchInput = document.getElementById(searchInputId);
    const table = document.getElementById(tableId);

    if (!searchInput || !table) return;

    searchInput.addEventListener('input', debounce(function (e) {
        const query = e.target.value.toLowerCase();
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    }, 200));
}


// ========== DOM MANIPULATION HELPERS ==========

function getElement(id) {
    return document.getElementById(id);
}

function getElements(selector) {
    return document.querySelectorAll(selector);
}

function onClick(id, handler) {
    const element = getElement(id);
    if (element) {
        element.addEventListener('click', handler);
    }
}


// ========== FORM VALIDATION ==========

function isValidEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

function validatePassword(password) {
    const result = {
        score: 0,
        feedback: []
    };

    if (password.length >= 8) {
        result.score++;
    } else {
        result.feedback.push('At least 8 characters');
    }

    if (/[A-Z]/.test(password)) {
        result.score++;
    } else {
        result.feedback.push('One uppercase letter');
    }

    if (/[a-z]/.test(password)) {
        result.score++;
    } else {
        result.feedback.push('One lowercase letter');
    }

    if (/[0-9]/.test(password)) {
        result.score++;
    } else {
        result.feedback.push('One number');
    }

    return result;
}

function showFieldError(field, message) {
    clearFieldError(field);
    field.classList.add('is-invalid');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(field) {
    field.classList.remove('is-invalid');
    const existingError = field.parentNode.querySelector('.invalid-feedback');
    if (existingError) {
        existingError.remove();
    }
}


// ========== LOCAL STORAGE HELPERS ==========

function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

function getFromStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error('Error reading from localStorage:', e);
        return null;
    }
}

function removeFromStorage(key) {
    localStorage.removeItem(key);
}


// ========== LOADING STATE MANAGEMENT ==========

function showButtonLoading(button, loadingText = 'Loading...') {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status"></span>
        ${loadingText}
    `;
}

function hideButtonLoading(button) {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
}

function showPageLoading() {
    let overlay = getElement('page-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'page-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255,255,255,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        overlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;"></div>
                <p class="text-muted">Loading...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hidePageLoading() {
    const overlay = getElement('page-loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}


// ========== GLOBAL OBJECT EXPOSURE ==========
window.gap2growth = {
    api,
    showToast,
    formatTime,
    formatDate,
    formatDuration,
    calculateDuration,
    formatRelativeTime,
    confirmAction,
    deleteItem,
    debounce,
    startActivity,
    completeActivity,
    markNotificationRead,
    markAllNotificationsRead,
    showButtonLoading,
    hideButtonLoading,
    showPageLoading,
    hidePageLoading,
    isValidEmail,
    validatePassword
};
