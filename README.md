<div align="center" style="display: block;margin-left: auto;margin-right: auto;width: 50%;">
<h1>LinkedIn Advanced Search</h1>
<div style="display: flex; justify-content: center; align-items: center;">
  <h4 style="margin: 0; display: flex;">
    <a href="https://www.apache.org/licenses/LICENSE-2.0.html">
      <img src="https://img.shields.io/badge/license-Apache2.0-blue" alt="LinkedIn Advanced Search is under the Apache 2.0 liscense" />
    </a>
    <a href="https://pptr.dev/">
      <img src="https://img.shields.io/badge/Puppeteer-violet" alt="Puppeteer" />
    </a>
    <a href="https://nodejs.org/en">
      <img src="https://img.shields.io/badge/Node-green" alt="Node" />
    </a>
  </h4>
</div>

  <p><b>Search LinkedIn Based on User Recent Activity</b> </p>
</div>

## Prerequisites

- Node v18+

## Install

```script
git clone https://github.com/HatmanStack/linkedin-advanced-search.git
cd linkedin
npm install
npm start
cd backend
npx nodemon server.js
```

After this the frontend will be running at http://localhost:3000

## Note on LinkedIn Automation:

- View browser activity in non-headless mode for manual verification
- Search timeouts are handled via local txt file caching in backend/
- Configure login credentials and authentication settings appropriately (alternate account connected to your main)
- Review LinkedIn's automation policies before use
