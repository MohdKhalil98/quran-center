import { useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useEffect } from 'react';
import '../styles/DevTools.css';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import { parseCSV } from '../utils/csvParse';

const DevTools = () => {
        // State for centers and groups
        const [centers, setCenters] = useState<any[]>([]);
        const [groups, setGroups] = useState<any[]>([]);

        // Fetch centers and groups on mount
        useEffect(() => {
          const fetchCenters = async () => {
            const snap = await getDocs(collection(db, 'centers'));
            setCenters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          };
          const fetchGroups = async () => {
            const snap = await getDocs(collection(db, 'groups'));
            setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          };
          fetchCenters();
          fetchGroups();
        }, []);
    // --- Import Students State ---
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [importedCount, setImportedCount] = useState(0);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);

    // تحميل نموذج CSV من public
    const handleDownloadTemplate = async () => {
      try {
        const response = await fetch('/csvTemplate_students.csv');
        const text = await response.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students_template.csv';
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert('تعذر تحميل النموذج');
      }
    };

    // قراءة ملف CSV
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportError(null);
      setImportSuccess(null);
      if (e.target.files && e.target.files[0]) {
        setCsvFile(e.target.files[0]);
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const text = evt.target?.result as string;
            const parsed = parseCSV(text);
            setStudents(parsed);
          } catch (err) {
            setImportError('خطأ في قراءة الملف');
          }
        };
        reader.readAsText(e.target.files[0]);
      }
    };

    // رفع الطلاب
    const handleImport = async () => {
      if (!students.length) {
        setImportError('يرجى اختيار ملف صحيح');
        return;
      }
      setImporting(true);
      setImportedCount(0);
      setImportError(null);
      setImportSuccess(null);
      let count = 0;
      try {
        for (const student of students) {
          if (!student.email || !student.name || !student.phone) continue;
          const uid = student.email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + Date.now();
          await setDoc(doc(db, 'users', uid), {
            uid,
            name: student.name,
            email: student.email,
            phone: student.phone,
            role: 'student',
            centerId: student.centerId || '',
            groupId: student.groupId || '',
            status: 'approved',
            createdAt: serverTimestamp(),
            registrationDate: new Date().toISOString(),
            active: true
          });
          count++;
          setImportedCount(count);
        }
        setImportSuccess(`تم استيراد ${count} طالب بنجاح!`);
      } catch (err: any) {
        setImportError('حدث خطأ أثناء الاستيراد: ' + err.message);
      }
      setImporting(false);
    };
  const [running, setRunning] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteOptions, setDeleteOptions] = useState({
    students: true,
    teachers: true,
    groups: true,
    points: true,
    achievements: true
  });

  const seedDemoData = async () => {
    setRunning(true);
    try {
      // Add teachers
      const teachers = [
        { name: 'أحمد علي', personalId: 'T1001', phone: '0500000001', email: 'ahmad@example.com', position: 'teacher', birthDate: '1985-01-01', seed: true },
        { name: 'سالم محمد', personalId: 'T1002', phone: '0500000002', email: 'salem@example.com', position: 'supervisor', birthDate: '1978-06-10', seed: true }
      ];
      const teacherIds: string[] = [];
      for (const t of teachers) {
        const ref = await addDoc(collection(db, 'teachers'), t);
        teacherIds.push(ref.id);
      }

      // Add students
      const students = [
        { name: 'مريم خالد', personalId: 'S2001', phone: '0501111111', email: 'maryam@example.com', birthDate: '2010-03-05', levelId: 1, levelName: 'المستوى الأول', seed: true },
        { name: 'يوسف علي', personalId: 'S2002', phone: '0502222222', email: 'yousef@example.com', birthDate: '2009-08-12', levelId: 6, levelName: 'المستوى السادس', seed: true }
      ];
      const studentIds: string[] = [];
      for (const s of students) {
        const ref = await addDoc(collection(db, 'students'), s);
        studentIds.push(ref.id);
      }

      // Add groups referencing teachers
      const groups = [
        { name: 'مجموعة النور', teacherId: teacherIds[0], description: 'مجموعة للصغار', schedule: 'الأحد - الثلاثاء', seed: true },
        { name: 'مجموعة الفجر', teacherId: teacherIds[1], description: 'مجموعة مراجعة', schedule: 'الاثنين - الخميس', seed: true }
      ];
      for (const g of groups) {
        await addDoc(collection(db, 'groups'), g);
      }

      // Add activities
      const activities = [
        { title: 'بدء التسجيل', description: 'تم فتح باب التسجيل للفصل الصيفي', date: new Date().toISOString(), seed: true },
        { title: 'إضافة مجموعة', description: 'تمت إضافة مجموعة جديدة', date: new Date().toISOString(), seed: true }
      ];
      for (const a of activities) {
        await addDoc(collection(db, 'activities'), a);
      }

      // Add sample achievements for one student
      if (studentIds.length) {
        await addDoc(collection(db, 'student_achievements'), {
          studentId: studentIds[0],
          portion: 'جزء عمّ',
          fromAya: '1',
          toAya: '20',
          rating: 8,
          assignmentFromAya: '21',
          assignmentToAya: '30',
          date: new Date().toISOString(),
          seed: true
        });
      }

      alert('تم زراعة بيانات تجريبية بنجاح');
    } catch (error) {
      console.error('Error seeding demo data:', error);
      alert('حدث خطأ أثناء زراعة البيانات');
    } finally {
      setRunning(false);
    }
  };

  const clearSeeded = async () => {
    setRunning(true);
    try {
      const collectionsToClear = ['students', 'teachers', 'groups', 'activities', 'student_achievements'];
      for (const col of collectionsToClear) {
        const q = query(collection(db, col), where('seed', '==', true));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, col, d.id));
        }
      }
      alert('تم إزالة البيانات التجريبية');
    } catch (error) {
      console.error('Error clearing seeded data:', error);
      alert('حدث خطأ أثناء تنظيف البيانات');
    } finally {
      setRunning(false);
    }
  };

  const clearAllData = async () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteData = async () => {
    setRunning(true);
    try {
      const collectionsToDelete: string[] = [];
      
      // Students are in 'users' collection with role='student'
      if (deleteOptions.students) {
        // Delete students from users collection
        const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
        const studentsSnap = await getDocs(studentsQuery);
        for (const d of studentsSnap.docs) {
          await deleteDoc(doc(db, 'users', d.id));
        }
      }
      
      // Teachers are in 'users' collection with role='teacher'
      if (deleteOptions.teachers) {
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersSnap = await getDocs(teachersQuery);
        for (const d of teachersSnap.docs) {
          await deleteDoc(doc(db, 'users', d.id));
        }
      }
      
      // Groups/Tracks
      if (deleteOptions.groups) {
        collectionsToDelete.push('groups', 'tracks');
      }
      
      // Reset student points to 0
      if (deleteOptions.points) {
        const allUsersSnap = await getDocs(collection(db, 'users'));
        for (const d of allUsersSnap.docs) {
          const userData = d.data();
          if (userData.points && userData.points > 0) {
            await updateDoc(doc(db, 'users', d.id), { points: 0 });
          }
        }
      }
      
      // Achievements and attendance
      if (deleteOptions.achievements) {
        collectionsToDelete.push('student_achievements', 'attendance', 'levelRequests');
      }

      // Delete from other collections
      for (const col of collectionsToDelete) {
        try {
          const snap = await getDocs(collection(db, col));
          for (const d of snap.docs) {
            await deleteDoc(doc(db, col, d.id));
          }
        } catch (e) {
          console.log(`Collection ${col} may not exist or is empty`);
        }
      }

      const deletedItems = [];
      if (deleteOptions.students) deletedItems.push('الطلاب');
      if (deleteOptions.teachers) deletedItems.push('المعلمين');
      if (deleteOptions.groups) deletedItems.push('الحلقات والمساقات');
      if (deleteOptions.points) deletedItems.push('نقاط الطلاب');
      if (deleteOptions.achievements) deletedItems.push('السجلات');

      let authNote = '';
      if (deleteOptions.students || deleteOptions.teachers) {
        authNote = '\n\n⚠️ ملاحظة: تم حذف البيانات من قاعدة البيانات فقط.\nلحذف حسابات المستخدمين من Firebase Auth، يجب الحذف يدوياً من Firebase Console.';
      }

      setDeleteMessage(`✅ تم حذف: ${deletedItems.join(' - ')}${authNote}`);
    } catch (error) {
      console.error('Error clearing data:', error);
      setDeleteMessage('❌ حدث خطأ أثناء حذف البيانات');
    } finally {
      setRunning(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteMessage('');
  };

  const reloadAllData = async () => {
    setRunning(true);
    try {
      window.location.reload();
    } catch (error) {
      console.error('Error reloading data:', error);
      alert('❌ حدث خطأ أثناء إعادة التحميل');
    } finally {
      setRunning(false);
    }
  };

  const createDefaultCenter = async () => {
    setRunning(true);
    try {
      // Check if center already exists
      const centersSnap = await getDocs(collection(db, 'centers'));
      if (centersSnap.docs.length > 0) {
        alert('يوجد مركز بالفعل في النظام');
        return;
      }

      // Create default center
      await addDoc(collection(db, 'centers'), {
        name: 'حلقات مسجد موزة بنت أحمد الرميحي',
        address: 'البحرين',
        phone: '97333333333',
        createdAt: new Date().toISOString(),
        active: true
      });

      alert('✅ تم إنشاء المركز الافتراضي بنجاح');
    } catch (error) {
      console.error('Error creating default center:', error);
      alert('❌ حدث خطأ أثناء إنشاء المركز');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="page">
      {/* جدول المراكز */}
      <div className="dev-card" style={{marginBottom: 16, maxWidth: 700}}>
        <div className="dev-card-header">
          <h3>🟢 قائمة المراكز (CenterId)</h3>
        </div>
        <div className="dev-card-body" style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f5f5f5'}}>
                <th style={{padding:'4px', border:'1px solid #ddd'}}>الاسم</th>
                <th style={{padding:'4px', border:'1px solid #ddd'}}>centerId</th>
              </tr>
            </thead>
            <tbody>
              {centers.map(center => (
                <tr key={center.id}>
                  <td style={{padding:'4px', border:'1px solid #ddd'}}>{center.name || '-'}</td>
                  <td style={{padding:'4px', border:'1px solid #ddd', fontFamily:'monospace'}}>{center.id}</td>
                </tr>
              ))}
              {centers.length === 0 && (
                <tr><td colSpan={2} style={{textAlign:'center', color:'#888'}}>لا يوجد مراكز</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* جدول الحلقات */}
      <div className="dev-card" style={{marginBottom: 24, maxWidth: 700}}>
        <div className="dev-card-header">
          <h3>🔵 قائمة الحلقات (GroupId)</h3>
        </div>
        <div className="dev-card-body" style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f5f5f5'}}>
                <th style={{padding:'4px', border:'1px solid #ddd'}}>الاسم</th>
                <th style={{padding:'4px', border:'1px solid #ddd'}}>groupId</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <tr key={group.id}>
                  <td style={{padding:'4px', border:'1px solid #ddd'}}>{group.name || '-'}</td>
                  <td style={{padding:'4px', border:'1px solid #ddd', fontFamily:'monospace'}}>{group.id}</td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr><td colSpan={2} style={{textAlign:'center', color:'#888'}}>لا يوجد حلقات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <header className="page__header">
        <h1>أدوات المطور</h1>
        <p>أدوات مساعدة لإدارة البيانات والتطوير (زرع، تنظيف، إعادة تحميل).</p>
      </header>

      {/* Import Students Card */}
      <div className="dev-card" style={{marginBottom: 24}}>
        <div className="dev-card-header">
          <h3>📥 استيراد الطلاب من ملف CSV</h3>
          <p>يمكنك تحميل نموذج CSV وتعبئته ثم رفعه هنا.</p>
        </div>
        <div className="dev-card-body" style={{flexDirection:'column',alignItems:'flex-start'}}>
          <button className="btn btn-primary" onClick={handleDownloadTemplate} style={{marginBottom:8}}>تحميل نموذج CSV</button>
          <input type="file" accept=".csv" onChange={handleFileChange} disabled={importing} style={{marginBottom:8}} />
          {students.length > 0 && (
            <div style={{margin: '10px 0'}}>عدد الطلاب في الملف: {students.length}</div>
          )}
          <button className="btn btn-success" onClick={handleImport} disabled={importing || !students.length}>
            {importing ? `جاري الاستيراد... (${importedCount}/${students.length})` : 'استيراد الطلاب'}
          </button>
          {importError && <div style={{color: 'red', marginTop: 10}}>{importError}</div>}
          {importSuccess && <div style={{color: 'green', marginTop: 10}}>{importSuccess}</div>}
          <div style={{marginTop: 20, fontSize: '0.95rem', color: '#555'}}>
            <b>صيغة الملف المطلوبة:</b><br/>
            name,email,phone,centerId,groupId<br/>
            <span style={{color:'#888'}}>جميع الحقول مطلوبة ما عدا centerId و groupId</span>
          </div>
        </div>
      </div>

      <div className="devtools-container">
        {/* Seeding Card */}
        <div className="dev-card">
          <div className="dev-card-header">
            <h3>🌱 زراعة البيانات</h3>
            <p>إضافة بيانات تجريبية لتعبئة النظام.</p>
          </div>
          <div className="dev-card-body">
            <button className="btn btn-primary" onClick={seedDemoData} disabled={running}>
              زرع بيانات تجريبية
            </button>
            <button className="btn btn-secondary" onClick={clearSeeded} disabled={running}>
              إزالة البيانات المزروعة
            </button>
          </div>
        </div>

        {/* Actions Card */}
        <div className="dev-card">
          <div className="dev-card-header">
            <h3>⚙️ إجراءات عامة</h3>
            <p>أدوات لإعادة تحميل البيانات أو حذفها.</p>
          </div>
          <div className="dev-card-body">
            <button 
              className="btn btn-primary" 
              onClick={createDefaultCenter} 
              disabled={running}
            >
              🏢 إنشاء مركز افتراضي
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={reloadAllData} 
              disabled={running}
            >
              🔄 إعادة تحميل البيانات
            </button>
            <button 
              className="btn btn-danger" 
              onClick={clearAllData} 
              disabled={running}
            >
              🗑️ حذف جميع البيانات
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{deleteMessage ? '✅ تم الحذف بنجاح' : '⚠️ حذف البيانات'}</h2>
              <button className="close-btn" onClick={cancelDelete}>&times;</button>
            </div>
            <div className="modal-body">
              {deleteMessage ? (
                <p className={`delete-message ${deleteMessage.startsWith('✅') ? 'success' : 'error'}`} style={{ whiteSpace: 'pre-line' }}>
                  {deleteMessage}
                </p>
              ) : (
                <>
                  <p>اختر ما تريد حذفه:</p>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={deleteOptions.students}
                        onChange={(e) => setDeleteOptions({ ...deleteOptions, students: e.target.checked })}
                      />
                      <span>جميع الطلاب</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={deleteOptions.teachers}
                        onChange={(e) => setDeleteOptions({ ...deleteOptions, teachers: e.target.checked })}
                      />
                      <span>جميع المعلمين</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={deleteOptions.groups}
                        onChange={(e) => setDeleteOptions({ ...deleteOptions, groups: e.target.checked })}
                      />
                      <span>جميع الحلقات والمساقات</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={deleteOptions.points}
                        onChange={(e) => setDeleteOptions({ ...deleteOptions, points: e.target.checked })}
                      />
                      <span>نقاط الطلاب (تصفير)</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={deleteOptions.achievements}
                        onChange={(e) => setDeleteOptions({ ...deleteOptions, achievements: e.target.checked })}
                      />
                      <span>سجلات الحضور والتحصيل</span>
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              {deleteMessage ? (
                <>
                  {(deleteOptions.students || deleteOptions.teachers) && (
                    <a 
                      href="https://console.firebase.google.com/project/halqatmoza/authentication/users" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                    >
                      🔗 فتح Firebase Auth
                    </a>
                  )}
                  <button className="btn btn-primary" onClick={cancelDelete}>
                    إغلاق
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={cancelDelete}>
                    إلغاء
                  </button>
                  <button className="btn btn-danger" onClick={confirmDeleteData} disabled={running}>
                    {running ? 'جاري الحذف...' : 'تأكيد الحذف'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DevTools;
