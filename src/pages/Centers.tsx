import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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

interface Supervisor extends UserProfile {
  centerIds?: string[];
}

const Centers = () => {
  const { isAdmin, isSupervisor, getSupervisorCenterIds, canAccessCenter } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [allSupervisors, setAllSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCenterModal, setShowAddCenterModal] = useState(false);
  const [showAddSupervisorModal, setShowAddSupervisorModal] = useState(false);
  const [showManageSupervisorsModal, setShowManageSupervisorsModal] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [centerUsers, setCenterUsers] = useState<CenterUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [newCenter, setNewCenter] = useState({
    id: '', // حقل ID يدوي
    name: '',
    address: '',
    phone: ''
  });

  const [newSupervisor, setNewSupervisor] = useState({
    name: '',
    email: '',
    password: generateTemporaryPassword(),
    phone: ''
  });

  useEffect(() => {
    fetchCenters();
    fetchAllSupervisors();
  }, []);

  // توليد كلمة مرور جديدة عند فتح نموذج إضافة مشرف
  useEffect(() => {
    if (showAddSupervisorModal) {
      setNewSupervisor(prev => ({
        ...prev,
        password: generateTemporaryPassword()
      }));
    }
  }, [showAddSupervisorModal]);

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

  const fetchAllSupervisors = async () => {
    try {
      const usersQuery = query(collection(db, 'users'), where('role', '==', 'supervisor'));
      const usersSnap = await getDocs(usersQuery);
      const supervisorsList = usersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: data.uid || doc.id,
          centerIds: data.centerIds || []
        } as Supervisor;
      });
      setAllSupervisors(supervisorsList);
    } catch (error) {
      console.error('Error fetching supervisors:', error);
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

  // ربط/إلغاء ربط مشرف بمركز
  const handleToggleSupervisorCenter = async (supervisor: Supervisor, centerId: string) => {
    try {
      const userDoc = doc(db, 'users', supervisor.uid);
      // دمج centerIds مع centerId القديم إن وجد
      let currentCenterIds = supervisor.centerIds || [];
      if (supervisor.centerId && !currentCenterIds.includes(supervisor.centerId)) {
        currentCenterIds = [...currentCenterIds, supervisor.centerId];
      }
      
      const isAssigned = currentCenterIds.includes(centerId);
      
      if (isAssigned) {
        // إزالة المركز من قائمة المشرف
        await updateDoc(userDoc, {
          centerIds: arrayRemove(centerId)
        });
      } else {
        // إضافة المركز لقائمة المشرف
        await updateDoc(userDoc, {
          centerIds: arrayUnion(centerId)
        });
      }
      
      // تحديث القائمة
      fetchAllSupervisors();
    } catch (error) {
      console.error('Error updating supervisor centers:', error);
      alert('حدث خطأ أثناء تحديث المشرف');
    }
  };

  const handleAddSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // التحقق من وجود رقم هاتف
    if (!newSupervisor.phone || newSupervisor.phone.trim() === '') {
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
        newSupervisor.email,
        newSupervisor.password
      );

      // حفظ بيانات المستخدم في Firestore
      const userProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: newSupervisor.email,
        name: newSupervisor.name,
        role: 'supervisor',
        roles: ['supervisor'],
        phone: newSupervisor.phone,
        centerIds: selectedCenter ? [selectedCenter.id] : [], // المراكز التي يشرف عليها
        createdAt: new Date().toISOString(),
        active: true
      };

      // استخدام setDoc مع uid كـ document ID
      await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
      
      // تنسيق رقم الهاتف (إزالة + أو 00 والمسافات)
      let phoneNumber = newSupervisor.phone.replace(/[\s+-]/g, '');
      // إذا كان الرقم يبدأ بـ 0، استبدله بكود الدولة (مملكة البحرين 973)
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '973' + phoneNumber.substring(1);
      }
      // إذا لم يبدأ بكود الدولة، أضف 973
      if (!phoneNumber.startsWith('973')) {
        phoneNumber = '973' + phoneNumber;
      }
      
      // إنشاء رسالة واتساب
      const message = `مرحباً ${newSupervisor.name}،

تم إنشاء حسابك كمشرف في النظام بنجاح!

البريد الإلكتروني: ${newSupervisor.email}
كلمة المرور المؤقتة: ${newSupervisor.password}

ملاحظة مهمة:
• يرجى تغيير كلمة المرور بعد تسجيل الدخول الأول
• يمكنك تغيير كلمة المرور من قائمة الإعدادات

رابط النظام: ${window.location.origin}

نتمنى لك تجربة موفقة!`;
      
      // فتح واتساب
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');

      // تسجيل خروج المستخدم الجديد
      await signOut(auth);
      
      // إعادة تسجيل دخول المستخدم الحالي (المطور)
      if (currentEmail) {
        const adminPassword = prompt('من فضلك أدخل كلمة مرورك لإعادة تسجيل الدخول:');
        if (adminPassword) {
          await signInWithEmailAndPassword(auth, currentEmail, adminPassword);
        }
      }

      alert(`تم إنشاء حساب المشرف بنجاح!\n\nتم فتح واتساب لإرسال بيانات الدخول إلى ${newSupervisor.name}`);

      setShowAddSupervisorModal(false);
      setNewSupervisor({ name: '', email: '', password: generateTemporaryPassword(), phone: '' });
      fetchAllSupervisors();
    } catch (error: any) {
      console.error('Error adding supervisor:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'auth/wrong-password') {
        alert('كلمة المرور غير صحيحة. لم يتم إعادة تسجيل دخولك.');
      } else {
        alert('حدث خطأ أثناء إنشاء المشرف');
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

  const handleToggleSupervisorStatus = async (supervisor: Supervisor) => {
    try {
      const userDoc = doc(db, 'users', supervisor.uid);
      await updateDoc(userDoc, { active: !supervisor.active });
      fetchAllSupervisors();
    } catch (error) {
      console.error('Error updating supervisor:', error);
      alert('حدث خطأ أثناء تحديث حالة المشرف');
    }
  };

  // الحصول على مشرفي المركز المحدد (دعم centerIds الجديد و centerId القديم)
  const getCenterSupervisors = (centerId: string) => {
    return allSupervisors.filter(s => {
      // التحقق من centerIds (الجديد)
      if (s.centerIds && s.centerIds.includes(centerId)) {
        return true;
      }
      // التحقق من centerId (القديم) للتوافقية
      if (s.centerId === centerId) {
        return true;
      }
      return false;
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
                  <p className="center-supervisors">
                    👨‍💼 {getCenterSupervisors(center.id).length} مشرف
                  </p>
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
              <div className="header-actions">
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowManageSupervisorsModal(true)}
                >
                  👨‍💼 إدارة المشرفين
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={() => setShowAddSupervisorModal(true)}
                >
                  ➕ مشرف جديد
                </button>
              </div>
            </div>

            <div className="users-section">
              <h3>المشرفون على هذا المركز ({getCenterSupervisors(selectedCenter.id).length})</h3>
              <div className="users-list">
                {getCenterSupervisors(selectedCenter.id).length === 0 ? (
                  <p className="no-data">لا يوجد مشرفون مرتبطون بهذا المركز</p>
                ) : (
                  getCenterSupervisors(selectedCenter.id).map(supervisor => (
                    <div key={supervisor.uid} className="user-card">
                      <div className="user-info">
                        <span className="user-name">{supervisor.name}</span>
                        <span className="user-email">{supervisor.email}</span>
                        <span className="user-centers">
                          📍 {supervisor.centerIds?.length || 0} مركز
                        </span>
                      </div>
                      <div className="user-actions">
                        <span className={`status-badge ${supervisor.active ? 'active' : 'inactive'}`}>
                          {supervisor.active ? 'نشط' : 'معطل'}
                        </span>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleToggleSupervisorCenter(supervisor, selectedCenter.id)}
                          title="إزالة من هذا المركز"
                        >
                          إزالة
                        </button>
                        <button 
                          className="btn btn-sm"
                          onClick={() => handleToggleSupervisorStatus(supervisor)}
                        >
                          {supervisor.active ? 'إيقاف' : 'تفعيل'}
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

      {/* Modal إدارة المشرفين */}
      {showManageSupervisorsModal && selectedCenter && (
        <div className="modal-overlay" onClick={() => setShowManageSupervisorsModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إدارة مشرفي {selectedCenter.name}</h2>
              <button className="close-btn" onClick={() => setShowManageSupervisorsModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                اختر المشرفين الذين سيكون لهم صلاحية الوصول لهذا المركز. يمكن للمشرف الواحد إدارة أكثر من مركز.
              </p>
              
              {allSupervisors.length === 0 ? (
                <p className="no-data">لا يوجد مشرفون في النظام. قم بإضافة مشرف جديد أولاً.</p>
              ) : (
                <div className="supervisors-checklist">
                  {allSupervisors.map(supervisor => {
                    // التحقق من الربط باستخدام centerIds أو centerId القديم
                    const isAssigned = supervisor.centerIds?.includes(selectedCenter.id) || supervisor.centerId === selectedCenter.id;
                    // حساب عدد المراكز
                    let centersCount = supervisor.centerIds?.length || 0;
                    if (supervisor.centerId && !supervisor.centerIds?.includes(supervisor.centerId)) {
                      centersCount += 1;
                    }
                    return (
                      <div key={supervisor.uid} className={`supervisor-check-item ${isAssigned ? 'assigned' : ''}`}>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => handleToggleSupervisorCenter(supervisor, selectedCenter.id)}
                          />
                          <div className="supervisor-check-info">
                            <span className="supervisor-name">{supervisor.name}</span>
                            <span className="supervisor-email">{supervisor.email}</span>
                            <span className="supervisor-centers-count">
                              يشرف على {centersCount} مركز
                            </span>
                          </div>
                        </label>
                        <span className={`status-indicator ${supervisor.active ? 'active' : 'inactive'}`}>
                          {supervisor.active ? '✓ نشط' : '✗ معطل'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setShowManageSupervisorsModal(false)}>
                تم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal إضافة مشرف جديد */}
      {showAddSupervisorModal && (
        <div className="modal-overlay" onClick={() => setShowAddSupervisorModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إضافة مشرف جديد</h2>
              <button className="close-btn" onClick={() => setShowAddSupervisorModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddSupervisor}>
              <div className="modal-body">
                <div className="form-group">
                  <label>الاسم الكامل *</label>
                  <input
                    type="text"
                    value={newSupervisor.name}
                    onChange={e => setNewSupervisor({ ...newSupervisor, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>البريد الإلكتروني *</label>
                  <input
                    type="email"
                    value={newSupervisor.email}
                    onChange={e => setNewSupervisor({ ...newSupervisor, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>كلمة المرور المؤقتة *</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newSupervisor.password}
                      onChange={e => setNewSupervisor({ ...newSupervisor, password: e.target.value })}
                      required
                      minLength={6}
                      readOnly
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setNewSupervisor({ ...newSupervisor, password: generateTemporaryPassword() })}
                      title="توليد كلمة مرور جديدة"
                    >
                      🔄
                    </button>
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => navigator.clipboard.writeText(newSupervisor.password)}
                      title="نسخ كلمة المرور"
                    >
                      📋
                    </button>
                  </div>
                  <small className="form-hint success">
                    💡 كلمة المرور المؤقتة يمكن للمشرف تغييرها من صفحة الإعدادات
                  </small>
                </div>
                <div className="form-group">
                  <label>رقم الهاتف (واتساب) *</label>
                  <input
                    type="tel"
                    value={newSupervisor.phone}
                    onChange={e => setNewSupervisor({ ...newSupervisor, phone: e.target.value })}
                    required
                    placeholder="05xxxxxxxx"
                  />
                  <small className="form-hint success">
                    📱 سيتم إرسال بيانات الدخول عبر واتساب إلى هذا الرقم
                  </small>
                </div>
                {selectedCenter && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                      />
                      <span>سيتم ربط المشرف بمركز: <strong>{selectedCenter.name}</strong></span>
                    </label>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSupervisorModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء حساب المشرف'}
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
