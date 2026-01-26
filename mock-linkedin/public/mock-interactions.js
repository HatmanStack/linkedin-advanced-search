/**
 * Mock LinkedIn Interactions
 * Adds interactivity to static LinkedIn DOM captures for testing.
 * Handles: filter panel toggles, suggestion selection, URL updates.
 */
(function () {
  'use strict';

  // Mock data for filter suggestions
  const MOCK_COMPANIES = [
    { name: 'Google', id: '1441' },
    { name: 'Google DeepMind', id: '31184898' },
    { name: 'Google Cloud', id: '14458637' },
    { name: 'Microsoft', id: '1035' },
    { name: 'Amazon', id: '1586' },
    { name: 'Meta', id: '10667' },
    { name: 'Apple', id: '162479' },
  ];

  const MOCK_LOCATIONS = [
    { name: 'San Francisco Bay Area', id: '90000084' },
    { name: 'Greater New York City Area', id: '90000070' },
    { name: 'Greater Seattle Area', id: '90000049' },
    { name: 'Greater Los Angeles Area', id: '90000069' },
    { name: 'Greater Chicago Area', id: '90000063' },
    { name: 'United States', id: '103644278' },
    { name: 'United Kingdom', id: '101165590' },
  ];

  // Only run on search results pages
  if (!window.location.pathname.includes('/search/results/people')) return;

  // --- Filter Panel Management ---

  let activeFilter = null; // 'company' or 'location'
  let companyPanelInjected = false;
  let locationPanelInjected = false;

  // Find elements by text content (more robust than just labels)
  function findElementByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).find(el =>
      el.textContent.trim().toLowerCase().includes(text.toLowerCase())
    );
  }

  // Handle "Current companies" filter click via aria selector
  // The Puppeteer code uses ::-p-aria(Current companies) which matches aria-label
  document.addEventListener('click', (e) => {
    const target = e.target.closest('label, button, [role="button"]');
    if (!target) return;

    const text = target.textContent.trim().toLowerCase();
    const ariaLabel = (target.getAttribute('aria-label') || '').toLowerCase();

    if (text.includes('current compan') || ariaLabel.includes('current compan')) {
      e.preventDefault();
      e.stopPropagation();
      toggleFilterPanel('company');
    } else if (text.includes('location') || ariaLabel.includes('location')) {
      e.preventDefault();
      e.stopPropagation();
      toggleFilterPanel('location');
    }
  }, true);

  function toggleFilterPanel(type) {
    if (type === 'company') {
      activeFilter = 'company';
      if (!companyPanelInjected) {
        injectCompanyPanel();
        companyPanelInjected = true;
      } else {
        const panel = document.getElementById('mock-company-panel');
        if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
      }
    } else if (type === 'location') {
      activeFilter = 'location';
      if (!locationPanelInjected) {
        injectLocationPanel();
        locationPanelInjected = true;
      } else {
        const panel = document.getElementById('mock-location-panel');
        if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
      }
    }
  }

  // --- Company Suggestion Management ---

  // Update the EXISTING listbox in the captured DOM with filtered suggestions
  function updateExistingListbox(query) {
    const listbox = document.querySelector('[role="listbox"][data-testid="typeahead-results-container"]');
    if (!listbox) {
      console.log('[MOCK] No existing listbox found, injecting company panel');
      if (!companyPanelInjected) {
        injectCompanyPanel();
        companyPanelInjected = true;
      }
      return;
    }

    // Filter companies based on query
    const filtered = query
      ? MOCK_COMPANIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
      : MOCK_COMPANIES;

    if (filtered.length === 0) {
      console.log(`[MOCK] No companies match query: ${query}`);
      return;
    }

    // Clear and rebuild the listbox contents
    const container = listbox.querySelector('[data-component-type="LazyColumn"]') || listbox;

    // Clear existing options
    container.innerHTML = '';

    // Insert new options matching the captured HTML structure
    filtered.forEach((company, index) => {
      const option = document.createElement('div');
      option.className = 'fbc343bb cf1d1960 f65bc5fd df120c7b _7ef84488 d232cbde d3f8d8fe e9f81ce6 _046a1ca7 _74161f8c';
      option.setAttribute('role', 'option');
      option.id = `:mock-option-${index}:`;
      option.setAttribute('aria-selected', 'false');
      option.dataset.companyId = company.id;
      option.innerHTML = `
        <div role="button" tabindex="-1" class="e71dbc5f _94baefbb e0744685 cba660dd bbfbb7c5 f0150480 c11ce368 b9adc9a2 _6a90e9a7 _13057166 _9b4be851 d6ae496c">
          <div class="_8e9b5937 d6ae496c _5628b1bd ec017ca0 _506eb1a0 _661023a5 _6e83049a">
            <div class="_0a585a57 _8e9b5937 d6ae496c adae15a5 ec017ca0 _70437c00 _75097f22 _6a2a32ef">
              <div class="_0a585a57 d6ae496c adae15a5 b66705b9 _70437c00 _75097f22 _6a2a32ef">
                <div class="_8fc3671d a48f26ff _602734bb _672e5870 _9424c0a0 _9409fce1 _83a6ddeb">
                  <p class="_57a17605 fd0877c7 _4a67f7ab e072ff2a _18a712a2 _92f61a21 _42c944be _2dbdb565">${company.name}</p>
                </div>
                <div class="_8fc3671d a48f26ff _4560f919 _672e5870 _9424c0a0 _9409fce1 _83a6ddeb">
                  <p class="_57a17605 e8f8b838 _4a67f7ab e072ff2a _18a712a2 _92f61a21 _42c944be _2dbdb565">Technology</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Attach click handler
      option.addEventListener('click', () => {
        applyCompanyFilter(company.id);
      });

      container.appendChild(option);
    });

    // Make sure the listbox is visible
    listbox.style.display = '';
    const popover = listbox.closest('[popover]');
    if (popover) {
      popover.style.display = '';
      try { popover.showPopover?.(); } catch (e) { /* ignore */ }
    }

    console.log(`[MOCK] Updated listbox with ${filtered.length} companies for query: ${query}`);
  }

  // --- Company Panel Injection (fallback) ---

  function injectCompanyPanel() {
    // Find where to insert (after the filter bar)
    const filterBar = document.querySelector('[role="toolbar"]') ||
      document.querySelector('[data-testid="primary-nav"]')?.parentElement ||
      document.body;

    const panel = document.createElement('div');
    panel.id = 'mock-company-panel';
    panel.className = 'basic-typeahead__triggered-content';
    panel.style.cssText = 'position:fixed; left:400px; top:156px; z-index:9999; background:white; border:1px solid #ccc; border-radius:8px; padding:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); min-width:300px;';
    panel.innerHTML = `
      <fieldset style="border:none; padding:0; margin:0;">
        <input type="text" id="mock-company-input"
          placeholder="Add a company"
          aria-label="Add a company"
          aria-autocomplete="list"
          role="combobox"
          autocomplete="off"
          style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:14px; box-sizing:border-box;">
        <div id="mock-company-listbox" role="listbox" data-testid="typeahead-results-container" data-basic-filter-parameter-values="true" style="margin-top:4px; max-height:200px; overflow-y:auto;"></div>
      </fieldset>
      <button id="mock-company-show-results" aria-label="Show results" style="margin-top:8px; padding:8px 16px; background:#0a66c2; color:white; border:none; border-radius:20px; cursor:pointer; width:100%;">Show results</button>
    `;

    document.body.appendChild(panel);

    const input = document.getElementById('mock-company-input');
    const listbox = document.getElementById('mock-company-listbox');
    const showResultsBtn = document.getElementById('mock-company-show-results');

    // Show all suggestions initially
    renderCompanySuggestions(MOCK_COMPANIES, listbox);

    // Filter on input
    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      const filtered = MOCK_COMPANIES.filter(c =>
        c.name.toLowerCase().includes(query)
      );
      renderCompanySuggestions(filtered, listbox);
    });

    // Show results button
    showResultsBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    console.log('[MOCK] Company filter panel injected');
  }

  function renderCompanySuggestions(companies, listbox) {
    listbox.innerHTML = companies.map(company => `
      <div role="option" aria-selected="false"
        data-company-id="${company.id}"
        style="padding:8px; cursor:pointer; border-radius:4px; display:flex; align-items:center;"
        onmouseover="this.style.background='#f3f6f8'"
        onmouseout="this.style.background=''">
        <label style="cursor:pointer; display:flex; align-items:center; width:100%;">
          <input type="checkbox" style="margin-right:8px;">
          <span>${company.name}</span>
        </label>
      </div>
    `).join('');

    // Attach click handlers
    listbox.querySelectorAll('[role="option"]').forEach(option => {
      option.addEventListener('click', () => {
        const companyId = option.dataset.companyId;
        applyCompanyFilter(companyId);
      });

      // Handle clicks on the label/checkbox inside
      const label = option.querySelector('label');
      const checkbox = option.querySelector('input[type="checkbox"]');
      if (label) {
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          const companyId = option.dataset.companyId;
          applyCompanyFilter(companyId);
        });
      }
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          const companyId = option.dataset.companyId;
          applyCompanyFilter(companyId);
        });
      }
    });
  }

  function applyCompanyFilter(companyId) {
    const url = new URL(window.location.href);
    url.searchParams.set('currentCompany', `["${companyId}"]`);
    window.history.pushState({}, '', url.toString());
    console.log(`[MOCK] Applied company filter: ${companyId}`);

    // Hide the panel
    const panel = document.getElementById('mock-company-panel');
    if (panel) panel.style.display = 'none';
  }

  // --- Location Panel Injection ---

  function injectLocationPanel() {
    // Find where to insert (after the company filter area)
    const filterBar = document.querySelector('[role="toolbar"]') ||
      document.querySelector('[data-testid="primary-nav"]')?.parentElement ||
      document.body;

    const panel = document.createElement('div');
    panel.id = 'mock-location-panel';
    panel.style.cssText = 'position:fixed; left:400px; top:156px; z-index:9999; background:white; border:1px solid #ccc; border-radius:8px; padding:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); min-width:300px;';
    panel.innerHTML = `
      <input type="text" id="mock-location-input"
        placeholder="Add a location"
        aria-label="Add a location"
        aria-autocomplete="list"
        role="combobox"
        autocomplete="off"
        style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:14px; box-sizing:border-box;">
      <div id="mock-location-listbox" role="listbox" style="margin-top:4px; max-height:200px; overflow-y:auto;"></div>
    `;

    document.body.appendChild(panel);

    const input = document.getElementById('mock-location-input');
    const listbox = document.getElementById('mock-location-listbox');

    // Show all suggestions initially
    renderLocationSuggestions(MOCK_LOCATIONS, listbox);

    // Filter on input
    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      const filtered = MOCK_LOCATIONS.filter(l =>
        l.name.toLowerCase().includes(query)
      );
      renderLocationSuggestions(filtered, listbox);
    });
  }

  function renderLocationSuggestions(locations, listbox) {
    listbox.innerHTML = locations.map(loc => `
      <div role="option" aria-selected="false"
        data-geo-id="${loc.id}"
        style="padding:8px; cursor:pointer; border-radius:4px; display:flex; align-items:center;"
        onmouseover="this.style.background='#f3f6f8'"
        onmouseout="this.style.background=''">
        <span>${loc.name}</span>
      </div>
    `).join('');

    // Attach click handlers
    listbox.querySelectorAll('[role="option"]').forEach(option => {
      option.addEventListener('click', () => {
        const geoId = option.dataset.geoId;
        applyLocationFilter(geoId);
      });
    });
  }

  function applyLocationFilter(geoId) {
    const url = new URL(window.location.href);
    url.searchParams.set('geoUrn', `["${geoId}"]`);
    window.history.pushState({}, '', url.toString());
    console.log(`[MOCK] Applied location filter: ${geoId}`);

    // Hide the location panel
    const panel = document.getElementById('mock-location-panel');
    if (panel) panel.style.display = 'none';
  }

  // --- Typeahead Input Handling ---

  // Intercept typing in any filter input field on the page
  // This handles cases where the captured DOM has its own input fields
  document.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.matches('input')) return;

    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();

    // Check if this is a company or location filter input
    if (placeholder.includes('add a') || ariaLabel.includes('add a')) {
      if (placeholder.includes('compan') || ariaLabel.includes('compan')) {
        // Company filter input - update the existing listbox with filtered suggestions
        const query = input.value;
        console.log(`[MOCK] Company input changed: "${query}"`);

        // First try to update the existing listbox in the captured DOM
        updateExistingListbox(query);

        // Also sync with injected panel if it exists
        const mockInput = document.getElementById('mock-company-input');
        if (mockInput && mockInput !== input) {
          mockInput.value = query;
        }
        const mockListbox = document.getElementById('mock-company-listbox');
        if (mockListbox) {
          const filtered = MOCK_COMPANIES.filter(c =>
            c.name.toLowerCase().includes(query.toLowerCase())
          );
          renderCompanySuggestions(filtered, mockListbox);
        }
      } else if (placeholder.includes('location') || ariaLabel.includes('location')) {
        // Location filter input
        if (!locationPanelInjected) {
          injectLocationPanel();
          locationPanelInjected = true;
        }
        const panel = document.getElementById('mock-location-panel');
        if (panel) panel.style.display = '';
      }
    }
  }, true);

  // --- Search Results Population ---

  // Fetch mock data and populate search results when company filter is applied
  async function populateSearchResults() {
    try {
      const response = await fetch('/api/state');
      const data = await response.json();
      const connections = data.connections || [];

      // Get current URL params to filter by company
      const url = new URL(window.location.href);
      const companyParam = url.searchParams.get('currentCompany');

      let filteredPeople = connections;
      if (companyParam) {
        // Company filter is active - in real LinkedIn this would filter
        // For mock, show all Amazon employees since that's our test data
        filteredPeople = connections.filter(p =>
          p.company?.toLowerCase().includes('amazon') ||
          p.headline?.toLowerCase().includes('amazon')
        );
      }

      if (filteredPeople.length === 0) {
        console.log('[MOCK] No people found for current filter');
        return;
      }

      // Find or create the search results container
      let resultsContainer = document.querySelector('.reusable-search__entity-result-list') ||
        document.querySelector('[data-testid="lazy-column"]') ||
        document.querySelector('[data-component-type="LazyColumn"]');

      if (!resultsContainer) {
        // Create a results container if none exists
        const main = document.querySelector('main') || document.body;
        resultsContainer = document.createElement('ul');
        resultsContainer.className = 'reusable-search__entity-result-list';
        resultsContainer.style.cssText = 'list-style:none; padding:16px; margin:0;';
        main.appendChild(resultsContainer);
      }

      // Clear existing results
      resultsContainer.innerHTML = '';

      // Populate with mock people
      filteredPeople.forEach(person => {
        const li = document.createElement('li');
        li.className = 'reusable-search__result-container';
        li.style.cssText = 'padding:12px; margin-bottom:8px; background:white; border-radius:8px; border:1px solid #e0e0e0;';
        li.innerHTML = `
          <div class="entity-result" style="display:flex; align-items:flex-start; gap:12px;">
            <div style="width:72px; height:72px; background:#e7e2dc; border-radius:50%; flex-shrink:0;"></div>
            <div style="flex:1;">
              <a href="/in/${person.profileId}/" class="entity-result__title-text" style="font-weight:600; color:#000; text-decoration:none; display:block; margin-bottom:4px;">
                <span>${person.name}</span>
              </a>
              <p class="entity-result__primary-subtitle" style="color:#666; margin:0 0 4px 0; font-size:14px;">${person.headline || ''}</p>
              <p style="color:#666; margin:0 0 8px 0; font-size:12px;">${person.connectionDegree || '2nd'} · ${person.recentActivity || 'Active recently'}</p>
              <button aria-label="Connect with ${person.name}" style="padding:6px 16px; border:1px solid #0a66c2; border-radius:16px; background:transparent; color:#0a66c2; cursor:pointer;">Connect</button>
            </div>
          </div>
        `;
        resultsContainer.appendChild(li);
      });

      // Update results count
      const countEl = document.querySelector('[data-testid="search-results-count"]');
      if (countEl) {
        countEl.textContent = `${filteredPeople.length} results`;
      }

      console.log(`[MOCK] Populated ${filteredPeople.length} search results`);
    } catch (error) {
      console.error('[MOCK] Failed to populate search results:', error);
    }
  }

  // Server-side now handles search results - disable client-side population
  // Watch for URL changes (when filters are applied)
  // let lastUrl = window.location.href;
  // const urlObserver = setInterval(() => {
  //   if (window.location.href !== lastUrl) {
  //     lastUrl = window.location.href;
  //     if (window.location.href.includes('currentCompany=')) {
  //       console.log('[MOCK] Company filter applied, populating results...');
  //       setTimeout(populateSearchResults, 500);
  //     }
  //   }
  // }, 200);

  // Server-side now handles search results with company filter
  // Only run populateSearchResults for dynamic filter changes, not initial load
  // if (window.location.href.includes('currentCompany=')) {
  //   setTimeout(populateSearchResults, 500);
  // }

  console.log('[MOCK] Search filter interactions initialized');
})();
