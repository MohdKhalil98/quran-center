import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Students.css';
import ConfirmModal from '../components/ConfirmModal';
import DetailsModal from '../components/DetailsModal';

interface Student {
  id?: string;
  name: string;
  personalId: string;
  phone: string;
  email: string;
  birthDate: string;
  currentPortion: string;
}

const Students = () => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsStudent, setDetailsStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Student>({
    name: '',
    personalId: '',
    phone: '',
    email: '',
    birthDate: '',
    currentPortion: ''
  });

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'students'), orderBy('name'));
        const snapshot = await getDocs(q);
        const studentsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as Student));
        setStudents(studentsList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching students:', error);
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.personalId || !formData.phone || !formData.email) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const { id, ...dataToSave } = formData;

      if (editingId) {
        await updateDoc(doc(db, 'students', editingId), dataToSave);
        setStudents((prev) =>
          prev.map((s) => (s.id === editingId ? { ...dataToSave, id: editingId } as Student : s))
        );
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'students'), dataToSave);
        setStudents((prev) => [...prev, { ...dataToSave, id: docRef.id } as Student]);
      }

      setFormData({
        name: '',
        personalId: '',
        phone: '',
        email: '',
        birthDate: '',
        currentPortion: ''
      });
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding/updating student:', error);
      alert('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleDeleteStudent = (id: string) => {
    setConfirmTargetId(id);
    setConfirmOpen(true);
  };

  const performDeleteStudent = async () => {
    const id = confirmTargetId;
    setConfirmOpen(false);
    setConfirmTargetId(null);
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'students', id));
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('حدث خطأ أثناء حذف البيانات');
    }
  };

  const handleEditStudent = (student: Student) => {
    setFormData(student);
    setEditingId(student.id || null);
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
      birthDate: '',
      currentPortion: ''
    });
  };

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>الطلاب</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>الطلاب</h1>
        <p>إدارة بيانات الطلاب ومستوى التقدم.</p>
      </header>

      <div className="students-header">
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
          + إضافة طالب جديد
        </button>
      </div>

      {isAdding && (
        <form className="form-card" onSubmit={handleAddStudent}>
          <h3>{editingId ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</h3>
          <div className="form-group">
            <label htmlFor="name">اسم الطالب *</label>
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
            <label htmlFor="currentPortion">الورد الحالي</label>
            <input
              type="text"
              id="currentPortion"
              name="currentPortion"
              value={formData.currentPortion}
              onChange={handleInputChange}
              placeholder="مثال: جزء عمّ"
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
        {students.length === 0 ? (
          <p>لا توجد بيانات طلاب حتى الآن</p>
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
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.phone}</td>
                  <td>
                    <div className="card-actions">
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => {
                          setDetailsStudent(student);
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

      {detailsStudent && (
        <DetailsModal
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title={detailsStudent.name}
          fields={[
            { label: 'الاسم الكامل', value: detailsStudent.name },
            { label: 'الرقم الشخصي', value: detailsStudent.personalId },
            { label: 'رقم الهاتف', value: detailsStudent.phone },
            { label: 'البريد الإلكتروني', value: detailsStudent.email },
            {
              label: 'تاريخ الميلاد',
              value: detailsStudent.birthDate
                ? new Date(detailsStudent.birthDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : '-'
            },
            { label: 'الورد الحالي', value: detailsStudent.currentPortion || '-' }
          ]}
          actions={
            <>
              <button
                className="btn-modal btn-modal-warning"
                onClick={() => handleEditStudent(detailsStudent)}
              >
                تعديل
              </button>
              <button
                className="btn-modal btn-modal-danger"
                onClick={() => {
                  setDetailsOpen(false);
                  handleDeleteStudent(detailsStudent.id || '');
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
        message="هل أنت متأكد من حذف هذا الطالب؟"
        onConfirm={performDeleteStudent}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmTargetId(null);
        }}
      />
    </section>
  );
};

export default Students;

