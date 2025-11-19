import { useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc
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
    activities: true,
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
      const collectionsToDelete = [];
      if (deleteOptions.students) collectionsToDelete.push('students');
      if (deleteOptions.teachers) collectionsToDelete.push('teachers');
      if (deleteOptions.groups) collectionsToDelete.push('groups');
      if (deleteOptions.activities) collectionsToDelete.push('activities');
      if (deleteOptions.achievements) collectionsToDelete.push('student_achievements', 'attendance');

      for (const col of collectionsToDelete) {
        const snap = await getDocs(collection(db, col));
        for (const d of snap.docs) {
          await deleteDoc(doc(db, col, d.id));
        }
      }

      const deletedItems = [];
      if (deleteOptions.students) deletedItems.push('الطلاب');
      if (deleteOptions.teachers) deletedItems.push('المعلمين');
      if (deleteOptions.groups) deletedItems.push('الحلقات والمساقات');
      if (deleteOptions.activities) deletedItems.push('الأنشطة');
      if (deleteOptions.achievements) deletedItems.push('السجلات');

      setDeleteMessage(`✅ تم حذف: ${deletedItems.join(' - ')}`);
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

  return (
    <section className="page">
      <header className="page__header">
        <h1>أدوات المطور</h1>
        <p>أدوات مساعدة لإدارة البيانات والتطوير (زرع، تنظيف، إعادة تحميل).</p>
      </header>

      <div style={{ display: 'flex', gap: '12px', marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={seedDemoData} disabled={running}>
          زرع بيانات تجريبية
        </button>
        <button className="btn btn-secondary" onClick={clearSeeded} disabled={running}>
          إزالة البيانات التجريبية
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={reloadAllData} 
          disabled={running}
          style={{ fontWeight: 'bold' }}
        >
          🔄 إعادة تحميل البيانات
        </button>
        <button 
          className="btn btn-danger" 
          onClick={clearAllData} 
          disabled={running}
          style={{ backgroundColor: '#dc3545', fontWeight: 'bold' }}
        >
          🗑️ حذف جميع البيانات
        </button>
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
                <p style={{ fontSize: '16px', color: deleteMessage.startsWith('✅') ? '#28a745' : '#dc3545', textAlign: 'center', padding: '20px 0' }}>
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
                        checked={deleteOptions.activities}
                        onChange={(e) => setDeleteOptions({ ...deleteOptions, activities: e.target.checked })}
                      />
                      <span>جميع الأنشطة والأحداث</span>
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
                <button className="btn btn-primary" onClick={cancelDelete}>
                  إغلاق
                </button>
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
