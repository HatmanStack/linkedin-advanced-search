import type { FC } from 'react';
import ResultItem from './ResultItem';
import styles from './ResultsList.module.css';

interface ResultsListProps {
  results: string[];
  visitedLinks: Record<string, boolean>;
  onLinkClick: (profileId: string) => void;
  onContextMenu: (profileId: string) => void;
  loading?: boolean;
}

const ResultsList: FC<ResultsListProps> = ({
  results,
  visitedLinks,
  onLinkClick,
  onContextMenu,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Searching LinkedIn profiles...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <h3 className={styles.emptyTitle}>No results found</h3>
          <p className={styles.emptyDescription}>
            Try adjusting your search criteria or check your search parameters.
          </p>
        </div>
      </div>
    );
  }

  const visitedCount = results.filter(result => visitedLinks[result]).length;
  const unvisitedCount = results.length - visitedCount;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Search Results</h3>
        <div className={styles.stats}>
          <span className={styles.stat}>
            <span className={styles.statNumber}>{results.length}</span> total
          </span>
          <span className={styles.stat}>
            <span className={styles.statNumber}>{unvisitedCount}</span> unvisited
          </span>
          <span className={styles.stat}>
            <span className={styles.statNumber}>{visitedCount}</span> visited
          </span>
        </div>
      </div>
      
      <ul className={styles.resultsList}>
        {results.map((result, index) => (
          <ResultItem
            key={`${result}-${index}`}
            profileId={result}
            isVisited={visitedLinks[result] || false}
            onLinkClick={onLinkClick}
            onContextMenu={onContextMenu}
          />
        ))}
      </ul>
    </div>
  );
};

export default ResultsList;