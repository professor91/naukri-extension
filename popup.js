const DEFAULT_FILTERS = {
  active: true,
  totalExp: '',
  postedWithin: '',
};

let filters = { ...DEFAULT_FILTERS };

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});


// Load saved filters
chrome.storage.sync.get('naukriFilters', (data) => {
  if (data.naukriFilters) {
    filters = { ...DEFAULT_FILTERS, ...data.naukriFilters };
  }
  populateUI();
  loadStats();
});

function populateUI() {
  document.getElementById('masterToggle').checked = filters.active;
  document.getElementById('totalExp').value = filters.totalExp;
  document.getElementById('postedWithin').value = filters.postedWithin;
}

function loadStats() {
  chrome.storage.local.get('naukriStats', (data) => {
    const stats = data.naukriStats || { visible: 0, hidden: 0, total: 0 };
    document.getElementById('visibleCount').textContent = stats.visible;
    document.getElementById('hiddenCount').textContent = stats.hidden;
    document.getElementById('totalCount').textContent = stats.total;
    const rate = stats.total > 0 ? Math.round((stats.hidden / stats.total) * 100) + '%' : '0%';
    document.getElementById('filterRatio').textContent = rate;
  });
}

// Save
document.getElementById('saveBtn').addEventListener('click', () => {
  filters.active = document.getElementById('masterToggle').checked;
  filters.totalExp = document.getElementById('totalExp').value;
  filters.postedWithin = document.getElementById('postedWithin').value;

  chrome.storage.sync.set({ naukriFilters: filters }, () => {
    // Notify active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => window.dispatchEvent(new CustomEvent('naukriFiltersUpdated'))
        });
      }
    });
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
    loadStats();
  });
});

document.getElementById('masterToggle').addEventListener('change', (e) => {
  filters.active = e.target.checked;
});

document.getElementById('resetStats').addEventListener('click', () => {
  chrome.storage.local.set({ naukriStats: { visible: 0, hidden: 0, total: 0 } }, loadStats);
});

document.getElementById('clearAll').addEventListener('click', () => {
  filters = { ...DEFAULT_FILTERS };
  populateUI();
  chrome.storage.sync.set({ naukriFilters: filters });
  chrome.storage.local.set({ naukriStats: { visible: 0, hidden: 0, total: 0 } }, loadStats);
});
