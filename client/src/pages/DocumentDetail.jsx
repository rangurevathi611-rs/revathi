import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, downloadFile } from '../api.js';
import { Alert } from '../components/ui.jsx';
import { describeEvent, fileKind, formatBytes, formatDay, formatWhen, roleLabel, todayInputValue } from '../format.js';

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [grants, setGrants] = useState([]);
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [canDownload, setCanDownload] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [shareError, setShareError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const detail = await api(`/documents/${id}`);
        if (cancel) return;
        const audit = await api(`/documents/${id}/audit`);
        if (cancel) return;
        let directory = [];
        if (detail.document.canManage) {
          const data = await api('/members');
          directory = data.members;
        }
        if (cancel) return;
        setDoc(detail.document);
        setGrants(detail.grants || []);
        setEvents(audit.events);
        setMembers(directory);
      } catch (err) {
        if (!cancel) setError(err.message);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  const candidates = useMemo(() => {
    if (!doc) return [];
    return members.filter(
      (member) =>
        member.active &&
        member.id !== doc.owner.id &&
        member.role !== 'owner' &&
        member.role !== 'admin'
    );
  }, [members, doc]);

  async function refreshTrail() {
    const [detail, audit] = await Promise.all([
      api(`/documents/${id}`),
      api(`/documents/${id}/audit`),
    ]);
    setDoc(detail.document);
    setGrants(detail.grants || []);
    setEvents(audit.events);
  }

  async function onShare(event) {
    event.preventDefault();
    setShareError('');
    setPending(true);
    try {
      await api(`/documents/${id}/grants`, {
        method: 'POST',
        body: { userId, canDownload, expiresAt },
      });
      setUserId('');
      setExpiresAt('');
      await refreshTrail();
    } catch (err) {
      setShareError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function onRevoke(memberId) {
    setActionError('');
    try {
      await api(`/documents/${id}/grants/${memberId}`, { method: 'DELETE' });
      await refreshTrail();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function onDownload() {
    setActionError('');
    try {
      await downloadFile(doc.id, doc.originalName);
      const audit = await api(`/documents/${id}/audit`);
      setEvents(audit.events);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete “${doc.title}”? The file is removed. The audit trail keeps the record.`)) return;
    setActionError('');
    try {
      await api(`/documents/${id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function copyHash() {
    try {
      await navigator.clipboard.writeText(doc.sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="hint">Opening the document…</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="page">
        <Link className="back" to="/">Back to documents</Link>
        <div className="empty">
          <h2>This document is not available</h2>
          <p>{error || 'It may belong to another company, or access was revoked.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Link className="back" to="/">Back to documents</Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">{fileKind(doc.originalName)}</p>
          <h1>{doc.title}</h1>
        </div>
        <div className="button-row">
          {doc.canDownload && (
            <button type="button" className="button primary" onClick={onDownload}>
              Download
            </button>
          )}
          {doc.canManage && (
            <button type="button" className="button danger" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </header>
      <Alert>{actionError}</Alert>

      <div className="detail-grid">
        <section className="stack">
          <div className="panel">
            <dl className="facts">
              <div>
                <dt>Owner</dt>
                <dd>{doc.owner.name}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{doc.originalName}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(doc.size)}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{formatWhen(doc.createdAt)}</dd>
              </div>
            </dl>
            <div className="hash-row">
              <span>SHA-256</span>
              <code title={doc.sha256}>{doc.sha256}</code>
              <button type="button" className="text-button dark" onClick={copyHash}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {!doc.canDownload && (
              <p className="hint">You can read this record, but downloading the file is not included in your grant.</p>
            )}
          </div>

          <div className="panel">
            <h2>Activity on this document</h2>
            {events.length === 0 ? (
              <p className="hint">No activity yet.</p>
            ) : (
              <ol className="timeline">
                {events.map((event) => (
                  <li key={event.id}>
                    <span className="dot" aria-hidden="true" />
                    <div>
                      <div className="event-line">
                        <span className={`pill ${event.action}`}>{event.action.replace('_', ' ')}</span>
                        <time dateTime={event.createdAt}>{formatWhen(event.createdAt)}</time>
                      </div>
                      <p>{describeEvent(event)}</p>
                      <p className="hint">{event.actor?.name}{event.ip ? ` · ${event.ip}` : ''}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <aside className="panel access-panel">
          <h2>Who has access</h2>
          {doc.canManage ? (
            <>
              <p className="hint">Owners and admins can already open every document in this company.</p>
              <form onSubmit={onShare} className="stack tight">
                <Alert>{shareError}</Alert>
                <label className="field">
                  <span>Person</span>
                  <select value={userId} onChange={(event) => setUserId(event.target.value)} required>
                    <option value="">Choose a member or viewer</option>
                    {candidates.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} · {roleLabel(member.role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={canDownload}
                    onChange={(event) => setCanDownload(event.target.checked)}
                  />
                  Allow download
                </label>
                <label className="field">
                  <span>Expiry, optional</span>
                  <input
                    type="date"
                    min={todayInputValue()}
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                  />
                </label>
                <button className="button" type="submit" disabled={pending || candidates.length === 0}>
                  {pending ? 'Saving…' : 'Grant access'}
                </button>
                {candidates.length === 0 && (
                  <p className="hint">Add a member or viewer before you can share this file.</p>
                )}
              </form>
              {grants.length === 0 ? (
                <p className="hint">No one else has been named on this document.</p>
              ) : (
                <ul className="grant-list">
                  {grants.map((grant) => (
                    <li key={grant.id}>
                      <div>
                        <strong>{grant.user.name}</strong>
                        <span>
                          {grant.canDownload ? 'Can download' : 'View only'}
                          {grant.expired ? ' · Expired' : grant.expiresAt ? ` · until ${formatDay(grant.expiresAt)}` : ''}
                          {grant.user.active === false ? ' · Inactive' : ''}
                        </span>
                      </div>
                      <button type="button" className="text-button dark" onClick={() => onRevoke(grant.user.id)}>
                        Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p>
              {doc.canDownload
                ? 'This document was shared with you, and you may download the file.'
                : 'This document was shared with you for viewing the record only.'}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
