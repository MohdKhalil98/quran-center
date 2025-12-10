import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth, UserProfile, UserRole } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
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
  const { isAdmin } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCenterModal, setShowAddCenterModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [centerUsers, setCenterUsers] = useState<CenterUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [newCenter, setNewCenter] = useState({
    name: '',
    address: '',
    phone: ''
  });

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'supervisor' as UserRole
  });

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    try {
      const centersSnap = await getDocs(collection(db, 'centers'));
      const centersList = centersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Center));
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
      const centerData = {
        ...newCenter,
        createdAt: new Date().toISOString(),
        active: true
      };

      await addDoc(collection(db, 'centers'), centerData);
      alert('تم إضافة المركز بنجاح');
      setShowAddCenterModal(false);
      setNewCenter({ name: '', address: '', phone: '' });
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
    setSubmitting(true);

    try {
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
        phone: newUser.phone,
        centerId: selectedCenter.id,
        createdAt: new Date().toISOString(),
        active: true
      };

      // استخدام setDoc مع uid كـ document ID
      await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);

      const roleText = newUser.role === 'supervisor' ? 'مشرف' : 'معلم';
      alert(`تم إنشاء حساب ${roleText} بنجاح!\n\nبيانات الدخول:\nالبريد: ${newUser.email}\nكلمة المرور: ${newUser.password}\n\nيرجى حفظ هذه البيانات وإرسالها للمستخدم.`);

      setShowAddUserModal(false);
      setNewUser({ name: '', email: '', password: '', phone: '', role: 'supervisor' });
      fetchCenterUsers(selectedCenter.id);
    } catch (error: any) {
      console.error('Error adding user:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('البريد الإلكتروني مستخدم بالفعل');
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

  if (!isAdmin) {
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
                  <label>نوع الحساب *</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    required
                  >
                    <option value="supervisor">مشرف</option>
                    <option value="teacher">معلم</option>
                  </select>
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
                  <label>كلمة المرور *</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label>رقم الهاتف</label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                  />
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
