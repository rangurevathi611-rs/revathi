import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert } from '../components/ui.jsx';
import { fileKind, formatBytes, formatWhen } from '../format.js';

export default function Documents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canUpload = user.role !== 'viewer';
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError('');
    api(`/documents?q=${encodeURIComponent(query)}`)
      .then((data) => {
        if (!cancel) setDocuments(data.documents);
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
  }, [query]);

  async function onUpload(event) {
    event.preventDefault();
    setUploadError('');
    if (!file) {
      setUploadError('Choose a file to upload');
      return;
    }
    setPending(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('file', file);
      const data = await api('/documents', { method: 'POST', form });
      navigate(`/documents/${data.document.id}`);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Vault</p>
          <h1>Documents</h1>
        </div>
        {canUpload && (
          <button type="button" className="button primary" onClick={() => setUploadOpen((open) => !open)}>
            {uploadOpen ? 'Close upload' : 'Upload'}
          </button>
        )}
      </header>

      <label className="search">
        <span>Search by title</span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Board minutes, lease, memo…"
        />
      </label>

      {uploadOpen && (
        <form className="panel upload-panel" onSubmit={onUpload}>
          <h2>Place a file in the vault</h2>
          <Alert>{uploadError}</Alert>
          <div className="split">
            <label className="field">
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={140} />
            </label>
            <label className="field">
              <span>File</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
              />
            </label>
          </div>
          <p className="hint">PDF, Word, text, PNG, or JPG. 25 MB maximum. The file is encrypted before it is stored.</p>
          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Encrypting…' : 'Upload and encrypt'}
          </button>
        </form>
      )}

      <Alert>{error}</Alert>

      {loading ? (
        <p className="hint">Loading documents…</p>
      ) : documents.length === 0 ? (
        <div className="empty">
          <h2>{query ? 'No documents match that title' : 'The vault is empty'}</h2>
          <p>
            {query
              ? 'Try a shorter phrase from the document title.'
              : user.role === 'viewer'
                ? 'Nothing has been shared with you yet.'
                : 'Upload a confidential file, then share it with the people who should see it.'}
          </p>
        </div>
      ) : (
        <ul className="ledger">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link to={`/documents/${doc.id}`}>
                <span className="kind">{fileKind(doc.originalName)}</span>
                <span className="ledger-copy">
                  <strong>{doc.title}</strong>
                  <span>
                    {doc.owner.name} · {formatWhen(doc.createdAt)} · {formatBytes(doc.size)}
                  </span>
                </span>
                <span className={doc.canDownload ? 'access-flag' : 'access-flag quiet'}>
                  {doc.canManage ? 'Manage' : doc.canDownload ? 'Download' : 'View only'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
