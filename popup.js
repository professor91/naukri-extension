const DEFAULT_FILTERS = {
  active: true,
  totalExp: '',
  // expSalary: '',
  postedWithin: '',
  blacklist: [],
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

// Tag helpers
function renderTags(containerId, items, key) {
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  items.forEach((item, i) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${item}<span class="remove" data-key="${key}" data-i="${i}">×</span>`;
    c.appendChild(tag);
  });
  c.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      filters[btn.dataset.key].splice(parseInt(btn.dataset.i), 1);
      renderTags(containerId, filters[btn.dataset.key], key);
    });
  });
}

function setupTagInput(inputId, btnId, key, containerId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  const add = () => {
    const val = input.value.trim();
    if (val && !filters[key].includes(val)) {
      filters[key].push(val);
      renderTags(containerId, filters[key], key);
    }
    input.value = '';
  };
  btn.addEventListener('click', add);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
}

setupTagInput('blacklistInput', 'addBlacklist', 'blacklist', 'blacklistTags');

// Load saved filters
chrome.storage.sync.get('naukriFilters', (data) => {
  if (data.naukriFilters) {
    filters = { ...DEFAULT_FILTERS, ...data.naukriFilters };
  }

  // Fix corrupted fields from old versions
  if (!Array.isArray(filters.blacklist)) filters.blacklist = [];

  populateUI();
  loadStats();
});

function populateUI() {
  document.getElementById('masterToggle').checked = filters.active;
  document.getElementById('totalExp').value = filters.totalExp;
  // document.getElementById('expSalary').value = filters.expSalary;
  document.getElementById('postedWithin').value = filters.postedWithin;
  renderTags('blacklistTags', filters.blacklist, 'blacklist');
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
  // filters.expSalary = document.getElementById('expSalary').value;
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
