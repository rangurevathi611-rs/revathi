import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '',
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await register(form);
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
        <p className="eyebrow light">New vault</p>
        <h1>Open a company vault. You will be its owner.</h1>
        <p className="lede">
          Owners appoint admins, members, and viewers. Members upload and share their own files. Viewers see only what was handed to them.
        </p>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Register the company</h2>
          <Alert>{error}</Alert>
          <Field label="Company name">
            <input name="companyName" value={form.companyName} onChange={update} required minLength={2} maxLength={80} />
          </Field>
          <Field label="Your name">
            <input name="name" autoComplete="name" value={form.name} onChange={update} required minLength={2} maxLength={80} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update}
              required
              minLength={8}
              maxLength={72}
            />
          </Field>
          <button className="button primary" type="submit" disabled={pending}>
            {pending ? 'Creating the vault…' : 'Create vault'}
          </button>
          <p className="form-foot">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
