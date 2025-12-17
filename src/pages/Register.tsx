import { FormEvent, useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import MessageBox from '../components/MessageBox';

interface Center {
  id: string;
  name: string;
  address: string;
}

const Register = () => {
  const { register, user } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'parent',
    centerId: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        console.log('Fetching centers...');
        const centersSnap = await getDocs(collection(db, 'centers'));
        console.log('Centers count:', centersSnap.docs.length);
        const centersList = centersSnap.docs.map(doc => {
          console.log('Center doc:', doc.id, doc.data());
          return {
            id: doc.id,
            name: doc.data().name,
            address: doc.data().address
          } as Center;
        });
        console.log('Centers list:', centersList);
        setCenters(centersList);
      } catch (error) {
        console.error('Error fetching centers:', error);
      } finally {
        setLoadingCenters(false);
      }
    };
    fetchCenters();
  }, []);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // التحقق من تطابق كلمات المرور
    if (formData.password !== formData.confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return;
    }

    // التحقق من طول كلمة المرور
    if (formData.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    // التحقق من اختيار المركز للطالب
    if (formData.role === 'student' && !formData.centerId) {
      setError('يجب اختيار المركز');
      return;
    }

    setSubmitting(true);
    try {
      await register(formData.email, formData.password, formData.name, formData.phone, formData.role, formData.centerId || undefined);
      if (formData.role === 'student') {
        setShowSuccessMessage(true);
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('البريد الإلكتروني مستخدم بالفعل');
      } else if (err.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صالح');
      } else if (err.code === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة جداً');
      } else {
        setError('حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.');
      }
      console.error('Registration error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card register-card">
        <h1>إنشاء حساب جديد</h1>
        <p className="login-card__subtitle">
          سجل الآن للانضمام إلى مركز تحفيظ القرآن الكريم
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            الاسم الكامل *
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="أدخل اسمك الكامل"
            />
          </label>

          <label>
            البريد الإلكتروني *
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="example@email.com"
            />
          </label>

          <label>
            رقم الهاتف *
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="973xxxxxxxx"
            />
          </label>

          <label>
            نوع الحساب *
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="student">طالب</option>
              <option value="parent">ولي أمر</option>
            </select>
          </label>

          {formData.role === 'student' && (
            <label>
              المركز المراد الانضمام إليه *
              <select
                name="centerId"
                value={formData.centerId}
                onChange={handleChange}
                required
                disabled={loadingCenters}
              >
                <option value="">
                  {loadingCenters ? 'جاري تحميل المراكز...' : 
                   centers.length === 0 ? 'لا توجد مراكز متاحة' : 'اختر المركز'}
                </option>
                {centers.map(center => (
                  <option key={center.id} value={center.id}>
                    {center.name} {center.address ? `- ${center.address}` : ''}
                  </option>
                ))}
              </select>
              {!loadingCenters && centers.length === 0 && (
                <small style={{ color: '#d32f2f', display: 'block', marginTop: '5px' }}>
                  ⚠️ لا توجد مراكز في النظام. تواصل مع المسؤول لإضافة مركز.
                </small>
              )}
            </label>
          )}

          <label>
            كلمة المرور *
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </label>

          <label>
            تأكيد كلمة المرور *
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" disabled={submitting}>
            {submitting ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
          </button>
        </form>

        <p className="login-card__hint">
          لديك حساب بالفعل؟ <Link to="/login">تسجيل الدخول</Link>
        </p>
      </div>

      {/* Success Message */}
      <MessageBox
        open={showSuccessMessage}
        type="success"
        title="تم إنشاء حسابك بنجاح! 🎉"
        message="طلبك قيد المراجعة من قبل المشرف.
سيتم إشعارك عند الموافقة على طلبك."
        onClose={() => {
          setShowSuccessMessage(false);
          navigate('/dashboard', { replace: true });
        }}
      />
    </div>
  );
};

export default Register;
