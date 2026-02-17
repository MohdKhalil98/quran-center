import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import '../styles/ResetPassword.css';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('يرجى إدخال البريد الإلكتروني');
      return;
    }

    if (!email.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess(true);
    } catch (err: any) {
      console.error('Reset password error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('لا يوجد حساب مرتبط بهذا البريد الإلكتروني.');
      } else if (err.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صالح.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('تم إرسال عدة طلبات. يرجى المحاولة لاحقاً.');
      } else {
        setError('حدث خطأ أثناء إرسال رابط إعادة التعيين. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reset-page">
      <div className="reset-page__header">
        <h1 className="reset-page__title">رحلة الماهر لإدارة مراكز القرآن الكريم</h1>
      </div>

      <div className="reset-card">
        {!success ? (
          <>
            <div className="reset-card__icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                <circle cx="12" cy="16" r="1" />
              </svg>
            </div>
            <h2>إعادة تعيين كلمة المرور</h2>
            <p className="reset-card__subtitle">
              أدخل بريدك الإلكتروني المسجّل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
            </p>
            <form className="reset-form" onSubmit={handleSubmit}>
              <label>
                البريد الإلكتروني
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  autoFocus
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" disabled={submitting}>
                {submitting ? 'جارٍ الإرسال...' : 'إرسال رابط إعادة التعيين'}
              </button>
            </form>
          </>
        ) : (
          <div className="reset-success">
            <div className="reset-success__icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <h2>تم إرسال الرابط بنجاح!</h2>
            <p className="reset-success__message">
              تم إرسال رابط إعادة تعيين كلمة المرور إلى:
            </p>
            <p className="reset-success__email">{email}</p>
            <div className="reset-success__instructions">
              <p>📧 تحقق من بريدك الوارد</p>
              <p>📁 إذا لم تجدها، تحقق من مجلد الرسائل غير المرغوب فيها (Spam)</p>
              <p>⏰ صلاحية الرابط محدودة، استخدمه في أقرب وقت</p>
            </div>
            <button
              className="reset-success__retry"
              onClick={() => {
                setSuccess(false);
                setEmail('');
                setError(null);
              }}
            >
              إرسال رابط جديد
            </button>
          </div>
        )}

        <div className="reset-card__footer">
          <Link to="/login" className="back-to-login">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>

      <footer className="reset-page__footer">
        © 2026 رحلة الماهر لإدارة مراكز القرآن الكريم. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
};

export default ResetPassword;
