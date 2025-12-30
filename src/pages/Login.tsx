import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, loginWithPersonalId, user } = useAuth();
  const [identifier, setIdentifier] = useState(''); // بريد إلكتروني أو رقم شخصي
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

  // التحقق من نوع المُعرّف (بريد أو رقم شخصي)
  const isEmail = identifier.includes('@');
  const isPersonalId = /^\d{9}$/.test(identifier);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    
    if (!identifier.trim()) {
      setError('يرجى إدخال البريد الإلكتروني أو الرقم الشخصي');
      return;
    }

    if (!password.trim()) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }
    
    setSubmitting(true);
    try {
      if (isEmail) {
        // تسجيل الدخول بالبريد الإلكتروني (للمشرفين والمعلمين)
        await login(identifier, password);
      } else if (isPersonalId) {
        // تسجيل الدخول بالرقم الشخصي (للطلاب)
        await loginWithPersonalId(identifier, password);
      } else {
        setError('يرجى إدخال بريد إلكتروني صحيح أو رقم شخصي (9 أرقام)');
        setSubmitting(false);
        return;
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') {
        setError('الرقم الشخصي غير مسجل في النظام');
      } else if (err.message === 'ACCOUNT_NOT_ACTIVATED') {
        setError('حسابك لم يُفعّل بعد. يرجى انتظار اجتياز المقابلة.');
      } else {
        setError('تعذر تسجيل الدخول. يرجى التحقق من البيانات.');
      }
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
          أدخل بريدك الإلكتروني أو رقمك الشخصي مع كلمة المرور.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            البريد الإلكتروني / الرقم الشخصي
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              placeholder="example@email.com أو 123456789"
            />
            {identifier && !isEmail && !isPersonalId && identifier.length > 0 && (
              <small style={{ color: '#ff9800', display: 'block', marginTop: '5px' }}>
                💡 أدخل بريد إلكتروني أو رقم شخصي (9 أرقام)
              </small>
            )}
            {isPersonalId && (
              <small style={{ color: '#4caf50', display: 'block', marginTop: '5px' }}>
                ✓ رقم شخصي صحيح (للطلاب)
              </small>
            )}
            {isEmail && (
              <small style={{ color: '#2196f3', display: 'block', marginTop: '5px' }}>
                ✓ بريد إلكتروني (للمشرفين والمعلمين)
              </small>
            )}
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
          طالب جديد؟ <Link to="/register">سجّل في قائمة الانتظار</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

