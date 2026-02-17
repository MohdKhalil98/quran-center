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
    const looksLikeEmail = identifier.includes('@');

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
      console.error('Login error:', err);
      
      // التحقق من أن المستخدم مسجل في قائمة الانتظار (البيانات موجودة في Firestore لكن Firebase Auth غير موجود)
      if (looksLikeEmail && (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found')) {
        // البحث عن المستخدم في Firestore بالبريد الإلكتروني
        try {
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          const q = query(collection(db, 'users'), where('email', '==', identifier.toLowerCase()));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            if (userData.status === 'pending_registration') {
              setError('⏳ طلبك قيد المراجعة. سيتم تفعيل حسابك بعد اجتياز المقابلة.');
              setSubmitting(false);
              return;
            } else if (userData.status === 'interview_scheduled') {
              setError(`📅 لديك موعد مقابلة. سيتم تفعيل حسابك بعد اجتياز المقابلة.`);
              setSubmitting(false);
              return;
            }
          }
        } catch (checkErr) {
          console.error('Error checking user in Firestore:', checkErr);
        }
      }
      
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
            setError('⏳ حسابك لم يُفعّل بعد. يرجى انتظار اجتياز المقابلة.');
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
        setError('⏳ حسابك لم يُفعّل بعد. يرجى انتظار اجتياز المقابلة.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else {
        setError('تعذر تسجيل الدخول. يرجى التحقق من البيانات.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__header">
        <h1 className="login-page__title">رحلة الماهر لإدارة مراكز القرآن الكريم</h1>
        <p className="login-page__description">
          هذه المنصة مخصصة لإدارة شؤون الطلاب والمعلمين في مراكز تحفيظ القرآن الكريم.
        </p>
      </div>

      <div className="login-card">
        <h2>تسجيل الدخول</h2>
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

        <p className="login-card__forgot">
          <Link to="/reset-password" className="forgot-password-link">نسيت كلمة المرور؟</Link>
        </p>

        <p className="login-card__hint">
          طالب جديد؟ <Link to="/register">سجّل في قائمة الانتظار</Link>
        </p>
      </div>

      <nav className="login-page__links">
        <a href="#">من نحن</a>
        <a href="#">سياسة الخصوصية</a>
        <a href="#">اتصل بنا</a>
      </nav>

      <footer className="login-page__footer">
        © 2026 رحلة الماهر لإدارة مراكز القرآن الكريم. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
};

export default Login;

