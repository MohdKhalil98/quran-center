import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Students.css';
import ConfirmModal from '../components/ConfirmModal';
import curriculum from '../data/curriculumData';

interface Student {
  id?: string;
  name: string;
  personalId: string;
  phone: string;
  email: string;
  birthDate: string;
  levelId?: number;
  levelName?: string;
}

const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Student>({
    name: '',
    personalId: '',
    phone: '',
    email: '',
    birthDate: '',
    levelId: 1,
    levelName: curriculum.find((l) => l.id === 1)?.name || 'المستوى الأول'
  });
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'students'), orderBy('name'));
        const snapshot = await getDocs(q);
        const studentsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          // ensure backward compatibility: if level not set, default to level 1
          levelId: (doc.data() as any).levelId || 1,
          levelName:
            (doc.data() as any).levelName || curriculum.find((l) => l.id === ((doc.data() as any).levelId || 1))?.name
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
    } as any));
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const levelId = parseInt(e.target.value, 10);
    const level = curriculum.find((l) => l.id === levelId);
    setFormData((prev) => ({
      ...prev,
      levelId,
      levelName: level?.name || ''
    } as any));
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.personalId || !formData.phone || !formData.email) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const { id, ...dataToSave } = formData as any;
      // ensure levelName exists
      if (!dataToSave.levelName && dataToSave.levelId) {
        dataToSave.levelName = curriculum.find((l) => l.id === dataToSave.levelId)?.name || '';
      }

      if (editingId) {
        await updateDoc(doc(db, 'students', editingId), dataToSave);
        setStudents((prev) =>
          prev.map((s) => (s.id === editingId ? { ...(dataToSave as Student), id: editingId } : s))
        );
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'students'), dataToSave);
        setStudents((prev) => [...prev, { ...(dataToSave as Student), id: docRef.id }]);
      }

      setFormData({
        name: '',
        personalId: '',
        phone: '',
        email: '',
        birthDate: '',
        levelId: 1,
        levelName: curriculum.find((l) => l.id === 1)?.name || 'المستوى الأول'
      });
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding/updating student:', error);
      alert('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: any[] = (results.data as any[]).map((row: any) => {
          // normalize keys
          const map: any = {};
          Object.keys(row).forEach((key) => {
            map[key.toLowerCase().trim()] = row[key];
          });
          return {
            name: map['name'] || map['الاسم'] || map['full name'] || map['student'] || '',
            personalId: map['personalid'] || map['id'] || map['personal_id'] || map['الرقم الشخصي'] || '',
            phone: map['phone'] || map['phone_number'] || map['الهاتف'] || '',
            email: map['email'] || map['email_address'] || map['البريد'] || '',
            birthDate: map['birthdate'] || map['dob'] || map['تاريخ الميلاد'] || '',
            levelId: map['levelid'] ? parseInt(map['levelid'], 10) : 1
          };
        });
        setImportRows(rows);
        setImportStatus(`${rows.length} صف تم قراءته من الملف`);
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        alert('حدث خطأ أثناء قراءة الملف');
      }
    });
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
      levelId: 1,
      levelName: curriculum.find((l) => l.id === 1)?.name || 'المستوى الأول'
    });
  };

  const importCsvToFirestore = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    setImportStatus('جاري إضافة الطلاب إلى قاعدة البيانات...');
    try {
      const added: any[] = [];
      for (const r of importRows) {
        if (!r.name || !r.personalId) continue; // skip incomplete rows
        // skip if personalId already exists locally
        if (students.find((s) => s.personalId === r.personalId)) continue;
        const studentDoc = {
          name: r.name,
          personalId: r.personalId,
          phone: r.phone || '',
          email: r.email || '',
          birthDate: r.birthDate || '',
          levelId: r.levelId || 1,
          levelName: curriculum.find((l) => l.id === (r.levelId || 1))?.name || ''
        };
        const docRef = await addDoc(collection(db, 'students'), studentDoc);
        added.push({ ...studentDoc, id: docRef.id });
      }
      if (added.length) {
        setStudents((prev) => [...prev, ...added]);
        setImportStatus(`تم استيراد ${added.length} طالب بنجاح`);
      } else {
        setImportStatus('لا يوجد صفوف صالحة للاستيراد');
      }
      setImportRows([]);
    } catch (error) {
      console.error('Error importing CSV:', error);
      setImportStatus('حدث خطأ أثناء استيراد الطلاب');
      alert('حدث خطأ أثناء استيراد الطلاب');
    }
    setImporting(false);
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
        <label className="btn btn-outline" style={{ marginLeft: 8 }}>
          استيراد CSV
          <input
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => handleCsvUpload(e)}
          />
        </label>
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
            <label htmlFor="levelId">المستوى</label>
            <select id="levelId" name="levelId" value={formData.levelId as any} onChange={handleLevelChange}>
              {curriculum.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </option>
              ))}
            </select>
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

      {importRows.length > 0 && (
        <div className="import-preview">
          <h4>معاينة الاستيراد — {importRows.length} سطر</h4>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            <table className="table-import">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الرقم الشخصي</th>
                  <th>الهاتف</th>
                  <th>البريد</th>
                </tr>
              </thead>
              <tbody>
                {importRows.slice(0, 10).map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.name}</td>
                    <td>{r.personalId}</td>
                    <td>{r.phone}</td>
                    <td>{r.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-success"
              disabled={importing}
              onClick={() => importCsvToFirestore()}
            >
              {importing ? 'جاري الاستيراد...' : `استيراد ${importRows.length} طالب`}
            </button>
            <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => { setImportRows([]); setImportStatus(''); }}>
              إلغاء
            </button>
          </div>
          {importStatus && <p style={{ marginTop: 8 }}>{importStatus}</p>}
        </div>
      )}

      {viewMode === 'cards' ? (
        <div className="students-cards-container">
          {students.length === 0 ? (
            <p>لا توجد بيانات طلاب حتى الآن</p>
          ) : (
            students.map((student) => (
              <article key={student.id} className="student-card">
                <header className="student-header">
                  <div>
                    <h3>{student.name}</h3>
                    <p className="student-id">#{student.personalId}</p>
                  </div>
                  <div className="student-portion">
                    <span>{student.levelName || 'غير محدد'}</span>
                  </div>
                </header>
                <section className="student-body">
                  <div className="student-row">
                    <label>رقم الهاتف:</label>
                    <span>{student.phone}</span>
                  </div>
                  <div className="student-row">
                    <label>البريد الإلكتروني:</label>
                    <span>{student.email}</span>
                  </div>
                  <div className="student-row">
                    <label>تاريخ الميلاد:</label>
                    <span>
                      {student.birthDate
                        ? new Date(student.birthDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : '-'}
                    </span>
                  </div>
                </section>
                <footer className="student-actions">
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => handleEditStudent(student)}
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteStudent(student.id || '')}
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
          {students.length === 0 ? (
            <p>لا توجد بيانات طلاب حتى الآن</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الرقم الشخصي</th>
                  <th>رقم الهاتف</th>
                  <th>البريد الإلكتروني</th>
                  <th>تاريخ الميلاد</th>
                  <th>الورد الحالي</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.personalId}</td>
                    <td>{student.phone}</td>
                    <td>{student.email}</td>
                    <td className="date-cell">
                      {student.birthDate
                        ? new Date(student.birthDate + 'T00:00:00').toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : '-'}
                    </td>
                    <td>{student.levelName || '-'}</td>
                    <td>
                      <div className="card-actions">
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleEditStudent(student)}
                        >
                          تعديل
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteStudent(student.id || '')}
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

