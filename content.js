(function () {
  'use strict';

  let filters = null;
  let stats = { visible: 0, hidden: 0, total: 0 };
  let debounceTimer = null;
  let observer = null;

  const SELECTORS = {
    jobCard: [
      'article.jobTuple',
      '.jobTuple',
      '[class*="jobTuple"]',
      '.job-post',
      '[data-job-id]',
      '.cust-job-tuple',
      '.srp-jobtuple-wrapper',
      '.list'
    ],
    experience: [
      '.experience',
      '[class*="experience"]',
      '.exp',
      '.ni-job-tuple-icon-srp-exp + span'
    ],
    postedDate: [
      '[class*="jobTupleFooter"] [class*="plcHolder"] span',
      '.job-post-day',
      '.created-date-container',
    ],
    companyName: [
        '.comp-name',
        '[class*="companyWrapper"] span[title]',
    ]
  };

  function getEl(card, selectorList) {
    for (const sel of selectorList) {
      const el = card.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function getText(card, selectorList) {
    const el = getEl(card, selectorList);
    return el ? el.textContent.trim().toLowerCase() : '';
  }

  function parseSalaryLPA(text) {
    if (!text) return null;
    const low = text.toLowerCase();
    if (low.includes('not disclosed') || low.includes('not available')) return null;
    const nums = low.match(/[\d.]+/g);
    if (!nums) return null;
    return parseFloat(nums[0]);
  }

  function parseExpYears(text) {
    if (!text) return null;
    const nums = text.match(/\d+/g);
    if (!nums) return null;
    return {
      min: parseInt(nums[0]),
      max: parseInt(nums[1] ?? nums[0])  // if only one number, min = max
    };
  }

  function parseDaysAgo(text) {
    if (!text) return 0;
    const low = text.toLowerCase();
    if (low.includes('today') || low.includes('just now') || low.includes('hour')) return 0;
    if (low.includes('yesterday')) return 1;
    const m = low.match(/(\d+)\+?\s*(day|week|month)/);
    if (!m) return 0;
    const n = parseInt(m[1]);
    if (m[2] === 'week') return n * 7;
    if (m[2] === 'month') return n * 30;
    return n;
  }

  function shouldHide(card) {
    if (!filters || !filters.active) return false;

    const expText = getText(card, SELECTORS.experience);
    const dateText = getText(card, SELECTORS.postedDate);
    const companyText = getText(card, SELECTORS.companyName);
    const fullText = (card.textContent || '').toLowerCase();

    // Experience filter
    if (filters.totalExp) {
      const exp = parseExpYears(expText);
      if (exp !== null) {
        // filter out whatever min experience is more than user's total experience
        // TODO: support float here
        if (filters.totalExp && exp.min > parseInt(filters.totalExp)) return true;
      }
    }

    // Posted within filter
    if (filters.postedWithin) {
      const days = parseDaysAgo(dateText);
      if (days > parseInt(filters.postedWithin)) return true;
    }

    // exclude company filter
    if (filters.blacklist) {
      for (const companyName of filters.blacklist) {
        if (companyName.toLowerCase() == companyText.toLowerCase()) return true;
      }
    }

    return false;
  }

  function applyFilters() {
    stats = { visible: 0, hidden: 0, total: 0 };

    // Try multiple selectors to find job cards
    let cards = [];
    for (const sel of SELECTORS.jobCard) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) { cards = Array.from(found); break; }
    }

    if (cards.length === 0) return;

    // Get all filter labels
    // document.querySelectorAll('label[class*="styles_chkLbl"]').forEach(label => {
    //   const titleSpan = label.querySelector('span[title]');
    //   if (!titleSpan) return;
    //   const text = titleSpan.getAttribute('title').toLowerCase();
    //   if (!text.toLowerCase().includes('lakhs')) return; 
    //   console.log('salary', text);
    //   if (text.includes('6-10') || text.includes('10-15')) {
    //     const checkbox = label.querySelector('i[class*="unchecked"]');
    //     if (checkbox) label.click(); // clicking the label toggles the checkbox
    //   }
    // });

    // console.log('apply filters');
    // console.log(filters);
    cards.forEach(card => {
      stats.total++;
      if (shouldHide(card)) {
        card.style.setProperty('display', 'none', 'important');
        card.setAttribute('data-naukri-filtered', 'true');
        stats.hidden++;
      } else {
        card.style.removeProperty('display');
        card.removeAttribute('data-naukri-filtered');
        stats.visible++;
      }
    });

    chrome.storage.local.set({ naukriStats: stats });
    updateBadge();
  }

  function updateBadge() {
    // Show a small overlay badge with count
    let badge = document.getElementById('naukri-filter-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'naukri-filter-badge';
      document.body.appendChild(badge);
    }
    if (!filters || !filters.active) {
      badge.style.display = 'none';
      return;
    }
    badge.style.display = 'flex';
    badge.textContent = `🔍 ${stats.visible} shown · ${stats.hidden} hidden`;
  }

  function loadAndApply() {
    chrome.storage.sync.get('naukriFilters', (data) => {
      filters = data.naukriFilters || { active: false };
      applyFilters();
    });
  }

  // Debounced re-apply
  function scheduleApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 400);
  }

  // Watch for DOM changes (infinite scroll / pagination)
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      const relevant = mutations.some(m =>
        m.addedNodes.length > 0 &&
        Array.from(m.addedNodes).some(n => n.nodeType === 1)
      );
      if (relevant) scheduleApply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Listen for filter updates from popup
  window.addEventListener('naukriFiltersUpdated', loadAndApply);


  // Listen for apply button
  // document.addEventListener("click", function (e) {
  //   const btn = e.target.closest("button");
  //   if (btn && btn.innerText.includes("Apply")) {
  //     console.log("Apply clicked");
  //   }
  // });

  // Init
  loadAndApply();
  startObserver();

  // Re-run on URL change (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(loadAndApply, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

})();
