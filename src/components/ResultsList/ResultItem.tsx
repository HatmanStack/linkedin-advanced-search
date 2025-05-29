import type { FC } from 'react';
import styles from './ResultItem.module.css';

interface ResultItemProps {
  profileId: string;
  isVisited: boolean;
  onLinkClick: (profileId: string) => void;
  onContextMenu: (profileId: string) => void;
}

const ResultItem: FC<ResultItemProps> = ({
  profileId,
  isVisited,
  onLinkClick,
  onContextMenu,
}) => {
  const linkedinUrl = `https://www.linkedin.com/in/${profileId}`;

  const handleClick = () => {
    onLinkClick(profileId);
  };

  const handleContextMenu = () => {
    onContextMenu(profileId);
  };

  return (
    <li className={styles.resultItem}>
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.link} ${isVisited ? styles.visited : styles.unvisited}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div className={styles.profileInfo}>
          <span className={styles.profileId}>{profileId}</span>
          <span className={styles.profileUrl}>{linkedinUrl}</span>
        </div>
        <div className={styles.statusIndicator}>
          {isVisited && <span className={styles.visitedBadge}>Visited</span>}
        </div>
      </a>
    </li>
  );
};

export default ResultItem;