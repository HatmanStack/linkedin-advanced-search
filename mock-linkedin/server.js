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
  sentInvitations: []
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
  html = html.replace('</body>', '<header data-view-name="navigation-homepage" style="display:block;width:100%;height:2px;"></header><script src="/public/mock-interactions.js"></script></body>');

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
      ${(data.posts || []).map(p => `<article class="feed-post">${p.content}</article>`).join('')}
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
        ${data.isConnected ? `
          <button aria-label="Message ${data.name}" data-test-id="message-button">Message</button>
        ` : data.isPending ? `
          <button aria-label="Pending" data-test-id="pending-button">Pending</button>
        ` : `
          <button aria-label="Connect with ${data.name}" data-test-id="connect-button" class="artdeco-button">Connect</button>
        `}
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
<head><title>Search Results | LinkedIn</title></head>
<body>
  <header class="global-nav" id="global-nav"></header>
  <main class="scaffold-layout">
    <div class="search-results-container">
      <ul class="reusable-search__entity-result-list">
        ${(data.results || state.connections.slice(0, 10)).map(person => `
          <li class="reusable-search__result-container">
            <div class="entity-result">
              <a href="/in/${person.profileId}/" class="entity-result__title-text">
                <span>${person.name}</span>
              </a>
              <p class="entity-result__primary-subtitle">${person.headline || ''}</p>
              <button aria-label="Connect with ${person.name}">Connect</button>
            </div>
          </li>
        `).join('')}
      </ul>
      <button class="artdeco-pagination__button--next" aria-label="Next">Next</button>
    </div>
  </main>
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
        ${(data.connections || state.connections).map(conn => `
          <li class="mn-connection-card">
            <a href="/in/${conn.profileId}/" data-test-id="connection-card">
              <span class="mn-connection-card__name">${conn.name}</span>
            </a>
            <button aria-label="Send message to ${conn.name}">Message</button>
          </li>
        `).join('')}
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
        ${(data.invitations || state.pendingInvitations).map(inv => `
          <li class="invitation-card">
            <a href="/in/${inv.profileId}/">
              <span>${inv.name}</span>
            </a>
            <button aria-label="Accept">Accept</button>
            <button aria-label="Ignore">Ignore</button>
          </li>
        `).join('')}
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
        ${(data.invitations || state.sentInvitations).map(inv => `
          <li class="invitation-card">
            <a href="/in/${inv.profileId}/">
              <span>${inv.name}</span>
            </a>
            <span>Pending</span>
            <button aria-label="Withdraw">Withdraw</button>
          </li>
        `).join('')}
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
      ${(data.activities || []).map(act => `
        <article class="feed-shared-update-v2">
          <p>${act.content}</p>
          <span>${act.timestamp}</span>
        </article>
      `).join('')}
    </div>
  </main>
</body>
</html>`
  };

  return templates[pageName] || `
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
</html>`;
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
  const person = state.connections.find(c => c.profileId === profileId) || {
    profileId,
    name: profileId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    headline: 'Mock Profile',
    about: 'This is a mock profile for testing.',
    isConnected: false,
    isPending: state.sentInvitations.some(i => i.profileId === profileId)
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
  console.log(`[MOCK] Overlay URL deprecated - redirecting to profile. LinkedIn now opens modal via profile name click.`);
  res.redirect(`/in/${profileId}/`);
});

// Search results
app.get('/search/results/people/', (req, res) => {
  const { keywords, company, title } = req.query;

  // Filter mock connections based on search params
  let results = [...state.connections];
  if (keywords) {
    results = results.filter(c =>
      c.name?.toLowerCase().includes(keywords.toLowerCase()) ||
      c.headline?.toLowerCase().includes(keywords.toLowerCase())
    );
  }

  servePage('search-results', res, { results, keywords, company, title });
});

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
    sentAt: new Date().toISOString()
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
    sentAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
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

// Reset state
app.post('/api/reset', (req, res) => {
  state.loggedIn = false;
  state.messages = [];
  state.posts = [];
  state.sentInvitations = [];
  loadMockData();
  res.json({ success: true });
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
