/**
 * CloudFolio UI Components
 */

/* ============================================================
   Modal
   ============================================================ */
function openModal(title, contentHTML, options = {}) {
  closeModal();

  const { onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', confirmClass = 'btn-primary', hideFooter = false } = options;

  const overlay = document.createElement('div');
  overlay.id = 'cf-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">${title}</h2>
        <button class="btn btn-ghost btn-icon" id="modal-close-btn" aria-label="Close">
          <i data-lucide="x" style="width:16px;height:16px;"></i>
        </button>
      </div>
      <div class="modal-body" id="modal-body">${contentHTML}</div>
      ${!hideFooter ? `
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel-btn">${cancelText}</button>
          ${onConfirm ? `<button class="btn ${confirmClass}" id="modal-confirm-btn">${confirmText}</button>` : ''}
        </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(overlay);

  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [overlay] });

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  const cancelBtn = document.getElementById('modal-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (onConfirm) {
    const confirmBtn = document.getElementById('modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => onConfirm(overlay));
    }
  }

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // Trap focus
  const firstInput = overlay.querySelector('input, select, textarea, button');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeModal() {
  const existing = document.getElementById('cf-modal-overlay');
  if (existing) existing.remove();
}

/* ============================================================
   Drawer
   ============================================================ */
function openDrawer(title, contentHTML) {
  closeDrawer();

  const overlay = document.createElement('div');
  overlay.id = 'cf-drawer-overlay';
  overlay.className = 'drawer-overlay';
  document.body.appendChild(overlay);

  const drawer = document.createElement('div');
  drawer.id = 'cf-drawer';
  drawer.className = 'drawer';
  drawer.innerHTML = `
    <div class="drawer-header">
      <h2 class="drawer-title">${title}</h2>
      <button class="btn btn-ghost btn-icon" id="drawer-close-btn" aria-label="Close">
        <i data-lucide="x" style="width:16px;height:16px;"></i>
      </button>
    </div>
    <div class="drawer-body" id="drawer-body">${contentHTML}</div>
  `;
  document.body.appendChild(drawer);

  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [drawer] });

  document.getElementById('drawer-close-btn').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
}

function closeDrawer() {
  const overlay = document.getElementById('cf-drawer-overlay');
  const drawer = document.getElementById('cf-drawer');
  if (overlay) overlay.remove();
  if (drawer) drawer.remove();
}

/* ============================================================
   DataTable
   ============================================================ */
function renderTable(containerId, columns, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { onRowClick, emptyMessage = 'No records found.', selectable = false } = options;

  let sortCol = null;
  let sortDir = 'asc';
  let currentData = [...data];

  function doRender() {
    if (currentData.length === 0) {
      container.innerHTML = `
        <div class="cf-table-empty">
          <i data-lucide="inbox" style="width:32px;height:32px;margin-bottom:0.5rem;opacity:0.4;"></i>
          <div>${emptyMessage}</div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
      return;
    }

    const headerCells = columns.map(col => {
      const isSortCol = sortCol === col.key;
      const sortClass = col.sortable !== false ? 'sortable' + (isSortCol ? ` sort-${sortDir}` : '') : '';
      return `<th class="${sortClass}" data-key="${col.key}">${col.label}</th>`;
    }).join('');

    const rows = currentData.map((row, idx) => {
      const cells = columns.map(col => {
        const val = row[col.key];
        const rendered = col.render ? col.render(val, row) : (val !== null && val !== undefined ? String(val) : '—');
        return `<td>${rendered}</td>`;
      }).join('');
      const selectCell = selectable ? `<td><input type="checkbox" class="cf-checkbox row-checkbox" data-idx="${idx}"></td>` : '';
      const clickClass = onRowClick ? ' clickable' : '';
      return `<tr class="${clickClass}" data-idx="${idx}">${selectCell}${cells}</tr>`;
    }).join('');

    const selectHeader = selectable ? '<th style="width:2.5rem;"><input type="checkbox" class="cf-checkbox" id="select-all-check"></th>' : '';

    container.innerHTML = `
      <div class="cf-table-wrapper">
        <table class="cf-table">
          <thead><tr>${selectHeader}${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });

    // Sort on header click
    container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (sortCol === key) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = key;
          sortDir = 'asc';
        }
        currentData.sort((a, b) => {
          const av = a[key]; const bv = b[key];
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          const cmp = typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv));
          return sortDir === 'asc' ? cmp : -cmp;
        });
        doRender();
      });
    });

    // Row click
    if (onRowClick) {
      container.querySelectorAll('tbody tr').forEach(tr => {
        tr.addEventListener('click', e => {
          if (e.target.closest('input, button, a')) return;
          const idx = parseInt(tr.dataset.idx);
          onRowClick(currentData[idx], idx);
        });
      });
    }

    // Select all
    if (selectable) {
      const selectAll = container.querySelector('#select-all-check');
      if (selectAll) {
        selectAll.addEventListener('change', () => {
          container.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = selectAll.checked);
        });
      }
    }
  }

  doRender();

  // Return update function
  return {
    update(newData) {
      currentData = [...newData];
      sortCol = null;
      sortDir = 'asc';
      doRender();
    },
    getSelected() {
      const selected = [];
      container.querySelectorAll('.row-checkbox:checked').forEach(cb => {
        selected.push(currentData[parseInt(cb.dataset.idx)]);
      });
      return selected;
    }
  };
}

/* ============================================================
   Status Badge
   ============================================================ */
function statusBadge(status, label) {
  const displayLabel = label || (status ? status.replace(/_/g, ' ') : '—');
  const cls = `badge badge-${status || 'inactive'}`;
  return `<span class="${cls}">${displayLabel}</span>`;
}

/* ============================================================
   Formatting Helpers
   ============================================================ */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    let normalized;
    if (dateStr.includes('T')) normalized = dateStr;
    else if (dateStr.includes(' ')) normalized = dateStr.replace(' ', 'T');
    else normalized = dateStr + 'T00:00:00';
    const d = new Date(normalized);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T'));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₱0.00';
  return '₱' + parseFloat(amount).toFixed(2);
}

function daysOverdue(dueDateStr) {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function daysUntilDue(dueDateStr) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  return Math.floor((due - today) / (1000 * 60 * 60 * 24));
}

function getOverdueDays(dueDateStr) {
  const due = new Date(dueDateStr); due.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.floor((today - due) / 86400000);
}

function getAccruedFine(dueDateStr, dailyRate, fineCap) {
  const days = getOverdueDays(dueDateStr);
  if (days <= 0) return 0;
  return Math.min(days * dailyRate, fineCap);
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / (1000 * 60 * 60));
  if (diff < 1) return 'Just now';
  if (diff < 24) return diff + 'h ago';
  const days = Math.floor(diff / 24);
  return days === 1 ? 'Yesterday' : days + 'd ago';
}
