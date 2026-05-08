/**
 * CloudFolio Toast Notification System
 */

(function () {
  // Ensure container exists
  function getContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function (message, type = 'success') {
    const container = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Icon
    const iconMap = {
      success: 'check-circle',
      error: 'x-circle',
      info: 'info',
      warning: 'alert-triangle'
    };
    const icon = iconMap[type] || 'info';

    toast.innerHTML = `
      <i data-lucide="${icon}" style="width:16px;height:16px;flex-shrink:0;"></i>
      <span style="flex:1;">${message}</span>
      <button onclick="this.closest('.toast').remove()" style="background:none;border:none;cursor:pointer;color:inherit;padding:0;margin-left:0.25rem;opacity:0.7;display:flex;align-items:center;">
        <i data-lucide="x" style="width:14px;height:14px;"></i>
      </button>
    `;

    container.appendChild(toast);

    // Init lucide icons if available
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [toast] });
    }

    // Auto remove after 3.5 seconds
    const timeout = setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3500);

    // Click to dismiss immediately
    toast.addEventListener('click', () => {
      clearTimeout(timeout);
      toast.remove();
    });
  };
})();
