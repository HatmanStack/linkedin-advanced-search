<div align="center" style="display: block;margin-left: auto;margin-right: auto;width: 50%;">
<h1>LinkedIn Advanced Search</h1>
<div style="display: flex; justify-content: center; align-items: center;">
  <h4 style="margin: 0; display: flex;">
    <a href="https://www.apache.org/licenses/LICENSE-2.0.html">
      <img src="https://img.shields.io/badge/license-Apache2.0-blue" alt="LinkedIn Advanced Search is under the Apache 2.0 license" />
    </a>
    <a href="https://vitejs.dev/">
      <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite" />
    </a>
    <a href="https://react.dev/">
      <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React" />
    </a>
    <a href="https://www.typescriptlang.org/">
      <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    </a>
    <a href="https://pptr.dev/">
      <img src="https://img.shields.io/badge/Puppeteer-violet" alt="Puppeteer" />
    </a>
    <a href="https://nodejs.org/en">
      <img src="https://img.shields.io/badge/Node-green" alt="Node" />
    </a>
  </h4>
</div>

  <p><b>Search LinkedIn Based on User Recent Activity</b></p>
  </p>
</div>

## 🚀 What's New in This Refactor

- **Modern Tech Stack**: Built with Vite + React 19 + TypeScript
- **Component Architecture**: Modular, reusable components with proper separation of concerns
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Form Validation**: Real-time validation with user-friendly error messages
- **Responsive Design**: Mobile-first design with professional LinkedIn branding
- **State Management**: Custom hooks for clean state management and API calls
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Code Quality**: ESLint, organized file structure, and clean code practices

## Prerequisites

- Node v18+
- npm or yarn

## Install & Run

### Frontend (Refactored Version)
```bash
git clone <your-repo-url>
cd ../linkedin-advanced-search/backend
npm install
```

The frontend will be running at http://localhost:5173 (or next available port)

### Backend 
To use with the backend, ensure you have the backend running:
```bash
cd ../linkedin-advanced-search/backend
npm install
npx nodemon --config nodemon.json server.js
```

The backend API will be running at http://localhost:3001

## 🏗️ Project Structure

```
src/
├── components/
│   ├── SearchForm/          # Search form with validation
│   ├── ResultsList/         # Results display components
│   └── common/              # Reusable UI components
├── hooks/                   # Custom React hooks
│   ├── useSearchResults.ts  # Search state management
│   ├── useLocalStorage.ts   # Local storage hook
│   └── useApi.ts           # API call management
├── services/
│   └── api.ts              # API service layer
├── utils/
│   ├── validation.ts       # Form validation logic
│   └── constants.ts        # App constants
└── styles/                 # Global styles and CSS variables
```

## 🎨 Features

- **Professional UI**: LinkedIn-branded design with modern styling
- **Form Validation**: Real-time validation with helpful error messages
- **Loading States**: Visual feedback during API calls
- **Visited Link Tracking**: Persistent tracking of visited LinkedIn profiles
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Error Handling**: Graceful error handling with user-friendly messages
- **TypeScript**: Full type safety and better developer experience

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### API Integration

The frontend is configured to connect to the backend API at `http://localhost:3001`. Ensure the original backend is running for full functionality.

## ⚠️ Note on LinkedIn Automation

- View browser activity in non-headless mode for manual verification
- Search timeouts are handled via local txt file caching in backend/
- Configure login credentials and authentication settings appropriately
- Searching for Companies can occasionally get snagged. To bypass manually navigate to company page in non-headless browser.
- **Review LinkedIn's automation policies before use**

## 🔗 Related

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## 📝 License

Apache 2.0 - see the [LICENSE](https://www.apache.org/licenses/LICENSE-2.0.html) file for details.