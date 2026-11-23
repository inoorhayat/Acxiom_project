import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getErrorMessage, getFieldErrors } from '../api/client.js';
import { EMAIL_RE, passwordErrors } from '../utils/validators.js';
import { Alert, Field } from '../components/ui.jsx';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    else if (form.name.trim().length > 100) errs.name = 'Name must be 100 characters or fewer.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    const pw = passwordErrors(form.password);
    if (pw.length) errs.password = pw[0];
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setMessage('');
    try {
      await api.post('/auth/register', { ...form, name: form.name.trim(), email: form.email.trim() });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand-mark">Acxiom<span>CRM</span></div>
        <p className="sub">Create your Sales Executive account.</p>

        {message && <Alert>{message}</Alert>}

        <form onSubmit={submit} noValidate>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Full name" error={errors.name}>
              <input className={`input${errors.name ? ' invalid' : ''}`} value={form.name} onChange={set('name')} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className={`input${errors.email ? ' invalid' : ''}`} type="email" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Password" error={errors.password} hint="8+ characters with upper, lower, number and special character">
              <input className={`input${errors.password ? ' invalid' : ''}`} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
            </Field>
            <Field label="Confirm password" error={errors.confirmPassword}>
              <input className={`input${errors.confirmPassword ? ' invalid' : ''}`} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} />
            </Field>
          </div>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
        </form>

        <p className="auth-foot">Already registered? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
