import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Notice } from '../components/ui.jsx';
import { roleLabel } from '../format.js';

function canEdit(actor, member) {
  if (actor.id === member.id) return false;
  if (member.role === 'owner') return false;
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin' && (member.role === 'member' || member.role === 'viewer')) return true;
  return false;
}

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member',
  });

  async function load() {
    const data = await api('/members?includeInactive=1');
    setMembers(data.members);
  }

  useEffect(() => {
    let cancel = false;
    load()
      .catch((err) => {
        if (!cancel) setError(err.message);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function onAdd(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setPending(true);
    try {
      await api('/members', { method: 'POST', body: form });
      setNotice(`${form.name} can sign in with the password you just set.`);
      setForm({ name: '', email: '', password: '', role: 'member' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function changeRole(member, role) {
    setError('');
    setNotice('');
    try {
      const data = await api(`/members/${member.id}`, { method: 'PATCH', body: { role } });
      setMembers((list) => list.map((item) => (item.id === member.id ? data.member : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function setActive(member, active) {
    setError('');
    setNotice('');
    try {
      const data = active
        ? await api(`/members/${member.id}`, { method: 'PATCH', body: { active: true } })
        : await api(`/members/${member.id}`, { method: 'DELETE' });
      setMembers((list) => list.map((item) => (item.id === member.id ? data.member : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  const roleOptions = user.role === 'owner' ? ['admin', 'member', 'viewer'] : ['member', 'viewer'];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Company</p>
          <h1>Members</h1>
        </div>
      </header>
      <p className="hint standalone">
        Passwords are handed over by you. TrustVault does not send email. Deactivated people cannot sign in, and their past audit entries stay in the trail.
      </p>
      <Alert>{error}</Alert>
      <Notice>{notice}</Notice>

      <form className="panel" onSubmit={onAdd}>
        <h2>Add someone</h2>
        <div className="member-grid">
          <label className="field">
            <span>Name</span>
            <input name="name" value={form.name} onChange={update} required minLength={2} />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={update} required />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input name="password" type="password" autoComplete="new-password" value={form.password} onChange={update} required minLength={8} />
          </label>
          <label className="field">
            <span>Role</span>
            <select name="role" value={form.role} onChange={update}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add member'}
        </button>
      </form>

      {loading ? (
        <p className="hint">Loading members…</p>
      ) : (
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const editable = canEdit(user, member);
                return (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.email}</td>
                    <td>
                      {editable ? (
                        <select
                          aria-label={`Role for ${member.name}`}
                          value={member.role}
                          onChange={(event) => changeRole(member, event.target.value)}
                        >
                          {(member.role === 'admin' ? roleOptions : roleOptions).map((role) => (
                            <option key={role} value={role}>{roleLabel(role)}</option>
                          ))}
                        </select>
                      ) : (
                        roleLabel(member.role)
                      )}
                    </td>
                    <td>{member.active ? 'Active' : 'Inactive'}</td>
                    <td className="actions">
                      {editable && member.active && (
                        <button type="button" className="text-button dark" onClick={() => setActive(member, false)}>
                          Deactivate
                        </button>
                      )}
                      {editable && !member.active && (
                        <button type="button" className="text-button dark" onClick={() => setActive(member, true)}>
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
