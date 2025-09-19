/**
 * Notification system for user feedback
 */

class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.nextId = 1;
    this.init();
  }

  init() {
    // Create notification container if it doesn't exist
    this.container = document.getElementById('notification-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    }
  }

  /**
   * Shows a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {number} duration - Auto-hide duration in ms (0 = no auto-hide)
   * @returns {number} - Notification ID
   */
  show(message, type = 'info', duration = 5000) {
    const id = this.nextId++;
    const notification = this.createNotificationElement(id, message, type);

    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Auto-hide if duration is set
    if (duration > 0) {
      setTimeout(() => {
        this.hide(id);
      }, duration);
    }

    return id;
  }

  /**
   * Hides a notification
   * @param {number} id - Notification ID
   */
  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) {
      return;
    }

    notification.classList.add('hide');

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.notifications.delete(id);
    }, 300);
  }

  /**
   * Creates a notification element
   * @param {number} id - Notification ID
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   * @returns {HTMLElement} - Notification element
   */
  createNotificationElement(id, message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.dataset.id = id;

    const icon = this.getIconForType(type);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => this.hide(id));

    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${this.sanitizeMessage(message)}</span>
      </div>
    `;

    notification.appendChild(closeBtn);

    return notification;
  }

  /**
   * Gets icon for notification type
   * @param {string} type - Notification type
   * @returns {string} - Icon HTML
   */
  getIconForType(type) {
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  /**
   * Sanitizes notification message
   * @param {string} message - Message to sanitize
   * @returns {string} - Sanitized message
   */
  sanitizeMessage(message) {
    const div = document.createElement('div');
    div.textContent = message;
    return div.innerHTML;
  }

  /**
   * Shows success notification
   * @param {string} message - Success message
   * @param {number} duration - Auto-hide duration
   * @returns {number} - Notification ID
   */
  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  /**
   * Shows error notification
   * @param {string} message - Error message
   * @param {number} duration - Auto-hide duration
   * @returns {number} - Notification ID
   */
  error(message, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  /**
   * Shows warning notification
   * @param {string} message - Warning message
   * @param {number} duration - Auto-hide duration
   * @returns {number} - Notification ID
   */
  warning(message, duration = 5000) {
    return this.show(message, 'warning', duration);
  }

  /**
   * Shows info notification
   * @param {string} message - Info message
   * @param {number} duration - Auto-hide duration
   * @returns {number} - Notification ID
   */
  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }

  /**
   * Clears all notifications
   */
  clear() {
    this.notifications.forEach((_, id) => {
      this.hide(id);
    });
  }
}

// Global notification manager instance
let notificationManager = null;

/**
 * Gets or creates the global notification manager
 * @returns {NotificationManager} - Notification manager instance
 */
function getNotificationManager() {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
  return notificationManager;
}

/**
 * Shows an error message (legacy compatibility)
 * @param {string} message - Error message
 * @param {string} type - Message type
 */
function showErrorMessage(message, type = 'error') {
  const manager = getNotificationManager();

  switch (type) {
  case 'success':
    manager.success(message);
    break;
  case 'warning':
    manager.warning(message);
    break;
  case 'info':
    manager.info(message);
    break;
  default:
    manager.error(message);
  }
}

module.exports = {
  NotificationManager,
  getNotificationManager,
  showErrorMessage
};
