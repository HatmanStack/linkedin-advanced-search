import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.MOCK_LINKEDIN_PORT || 3333;

// HTML escape helper to prevent XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/public', express.static(join(__dirname, 'public')));

// In-memory state
const state = {
  loggedIn: false,
  currentUser: null,
  connections: [],
  messages: [],
  posts: [],
  pendingInvitations: [],
  sentInvitations: [],
};

// Load mock data
function loadMockData() {
  try {
    const dataPath = join(__dirname, 'data', 'mock-data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      Object.assign(state, data);
      console.log('Loaded mock data:', Object.keys(data));
    }
  } catch (error) {
    console.error('Failed to load mock data:', error.message);
  }
}

// Helper to serve HTML pages (from your saved MHTML-extracted files)
function servePage(pageName, res, replacements = {}) {
  const pagePath = join(__dirname, 'pages', `${pageName}.html`);

  if (!fs.existsSync(pagePath)) {
    // Return a placeholder page with the required selectors
    return res.send(generatePlaceholderPage(pageName, replacements));
  }

  let html = fs.readFileSync(pagePath, 'utf-8');

  // Apply replacements (for dynamic content)
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Strip Content-Security-Policy meta tags (they block our injected scripts)
  html = html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, '');
  html = html.replace(/<meta[^>]*trusted-types[^>]*>/gi, '');

  // Strip LinkedIn's JavaScript (it needs their backend and breaks the static DOM)
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Rewrite LinkedIn URLs to local
  html = html.replace(/https?:\/\/(www\.)?linkedin\.com/g, `http://localhost:${PORT}`);

  // Inject a visible header for post-login detection (LinkedIn's real headers need JS to render visibly)
  html = html.replace(
    '</body>',
    '<header data-view-name="navigation-homepage" style="display:block;width:100%;height:2px;"></header><script src="/public/mock-interactions.js"></script></body>'
  );

  res.send(html);
}

// Generate placeholder pages with required selectors (use until you have real HTML)
function generatePlaceholderPage(pageName, data = {}) {
  const templates = {
    login: `
<!DOCTYPE html>
<html>
<head><title>LinkedIn Login</title></head>
<body>
  <main>
    <form id="login-form" action="/uas/login-submit" method="POST">
      <input type="text" id="username" name="session_key" placeholder="Email" autocomplete="username">
      <input type="password" id="password" name="session_password" placeholder="Password" autocomplete="current-password">
      <button type="submit" aria-label="Sign in">Sign in</button>
    </form>
  </main>
</body>
</html>`,

    feed: `
<!DOCTYPE html>
<html>
<head><title>LinkedIn Feed</title></head>
<body>
  <header class="global-nav" id="global-nav">
    <nav>
      <a href="/feed/">Home</a>
      <a href="/mynetwork/">My Network</a>
      <a href="/messaging/">Messaging</a>
    </nav>
  </header>
  <main class="scaffold-layout">
    <div class="share-box">
      <button aria-label="Start a post" data-test-id="start-post-button">Start a post</button>
    </div>
    <div id="post-modal" style="display:none;">
      <div class="share-creation-state">
        <div contenteditable="true"
             data-test-id="post-content-input"
             aria-label="Text editor"
             class="ql-editor"></div>
        <button aria-label="Add media" data-test-id="media-button">Add media</button>
        <input type="file" style="display:none;">
        <button aria-label="Post" data-test-id="post-button">Post</button>
      </div>
    </div>
    <div class="feed-posts">
      ${(data.posts || []).map((p) => `<article class="feed-post">${p.content}</article>`).join('')}
    </div>
  </main>
</body>
</html>`,

    profile: `
<!DOCTYPE html>
<html>
<head><title>${data.name || 'Profile'} | LinkedIn</title></head>
<body>
  <header class="global-nav" id="global-nav">
    <nav><a href="/feed/">Home</a></nav>
  </header>
  <main class="scaffold-layout">
    <section data-test-id="profile-top-card" class="pv-top-card">
      <h1>${data.name || 'Mock User'}</h1>
      <p>${data.headline || 'Software Engineer'}</p>
      <span class="distance-badge"><span class="dist-value">${data.connectionDegree || '2nd'}</span></span>

      <div class="pvs-profile-actions pv-s-profile-actions">
        ${
          data.isConnected
            ? `
          <button aria-label="Message ${data.name}" data-test-id="message-button">Message</button>
        `
            : data.isPending
              ? `
          <button aria-label="Pending" data-test-id="pending-button">Pending</button>
        `
              : `
          <button aria-label="Connect with ${data.name}" data-test-id="connect-button" class="artdeco-button">Connect</button>
        `
        }
        <button aria-label="More actions" class="artdeco-dropdown__trigger">More</button>
      </div>

      <div class="artdeco-dropdown__content" role="menu" style="display:none;">
        <button aria-label="Follow ${data.name}">Follow</button>
      </div>
    </section>

    <section class="pv-about-section">
      <h2>About</h2>
      <p>${data.about || 'No about section'}</p>
    </section>
  </main>
</body>
</html>`,

    messaging: `
<!DOCTYPE html>
<html>
<head><title>Messaging | LinkedIn</title></head>
<body>
  <header class="global-nav" id="global-nav"></header>
  <main class="scaffold-layout">
    <div class="messaging-container">
      <div class="msg-conversation-card">
        <h3>${data.recipientName || 'Recipient'}</h3>
      </div>
      <div class="messaging-composer msg-form">
        <div contenteditable="true"
             data-test-id="message-input"
             aria-label="Write a message"
             class="msg-form__contenteditable"></div>
        <div class="msg-form__footer">
          <button aria-label="Send" data-test-id="send-button">Send</button>
        </div>
      </div>
      <div data-test-id="message-sent" style="display:none;">Message sent</div>
    </div>
  </main>
</body>
</html>`,

    'search-results': `
<!DOCTYPE html>
<html>
<head>
  <title>Search Results | LinkedIn</title>
  <style>
    .search-filters { display: flex; gap: 8px; margin-bottom: 16px; padding: 12px; background: white; border-radius: 8px; }
    .filter-button { padding: 6px 12px; border: 1px solid #666; border-radius: 16px; background: white; cursor: pointer; }
    .filter-button:hover { background: #f3f2ef; }
    .filter-dropdown { display: none; position: absolute; background: white; border: 1px solid #ddd; border-radius: 8px; padding: 8px; z-index: 100; min-width: 250px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .filter-dropdown.open { display: block; }
    .filter-input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px; }
    .suggestion-list { list-style: none; padding: 0; margin: 0; }
    .suggestion-item { padding: 8px; cursor: pointer; border-radius: 4px; }
    .suggestion-item:hover { background: #f3f2ef; }
    .show-results-btn { width: 100%; padding: 8px; background: #0a66c2; color: white; border: none; border-radius: 16px; cursor: pointer; margin-top: 8px; }
  </style>
</head>
<body>
  <header class="global-nav" id="global-nav" data-view-name="navigation-homepage"></header>
  <main class="scaffold-layout">
    <div class="search-reusables__filters-bar search-filters" style="position: relative;">
      <button class="filter-button artdeco-pill" aria-label="Current companies filter" data-filter="currentCompany">Current companies</button>
      <button class="filter-button artdeco-pill" aria-label="Locations filter" data-filter="geoUrn">Locations</button>

      <!-- Company filter dropdown -->
      <div id="company-filter-dropdown" class="filter-dropdown reusables-filters__filter-value-typeahead">
        <input type="text" class="filter-input" role="combobox" placeholder="Add a company" aria-label="Add a company" data-filter-input="currentCompany">
        <ul class="suggestion-list" id="company-suggestions" role="listbox">
          <li class="suggestion-item" role="option" data-company-id="1586" data-company-name="Amazon">Amazon</li>
          <li class="suggestion-item" role="option" data-company-id="1441" data-company-name="Google">Google</li>
          <li class="suggestion-item" role="option" data-company-id="1035" data-company-name="Microsoft">Microsoft</li>
        </ul>
        <button class="show-results-btn" aria-label="Show results">Show results</button>
      </div>

      <!-- Location filter dropdown -->
      <div id="location-filter-dropdown" class="filter-dropdown reusables-filters__filter-value-typeahead">
        <input type="text" class="filter-input" role="combobox" placeholder="Add a location" aria-label="Add a location" data-filter-input="geoUrn">
        <ul class="suggestion-list" id="location-suggestions" role="listbox">
          <li class="suggestion-item" role="option" data-geo-urn="103644278" data-location-name="United States">United States</li>
          <li class="suggestion-item" role="option" data-geo-urn="102571732" data-location-name="San Francisco Bay Area">San Francisco Bay Area</li>
          <li class="suggestion-item" role="option" data-geo-urn="90000084" data-location-name="Seattle Area">Seattle Area</li>
        </ul>
        <button class="show-results-btn" aria-label="Show results">Show results</button>
      </div>
    </div>

    <div class="search-results-container">
      <ul class="reusable-search__entity-result-list">
        ${(data.results || state.connections.slice(0, 10))
          .map(
            (person) => `
          <li class="reusable-search__result-container">
            <div class="entity-result">
              ${person.profilePictureUrl ? `<img src="${person.profilePictureUrl}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;">` : ''}
              <a href="/in/${person.profileId}/" class="entity-result__title-text">
                <span>${person.name}</span>
              </a>
              <p class="entity-result__primary-subtitle">${person.headline || ''}</p>
              <button aria-label="Connect with ${person.name}">Connect</button>
            </div>
          </li>
        `
          )
          .join('')}
      </ul>
      <button class="artdeco-pagination__button--next" aria-label="Next">Next</button>
    </div>
  </main>
  <script>
    // Handle filter button clicks
    document.querySelectorAll('.filter-button').forEach(btn => {
      btn.addEventListener('click', function() {
        const filter = this.dataset.filter;
        const dropdown = document.getElementById(filter === 'currentCompany' ? 'company-filter-dropdown' : 'location-filter-dropdown');
        // Close other dropdowns
        document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));
        dropdown.classList.toggle('open');
        // Focus input
        dropdown.querySelector('input')?.focus();
      });
    });

    // Handle suggestion clicks - update URL with filter
    document.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', function() {
        const companyId = this.dataset.companyId;
        const geoUrn = this.dataset.geoUrn;
        const url = new URL(window.location);
        if (companyId) {
          url.searchParams.set('currentCompany', '["' + companyId + '"]');
        }
        if (geoUrn) {
          url.searchParams.set('geoUrn', '["' + geoUrn + '"]');
        }
        window.location.href = url.toString();
      });
    });

    // Handle show results button
    document.querySelectorAll('.show-results-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const dropdown = this.closest('.filter-dropdown');
        const selectedSuggestion = dropdown.querySelector('.suggestion-item.selected');
        if (selectedSuggestion) {
          selectedSuggestion.click();
        }
      });
    });

    // Handle typing in filter input - filter suggestions
    document.querySelectorAll('.filter-input').forEach(input => {
      input.addEventListener('input', function() {
        const dropdown = this.closest('.filter-dropdown');
        const suggestions = dropdown.querySelectorAll('.suggestion-item');
        const searchText = this.value.toLowerCase();
        suggestions.forEach(s => {
          const name = (s.dataset.companyName || s.dataset.locationName || '').toLowerCase();
          s.style.display = name.includes(searchText) ? 'block' : 'none';
        });
      });
    });
  </script>
</body>
</html>`,

    connections: `
<!DOCTYPE html>
<html>
<head><title>Connections | LinkedIn</title></head>
<body>
  <header class="global-nav" id="global-nav"></header>
  <main class="scaffold-layout">
    <div class="mn-connections">
      <ul class="mn-connections__list">
        ${(data.connections || state.connections)
          .map(
            (conn) => `
          <li class="mn-connection-card">
            ${conn.profilePictureUrl ? `<img src="${escapeHtml(conn.profilePictureUrl)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">` : ''}
            <a href="/in/${conn.profileId}/" data-test-id="connection-card">
              <span class="mn-connection-card__name">${conn.name}</span>
            </a>
            <button aria-label="Send message to ${conn.name}">Message</button>
          </li>
        `
          )
          .join('')}
      </ul>
    </div>
  </main>
</body>
</html>`,

    invitations: `
<!DOCTYPE html>
<html>
<head><title>Invitations | LinkedIn</title></head>
<body>
  <header class="global-nav" id="global-nav"></header>
  <main class="scaffold-layout">
    <div class="invitation-manager">
      <ul class="invitation-card__list">
        ${(data.invitations || state.pendingInvitations)
          .map(
            (inv) => `
          <li class="invitation-card">
            <a href="/in/${inv.profileId}/">
              <span>${inv.name}</span>
            </a>
            <button aria-label="Accept">Accept</button>
            <button aria-label="Ignore">Ignore</button>
          </li>
        `
          )
          .join('')}
      </ul>
    </div>
  </main>
</body>
</html>`,

    'sent-invitations': `
<!DOCTYPE html>
<html>
<head><title>Sent Invitations | LinkedIn</title></head>
<body>
  <header class="global-nav" id="global-nav"></header>
  <main class="scaffold-layout">
    <div class="invitation-manager">
      <ul class="invitation-card__list">
        ${(data.invitations || state.sentInvitations)
          .map(
            (inv) => `
          <li class="invitation-card">
            <a href="/in/${inv.profileId}/">
              <span>${inv.name}</span>
            </a>
            <span>Pending</span>
            <button aria-label="Withdraw">Withdraw</button>
          </li>
        `
          )
          .join('')}
      </ul>
    </div>
  </main>
</body>
</html>`,

    activity: `
<!DOCTYPE html>
<html>
<head><title>Activity | LinkedIn</title></head>
<body>
  <header class="global-nav" id="global-nav"></header>
  <main class="scaffold-layout">
    <div class="pv-recent-activity">
      ${(data.activities || [])
        .map(
          (act) => `
        <article class="feed-shared-update-v2">
          <p>${act.content}</p>
          <span>${act.timestamp}</span>
        </article>
      `
        )
        .join('')}
    </div>
  </main>
</body>
</html>`,
  };

  return (
    templates[pageName] ||
    `
<!DOCTYPE html>
<html>
<head><title>${pageName} | Mock LinkedIn</title></head>
<body>
  <header class="global-nav" id="global-nav"></header>
  <main class="scaffold-layout">
    <h1>Page: ${pageName}</h1>
    <p>Save your MHTML as ${pageName}.html in the pages/ directory</p>
    <pre>${JSON.stringify(data, null, 2)}</pre>
  </main>
</body>
</html>`
  );
}

// ============ ROUTES ============

// Login
app.get('/login', (req, res) => {
  servePage('login', res);
});

app.post('/uas/login-submit', handleLogin);
app.post('/checkpoint/lg/login-submit', handleLogin);

function handleLogin(req, res) {
  const { session_key, session_password } = req.body;

  // Accept any credentials for testing
  state.loggedIn = true;
  state.currentUser = { email: session_key };

  res.cookie('mock_session', 'authenticated', { httpOnly: true });
  res.redirect('/feed/');
}

// Feed / Home
app.get('/feed/', (req, res) => {
  servePage('feed', res, { posts: state.posts });
});

// Profile pages
app.get('/in/:profileId/', (req, res) => {
  const { profileId } = req.params;
  const person = state.connections.find((c) => c.profileId === profileId) || {
    profileId,
    name: profileId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    headline: 'Mock Profile',
    about: 'This is a mock profile for testing.',
    isConnected: false,
    isPending: state.sentInvitations.some((i) => i.profileId === profileId),
  };
  servePage('profile', res, person);
});

// Profile activity pages
// /posts/ now redirects to /articles/ on LinkedIn
app.get('/in/:profileId/recent-activity/posts/', (req, res) => {
  const { profileId } = req.params;
  res.redirect(`/in/${profileId}/recent-activity/articles/`);
});

// Reactions page has its own HTML
app.get('/in/:profileId/recent-activity/reactions/', (req, res) => {
  const { profileId } = req.params;
  servePage('activity-reactions', res, { profileId, type: 'reactions' });
});

// All other activity types (all, articles, etc.)
app.get('/in/:profileId/recent-activity/:type/', (req, res) => {
  const { profileId, type } = req.params;
  servePage('activity', res, { profileId, type });
});

// Profile overlay - LinkedIn removed this as a direct URL
// Now requires clicking profile name to open modal
// Redirect to profile page for backwards compatibility
app.get('/in/:profileId/overlay/about-this-profile/', (req, res) => {
  const { profileId } = req.params;
  console.log(
    `[MOCK] Overlay URL deprecated - redirecting to profile. LinkedIn now opens modal via profile name click.`
  );
  res.redirect(`/in/${profileId}/`);
});

// Search results
app.get('/search/results/people/', (req, res) => {
  const { keywords, currentCompany, page } = req.query;
  console.log(
    `[MOCK] Search request: currentCompany=${currentCompany}, page=${page}, connections=${state.connections.length}`
  );

  // Filter mock connections based on search params
  let results = [...state.connections];

  // If currentCompany filter is applied, show Amazon employees
  if (currentCompany) {
    results = results.filter(
      (c) =>
        c.company?.toLowerCase().includes('amazon') ||
        c.headline?.toLowerCase().includes('amazon') ||
        c.headline?.toLowerCase().includes('aws')
    );
    console.log(`[MOCK] Company filter applied, returning ${results.length} Amazon results`);
  }

  if (keywords) {
    results = results.filter(
      (c) =>
        c.name?.toLowerCase().includes(keywords.toLowerCase()) ||
        c.headline?.toLowerCase().includes(keywords.toLowerCase())
    );
  }

  // If we have results and a company filter, inject them directly into the HTML
  if (results.length > 0 && currentCompany) {
    const resultsHtml = generateSearchResultsHtml(results);
    return res.send(resultsHtml);
  }

  servePage('search-results', res, { results, keywords });
});

// Generate search results HTML with mock people
function generateSearchResultsHtml(people) {
  // Use linkedin.com URLs - Puppeteer filters for this domain
  // The browser will navigate to these, but our mock intercepts them
  const peopleHtml = people
    .map(
      (person) => `
    <li class="reusable-search__result-container" style="padding:12px; margin-bottom:8px; background:white; border-radius:8px; list-style:none;">
      <div class="entity-result" style="display:flex; align-items:flex-start; gap:12px;">
        ${person.profilePictureUrl ? `<img src="${escapeHtml(person.profilePictureUrl)}" alt="" style="width:72px; height:72px; border-radius:50%; object-fit:cover; flex-shrink:0;">` : `<div style="width:72px; height:72px; background:#e7e2dc; border-radius:50%; flex-shrink:0;"></div>`}
        <div style="flex:1;">
          <a href="https://www.linkedin.com/in/${escapeHtml(person.profileId)}/" class="entity-result__title-text app-aware-link" style="font-weight:600; color:#000; text-decoration:none; display:block; margin-bottom:4px;">
            <span>${escapeHtml(person.name)}</span>
          </a>
          <p class="entity-result__primary-subtitle" style="color:#666; margin:0 0 4px 0; font-size:14px;">${escapeHtml(person.headline || '')}</p>
          <p style="color:#666; margin:0 0 8px 0; font-size:12px;">${escapeHtml(person.connectionDegree || '2nd')} · ${escapeHtml(person.recentActivity || 'Active recently')}</p>
          <button aria-label="Connect with ${escapeHtml(person.name)}" style="padding:6px 16px; border:1px solid #0a66c2; border-radius:16px; background:transparent; color:#0a66c2; cursor:pointer;">Connect</button>
        </div>
      </div>
    </li>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search Results | Mock LinkedIn</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f2ef; margin: 0; padding: 20px; }
    .search-results-container { max-width: 900px; margin: 0 auto; }
    header { background: white; padding: 12px 20px; margin-bottom: 20px; border-radius: 8px; }
    h1 { font-size: 18px; margin: 0; }
  </style>
</head>
<body>
  <header class="global-nav" id="global-nav" data-view-name="navigation-homepage">
    <h1>${people.length} results</h1>
  </header>
  <main class="scaffold-layout">
    <div class="search-results-container">
      <ul class="reusable-search__entity-result-list" style="padding:0; margin:0;">
        ${peopleHtml}
      </ul>
      <button class="artdeco-pagination__button--next" aria-label="Next" style="display:none;">Next</button>
    </div>
  </main>
  <script src="/public/mock-interactions.js"></script>
</body>
</html>`;
}

// Messaging - main view
app.get('/messaging/', (req, res) => {
  servePage('messaging', res);
});

// Messaging - new thread (compose)
app.get('/messaging/thread/new', (req, res) => {
  servePage('messaging', res, { connections: state.connections });
});

// My Network - Connections
app.get('/mynetwork/invite-connect/connections/', (req, res) => {
  servePage('connections', res, { connections: state.connections });
});

// My Network - Received invitations
app.get('/mynetwork/invitation-manager/received/', (req, res) => {
  servePage('invitations', res, { invitations: state.pendingInvitations });
});

// My Network - Sent invitations
app.get('/mynetwork/invitation-manager/sent/', (req, res) => {
  servePage('sent-invitations', res, { invitations: state.sentInvitations });
});

// ============ API ACTIONS (for form submissions) ============

// Send connection request
app.post('/api/connect', (req, res) => {
  const { profileId, message } = req.body;
  state.sentInvitations.push({
    profileId,
    name: profileId,
    message,
    sentAt: new Date().toISOString(),
  });
  console.log(`[MOCK] Connection request sent to ${profileId}`);
  res.json({ success: true });
});

// Send message
app.post('/api/message', (req, res) => {
  const { recipientId, content } = req.body;
  state.messages.push({
    recipientId,
    content,
    sentAt: new Date().toISOString(),
  });
  const preview = (content || '').substring(0, 50);
  console.log(`[MOCK] Message sent to ${recipientId}: ${preview}...`);
  res.json({ success: true });
});

// Create post
app.post('/api/post', (req, res) => {
  const { content, mediaUrl } = req.body;
  const post = {
    id: `post-${Date.now()}`,
    content,
    mediaUrl,
    createdAt: new Date().toISOString(),
  };
  state.posts.unshift(post);
  const preview = (content || '').substring(0, 50);
  console.log(`[MOCK] Post created: ${preview}...`);
  res.json({ success: true, post });
});

// Get current state (for debugging)
app.get('/api/state', (req, res) => {
  res.json(state);
});

// ============ RAGStack Proxy (mock) ============

let mockScrapeJobCounter = 0;

app.post('/ragstack', (req, res) => {
  const { operation } = req.body;

  console.log('\n========== MOCK RAGStack: POST /ragstack ==========');
  console.log('Operation:', operation);
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('===================================================\n');

  if (operation === 'scrape_start') {
    const { profileId } = req.body;
    mockScrapeJobCounter++;
    const jobId = `mock-scrape-job-${mockScrapeJobCounter}`;
    const baseUrl = `https://www.linkedin.com/in/${profileId}/`;
    console.log(`✅ Started mock scrape job ${jobId} for ${profileId}`);
    return res.json({ jobId, baseUrl, status: 'COMPLETED' });
  }

  if (operation === 'scrape_status') {
    const { jobId } = req.body;
    console.log(`🔍 Scrape status check for ${jobId}`);
    return res.json({
      jobId,
      baseUrl: '',
      status: 'COMPLETED',
      totalUrls: 1,
      processedCount: 1,
      failedCount: 0,
    });
  }

  if (operation === 'ingest') {
    const { profileId } = req.body;
    console.log(`✅ Mock ingest for ${profileId}`);
    return res.json({ status: 'uploaded', documentId: `mock-doc-${profileId}` });
  }

  if (operation === 'search') {
    const { query } = req.body;
    console.log(`🔍 Mock search for "${query}"`);
    return res.json({ results: [], totalResults: 0 });
  }

  if (operation === 'status') {
    const { documentId } = req.body;
    console.log(`🔍 Mock document status for ${documentId}`);
    return res.json({ status: 'indexed', documentId, error: null });
  }

  console.log('❌ Unknown RAGStack operation:', operation);
  res.status(400).json({ error: `Unsupported ragstack operation: ${operation}` });
});

// ============ MOCK DynamoDB API (for testing) ============

// Edge operations (upsert_status, check_exists)
app.post('/edges', (req, res) => {
  const { operation, profileId, linkedinurl, updates } = req.body;

  console.log('\n========== MOCK DynamoDB: POST /edge ==========');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('===============================================\n');

  if (operation === 'upsert_status') {
    // Store edge in memory
    state.edges = state.edges || {};
    state.edges[profileId] = {
      profileId,
      ...updates,
      createdAt: state.edges[profileId]?.createdAt || new Date().toISOString(),
    };
    console.log(`✅ Upserted edge for "${profileId}":`);
    console.log('   Status:', updates?.status);
    console.log('   Full edge:', JSON.stringify(state.edges[profileId], null, 2));
    return res.json({ success: true, edge: state.edges[profileId] });
  }

  if (operation === 'check_exists') {
    const key = linkedinurl || profileId;
    const exists = !!(state.edges && state.edges[key]);
    console.log(`🔍 Edge exists check for "${key}": ${exists}`);
    return res.json({ result: { exists } });
  }

  console.log('❌ Unknown operation:', operation);
  res.status(400).json({ error: 'Unknown operation' });
});

// Profiles operations
app.get('/profiles', (req, res) => {
  const { profileId } = req.query;

  console.log('\n========== MOCK DynamoDB: GET /profiles ==========');
  console.log('Query params:', JSON.stringify(req.query, null, 2));
  console.log('==================================================\n');

  state.profiles = state.profiles || {};
  const profile = state.profiles[profileId];

  if (profile) {
    console.log(`✅ Found profile "${profileId}":`, JSON.stringify(profile, null, 2));
    return res.json({ profile });
  }

  console.log(`⚪ Profile "${profileId}" not found (will trigger analysis)`);
  return res.json({ profile: null });
});

app.post('/profiles', (req, res) => {
  const { operation, profileId, updates } = req.body;

  console.log('\n========== MOCK DynamoDB: POST /profiles ==========');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('===================================================\n');

  state.profiles = state.profiles || {};

  if (operation === 'create') {
    state.profiles[profileId] = {
      profileId,
      ...updates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluated: updates.evaluated ?? false,
    };
    console.log(`✅ Created profile "${profileId}":`);
    console.log('   Updates:', JSON.stringify(updates, null, 2));
    return res.json({ success: true, profile: state.profiles[profileId] });
  }

  if (operation === 'update') {
    if (!state.profiles[profileId]) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    state.profiles[profileId] = {
      ...state.profiles[profileId],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    console.log(`✅ Updated profile "${profileId}":`);
    console.log('   Updates:', JSON.stringify(updates, null, 2));
    return res.json({ success: true, profile: state.profiles[profileId] });
  }

  if (operation === 'update_profile_picture') {
    const pictureUrl = req.body.profilePictureUrl || '';
    state.profiles[profileId] = state.profiles[profileId] || {};
    state.profiles[profileId].profilePictureUrl = pictureUrl;
    state.profiles[profileId].updatedAt = new Date().toISOString();
    console.log(`✅ Updated profile picture for "${profileId}": ${pictureUrl}`);
    return res.json({ message: 'Profile picture updated', profileId });
  }

  console.log('❌ Unknown operation:', operation);
  res.status(400).json({ error: 'Unknown operation' });
});

// Reset state
app.post('/api/reset', (req, res) => {
  state.loggedIn = false;
  state.messages = [];
  state.edges = {};
  state.profiles = {};
  state.posts = [];
  state.sentInvitations = [];
  loadMockData();
  res.json({ success: true });
});

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'mock-linkedin' });
});

// Catch-all for unhandled routes
app.use('*', (req, res) => {
  console.log(`[MOCK] Unhandled route: ${req.method} ${req.originalUrl}`);
  const safePath = escapeHtml(req.originalUrl);
  res.status(404).send(`
    <html>
      <body>
        <h1>Mock LinkedIn - Route not found</h1>
        <p>Path: ${safePath}</p>
        <p>Add this route to server.js or save an HTML file for this page.</p>
      </body>
    </html>
  `);
});

// Start server
loadMockData();
app.listen(PORT, () => {
  console.log(`
========================================
  Mock LinkedIn Server
  http://localhost:${PORT}
========================================

Available routes:
  GET  /login                              - Login page
  GET  /feed/                              - Home feed
  GET  /in/:profileId/                     - Profile page
  GET  /in/:profileId/recent-activity/:type/  - Activity pages
  GET  /search/results/people/             - Search results
  GET  /messaging/thread/new              - New message compose
  GET  /mynetwork/invite-connect/connections/  - Your connections
  GET  /mynetwork/invitation-manager/received/ - Received invitations
  GET  /mynetwork/invitation-manager/sent/ - Sent invitations

API endpoints (for testing):
  POST /api/connect   - Send connection request
  POST /api/message   - Send message
  POST /api/post      - Create post
  GET  /api/state     - View current state
  POST /api/reset     - Reset state

Saved pages loaded:
     - login.html
     - feed.html
     - profile.html
     - messaging.html (new thread / message compose)
     - search-results.html
     - connections.html
     - invitations.html
     - sent-invitations.html
     - activity.html
     - activity-reactions.html
========================================
`);
});
