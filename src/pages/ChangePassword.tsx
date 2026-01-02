import { useState } from 'react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import '../styles/ChangePassword.css';

const ChangePassword = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // التحقق من تطابق كلمة المرور الجديدة
    if (formData.newPassword !== formData.confirmPassword) {
      setError('كلمة المرور الجديدة غير متطابقة');
      return;
    }

    // التحقق من طول كلمة المرور
    if (formData.newPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    // التحقق من أن كلمة المرور الجديدة مختلفة عن القديمة
    if (formData.currentPassword === formData.newPassword) {
      setError('كلمة المرور الجديدة يجب أن تكون مختلفة عن القديمة');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('المستخدم غير مسجل الدخول');
      }

      // إعادة المصادقة مع كلمة المرور الحالية
      const credential = EmailAuthProvider.credential(
        user.email,
        formData.currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // تحديث كلمة المرور
      await updatePassword(user, formData.newPassword);

      setSuccess('تم تغيير كلمة المرور بنجاح! 🎉');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      
      if (error.code === 'auth/wrong-password') {
        setError('كلمة المرور الحالية غير صحيحة');
      } else if (error.code === 'auth/requires-recent-login') {
        setError('يرجى تسجيل الخروج والدخول مرة أخرى ثم المحاولة');
      } else {
        setError('حدث خطأ أثناء تغيير كلمة المرور');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page">
      <header className="page__header">
        <h1>🔐 تغيير كلمة المرور</h1>
        <p>قم بتحديث كلمة المرور الخاصة بك</p>
      </header>

      <div className="change-password-container">
        <div className="change-password-card">
          <div className="user-info-section">
            <div className="user-avatar">
              {userProfile?.name?.charAt(0).toUpperCase() || '👤'}
            </div>
            <div className="user-details">
              <h3>{userProfile?.name}</h3>
              <p className="user-email">{userProfile?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="change-password-form">
            {error && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <span className="alert-icon">✓</span>
                <span>{success}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="currentPassword">كلمة المرور الحالية *</label>
              <input
                type="password"
                id="currentPassword"
                value={formData.currentPassword}
                onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
                required
                placeholder="أدخل كلمة المرور الحالية"
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">كلمة المرور الجديدة *</label>
              <input
                type="password"
                id="newPassword"
                value={formData.newPassword}
                onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                required
                minLength={6}
                placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة *</label>
              <input
                type="password"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={6}
                placeholder="أعد إدخال كلمة المرور الجديدة"
              />
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
              >
                {loading ? 'جاري التحديث...' : 'تغيير كلمة المرور'}
              </button>
            </div>

            <div className="password-tips">
              <h4>💡 نصائح لكلمة مرور قوية:</h4>
              <ul>
                <li>استخدم على الأقل 8 أحرف</li>
                <li>اجمع بين الأحرف الكبيرة والصغيرة</li>
                <li>أضف أرقام ورموز خاصة</li>
                <li>تجنب استخدام معلومات شخصية واضحة</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ChangePassword;
