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
import '../styles/DevTools.css';

const DevTools = () => {
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
      <header className="page__header">
        <h1>أدوات المطور</h1>
        <p>أدوات مساعدة لإدارة البيانات والتطوير (زرع، تنظيف، إعادة تحميل).</p>
      </header>

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
