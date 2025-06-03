# LinkedIn Advanced Search 

Modern, modular backend for LinkedIn Advanced Search

## 🚀 Features

- **Modular Architecture**: Separated concerns with services, controllers, and utilities
- **Environment Configuration**: Flexible configuration via environment variables
- **Comprehensive Logging**: Winston-based logging with multiple transports
- **Error Handling**: Robust error handling and graceful failures
- **Type Safety**: Modern ES modules with proper imports
- **Configuration Management**: Centralized configuration with validation
- **File Management**: Organized file operations and data persistence

## 📁 Project Structure

```
Backend/
├── src/
│   └── server.js           # Main server entry point
├── config/
│   └── index.js           # Centralized configuration
├── controllers/
│   └── searchController.js # Search logic and API endpoints
├── routes/
│   └── searchRoutes.js    # Express route definitions
├── services/
│   ├── puppeteerService.js # Browser automation service
│   └── linkedinService.js  # LinkedIn-specific operations
├── utils/
│   ├── logger.js          # Winston logging configuration
│   ├── fileHelpers.js     # File system operations
│   └── randomHelpers.js   # Random utilities for human-like behavior
├── package.json
├── .env.example
├── nodemon.json
└── README.md
```

## 🛠️ Installation & Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration (Frontend URLs)
FRONTEND_URLS=http://localhost:3000,http://localhost:5173

# LinkedIn Search Parameters
RECENCY_HOURS=6
RECENCY_DAYS=5
RECENCY_WEEKS=3
HISTORY_TO_CHECK=4
THRESHOLD=8
PAGE_NUMBER_START=50
PAGE_NUMBER_END=100

# Google AI API Key (optional)
GOOGLE_AI_API_KEY=your_api_key_here

# Puppeteer Settings
HEADLESS=false
SLOW_MO=50
```

### 3. Start the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## 🔧 Configuration Options

### LinkedIn Search Parameters
- `RECENCY_HOURS` (6): Weight for very recent activity (last day)
- `RECENCY_DAYS` (5): Weight for recent activity (last 6 days)
- `RECENCY_WEEKS` (3): Weight for older activity (last 3 weeks)
- `HISTORY_TO_CHECK` (4): Number of scroll iterations on activity pages
- `THRESHOLD` (8): Minimum combined score to consider a contact "good"
- `PAGE_NUMBER_START/END` (1-100): LinkedIn search result pages to process

### Puppeteer Settings
- `HEADLESS` (false): Run browser in headless mode
- `SLOW_MO` (50): Delay between actions in milliseconds
- `VIEWPORT_WIDTH/HEIGHT`: Browser viewport dimensions

## 📡 API Endpoints

### POST `/`
Perform LinkedIn search with the following payload:
```json
{
  "companyName": "Company Name",
  "companyRole": "Software Engineer",
  "companyLocation": "New York, NY",
  "searchName": "your_linkedin_email",
  "searchPassword": "your_linkedin_password"
}
```

### GET `/results`
Retrieve previously stored search results.

### GET `/health`
Health check endpoint with system status.

## 📊 Response Format

```json
{
  "response": ["profile-id-1", "profile-id-2"],
  "metadata": {
    "totalProfilesAnalyzed": 1500,
    "goodContactsFound": 75,
    "successRate": "5.00%",
    "searchParameters": {
      "companyName": "Company Name",
      "companyRole": "Software Engineer",
      "companyLocation": "New York, NY",
      "pagesSearched": 51
    }
  }
}
```

## 🔍 How It Works

1. **Authentication**: Logs into LinkedIn using provided credentials
2. **Company Search**: Finds the target company profile
3. **Jobs Navigation**: Navigates to company jobs section with location filter
4. **People Search**: Searches through company employee pages
5. **Activity Analysis**: Analyzes each profile's recent LinkedIn activity
6. **Scoring**: Scores contacts based on recent activity frequency
7. **Results**: Returns profiles that meet the activity threshold

## 🛡️ Security & Best Practices

- **Credential Handling**: Credentials are not logged or stored
- **Rate Limiting**: Random delays between actions
- **Error Recovery**: Graceful handling of LinkedIn layout changes
- **Resource Cleanup**: Proper browser cleanup on completion/error
- **Logging**: Comprehensive logging without sensitive data exposure

## ⚠️ Important Notes

- **LinkedIn ToS**: Review LinkedIn's terms of service and automation policies
- **Browser Visibility**: Runs in non-headless mode by default for transparency
- **Data Storage**: Results are cached locally in JSON files
- **Error Handling**: Continues processing even if individual profiles fail

## 🐛 Troubleshooting

### Common Issues

1. **Login Failures**: LinkedIn may require 2FA or CAPTCHA verification
2. **Element Not Found**: LinkedIn frequently changes their DOM structure
3. **Rate Limiting**: Too many requests may trigger LinkedIn's rate limiting
4. **Puppeteer Issues**: Ensure Chrome/Chromium is properly installed

### Debugging

Enable debug logging by setting:
```env
NODE_ENV=development
```

Check logs in the `logs/` directory for detailed error information.

## 📝 License

Apache 2.0 - see the [LICENSE](https://www.apache.org/licenses/LICENSE-2.0.html) file for details.