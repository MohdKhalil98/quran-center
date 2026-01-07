import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, loginWithPersonalId, user, userProfile, getDefaultRoute } = useAuth();
  const [identifier, setIdentifier] = useState(''); // بريد إلكتروني أو رقم شخصي
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // استخدام المسار الافتراضي حسب دور المستخدم
  const defaultRoute = getDefaultRoute();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    defaultRoute;

  if (user) {
    return <Navigate to={from} replace />;
  }

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
    const looksLikePersonalId = /^\d{3,}$/.test(identifier.trim());

    try {
      // 1) جرّب دائماً الدخول كبريد إلكتروني أولاً
      await login(identifier, password);
      // انتظر قليلاً لتحميل userProfile ثم انتقل للمسار الصحيح
      setTimeout(() => {
        const route = getDefaultRoute();
        navigate(route, { replace: true });
      }, 500);
      return;
    } catch (err: any) {
      // 2) إذا فشل وكان المُعرّف رقمياً فجرّب الدخول بالرقم الشخصي
      if (looksLikePersonalId) {
        try {
          await loginWithPersonalId(identifier, password);
          // انتظر قليلاً لتحميل userProfile ثم انتقل للمسار الصحيح
          setTimeout(() => {
            const route = getDefaultRoute();
            navigate(route, { replace: true });
          }, 500);
          return;
        } catch (err2: any) {
          if (err2.message === 'USER_NOT_FOUND') {
            setError('البيانات غير صحيحة أو الحساب غير موجود');
          } else if (err2.message === 'ACCOUNT_NOT_ACTIVATED') {
            setError('حسابك لم يُفعّل بعد. يرجى انتظار اجتياز المقابلة.');
          } else {
            setError('تعذر تسجيل الدخول. يرجى التحقق من البيانات.');
          }
          console.error(err2);
          setSubmitting(false);
          return;
        }
      }

      // 3) فشل الدخول بالبريد
      if (err.message === 'ACCOUNT_NOT_ACTIVATED') {
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

