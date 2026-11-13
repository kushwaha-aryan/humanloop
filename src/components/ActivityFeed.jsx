import { Icon } from './Icons.jsx';
import { EmptyState } from './ui.jsx';
import { activityIcon } from '../lib/stats.js';
import { timeAgo } from '../lib/fmt.js';

export function ActivityFeed({ activities = [], emptyBody = 'Completing tasks, logging focus sessions, and applying plans will show up here.' }) {
  if (activities.length === 0) {
    return <EmptyState compact icon="layers" title="No activity yet" body={emptyBody} />;
  }
  return (
    <ul className="activity-feed">
      {activities.map((activity) => (
        <li key={activity.id} className="activity-item">
          <span className={`activity-icon type-${activity.type}`} aria-hidden="true">
            <Icon name={activityIcon(activity.type)} size={12} />
          </span>
          <div className="activity-main">
            <p>{activity.message}</p>
            <time dateTime={activity.at}>{timeAgo(activity.at)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
