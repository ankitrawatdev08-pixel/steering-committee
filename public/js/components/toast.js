/**
 * Toast Notification System
 * Displays temporary slide-down notifications for errors, confirmations, and alerts.
 */

const toastContainer = document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 250ms ease, transform 250ms ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }, duration);
}

export function showErrorToast(message) {
  showToast(message, 'error', 3500);
}

export function showSuccessToast(message) {
  showToast(message, 'success', 2500);
}

export function showInfoToast(message) {
  showToast(message, 'info', 2500);
}
