import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    '/dashboard';

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError('تعذر تسجيل الدخول. يرجى التحقق من البيانات.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>تسجيل الدخول</h1>
        <p className="login-card__subtitle">
          أدخل بريدك الإلكتروني وكلمة المرور للمتابعة.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            البريد الإلكتروني
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="example@email.com"
            />
          </label>
          <label>
            كلمة المرور
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
        <p className="login-card__hint">
          يمكن إدارة المستخدمين من لوحة Firebase Authentication.
        </p>
      </div>
    </div>
  );
};

export default Login;

