import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';

const DEMOS = [
  { label: 'Owner', email: 'owner@northwind.dev' },
  { label: 'Member', email: 'member@northwind.dev' },
  { label: 'Viewer', email: 'viewer@northwind.dev' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-story">
        <p className="eyebrow light">TrustVault</p>
        <h1>Confidential files, accounted for.</h1>
        <p className="lede">
          Each company keeps its own vault. A document opens only for the people it was shared with, and every open, download, and share is written into an audit trail.
        </p>
        <ul className="promises">
          <li>Company data never mixes with another tenant</li>
          <li>Files are encrypted before they touch disk</li>
          <li>Access is granted by name, then revoked the same way</li>
          <li>Audit records cannot be edited</li>
        </ul>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Sign in</h2>
          <Alert>{error}</Alert>
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <button className="button primary" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Enter the vault'}
          </button>
          <p className="form-foot">
            New company? <Link to="/register">Open a vault</Link>
          </p>
          <div className="demo-box">
            <p>Northwind demo · password <code>TrustVault1!</code></p>
            <div className="demo-row">
              {DEMOS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword('TrustVault1!');
                  }}
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
