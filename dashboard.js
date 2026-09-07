document.addEventListener('DOMContentLoaded', () => {
  // =========================================================
  // TOAST NOTIFICATION SYSTEM
  // =========================================================
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warning') icon = 'alert-triangle';
    toast.innerHTML = `<i data-lucide="${icon}" style="color: var(--color-primary);"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: toast });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 3500);
  }
  window.showToast = showToast;

  // =========================================================
  // NOTIFICATIONS DROPDOWN
  // =========================================================
  const notifBtn = document.getElementById('notifBtn');
  if (notifBtn) {
    // Remove any existing dropdown
    const existingDropdown = document.getElementById('notifDropdown');
    if (existingDropdown) existingDropdown.remove();

    const dropdown = document.createElement('div');
    dropdown.id = 'notifDropdown';
    dropdown.className = 'notifications-dropdown';
    dropdown.innerHTML = `
      <div style="padding: 14px 16px; border-bottom: 1px solid #eee; font-weight: 600; font-family: 'Outfit', sans-serif; display:flex; justify-content:space-between; align-items:center;">
        <span>Notifications</span>
        <span style="font-size:12px; color:var(--color-primary); cursor:pointer;" id="markAllRead">Mark all read</span>
      </div>
      <div class="notif-item" style="background:rgba(0,191,165,0.03);">
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <i data-lucide="trending-up" style="width:16px;height:16px;color:var(--color-primary);margin-top:2px;flex-shrink:0;"></i>
          <div>
            <div style="font-weight:500; font-size:14px;">Wheat price up 5%</div>
            <div style="font-size:12px; color:var(--text-muted);">Good time to list your produce. 10 mins ago</div>
          </div>
        </div>
      </div>
      <div class="notif-item">
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <i data-lucide="package" style="width:16px;height:16px;color:#f39c12;margin-top:2px;flex-shrink:0;"></i>
          <div>
            <div style="font-weight:500; font-size:14px;">Shipment #SHP-882 dispatched</div>
            <div style="font-size:12px; color:var(--text-muted);">Your produce is on the way. 1 hour ago</div>
          </div>
        </div>
      </div>
      <div class="notif-item">
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <i data-lucide="indian-rupee" style="width:16px;height:16px;color:var(--color-accent);margin-top:2px;flex-shrink:0;"></i>
          <div>
            <div style="font-weight:500; font-size:14px;">Payment received: \u20b945,200</div>
            <div style="font-size:12px; color:var(--text-muted);">From AgriCorp Foods. Yesterday</div>
          </div>
        </div>
      </div>
      <div class="notif-item">
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <i data-lucide="handshake" style="width:16px;height:16px;color:#3498db;margin-top:2px;flex-shrink:0;"></i>
          <div>
            <div style="font-weight:500; font-size:14px;">New offer received</div>
            <div style="font-size:12px; color:var(--text-muted);">Fresh Foods Ltd offered \u20b92,150/q for Wheat. 2 days ago</div>
          </div>
        </div>
      </div>
      <div style="padding:10px; text-align:center;">
        <a href="#" style="color:var(--color-primary); font-size:13px; font-weight:500;">View all notifications</a>
      </div>
    `;
    notifBtn.parentElement.style.position = 'relative';
    notifBtn.parentElement.appendChild(dropdown);

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: dropdown });

    notifBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== notifBtn) {
        dropdown.classList.remove('show');
      }
    });

    const markAllRead = document.getElementById('markAllRead');
    if (markAllRead) {
      markAllRead.addEventListener('click', () => {
        dropdown.classList.remove('show');
        showToast('All notifications marked as read.', 'success');
      });
    }
  }

  // =========================================================
  // INTERACTIVE TABLE ACTIONS
  // =========================================================
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.type === 'submit') return;
    if (btn.id === 'notifBtn') return;
    if (btn.closest('#notifDropdown')) return;

    const btnText = btn.textContent.trim().toLowerCase();

    if (btnText === 'accept' || btnText === 'approve') {
      e.preventDefault();
      const row = btn.closest('tr') || btn.closest('.card-3d');
      if (row) {
        row.style.background = 'rgba(0, 191, 165, 0.06)';
        const cell = btn.closest('td');
        if (cell) cell.innerHTML = '<span class="badge badge-success">Accepted</span>';
      }
      showToast('Offer accepted successfully!', 'success');
    } else if (btnText === 'reject' || btnText === 'suspend') {
      e.preventDefault();
      const row = btn.closest('tr') || btn.closest('.card-3d');
      if (row) {
        row.style.opacity = '0.5';
        row.style.pointerEvents = 'none';
      }
      showToast(`Action completed: ${btn.textContent.trim()}.`, 'warning');
    } else if (btnText === 'remove') {
      e.preventDefault();
      const card = btn.closest('.card-3d');
      if (card) {
        card.style.transform = 'scale(0)';
        card.style.opacity = '0';
        card.style.transition = 'all 0.3s ease';
        setTimeout(() => card.remove(), 300);
      }
      showToast('Produce removed from listing.', 'warning');
    } else if (btnText.includes('download') || btnText.includes('export') || btnText.includes('generate') || btnText.includes('receipt') || btnText.includes('invoice')) {
      e.preventDefault();
      showToast('Generating document... Download will start shortly.', 'info');
    } else if (btnText.includes('add') || btnText.includes('list now')) {
      e.preventDefault();
      showToast('Feature coming in next phase. Form editor launching...', 'info');
    } else if (btnText === 'edit') {
      e.preventDefault();
      showToast('Edit mode activated. (Full form in next phase)', 'info');
    } else if (btnText.includes('contact') || btnText.includes('view') || btnText.includes('review')) {
      e.preventDefault();
      showToast('Loading details panel...', 'info');
    } else if (btnText.includes('counter') || btnText.includes('find buyer') || btnText.includes('update')) {
      e.preventDefault();
      showToast('Action triggered. (Mock)', 'success');
    } else if (btnText === 'refresh') {
      e.preventDefault();
      showToast('Prices refreshed with latest market data!', 'success');
    } else if (btnText.includes('close') || btnText.includes('resolve')) {
      e.preventDefault();
      const row = btn.closest('tr');
      if (row) {
        row.style.opacity = '0.5';
        row.style.pointerEvents = 'none';
        const cell = btn.closest('td');
        if (cell) cell.innerHTML = '<span class="badge badge-success">Resolved</span>';
      }
      showToast('Case closed successfully.', 'success');
    } else if (btn.id || btn.getAttribute('onclick')) {
      // has specific handler, skip
    } else {
      e.preventDefault();
      showToast('Action triggered. (Mock)', 'success');
    }
  });

  // =========================================================
  // USER PROFILE CLICK
  // =========================================================
  const userProfile = document.querySelector('.user-profile');
  if (userProfile) {
    userProfile.addEventListener('click', () => {
      showToast('Profile settings will be available in the next release.', 'info');
    });
  }
});
