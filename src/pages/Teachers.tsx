import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Shared.css';
import '../styles/Teachers.css';
import ConfirmModal from '../components/ConfirmModal';

interface Teacher {
  id?: string;
  name: string;
  personalId: string;
  phone: string;
  email: string;
  position: 'supervisor' | 'teacher' | 'admin';
  birthDate: string;
  groupIds?: string[];
  groupNames?: string;
}

const POSITIONS = [
  { value: 'supervisor', label: 'مشرف' },
  { value: 'teacher', label: 'معلم' },
  { value: 'admin', label: 'إداري' }
];

const getPositionLabel = (position: string): string => {
  return POSITIONS.find((p) => p.value === position)?.label || position;
};

const Teachers = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Teacher>({
    name: '',
    personalId: '',
    phone: '',
    email: '',
    position: 'teacher',
    birthDate: '',
    groupIds: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch groups first
        const groupsQuery = query(collection(db, 'groups'), orderBy('name'));
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupsList = groupsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          ...doc.data()
        } as any));
        setGroups(groupsList);

        // Fetch teachers
        const q = query(collection(db, 'teachers'), orderBy('name'));
        const snapshot = await getDocs(q);
        const teachersList = snapshot.docs.map((doc) => {
          const data = doc.data() as Teacher;
          const groupIds = data.groupIds || [];
          const groupNames = groupIds
            .map(gid => groupsList.find(g => g.id === gid)?.name)
            .filter(Boolean)
            .join(', ');
          return {
            id: doc.id,
            ...data,
            groupNames
          } as Teacher;
        });
        setTeachers(teachersList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.personalId || !formData.phone || !formData.email) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const { id, groupNames, ...dataToSave } = formData;
      dataToSave.groupIds = selectedGroupIds;

      if (editingId) {
        await updateDoc(doc(db, 'teachers', editingId), dataToSave);
        const groupNamesStr = selectedGroupIds
          .map(gid => groups.find(g => g.id === gid)?.name)
          .filter(Boolean)
          .join(', ');
        setTeachers((prev) =>
          prev.map((t) => (t.id === editingId ? { ...dataToSave, id: editingId, groupNames: groupNamesStr } as Teacher : t))
        );
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'teachers'), dataToSave);
        const groupNamesStr = selectedGroupIds
          .map(gid => groups.find(g => g.id === gid)?.name)
          .filter(Boolean)
          .join(', ');
        setTeachers((prev) => [...prev, { ...dataToSave, id: docRef.id, groupNames: groupNamesStr } as Teacher]);
      }

      setFormData({
        name: '',
        personalId: '',
        phone: '',
        email: '',
        position: 'teacher',
        birthDate: '',
        groupIds: []
      });
      setSelectedGroupIds([]);
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding/updating teacher:', error);
      alert('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleDeleteTeacher = (id: string) => {
    setConfirmTargetId(id);
    setConfirmOpen(true);
  };

  const performDeleteTeacher = async () => {
    const id = confirmTargetId;
    setConfirmOpen(false);
    setConfirmTargetId(null);
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'teachers', id));
      setTeachers((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Error deleting teacher:', error);
      alert('حدث خطأ أثناء حذف البيانات');
    }
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setFormData(teacher);
    setSelectedGroupIds(teacher.groupIds || []);
    setEditingId(teacher.id || null);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setSelectedGroupIds([]);
    setFormData({
      name: '',
      personalId: '',
      phone: '',
      email: '',
      position: 'teacher',
      birthDate: '',
      groupIds: []
    });
  };

  const handleGroupCheckboxChange = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      if (prev.includes(groupId)) {
        return prev.filter((id) => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const handleOpenDetailsModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedTeacher(null);
    setIsDetailsModalOpen(false);
  };

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
        <p>إدارة بيانات المعلمين والمشرفين.</p>
      </header>

      <div className="page-actions-header">
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
          + إضافة معلم جديد
        </button>
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

      {isAdding && (
        <form className="form-card" onSubmit={handleAddTeacher}>
          <h3>{editingId ? 'تعديل بيانات المعلم' : 'إضافة معلم جديد'}</h3>
          <div className="form-group">
            <label htmlFor="name">اسم المعلم *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="personalId">الرقم الشخصي *</label>
            <input
              type="text"
              id="personalId"
              name="personalId"
              value={formData.personalId}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">رقم الهاتف *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">البريد الإلكتروني *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="position">الوظيفة</label>
            <select
              id="position"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
            >
              {POSITIONS.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="birthDate">تاريخ الميلاد</label>
            <input
              type="date"
              id="birthDate"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-group">
            <label>المجموعات المسؤول عنها</label>
            <div className="groups-checkboxes">
              {groups.length === 0 ? (
                <p style={{ color: '#999', fontSize: '14px' }}>لا توجد مجموعات متاحة. قم بإضافة مجموعات أولاً.</p>
              ) : (
                groups.map((group) => (
                  <label key={group.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(group.id)}
                      onChange={() => handleGroupCheckboxChange(group.id)}
                    />
                    <span>{group.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-success">
              {editingId ? 'تحديث' : 'حفظ'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      {viewMode === 'cards' ? (
        <div className="cards-container">
          {teachers.length === 0 ? (
            <p className="empty-state">لا توجد بيانات معلمين حتى الآن</p>
          ) : (
            teachers.map((teacher) => (
              <article key={teacher.id} className="data-card">
                <header className="data-card-header">
                  <div>
                    <h3>{teacher.name}</h3>
                    <p className="data-card-id">#{teacher.personalId}</p>
                  </div>
                  <div className="data-card-tag">
                    <span>{getPositionLabel(teacher.position)}</span>
                  </div>
                </header>
                <section className="data-card-body">
                  <div className="data-card-row">
                    <label>رقم الهاتف:</label>
                    <span>{teacher.phone}</span>
                  </div>
                  <div className="data-card-row">
                    <label>البريد الإلكتروني:</label>
                    <span>{teacher.email}</span>
                  </div>
                  <div className="data-card-row">
                    <label>تاريخ الميلاد:</label>
                    <span>
                      {teacher.birthDate
                        ? new Date(teacher.birthDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : '-'}
                    </span>
                  </div>
                  {teacher.groupNames && (
                    <div className="data-card-row">
                      <label>المجموعات:</label>
                      <span className="tag-cell">{teacher.groupNames}</span>
                    </div>
                  )}
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
          {teachers.length === 0 ? (
            <p>لا توجد بيانات معلمين حتى الآن</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الرقم الشخصي</th>
                  <th>رقم الهاتف</th>
                  <th>البريد الإلكتروني</th>
                  <th>الوظيفة</th>
                  <th>المجموعات</th>
                  <th>تاريخ الميلاد</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.name}</td>
                    <td>{teacher.personalId}</td>
                    <td>{teacher.phone}</td>
                    <td>{teacher.email}</td>
                    <td>{getPositionLabel(teacher.position)}</td>
                    <td className="tag-cell">
                      {teacher.groupNames || '-'}
                    </td>
                    <td className="date-cell">
                      {teacher.birthDate
                        ? new Date(teacher.birthDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : '-'}
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
      <ConfirmModal
        open={confirmOpen}
        message="هل أنت متأكد من حذف هذا المعلم؟"
        onConfirm={performDeleteTeacher}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmTargetId(null);
        }}
      />
      {isDetailsModalOpen && selectedTeacher && (
        <div className="modal-overlay" onClick={handleCloseDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تفاصيل المعلم: {selectedTeacher.name}</h2>
              <button className="close-btn" onClick={handleCloseDetailsModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="details-list">
                <p><strong>الرقم الشخصي:</strong> {selectedTeacher.personalId}</p>
                <p><strong>رقم الهاتف:</strong> {selectedTeacher.phone}</p>
                <p><strong>البريد الإلكتروني:</strong> {selectedTeacher.email}</p>
                <p><strong>الوظيفة:</strong> {getPositionLabel(selectedTeacher.position)}</p>
                <p><strong>تاريخ الميلاد:</strong> {selectedTeacher.birthDate ? new Date(selectedTeacher.birthDate + 'T00:00:00').toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
                <p><strong>المجموعات:</strong> <span className="tag-cell">{selectedTeacher.groupNames || 'لا يوجد'}</span></p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-warning"
                onClick={() => {
                  handleCloseDetailsModal();
                  handleEditTeacher(selectedTeacher);
                }}
              >
                ✏️ تعديل
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  handleCloseDetailsModal();
                  handleDeleteTeacher(selectedTeacher.id || '');
                }}
              >
                🗑️ حذف
              </button>
              <button className="btn btn-secondary" onClick={handleCloseDetailsModal}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Teachers;
