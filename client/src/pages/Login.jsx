import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import { EMAIL_RE } from '../utils/validators.js';
import { Alert, Field } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setMessage('');
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand-mark">Acxiom<span>CRM</span></div>
        <p className="sub">Sign in to manage your sales pipeline.</p>

        {message && <Alert>{message}</Alert>}

        <form onSubmit={submit} noValidate>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Email" error={errors.email}>
              <input className={`input${errors.email ? ' invalid' : ''}`} type="email" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </Field>
            <Field label="Password" error={errors.password}>
              <input className={`input${errors.password ? ' invalid' : ''}`} type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
            </Field>
          </div>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>

        <p className="auth-foot">New here? <Link to="/register">Create an account</Link></p>
        <p className="auth-foot" style={{ fontSize: 12 }}>
          Demo: admin@acxiom.com / Admin@123 (also manager@ and sales@)
        </p>
      </div>
    </div>
  );
}
