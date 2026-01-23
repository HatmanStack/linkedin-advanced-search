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
    { name: 'Greater Seattle Area', id: '90000084' },
    { name: 'Greater Los Angeles Area', id: '90000069' },
    { name: 'Greater Chicago Area', id: '90000063' },
    { name: 'United States', id: '103644278' },
    { name: 'United Kingdom', id: '101165590' },
  ];

  // Only run on search results pages
  if (!window.location.pathname.includes('/search/results/people')) return;

  // --- Filter Panel Management ---

  let activeFilter = null; // 'company' or 'location'
  let locationPanelInjected = false;

  // Find the filter labels
  function findFilterLabel(text) {
    const labels = document.querySelectorAll('label');
    return Array.from(labels).find(l =>
      l.textContent.trim().toLowerCase().includes(text.toLowerCase())
    );
  }

  // Handle "Current companies" filter click
  const companyLabel = findFilterLabel('Current companies');
  if (companyLabel) {
    companyLabel.addEventListener('click', (e) => {
      e.preventDefault();
      toggleFilterPanel('company');
    });
  }

  // Handle "Locations" filter click
  const locationsLabel = findFilterLabel('Locations');
  if (locationsLabel) {
    locationsLabel.addEventListener('click', (e) => {
      e.preventDefault();
      toggleFilterPanel('location');
    });
  }

  function toggleFilterPanel(type) {
    if (type === 'company') {
      // Company panel already exists in the captured DOM, just ensure it's visible
      const listbox = document.querySelector('[role="listbox"][data-testid="typeahead-results-container"]');
      if (listbox) {
        listbox.style.display = listbox.style.display === 'none' ? '' : '';
      }
      activeFilter = 'company';
    } else if (type === 'location') {
      activeFilter = 'location';
      if (!locationPanelInjected) {
        injectLocationPanel();
        locationPanelInjected = true;
      } else {
        const panel = document.getElementById('mock-location-panel');
        if (panel) panel.style.display = panel.style.display === 'none' ? '' : '';
      }
    }
  }

  // --- Company Suggestion Clicks ---

  // Attach click handlers to existing company suggestion options
  const companyOptions = document.querySelectorAll('[role="listbox"] [role="option"]');
  companyOptions.forEach((option, index) => {
    option.addEventListener('click', () => {
      // Determine which company was clicked based on text or index
      const optionText = option.textContent.trim();
      const company = MOCK_COMPANIES.find(c =>
        optionText.toLowerCase().includes(c.name.toLowerCase())
      ) || MOCK_COMPANIES[index] || MOCK_COMPANIES[0];

      applyCompanyFilter(company.id);
    });

    // Also handle the inner role="button" elements
    const innerButton = option.querySelector('[role="button"]');
    if (innerButton) {
      innerButton.addEventListener('click', (e) => {
        e.stopPropagation();
        option.click();
      });
    }
  });

  function applyCompanyFilter(companyId) {
    const url = new URL(window.location.href);
    url.searchParams.set('currentCompany', `["${companyId}"]`);
    window.history.pushState({}, '', url.toString());
    console.log(`[MOCK] Applied company filter: ${companyId}`);

    // Hide the suggestion panel
    const listbox = document.querySelector('[role="listbox"][data-testid="typeahead-results-container"]');
    if (listbox) listbox.style.display = 'none';
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

  // Handle typing in the company filter input (already in DOM)
  const companyInput = document.querySelector('input[placeholder="Add a company"]');
  if (companyInput) {
    companyInput.addEventListener('input', () => {
      // Show/filter the existing suggestion list
      const listbox = document.querySelector('[role="listbox"][data-testid="typeahead-results-container"]');
      if (listbox) listbox.style.display = '';
    });
  }

  console.log('[MOCK] Search filter interactions initialized');
})();
