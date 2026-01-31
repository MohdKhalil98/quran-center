import { FormEvent, useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import MessageBox from '../components/MessageBox';

interface Center {
  id: string;
  name: string;
  address: string;
}

interface Track {
  id: string;
  name: string;
  centerId: string;
}

const Register = () => {
  const { user } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [formData, setFormData] = useState({
    personalId: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    centerId: '',
    trackId: ''
  });
  const [checkingPersonalId, setCheckingPersonalId] = useState(false);
  const [personalIdError, setPersonalIdError] = useState<string | null>(null);
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

  // جلب المساقات عند تغيير المركز
  useEffect(() => {
    const fetchTracks = async () => {
      if (!formData.centerId) {
        console.log('No center selected');
        setTracks([]);
        return;
      }

      setLoadingTracks(true);
      console.log('Fetching tracks for centerId:', formData.centerId);
      try {
        const tracksSnap = await getDocs(
          query(collection(db, 'tracks'), where('centerId', '==', formData.centerId))
        );
        console.log('Found tracks count:', tracksSnap.docs.length);
        console.log('Track documents:', tracksSnap.docs.map(doc => ({ id: doc.id, data: doc.data() })));
        
        const tracksList = tracksSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          centerId: doc.data().centerId
        } as Track));
        console.log('Processed tracks list:', tracksList);
        setTracks(tracksList);
        // امسح تحديد المسق عند تغيير المركز
        setFormData(prev => ({ ...prev, trackId: '' }));
      } catch (error) {
        console.error('Error fetching tracks:', error);
        setTracks([]);
      } finally {
        setLoadingTracks(false);
      }
    };

    fetchTracks();
  }, [formData.centerId]);

  // التحقق الفوري من الرقم الشخصي عند الإدخال
  useEffect(() => {
    const checkPersonalIdRealtime = async () => {
      if (formData.personalId.length === 9) {
        setCheckingPersonalId(true);
        const exists = await checkPersonalIdExists(formData.personalId);
        setCheckingPersonalId(false);
        
        if (exists) {
          setPersonalIdError('⚠️ هذا الرقم مسجل مسبقاً! استخدم رقماً آخر');
        } else {
          setPersonalIdError(null);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      checkPersonalIdRealtime();
    }, 500); // تأخير 500ms لتجنب الكثير من الاستعلامات

    return () => clearTimeout(timeoutId);
  }, [formData.personalId]);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // للرقم الشخصي: السماح فقط بالأرقام
    if (name === 'personalId') {
      const numericValue = value.replace(/\D/g, '').slice(0, 9);
      setFormData({
        ...formData,
        [name]: numericValue
      });
      setPersonalIdError(null);
      return;
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // التحقق من عدم تكرار الرقم الشخصي
  const checkPersonalIdExists = async (personalId: string): Promise<boolean> => {
    try {
      console.log('Checking if personalId exists:', personalId);
      const q = query(collection(db, 'users'), where('personalId', '==', personalId));
      const snapshot = await getDocs(q);
      console.log('Query result - Found documents:', snapshot.docs.length);
      if (!snapshot.empty) {
        console.log('PersonalId already exists! Found:', snapshot.docs.map(d => d.data().name));
      }
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking personal ID:', error);
      // في حالة الخطأ، نفترض أن الرقم موجود لمنع التسجيل
      return true;
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // التحقق من الحقول المطلوبة
    if (!formData.name.trim()) {
      setError('الاسم الكامل مطلوب');
      return;
    }

    if (!formData.email.trim()) {
      setError('البريد الإلكتروني مطلوب');
      return;
    }

    // التحقق من صيغة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('صيغة البريد الإلكتروني غير صحيحة');
      return;
    }

    if (!formData.password) {
      setError('كلمة المرور مطلوبة');
      return;
    }

    if (formData.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقتين');
      return;
    }

    if (!formData.phone.trim()) {
      setError('رقم الهاتف مطلوب');
      return;
    }

    // الرقم الشخصي إجباري
    if (!formData.personalId.trim()) {
      setError('الرقم الشخصي مطلوب');
      return;
    }

    if (formData.personalId.length !== 9) {
      setError('الرقم الشخصي يجب أن يكون 9 أرقام بالضبط');
      return;
    }

    if (!formData.centerId) {
      setError('يجب اختيار المركز');
      return;
    }

    if (!formData.trackId) {
      setError('يجب اختيار المسق');
      return;
    }

    // التحقق النهائي من عدم تكرار الرقم الشخصي
    setCheckingPersonalId(true);
    const personalIdExists = await checkPersonalIdExists(formData.personalId);
    setCheckingPersonalId(false);
    
    if (personalIdExists) {
      setPersonalIdError('⚠️ هذا الرقم مسجل مسبقاً! استخدم رقماً آخر');
      setError('❌ الرقم الشخصي ' + formData.personalId + ' موجود بالفعل في النظام. لا يمكن التسجيل بنفس الرقم مرتين.');
      return;
    }

    setSubmitting(true);
    try {
      // إضافة طلب تسجيل جديد - سجل واحد فقط يتم تحديثه خلال جميع المراحل
      await addDoc(collection(db, 'users'), {
        personalId: formData.personalId.trim(),
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password, // سيتم استخدامها لإنشاء حساب Firebase Auth لاحقاً
        phone: formData.phone.trim(),
        centerId: formData.centerId,
        trackId: formData.trackId,
        role: 'student',
        status: 'pending_registration', // المرحلة 1: في انتظار جدولة المقابلة
        active: true,
        createdAt: serverTimestamp(),
        // الحقول التي ستُملأ لاحقاً من قبل المشرف
        groupId: 'Unknown',
        levelId: 'Unknown',
        levelName: 'Unknown',
        stageId: 'Unknown',
        stageName: 'Unknown',
        interviewDate: 'Unknown',
        interviewTime: 'Unknown'
      });

      setShowSuccessMessage(true);
      setFormData({ personalId: '', name: '', email: '', password: '', confirmPassword: '', phone: '', centerId: '', trackId: '' });
    } catch (err: any) {
      console.error('Registration error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      if (err.code === 'permission-denied') {
        setError('لا توجد صلاحية للتسجيل. يرجى التواصل مع المسؤول.');
      } else {
        setError(`حدث خطأ أثناء التسجيل: ${err.message || 'يرجى المحاولة مرة أخرى.'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card register-card">
        <h1>التسجيل في قائمة الانتظار</h1>
        <p className="login-card__subtitle">
          تسجيل في قائمة الانتظار للانضمام إلى مركز تحفيظ القرآن الكريم
        </p>
        
        {/* زر العودة لصفحة تسجيل الدخول */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '10px 16px',
            marginBottom: '20px',
            backgroundColor: '#f5f5f5',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#e8e8e8';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
          }}
        >
          <span>→</span>
          <span>لديك حساب؟ تسجيل الدخول</span>
        </button>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            الرقم الشخصي <span style={{ color: '#d32f2f' }}>*</span> <small style={{ fontWeight: 'normal', color: '#666' }}>(9 أرقام)</small>
            <input
              type="text"
              name="personalId"
              value={formData.personalId}
              onChange={handleChange}
              placeholder="أدخل الرقم الشخصي (9 أرقام)"
              maxLength={9}
              inputMode="numeric"
              required
              style={personalIdError ? { borderColor: '#d32f2f' } : {}}
            />
            {formData.personalId && formData.personalId.length < 9 && !personalIdError && (
              <small style={{ color: '#ff9800', display: 'block', marginTop: '5px' }}>
                ⚠️ الرقم الشخصي يجب أن يكون 9 أرقام ({formData.personalId.length}/9)
              </small>
            )}
            {checkingPersonalId && formData.personalId.length === 9 && (
              <small style={{ color: '#2196f3', display: 'block', marginTop: '5px' }}>
                🔍 جاري التحقق من الرقم...
              </small>
            )}
            {formData.personalId && formData.personalId.length === 9 && !personalIdError && !checkingPersonalId && (
              <small style={{ color: '#4caf50', display: 'block', marginTop: '5px', fontWeight: 'bold' }}>
                ✓ الرقم متاح ويمكن استخدامه
              </small>
            )}
            {personalIdError && (
              <small style={{ color: '#d32f2f', display: 'block', marginTop: '5px', fontWeight: 'bold' }}>
                {personalIdError}
              </small>
            )}
          </label>

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
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </label>

          <label>
            كلمة المرور *
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
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
              placeholder="أعد إدخال كلمة المرور"
            />
            {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <small style={{ color: '#d32f2f', display: 'block', marginTop: '5px' }}>
                ⚠️ كلمة المرور غير متطابقة
              </small>
            )}
            {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
              <small style={{ color: '#4caf50', display: 'block', marginTop: '5px' }}>
                ✓ كلمة المرور متطابقة
              </small>
            )}
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

          {formData.centerId && (
            <label>
              المسق *
              <select
                name="trackId"
                value={formData.trackId}
                onChange={handleChange}
                required
                disabled={loadingTracks}
              >
                <option value="">
                  {loadingTracks ? 'جاري تحميل المساقات...' : 
                   tracks.length === 0 ? 'لا توجد مساقات متاحة' : 'اختر المسق'}
                </option>
                {tracks.map(track => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
              {!loadingTracks && tracks.length === 0 && formData.centerId && (
                <small style={{ color: '#d32f2f', display: 'block', marginTop: '5px' }}>
                  ⚠️ لا توجد مساقات للمركز المختار. تواصل مع المسؤول.
                </small>
              )}
            </label>
          )}

          {error && <div className="form-error">{error}</div>}

          <button type="submit" disabled={submitting || checkingPersonalId || !!personalIdError}>
            {checkingPersonalId ? 'جاري التحقق من الرقم الشخصي...' : submitting ? 'جاري التسجيل...' : 'التسجيل في قائمة الانتظار'}
          </button>
        </form>
      </div>

      {/* Success Message */}
      <MessageBox
        open={showSuccessMessage}
        type="success"
        title="تم تسجيلك بنجاح! 🎉"
        message="تم إضافتك إلى قائمة الانتظار.
سيتم إشعارك عند الموافقة على طلبك."
        onClose={() => {
          setShowSuccessMessage(false);
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
};

export default Register;
