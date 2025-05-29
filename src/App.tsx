import { SearchForm } from './components/SearchForm';
import { ResultsList } from './components/ResultsList';
import { useSearchResults } from './hooks';
import type { SearchFormData } from './utils/validation';
import './styles/globals.css';
import './styles/variables.css';
import styles from './App.module.css';

function App() {
  const {
    results,
    visitedLinks,
    loading,
    error,
    searchLinkedIn,
    markAsVisited,
    clearResults,
    clearVisitedLinks,
  } = useSearchResults();

  const handleSearch = async (formData: SearchFormData) => {
    await searchLinkedIn(formData);
  };

  const handleLinkClick = (profileId: string) => {
    markAsVisited(profileId);
  };

  const handleContextMenu = (profileId: string) => {
    markAsVisited(profileId);
  };

  const handleClearResults = () => {
    if (window.confirm('Are you sure you want to clear all search results?')) {
      clearResults();
    }
  };

  const handleClearVisited = () => {
    if (window.confirm('Are you sure you want to clear all visited link history?')) {
      clearVisitedLinks();
    }
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.container}>
          <h1 className={styles.title}>LinkedIn Advanced Search</h1>
          <p className={styles.subtitle}>
            Search LinkedIn Based on User Recent Activity
          </p>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <SearchForm onSubmit={handleSearch} loading={loading} />
          
          {error && (
            <div className={styles.errorAlert}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {(results.length > 0 || loading) && (
            <>
              <div className={styles.controls}>
                <button
                  onClick={handleClearResults}
                  className={styles.clearButton}
                  disabled={loading || results.length === 0}
                >
                  Clear Results
                </button>
                <button
                  onClick={handleClearVisited}
                  className={styles.clearButton}
                  disabled={Object.keys(visitedLinks).length === 0}
                >
                  Clear Visited
                </button>
              </div>

              <ResultsList
                results={results}
                visitedLinks={visitedLinks}
                onLinkClick={handleLinkClick}
                onContextMenu={handleContextMenu}
                loading={loading}
              />
            </>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <p className={styles.footerText}>
            LinkedIn Advanced Search • Built with React & TypeScript
          </p>
          <p className={styles.disclaimer}>
            Please review LinkedIn's automation policies before use
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;