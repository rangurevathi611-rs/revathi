import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert } from '../components/ui.jsx';
import { describeEvent, formatWhen } from '../format.js';

const ACTIONS = [
  ['', 'All actions'],
  ['login', 'Sign in'],
  ['upload', 'Upload'],
  ['view', 'View'],
  ['download', 'Download'],
  ['share', 'Share'],
  ['revoke', 'Revoke'],
  ['delete', 'Delete'],
  ['role_change', 'Role change'],
];

export default function AuditLog() {
  const [action, setAction] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError('');
    api(`/audit${action ? `?action=${action}` : ''}`)
      .then((data) => {
        if (!cancel) setEvents(data.events);
      })
      .catch((err) => {
        if (!cancel) setError(err.message);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [action]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Company</p>
          <h1>Audit trail</h1>
        </div>
        <label className="field compact">
          <span>Action</span>
          <select value={action} onChange={(event) => setAction(event.target.value)}>
            {ACTIONS.map(([value, label]) => (
              <option key={value || 'all'} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </header>
      <p className="hint standalone">
        These records are append-only. Deleting a document removes the file, not the history of who touched it.
      </p>
      <Alert>{error}</Alert>
      {loading ? (
        <p className="hint">Loading the trail…</p>
      ) : events.length === 0 ? (
        <div className="empty">
          <h2>No events for this filter</h2>
          <p>Uploads, shares, downloads, and role changes will appear here.</p>
        </div>
      ) : (
        <ol className="timeline panel">
          {events.map((event) => (
            <li key={event.id}>
              <span className="dot" aria-hidden="true" />
              <div>
                <div className="event-line">
                  <span className={`pill ${event.action}`}>{event.action.replace('_', ' ')}</span>
                  <time dateTime={event.createdAt}>{formatWhen(event.createdAt)}</time>
                </div>
                <p>{describeEvent(event)}</p>
                <p className="hint">
                  {event.actor?.name}
                  {event.actor?.email ? ` · ${event.actor.email}` : ''}
                  {event.ip ? ` · ${event.ip}` : ''}
                  {event.document?.id ? (
                    <>
                      {' · '}
                      <Link to={`/documents/${event.document.id}`}>{event.document.title}</Link>
                    </>
                  ) : event.document?.title ? (
                    ` · ${event.document.title}`
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
