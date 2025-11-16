import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Teachers.css';
import ConfirmModal from '../components/ConfirmModal';
import DetailsModal from '../components/DetailsModal';

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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTeacher, setDetailsTeacher] = useState<Teacher | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setDetailsOpen(false);
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

      <div className="table-card">
        {teachers.length === 0 ? (
          <p>لا توجد بيانات معلمين حتى الآن</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>الاسم الكامل</th>
                <th>رقم الهاتف</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>{teacher.name}</td>
                  <td>{teacher.phone}</td>
                  <td>
                    <div className="card-actions">
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => {
                          setDetailsTeacher(teacher);
                          setDetailsOpen(true);
                        }}
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

      {detailsTeacher && (
        <DetailsModal
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title={detailsTeacher.name}
          fields={[
            { label: 'الاسم الكامل', value: detailsTeacher.name },
            { label: 'الرقم الشخصي', value: detailsTeacher.personalId },
            { label: 'رقم الهاتف', value: detailsTeacher.phone },
            { label: 'البريد الإلكتروني', value: detailsTeacher.email },
            { label: 'الوظيفة', value: getPositionLabel(detailsTeacher.position) },
            {
              label: 'تاريخ الميلاد',
              value: detailsTeacher.birthDate
                ? new Date(detailsTeacher.birthDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : '-'
            }
          ]}
          actions={
            <>
              <button
                className="btn-modal btn-modal-warning"
                onClick={() => handleEditTeacher(detailsTeacher)}
              >
                تعديل
              </button>
              <button
                className="btn-modal btn-modal-danger"
                onClick={() => {
                  setDetailsOpen(false);
                  handleDeleteTeacher(detailsTeacher.id || '');
                }}
              >
                حذف
              </button>
            </>
          }
        />
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
