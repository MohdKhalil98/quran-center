import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, where, deleteDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import { generateTemporaryPassword } from '../utils/passwordGenerator';
import '../styles/Shared.css';
import '../styles/Teachers.css';

interface TeacherUser extends UserProfile {
  groupIds?: string[];
  groupNames?: string;
  centerName?: string;
  groupsCount?: number;
}

interface Center {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  teacherId?: string;
}

const Teachers = () => {
  const { userProfile, isSupervisor, isAdmin, getSupervisorCenterIds, canAccessCenter } = useAuth();
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherUser | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [filterCenterId, setFilterCenterId] = useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<TeacherUser | null>(null);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTeacher, setNewTeacher] = useState({
    name: '',
    email: '',
    password: generateTemporaryPassword(),
    phone: '',
    centerId: ''
  });
  // ترتيب الجدول
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // دالة الترتيب
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // دالة للحصول على class الترتيب
  const getSortClass = (column: string) => {
    if (sortColumn !== column) return 'sortable';
    return sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
  };

  useEffect(() => {
    fetchData();
  }, [isSupervisor, userProfile]);

  const fetchData = async () => {
    try {
      // Fetch centers
      const centersSnapshot = await getDocs(collection(db, 'centers'));
      const centersList = centersSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name
      }));
      setCenters(centersList);

      // Fetch groups
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      const groupsList = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        teacherId: doc.data().teacherId
      }));

      // Fetch teachers from users collection (role = teacher)
      let teachersQuery;
      if (isSupervisor) {
        // المشرف يرى معلمي مراكزه (دعم مراكز متعددة)
        const supervisorCenterIds = getSupervisorCenterIds();
        if (supervisorCenterIds.length > 0) {
          // استخدام 'in' query للبحث في مراكز متعددة
          teachersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            where('centerId', 'in', supervisorCenterIds)
          );
          
          // إذا كان لديه مركز واحد فقط، يتم تعيينه في الفلتر تلقائياً
          if (supervisorCenterIds.length === 1) {
            setFilterCenterId(supervisorCenterIds[0]);
          }
        } else {
          // المشرف بدون مراكز - لا يرى أي معلم
          teachersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            where('centerId', '==', 'non-existent')
          );
        }
      } else {
        teachersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'teacher')
        );
      }
      
      const snapshot = await getDocs(teachersQuery);
      const teachersList = snapshot.docs.map((doc) => {
        const data = doc.data() as TeacherUser;
        // حساب عدد الحلقات لكل معلم
        const teacherGroups = groupsList.filter((g: Group) => g.teacherId === data.uid);
        const groupNames = teacherGroups.map((g: Group) => g.name).join(', ');
        
        return {
          ...data,
          groupNames: groupNames || 'لا يوجد',
          groupsCount: teacherGroups.length,
          centerName: centersList.find(c => c.id === data.centerId)?.name || ''
        } as TeacherUser;
      });
      
      setTeachers(teachersList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  // فتح modal إضافة معلم جديد
  const handleOpenAddTeacherModal = () => {
    const supervisorCenterIds = getSupervisorCenterIds();
    setNewTeacher({
      name: '',
      email: '',
      password: generateTemporaryPassword(),
      phone: '',
      centerId: supervisorCenterIds.length === 1 ? supervisorCenterIds[0] : ''
    });
    setShowAddTeacherModal(true);
  };

  // إضافة معلم جديد
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTeacher.centerId) {
      alert('يرجى اختيار المركز');
      return;
    }
    
    if (!newTeacher.phone || newTeacher.phone.trim() === '') {
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
        newTeacher.email,
        newTeacher.password
      );

      // حفظ بيانات المستخدم في Firestore
      const userProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: newTeacher.email,
        name: newTeacher.name,
        role: 'teacher',
        roles: ['teacher'],
        phone: newTeacher.phone,
        centerId: newTeacher.centerId,
        createdAt: new Date().toISOString(),
        active: true
      };

      // استخدام setDoc مع uid كـ document ID
      await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
      
      // الحصول على اسم المركز
      const centerName = centers.find(c => c.id === newTeacher.centerId)?.name || '';
      
      // تنسيق رقم الهاتف
      let phoneNumber = newTeacher.phone.replace(/[\s+-]/g, '');
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '973' + phoneNumber.substring(1);
      }
      if (!phoneNumber.startsWith('973')) {
        phoneNumber = '973' + phoneNumber;
      }
      
      // إنشاء رسالة واتساب
      const message = `مرحباً ${newTeacher.name}،

تم إنشاء حسابك كمعلم في ${centerName} بنجاح!

البريد الإلكتروني: ${newTeacher.email}
كلمة المرور المؤقتة: ${newTeacher.password}

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
      
      // إعادة تسجيل دخول المستخدم الحالي
      if (currentEmail) {
        const adminPassword = prompt('من فضلك أدخل كلمة مرورك لإعادة تسجيل الدخول:');
        if (adminPassword) {
          await signInWithEmailAndPassword(auth, currentEmail, adminPassword);
        }
      }

      alert(`تم إنشاء حساب المعلم بنجاح!\n\nتم فتح واتساب لإرسال بيانات الدخول إلى ${newTeacher.name}`);

      setShowAddTeacherModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error adding teacher:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'auth/wrong-password') {
        alert('كلمة المرور غير صحيحة. لم يتم إعادة تسجيل دخولك.');
      } else {
        alert('حدث خطأ أثناء إنشاء المعلم');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (teacher: TeacherUser) => {
    try {
      await updateDoc(doc(db, 'users', teacher.uid), {
        active: !teacher.active
      });
      fetchData();
    } catch (error) {
      console.error('Error updating teacher:', error);
      alert('حدث خطأ أثناء تحديث حالة المعلم');
    }
  };

  const handleOpenDetailsModal = (teacher: TeacherUser) => {
    setSelectedTeacher(teacher);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedTeacher(null);
    setIsDetailsModalOpen(false);
  };

  const handleOpenEditModal = (teacher: TeacherUser) => {
    setEditFormData({ ...teacher });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditFormData(null);
    setIsEditModalOpen(false);
  };

  const handleEditFormChange = (field: string, value: string) => {
    if (editFormData) {
      setEditFormData({
        ...editFormData,
        [field]: value
      });
    }
  };

  const handleSaveTeacher = async () => {
    if (!editFormData || !editFormData.uid) {
      alert('خطأ: لا يوجد معرف للمعلم');
      return;
    }

    // التحقق من البيانات المطلوبة
    if (!editFormData.name || !editFormData.email || !editFormData.phone) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', editFormData.uid), {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone
      });

      alert('تم تحديث بيانات المعلم بنجاح');
      handleCloseEditModal();
      fetchData();
    } catch (error) {
      console.error('Error updating teacher:', error);
      alert('حدث خطأ أثناء تحديث بيانات المعلم');
    }
  };

  const handleDeleteTeacher = async (teacher: TeacherUser) => {
    if (!window.confirm(`هل أنت متأكد من حذف المعلم ${teacher.name}؟\n\nسيتم حذف البيانات من قاعدة البيانات وإرسال رسالة للمطور لحذف الحساب من Firebase.`)) {
      return;
    }

    try {
      // حذف بيانات المعلم من Firestore
      await deleteDoc(doc(db, 'users', teacher.uid));

      alert(`تم حذف المعلم ${teacher.name} بنجاح`);
      handleCloseDetailsModal();
      fetchData();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      alert('حدث خطأ أثناء حذف المعلم');
    }
  };

  // فلترة المعلمين
  const filteredTeachers = teachers.filter(t => 
    !filterCenterId || t.centerId === filterCenterId
  );

  // ترتيب المعلمين
  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
    let aValue: any = '';
    let bValue: any = '';
    
    switch (sortColumn) {
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
      case 'email':
        aValue = a.email || '';
        bValue = b.email || '';
        break;
      case 'phone':
        aValue = a.phone || '';
        bValue = b.phone || '';
        break;
      case 'center':
        aValue = a.centerName || '';
        bValue = b.centerName || '';
        break;
      case 'groups':
        aValue = a.groupsCount || 0;
        bValue = b.groupsCount || 0;
        break;
      case 'active':
        aValue = a.active ? 1 : 0;
        bValue = b.active ? 1 : 0;
        break;
      default:
        aValue = a.name || '';
        bValue = b.name || '';
    }
    
    if (typeof aValue === 'string') {
      const comparison = aValue.localeCompare(bValue, 'ar');
      return sortDirection === 'asc' ? comparison : -comparison;
    }
    
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>المعلمون</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>المعلمون</h1>
        <p>عرض بيانات المعلمين.</p>
      </header>

      <div className="page-actions-header">
        {isSupervisor && (
          <button 
            className="btn btn-primary"
            onClick={handleOpenAddTeacherModal}
          >
            ➕ إضافة معلم جديد
          </button>
        )}

        <div className="filters-section">
          {isAdmin && (
            <select 
              className="filter-select"
              value={filterCenterId} 
              onChange={(e) => setFilterCenterId(e.target.value)}
            >
              <option value="">جميع المراكز</option>
              {centers.map(center => (
                <option key={center.id} value={center.id}>{center.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="view-mode-toggle">
          <button 
            className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
            title="عرض البطاقات"
          >
            📇 البطاقات
          </button>
          <button 
            className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="عرض الجدول"
          >
            📋 الجدول
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="cards-container">
          {filteredTeachers.length === 0 ? (
            <p className="empty-state">لا يوجد معلمون حتى الآن</p>
          ) : (
            filteredTeachers.map((teacher) => (
              <article key={teacher.uid} className="data-card">
                <header className="data-card-header">
                  <div>
                    <h3>{teacher.name}</h3>
                    <p className="data-card-id">{teacher.email}</p>
                  </div>
                  <div className="data-card-tag">
                    <span className={teacher.active ? 'active' : 'inactive'}>
                      {teacher.active ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                </header>
                <section className="data-card-body">
                  <div className="data-card-row">
                    <label>رقم الهاتف:</label>
                    <span>{teacher.phone || '-'}</span>
                  </div>
                  <div className="data-card-row">
                    <label>المركز:</label>
                    <span>{teacher.centerName || '-'}</span>
                  </div>
                  <div className="data-card-row">
                    <label>الحلقات:</label>
                    <span className="tag-cell">{teacher.groupNames}</span>
                  </div>
                </section>
                <footer className="data-card-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleOpenDetailsModal(teacher)}
                  >
                    المزيد
                  </button>
                </footer>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="table-card">
          {sortedTeachers.length === 0 ? (
            <p>لا يوجد معلمون حتى الآن</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className={getSortClass('name')} onClick={() => handleSort('name')}>الاسم</th>
                  <th className={getSortClass('email')} onClick={() => handleSort('email')}>البريد الإلكتروني</th>
                  <th className={getSortClass('phone')} onClick={() => handleSort('phone')}>رقم الهاتف</th>
                  <th className={getSortClass('center')} onClick={() => handleSort('center')}>المركز</th>
                  <th className={getSortClass('groups')} onClick={() => handleSort('groups')}>الحلقات</th>
                  <th className={getSortClass('active')} onClick={() => handleSort('active')}>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeachers.map((teacher) => (
                  <tr key={teacher.uid}>
                    <td>{teacher.name}</td>
                    <td>{teacher.email}</td>
                    <td>{teacher.phone || '-'}</td>
                    <td>{teacher.centerName || '-'}</td>
                    <td className="tag-cell">{teacher.groupNames}</td>
                    <td>
                      <span className={`status-badge ${teacher.active ? 'active' : 'inactive'}`}>
                        {teacher.active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td>
                      <div className="card-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenDetailsModal(teacher)}
                        >
                          المزيد
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {isDetailsModalOpen && selectedTeacher && (
        <div className="modal-overlay" onClick={handleCloseDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تفاصيل المعلم: {selectedTeacher.name}</h2>
              <button className="close-btn" onClick={handleCloseDetailsModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="details-list">
                <p><strong>البريد الإلكتروني:</strong> {selectedTeacher.email}</p>
                <p><strong>رقم الهاتف:</strong> {selectedTeacher.phone || '-'}</p>
                <p><strong>المركز:</strong> {selectedTeacher.centerName || 'غير محدد'}</p>
                <p><strong>الحلقات:</strong> <span className="tag-cell">{selectedTeacher.groupNames}</span></p>
                <p><strong>عدد الحلقات:</strong> {selectedTeacher.groupsCount}</p>
                <p><strong>الحالة:</strong> {selectedTeacher.active ? 'نشط' : 'معطل'}</p>
                <p><strong>تاريخ الإنشاء:</strong> {new Date(selectedTeacher.createdAt).toLocaleDateString('ar-EG')}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-info"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  handleOpenEditModal(selectedTeacher);
                }}
              >
                ✏️ تعديل
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDeleteTeacher(selectedTeacher)}
              >
                🗑️ حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && editFormData && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تعديل بيانات المعلم: {editFormData.name}</h2>
              <button className="close-btn" onClick={handleCloseEditModal}>&times;</button>
            </div>
            <div className="modal-body">
              <form className="form-group">
                <div className="form-row">
                  <label htmlFor="edit-name">الاسم الكامل *</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => handleEditFormChange('name', e.target.value)}
                    placeholder="أدخل اسم المعلم"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="edit-email">البريد الإلكتروني *</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => handleEditFormChange('email', e.target.value)}
                    placeholder="أدخل البريد الإلكتروني"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="edit-phone">رقم الهاتف *</label>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={editFormData.phone || ''}
                    onChange={(e) => handleEditFormChange('phone', e.target.value)}
                    placeholder="أدخل رقم الهاتف"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="edit-center">المركز</label>
                  <input
                    id="edit-center"
                    type="text"
                    value={editFormData.centerName || ''}
                    disabled
                    placeholder="المركز (غير قابل للتعديل)"
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-success"
                onClick={handleSaveTeacher}
              >
                💾 حفظ التعديلات
              </button>
              <button className="btn btn-secondary" onClick={handleCloseEditModal}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal إضافة معلم جديد */}
      {showAddTeacherModal && (
        <div className="modal-overlay" onClick={() => setShowAddTeacherModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إضافة معلم جديد</h2>
              <button className="close-btn" onClick={() => setShowAddTeacherModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddTeacher}>
              <div className="modal-body">
                {getSupervisorCenterIds().length > 1 && (
                  <div className="form-row">
                    <label htmlFor="teacher-center">المركز *</label>
                    <select
                      id="teacher-center"
                      value={newTeacher.centerId}
                      onChange={e => setNewTeacher({ ...newTeacher, centerId: e.target.value })}
                      required
                    >
                      <option value="">اختر المركز</option>
                      {centers
                        .filter(c => getSupervisorCenterIds().includes(c.id))
                        .map(center => (
                          <option key={center.id} value={center.id}>{center.name}</option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="form-row">
                  <label htmlFor="teacher-name">الاسم الكامل *</label>
                  <input
                    id="teacher-name"
                    type="text"
                    value={newTeacher.name}
                    onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })}
                    required
                    placeholder="أدخل اسم المعلم"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="teacher-email">البريد الإلكتروني *</label>
                  <input
                    id="teacher-email"
                    type="email"
                    value={newTeacher.email}
                    onChange={e => setNewTeacher({ ...newTeacher, email: e.target.value })}
                    required
                    placeholder="أدخل البريد الإلكتروني"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="teacher-password">كلمة المرور المؤقتة *</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      id="teacher-password"
                      type="text"
                      value={newTeacher.password}
                      readOnly
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setNewTeacher({ ...newTeacher, password: generateTemporaryPassword() })}
                      title="توليد كلمة مرور جديدة"
                    >
                      🔄
                    </button>
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => navigator.clipboard.writeText(newTeacher.password)}
                      title="نسخ كلمة المرور"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="teacher-phone">رقم الهاتف (واتساب) *</label>
                  <input
                    id="teacher-phone"
                    type="tel"
                    value={newTeacher.phone}
                    onChange={e => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                    required
                    placeholder="05xxxxxxxx"
                  />
                  <small style={{ color: '#666', marginTop: '4px' }}>
                    📱 سيتم إرسال بيانات الدخول عبر واتساب إلى هذا الرقم
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTeacherModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء حساب المعلم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Teachers;
