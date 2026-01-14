import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth, UserProfile, UserRole } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { generateTemporaryPassword } from '../utils/passwordGenerator';
import '../styles/Centers.css';

interface Center {
  id: string;
  name: string;
  address: string;
  phone: string;
  createdAt: string;
  active: boolean;
}

interface CenterUser extends UserProfile {
  id?: string;
}

const Centers = () => {
  const { isAdmin, isSupervisor, getSupervisorCenterIds, canAccessCenter } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCenterModal, setShowAddCenterModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [centerUsers, setCenterUsers] = useState<CenterUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [newCenter, setNewCenter] = useState({
    id: '', // حقل ID يدوي
    name: '',
    address: '',
    phone: ''
  });

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: generateTemporaryPassword(),
    phone: '',
    role: 'supervisor' as UserRole,
    roles: [] as UserRole[] // صلاحيات متعددة
  });

  useEffect(() => {
    fetchCenters();
  }, []);

  // توليد كلمة مرور جديدة عند فتح نموذج إضافة مستخدم
  useEffect(() => {
    if (showAddUserModal) {
      setNewUser(prev => ({
        ...prev,
        password: generateTemporaryPassword()
      }));
    }
  }, [showAddUserModal]);

  const fetchCenters = async () => {
    try {
      const centersSnap = await getDocs(collection(db, 'centers'));
      let centersList = centersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Center));
      
      // تصفية المراكز للمشرفين (يرون مراكزهم فقط)
      if (isSupervisor) {
        const supervisorCenterIds = getSupervisorCenterIds();
        centersList = centersList.filter(center => supervisorCenterIds.includes(center.id));
      }
      // المدراء يرون جميع المراكز
      
      setCenters(centersList);
    } catch (error) {
      console.error('Error fetching centers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCenterUsers = async (centerId: string) => {
    try {
      const usersQuery = query(collection(db, 'users'), where('centerId', '==', centerId));
      const usersSnap = await getDocs(usersQuery);
      const usersList = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CenterUser));
      setCenterUsers(usersList);
    } catch (error) {
      console.error('Error fetching center users:', error);
    }
  };

  const handleAddCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // التحقق من عدم وجود مركز بنفس الـ ID
      const existingCenterQuery = query(collection(db, 'centers'), where('__name__', '==', newCenter.id));
      const existingSnapshot = await getDocs(existingCenterQuery);
      
      if (!existingSnapshot.empty) {
        alert('يوجد مركز بنفس المعرف (ID) بالفعل. يرجى استخدام معرف مختلف.');
        setSubmitting(false);
        return;
      }

      const centerData = {
        name: newCenter.name,
        address: newCenter.address,
        phone: newCenter.phone,
        createdAt: new Date().toISOString(),
        active: true
      };

      // استخدام setDoc بدلاً من addDoc لتحديد ID يدوي
      await setDoc(doc(db, 'centers', newCenter.id), centerData);
      alert('تم إضافة المركز بنجاح');
      setShowAddCenterModal(false);
      setNewCenter({ id: '', name: '', address: '', phone: '' });
      fetchCenters();
    } catch (error) {
      console.error('Error adding center:', error);
      alert('حدث خطأ أثناء إضافة المركز');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCenter) return;
    
    // التحقق من اختيار صلاحية واحدة على الأقل
    if (newUser.roles.length === 0) {
      alert('يرجى اختيار صلاحية واحدة على الأقل');
      return;
    }
    
    // التحقق من وجود رقم هاتف
    if (!newUser.phone || newUser.phone.trim() === '') {
      alert('يرجى إدخال رقم الهاتف لإرسال بيانات الدخول عبر واتساب');
      return;
    }
    
    setSubmitting(true);

    try {
      // حفظ بيانات المستخدم الحالي لإعادة تسجيل الدخول
      const currentUser = auth.currentUser;
      const currentEmail = currentUser?.email;
      
      // إنشاء حساب في Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newUser.email,
        newUser.password
      );

      // حفظ بيانات المستخدم في Firestore
      const userProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        roles: newUser.roles.length > 0 ? newUser.roles : undefined, // إضافة الصلاحيات المتعددة
        phone: newUser.phone,
        centerId: selectedCenter.id,
        createdAt: new Date().toISOString(),
        active: true
      };

      // استخدام setDoc مع uid كـ document ID
      await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);

      const roleText = newUser.role === 'supervisor' ? 'مشرف' : 'معلم';
      
      // تنسيق رقم الهاتف (إزالة + أو 00 والمسافات)
      let phoneNumber = newUser.phone.replace(/[\s+-]/g, '');
      // إذا كان الرقم يبدأ بـ 0، استبدله بكود الدولة (مملكة البحرين 973)
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '973' + phoneNumber.substring(1);
      }
      // إذا لم يبدأ بكود الدولة، أضف 973
      if (!phoneNumber.startsWith('973')) {
        phoneNumber = '973' + phoneNumber;
      }
      
      // إنشاء رسالة واتساب
      const message = `مرحباً ${newUser.name}،

تم إنشاء حسابك في نظام ${selectedCenter.name} بنجاح!

البريد الإلكتروني: ${newUser.email}
كلمة المرور المؤقتة: ${newUser.password}

ملاحظة مهمة:
• يرجى تغيير كلمة المرور بعد تسجيل الدخول الأول
• يمكنك تغيير كلمة المرور من قائمة الإعدادات

رابط النظام: ${window.location.origin}

نتمنى لك تجربة موفقة!`;
      
      // فتح واتساب
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      
      console.log('رقم الهاتف:', phoneNumber);
      console.log('رابط واتساب:', whatsappUrl);
      
      window.open(whatsappUrl, '_blank');

      // تسجيل خروج المستخدم الجديد
      await signOut(auth);
      
      // إعادة تسجيل دخول المستخدم الحالي (المطور)
      if (currentEmail) {
        // ملاحظة: يجب على المطور أن يكون مسجل الدخول مسبقاً
        // في حالة Production، يفضل استخدام Firebase Admin SDK
        const adminPassword = prompt('من فضلك أدخل كلمة مرورك لإعادة تسجيل الدخول:');
        if (adminPassword) {
          await signInWithEmailAndPassword(auth, currentEmail, adminPassword);
        }
      }

      alert(`تم إنشاء حساب ${roleText} بنجاح!\n\nتم فتح واتساب لإرسال بيانات الدخول إلى ${newUser.name}`);

      setShowAddUserModal(false);
      setNewUser({ name: '', email: '', password: generateTemporaryPassword(), phone: '', role: 'supervisor', roles: [] });
      fetchCenterUsers(selectedCenter.id);
    } catch (error: any) {
      console.error('Error adding user:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'auth/wrong-password') {
        alert('كلمة المرور غير صحيحة. لم يتم إعادة تسجيل دخولك.');
      } else {
        alert('حدث خطأ أثناء إنشاء المستخدم');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectCenter = (center: Center) => {
    setSelectedCenter(center);
    fetchCenterUsers(center.id);
  };

  const handleDeleteCenter = async (centerId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المركز؟')) return;

    try {
      await deleteDoc(doc(db, 'centers', centerId));
      alert('تم حذف المركز بنجاح');
      if (selectedCenter?.id === centerId) {
        setSelectedCenter(null);
        setCenterUsers([]);
      }
      fetchCenters();
    } catch (error) {
      console.error('Error deleting center:', error);
      alert('حدث خطأ أثناء حذف المركز');
    }
  };

  const handleToggleUserStatus = async (user: CenterUser) => {
    try {
      const userDoc = doc(db, 'users', user.uid);
      await updateDoc(userDoc, { active: !user.active });
      if (selectedCenter) {
        fetchCenterUsers(selectedCenter.id);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('حدث خطأ أثناء تحديث حالة المستخدم');
    }
  };

  const handleRoleChange = (role: UserRole) => {
    setNewUser(prev => {
      const newRoles = prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role];
      
      // تعيين الصلاحية الرئيسية (أول صلاحية محددة أو الافتراضي)
      const mainRole = newRoles.length > 0 ? newRoles[0] : 'supervisor';
      
      return {
        ...prev,
        role: mainRole,
        roles: newRoles
      };
    });
  };

  if (!isAdmin && !isSupervisor) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>مراكز القرآن الكريم</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>مراكز القرآن الكريم</h1>
        <p>إدارة مراكز التحفيظ والمشرفين والمعلمين</p>
      </header>

      <div className="centers-container">
        {/* قائمة المراكز */}
        <div className="centers-list">
          <div className="centers-list-header">
            <h2>المراكز ({centers.length})</h2>
            <button className="btn btn-primary" onClick={() => setShowAddCenterModal(true)}>
              ➕ إضافة مركز
            </button>
          </div>

          {centers.length === 0 ? (
            <p className="no-data">لا توجد مراكز مسجلة</p>
          ) : (
            <div className="centers-cards">
              {centers.map(center => (
                <div 
                  key={center.id} 
                  className={`center-card ${selectedCenter?.id === center.id ? 'selected' : ''}`}
                  onClick={() => handleSelectCenter(center)}
                >
                  <div className="center-card-header">
                    <h3>{center.name}</h3>
                    <button 
                      className="btn-icon delete"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCenter(center.id); }}
                      title="حذف المركز"
                    >
                      🗑️
                    </button>
                  </div>
                  <p className="center-address">📍 {center.address}</p>
                  <p className="center-phone">📞 {center.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* تفاصيل المركز المختار */}
        {selectedCenter && (
          <div className="center-details">
            <div className="center-details-header">
              <h2>{selectedCenter.name}</h2>
              <button 
                className="btn btn-success" 
                onClick={() => setShowAddUserModal(true)}
              >
                ➕ إضافة مشرف/معلم
              </button>
            </div>

            <div className="users-section">
              <h3>المشرفون</h3>
              <div className="users-list">
                {centerUsers.filter(u => u.role === 'supervisor').length === 0 ? (
                  <p className="no-data">لا يوجد مشرفون</p>
                ) : (
                  centerUsers.filter(u => u.role === 'supervisor').map(user => (
                    <div key={user.uid} className="user-card">
                      <div className="user-info">
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">{user.email}</span>
                      </div>
                      <div className="user-actions">
                        <span className={`status-badge ${user.active ? 'active' : 'inactive'}`}>
                          {user.active ? 'نشط' : 'معطل'}
                        </span>
                        <button 
                          className="btn btn-sm"
                          onClick={() => handleToggleUserStatus(user)}
                        >
                          {user.active ? 'إيقاف' : 'تفعيل'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="users-section">
              <h3>المعلمون</h3>
              <div className="users-list">
                {centerUsers.filter(u => u.role === 'teacher').length === 0 ? (
                  <p className="no-data">لا يوجد معلمون</p>
                ) : (
                  centerUsers.filter(u => u.role === 'teacher').map(user => (
                    <div key={user.uid} className="user-card">
                      <div className="user-info">
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">{user.email}</span>
                      </div>
                      <div className="user-actions">
                        <span className={`status-badge ${user.active ? 'active' : 'inactive'}`}>
                          {user.active ? 'نشط' : 'معطل'}
                        </span>
                        <button 
                          className="btn btn-sm"
                          onClick={() => handleToggleUserStatus(user)}
                        >
                          {user.active ? 'إيقاف' : 'تفعيل'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal إضافة مركز */}
      {showAddCenterModal && (
        <div className="modal-overlay" onClick={() => setShowAddCenterModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إضافة مركز جديد</h2>
              <button className="close-btn" onClick={() => setShowAddCenterModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddCenter}>
              <div className="modal-body">
                <div className="form-group">
                  <label>معرف المركز (Center ID) *</label>
                  <input
                    type="text"
                    value={newCenter.id}
                    onChange={e => setNewCenter({ ...newCenter, id: e.target.value })}
                    required
                    placeholder="مثال: center1 أو مركز-الأول"
                    pattern="[a-zA-Z0-9\u0600-\u06FF_-]+"
                    title="يجب أن يحتوي على أحرف أو أرقام فقط (بدون مسافات)"
                  />
                  <small style={{ color: '#666', fontSize: '0.85rem' }}>
                    ⚠️ سيتم استخدام هذا المعرف في إنشاء الحلقات بصيغة: {newCenter.id || 'centerID'}-1، {newCenter.id || 'centerID'}-2، إلخ
                  </small>
                </div>
                <div className="form-group">
                  <label>اسم المركز *</label>
                  <input
                    type="text"
                    value={newCenter.name}
                    onChange={e => setNewCenter({ ...newCenter, name: e.target.value })}
                    required
                    placeholder="مثال: مركز النور للتحفيظ"
                  />
                </div>
                <div className="form-group">
                  <label>العنوان *</label>
                  <input
                    type="text"
                    value={newCenter.address}
                    onChange={e => setNewCenter({ ...newCenter, address: e.target.value })}
                    required
                    placeholder="مثال: الرياض - حي النور"
                  />
                </div>
                <div className="form-group">
                  <label>رقم الهاتف *</label>
                  <input
                    type="tel"
                    value={newCenter.phone}
                    onChange={e => setNewCenter({ ...newCenter, phone: e.target.value })}
                    required
                    placeholder="05xxxxxxxx"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddCenterModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'جاري الإضافة...' : 'إضافة المركز'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal إضافة مستخدم */}
      {showAddUserModal && (
        <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إضافة مشرف/معلم - {selectedCenter?.name}</h2>
              <button className="close-btn" onClick={() => setShowAddUserModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label>نوع الحساب (يمكنك اختيار أكثر من صلاحية) *</label>
                  <div className="roles-checkboxes">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={newUser.roles.includes('supervisor')}
                        onChange={() => handleRoleChange('supervisor')}
                      />
                      <span>👨‍💼 مشرف - يمكنه إدارة المعلمين والطلاب والحلقات</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={newUser.roles.includes('teacher')}
                        onChange={() => handleRoleChange('teacher')}
                      />
                      <span>👨‍🏫 معلم - يمكنه تسجيل الحضور وتحديث التحصيل</span>
                    </label>
                  </div>
                  {newUser.roles.length === 0 && (
                    <small className="form-hint error">⚠️ يرجى اختيار صلاحية واحدة على الأقل</small>
                  )}
                  {newUser.roles.length > 0 && (
                    <small className="form-hint success">
                      الصلاحية الرئيسية: {newUser.role === 'supervisor' ? '👨‍💼 مشرف' : '👨‍🏫 معلم'}
                      {newUser.roles.length > 1 && ' | يمكن التبديل بين الصلاحيات من الـ Sidebar'}
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label>الاسم الكامل *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>البريد الإلكتروني *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>كلمة المرور المؤقتة *</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      minLength={6}
                      readOnly
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setNewUser({ ...newUser, password: generateTemporaryPassword() })}
                      title="توليد كلمة مرور جديدة"
                    >
                      🔄
                    </button>
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => navigator.clipboard.writeText(newUser.password)}
                      title="نسخ كلمة المرور"
                    >
                      📋
                    </button>
                  </div>
                  <small className="form-hint success">
                    💡 كلمة المرور المؤقتة يمكن للمستخدم تغييرها من صفحة الإعدادات
                  </small>
                </div>
                <div className="form-group">
                  <label>رقم الهاتف (واتساب) *</label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                    required
                    placeholder="05xxxxxxxx"
                  />
                  <small className="form-hint success">
                    📱 سيتم إرسال بيانات الدخول عبر واتساب إلى هذا الرقم
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Centers;
