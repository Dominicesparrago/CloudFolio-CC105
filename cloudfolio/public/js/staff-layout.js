/**
 * CloudFolio Staff Layout
 * Renders sidebar and topbar for staff pages
 */

(async function () {
  // Auth guard
  let currentUser = null;
  try {
    currentUser = await API.get('/auth/me');
    if (!currentUser || !['staff', 'admin'].includes(currentUser.role)) {
      window.location.href = '/staff/login.html';
      return;
    }
  } catch (e) {
    window.location.href = '/staff/login.html';
    return;
  }

  const path = window.location.pathname;

  const navItems = [
    { href: '/staff/dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
    { href: '/staff/catalog.html', label: 'Book Catalog', icon: 'book-copy' },
    { href: '/staff/loans.html', label: 'Loans & Checkouts', icon: 'book-open' },
    { href: '/staff/overdue.html', label: 'Overdue Queue', icon: 'alert-circle' },
    { href: '/staff/fines.html', label: 'Fines & Payments', icon: 'banknote' },
    { href: '/staff/members.html', label: 'Members', icon: 'users' },
    { href: '/staff/notifications.html', label: 'Notifications', icon: 'bell' },
  ];

  function isActive(href) {
    return path === href || path.endsWith(href.split('/').pop());
  }

  const navHTML = navItems.map(item => `
    <li>
      <a href="${item.href}" class="${isActive(item.href) ? 'active' : ''}">
        <i data-lucide="${item.icon}" style="width:16px;height:16px;flex-shrink:0;"></i>
        ${item.label}
      </a>
    </li>
  `).join('');

  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    sidebarContainer.innerHTML = `
      <aside class="sidebar">
        <div class="sidebar-header">
          <i data-lucide="library" style="width:20px;height:20px;color:rgb(var(--accent));flex-shrink:0;"></i>
          <span class="sidebar-logo">Cloud<span>Folio</span></span>
        </div>
        <nav style="flex:1;overflow-y:auto;">
          <ul class="sidebar-nav">${navHTML}</ul>
        </nav>
        <div class="sidebar-footer">
          <div style="display:flex;align-items:center;gap:0.625rem;margin-bottom:0.75rem;">
            <div style="width:32px;height:32px;border-radius:50%;background:rgba(var(--accent)/0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i data-lucide="user" style="width:14px;height:14px;color:rgb(var(--accent));"></i>
            </div>
            <div style="overflow:hidden;">
              <div style="font-size:0.8125rem;font-weight:600;color:rgb(var(--sidebar-text));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${currentUser.name}</div>
              <div style="font-size:0.6875rem;color:rgba(var(--sidebar-text)/0.5);text-transform:capitalize;">${currentUser.role}</div>
            </div>
          </div>
          <button id="logout-btn" class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;color:rgba(var(--sidebar-text)/0.6);gap:0.375rem;">
            <i data-lucide="log-out" style="width:14px;height:14px;"></i>
            Logout
          </button>
        </div>
      </aside>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [sidebarContainer] });

    document.getElementById('logout-btn').addEventListener('click', async () => {
      try {
        await API.post('/auth/logout');
      } catch (_) {}
      window.location.href = '/staff/login.html';
    });
  }

  // Render topbar
  const topbarContainer = document.getElementById('topbar-container');
  if (topbarContainer) {
    const pageTitle = window.PAGE_TITLE || document.body.dataset.pageTitle || 'CloudFolio';
    topbarContainer.innerHTML = `
      <div class="topbar">
        <span class="topbar-title">${pageTitle}</span>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <button id="theme-toggle-btn" class="btn btn-ghost btn-icon" title="Toggle theme" aria-label="Toggle theme">
            <span class="theme-sun"><i data-lucide="sun" style="width:16px;height:16px;"></i></span>
            <span class="theme-moon"><i data-lucide="moon" style="width:16px;height:16px;"></i></span>
          </button>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [topbarContainer] });

    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      toggleTheme();
    });
  }

  // Expose currentUser globally
  window._currentUser = currentUser;
})();
