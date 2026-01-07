import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase';
import { useAuth, UserProfile, UserRole } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const UserManagement = () => {
  const { isAdmin, userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'teacher' as UserRole
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList = usersSnap.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // التحقق من أن المطور مسجل دخول
      if (!userProfile || userProfile.role !== 'admin') {
        alert('ليس لديك صلاحية لإضافة مستخدمين');
        return;
      }

      // 1. إنشاء المستخدم في Firebase Auth باستخدام secondary auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newUser.email,
        newUser.password
      );

      const newUserId = userCredential.user.uid;

      // 2. تسجيل خروج المستخدم الجديد فوراً من secondaryAuth
      await signOut(secondaryAuth);

      // 3. حفظ بيانات المستخدم في Firestore (باستخدام جلسة المطور الحالية)
      const newUserProfile: UserProfile = {
        uid: newUserId,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        phone: newUser.phone,
        createdAt: new Date().toISOString(),
        active: true
      };

      await setDoc(doc(db, 'users', newUserId), newUserProfile);

      // 4. تجهيز رسالة WhatsApp
      const whatsappMessage = `مرحباً ${newUser.name}،\n\nتم إنشاء حسابك في نظام رحلة الماهر:\n\n📧 البريد الإلكتروني: ${newUser.email}\n🔐 كلمة المرور: ${newUser.password}\n\nيُرجى تغيير كلمة المرور بعد تسجيل الدخول الأول.\n\nرابط الدخول: https://almaherqu.com`;
      
      const phoneNumber = newUser.phone.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(whatsappMessage)}`;
      
      // 5. فتح WhatsApp في نافذة جديدة
      window.open(whatsappUrl, '_blank');

      alert(`✅ تم إنشاء حساب ${getRoleName(newUser.role)} بنجاح!\n\nسيتم فتح WhatsApp لإرسال البيانات للمستخدم.`);

      setShowAddModal(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'teacher'
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      
      // تسجيل خروج من secondaryAuth في حالة الخطأ
      try {
        await signOut(secondaryAuth);
      } catch (e) {
        // تجاهل أخطاء تسجيل الخروج
      }

      if (error.code === 'auth/email-already-in-use') {
        alert('❌ البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'auth/weak-password') {
        alert('❌ كلمة المرور ضعيفة. يجب أن تكون 6 أحرف على الأقل');
      } else if (error.code === 'auth/invalid-email') {
        alert('❌ البريد الإلكتروني غير صالح');
      } else {
        alert('❌ حدث خطأ أثناء إنشاء المستخدم: ' + (error.message || 'خطأ غير معروف'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: UserProfile) => {
    try {
      const userDoc = doc(db, 'users', user.uid);
      await updateDoc(userDoc, {
        active: !user.active
      });
      fetchUsers();
      alert(`تم ${user.active ? 'إيقاف' : 'تفعيل'} المستخدم بنجاح`);
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('حدث خطأ أثناء تحديث حالة المستخدم');
    }
  };

  const getRoleName = (role: UserRole): string => {
    const roles: Record<UserRole, string> = {
      admin: 'مطور',
      supervisor: 'مشرف',
      teacher: 'معلم',
      student: 'طالب',
      parent: 'ولي أمر'
    };
    return roles[role];
  };

  const getRoleColor = (role: UserRole): string => {
    const colors: Record<UserRole, string> = {
      admin: '#e91e63',
      supervisor: '#2196f3',
      teacher: '#4caf50',
      student: '#ff9800',
      parent: '#9c27b0'
    };
    return colors[role];
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>إدارة المستخدمين</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>إدارة المستخدمين</h1>
        <p>إضافة وإدارة المشرفين والمعلمين في النظام</p>
      </header>

      <div style={{ marginBottom: '20px' }}>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          ➕ إضافة مستخدم جديد
        </button>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد الإلكتروني</th>
              <th>الهاتف</th>
              <th>الدور</th>
              <th>الحالة</th>
              <th>تاريخ التسجيل</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.uid}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.phone || '-'}</td>
                <td>
                  <span 
                    style={{
                      backgroundColor: getRoleColor(user.role),
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: '600'
                    }}
                  >
                    {getRoleName(user.role)}
                  </span>
                </td>
                <td>
                  <span style={{ color: user.active ? '#4caf50' : '#f44336', fontWeight: '600' }}>
                    {user.active ? '✓ نشط' : '✗ معطل'}
                  </span>
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString('ar-SA')}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => toggleUserStatus(user)}
                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  >
                    {user.active ? 'إيقاف' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>إضافة مستخدم جديد</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ textAlign: 'right' }}>
                    <strong>الاسم الكامل *</strong>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px', marginTop: '5px', direction: 'rtl' }}
                    />
                  </label>

                  <label style={{ textAlign: 'right' }}>
                    <strong>البريد الإلكتروني *</strong>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    />
                  </label>

                  <label style={{ textAlign: 'right' }}>
                    <strong>كلمة المرور *</strong>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      minLength={6}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                    />
                  </label>

                  <label style={{ textAlign: 'right' }}>
                    <strong>رقم الهاتف</strong>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', direction: 'rtl' }}
                    />
                  </label>

                  <label style={{ textAlign: 'right' }}>
                    <strong>الدور *</strong>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                      required
                      style={{ width: '100%', padding: '8px', marginTop: '5px', direction: 'rtl' }}
                    >
                      <option value="supervisor">مشرف</option>
                      <option value="teacher">معلم</option>
                      <option value="admin">مطور</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default UserManagement;
