import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
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
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Teacher>({
    name: '',
    personalId: '',
    phone: '',
    email: '',
    position: 'teacher',
    birthDate: ''
  });

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const q = query(collection(db, 'teachers'), orderBy('name'));
        const snapshot = await getDocs(q);
        const teachersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as Teacher));
        setTeachers(teachersList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching teachers:', error);
        setLoading(false);
      }
    };

    fetchTeachers();
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
      const { id, ...dataToSave } = formData;

      if (editingId) {
        await updateDoc(doc(db, 'teachers', editingId), dataToSave);
        setTeachers((prev) =>
          prev.map((t) => (t.id === editingId ? { ...dataToSave, id: editingId } as Teacher : t))
        );
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'teachers'), dataToSave);
        setTeachers((prev) => [...prev, { ...dataToSave, id: docRef.id } as Teacher]);
      }

      setFormData({
        name: '',
        personalId: '',
        phone: '',
        email: '',
        position: 'teacher',
        birthDate: ''
      });
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
    setEditingId(teacher.id || null);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      personalId: '',
      phone: '',
      email: '',
      position: 'teacher',
      birthDate: ''
    });
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

      <div className="teachers-header">
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
        <div className="teachers-cards-container">
          {teachers.length === 0 ? (
            <p>لا توجد بيانات معلمين حتى الآن</p>
          ) : (
            teachers.map((teacher) => (
              <article key={teacher.id} className="teacher-card">
                <header className="teacher-header">
                  <div>
                    <h3>{teacher.name}</h3>
                    <p className="teacher-id">#{teacher.personalId}</p>
                  </div>
                  <div className="teacher-position">
                    <span>{getPositionLabel(teacher.position)}</span>
                  </div>
                </header>
                <section className="teacher-body">
                  <div className="teacher-row">
                    <label>رقم الهاتف:</label>
                    <span>{teacher.phone}</span>
                  </div>
                  <div className="teacher-row">
                    <label>البريد الإلكتروني:</label>
                    <span>{teacher.email}</span>
                  </div>
                  <div className="teacher-row">
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
                </section>
                <footer className="teacher-actions">
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => handleEditTeacher(teacher)}
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteTeacher(teacher.id || '')}
                  >
                    🗑️ حذف
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
                          className="btn btn-sm btn-warning"
                          onClick={() => handleEditTeacher(teacher)}
                        >
                          تعديل
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteTeacher(teacher.id || '')}
                        >
                          حذف
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
    </section>
  );
};

export default Teachers;
