import { useEffect, useState } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  addDoc,
  deleteDoc,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import '../styles/Subscriptions.css';

interface Student extends UserProfile {
  groupName?: string;
  centerName?: string;
  subscriptionActive?: boolean;
  lastActivationDate?: string;
}

interface Center {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  centerId?: string;
}

interface StudyPeriod {
  id: string;
  name: string;
  type: 'first_semester' | 'spring_activity' | 'second_semester' | 'summer_activity';
  startDate: Timestamp;
  endDate: Timestamp;
  isActive: boolean;
  centerId?: string; // اختياري - إذا كانت الفترة خاصة بمركز معين
}

const PERIOD_TYPES = [
  { value: 'first_semester', label: 'الفصل الدراسي الأول' },
  { value: 'spring_activity', label: 'النشاط الربيعي' },
  { value: 'second_semester', label: 'الفصل الدراسي الثاني' },
  { value: 'summer_activity', label: 'النشاط الصيفي' }
];

const Subscriptions = () => {
  const { userProfile, isSupervisor, isAdmin, getSupervisorCenterIds } = useAuth();
  
  // States للطلاب والفلاتر
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  // فلاتر
  const [filterCenterId, setFilterCenterId] = useState<string>('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  
  // WhatsApp Bulk
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string>('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  
  // فترات الدراسة
  const [studyPeriods, setStudyPeriods] = useState<StudyPeriod[]>([]);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<StudyPeriod | null>(null);
  const [newPeriod, setNewPeriod] = useState({
    name: '',
    type: 'first_semester' as StudyPeriod['type'],
    startDate: '',
    endDate: '',
    centerId: ''
  });
  
  // تفعيل/تعطيل حسابات
  const [processingStudents, setProcessingStudents] = useState<string[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'periods'>('subscriptions');

  useEffect(() => {
    fetchData();
  }, [isSupervisor, isAdmin, userProfile]);

  useEffect(() => {
    filterStudents();
  }, [students, filterCenterId, filterGroupId, filterStatus]);

  useEffect(() => {
    // تصفية المجموعات حسب المركز المحدد
    if (filterCenterId) {
      const filtered = groups.filter(g => g.centerId === filterCenterId);
      setFilteredGroups(filtered);
      // إذا كانت المجموعة المحددة غير موجودة في المركز الجديد، إعادة تعيينها
      if (filterGroupId && !filtered.find(g => g.id === filterGroupId)) {
        setFilterGroupId('');
      }
    } else {
      setFilteredGroups(groups);
    }
  }, [filterCenterId, groups]);

  // التحقق من انتهاء فترات الدراسة وتعطيل الحسابات
  useEffect(() => {
    checkAndDeactivateExpiredPeriods();
  }, [studyPeriods]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // جلب المراكز
      const centersSnapshot = await getDocs(collection(db, 'centers'));
      const centersList = centersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setCenters(centersList);

      // جلب المجموعات
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      const groupsList = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        centerId: doc.data().centerId
      }));
      setGroups(groupsList);

      // جلب فترات الدراسة
      const periodsSnapshot = await getDocs(
        query(collection(db, 'studyPeriods'), orderBy('startDate', 'desc'))
      );
      const periodsList = periodsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudyPeriod[];
      setStudyPeriods(periodsList);

      // جلب الطلاب
      let studentsQuery;
      if (isSupervisor) {
        const supervisorCenterIds = getSupervisorCenterIds();
        if (supervisorCenterIds.length > 0) {
          // جلب الطلاب في مراكز المشرف
          studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('status', '==', 'approved')
          );
        }
      } else if (isAdmin) {
        studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'approved')
        );
      }

      if (studentsQuery) {
        const studentsSnapshot = await getDocs(studentsQuery);
        let studentsList = studentsSnapshot.docs.map(doc => {
          const data = doc.data() as Student;
          return {
            ...data,
            uid: doc.id,
            groupName: groupsList.find(g => g.id === data.groupId)?.name || 'غير محدد',
            centerName: centersList.find(c => c.id === data.centerId)?.name || 'غير محدد'
          };
        });

        // تصفية حسب مراكز المشرف
        if (isSupervisor) {
          const supervisorCenterIds = getSupervisorCenterIds();
          studentsList = studentsList.filter(s => 
            s.centerId && supervisorCenterIds.includes(s.centerId)
          );
          
          // إذا كان لديه مركز واحد فقط
          if (supervisorCenterIds.length === 1) {
            setFilterCenterId(supervisorCenterIds[0]);
          }
        }

        setStudents(studentsList);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const filterStudents = () => {
    let filtered = [...students];

    if (filterCenterId) {
      filtered = filtered.filter(s => s.centerId === filterCenterId);
    }

    if (filterGroupId) {
      filtered = filtered.filter(s => s.groupId === filterGroupId);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => 
        filterStatus === 'active' ? s.subscriptionActive : !s.subscriptionActive
      );
    }

    setFilteredStudents(filtered);
  };

  const checkAndDeactivateExpiredPeriods = async () => {
    const now = new Date();
    
    for (const period of studyPeriods) {
      const endDate = period.endDate.toDate();
      
      // إذا انتهت الفترة ولم يتم تعطيلها بعد
      if (endDate < now && period.isActive) {
        try {
          // تعطيل الفترة
          await updateDoc(doc(db, 'studyPeriods', period.id), {
            isActive: false
          });

          // تعطيل جميع حسابات الطلاب في هذا المركز (إذا كانت الفترة خاصة بمركز)
          // أو جميع الطلاب إذا كانت فترة عامة
          let studentsToDeactivate;
          if (period.centerId) {
            studentsToDeactivate = students.filter(s => s.centerId === period.centerId);
          } else {
            studentsToDeactivate = students;
          }

          for (const student of studentsToDeactivate) {
            await updateDoc(doc(db, 'users', student.uid), {
              subscriptionActive: false
            });
          }

          // تحديث البيانات المحلية
          fetchData();
        } catch (error) {
          console.error('Error deactivating expired period:', error);
        }
      }
    }
  };

  const toggleStudentSubscription = async (studentId: string, currentStatus: boolean) => {
    setProcessingStudents(prev => [...prev, studentId]);
    try {
      await updateDoc(doc(db, 'users', studentId), {
        subscriptionActive: !currentStatus,
        lastActivationDate: !currentStatus ? new Date().toISOString() : null
      });

      // تحديث البيانات المحلية
      setStudents(prev => prev.map(s => 
        s.uid === studentId 
          ? { ...s, subscriptionActive: !currentStatus, lastActivationDate: !currentStatus ? new Date().toISOString() : undefined }
          : s
      ));
    } catch (error) {
      console.error('Error toggling subscription:', error);
      alert('حدث خطأ أثناء تحديث حالة الاشتراك');
    }
    setProcessingStudents(prev => prev.filter(id => id !== studentId));
  };

  const activateAllSelected = async () => {
    if (selectedStudents.length === 0) {
      alert('يرجى اختيار الطلاب أولاً');
      return;
    }

    setProcessingStudents(selectedStudents);
    try {
      for (const studentId of selectedStudents) {
        await updateDoc(doc(db, 'users', studentId), {
          subscriptionActive: true,
          lastActivationDate: new Date().toISOString()
        });
      }

      // تحديث البيانات المحلية
      setStudents(prev => prev.map(s => 
        selectedStudents.includes(s.uid)
          ? { ...s, subscriptionActive: true, lastActivationDate: new Date().toISOString() }
          : s
      ));

      setSelectedStudents([]);
      alert('تم تفعيل الاشتراكات بنجاح');
    } catch (error) {
      console.error('Error activating subscriptions:', error);
      alert('حدث خطأ أثناء تفعيل الاشتراكات');
    }
    setProcessingStudents([]);
  };

  const deactivateAllSelected = async () => {
    if (selectedStudents.length === 0) {
      alert('يرجى اختيار الطلاب أولاً');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من تعطيل اشتراكات ${selectedStudents.length} طالب؟`)) {
      return;
    }

    setProcessingStudents(selectedStudents);
    try {
      for (const studentId of selectedStudents) {
        await updateDoc(doc(db, 'users', studentId), {
          subscriptionActive: false
        });
      }

      // تحديث البيانات المحلية
      setStudents(prev => prev.map(s => 
        selectedStudents.includes(s.uid)
          ? { ...s, subscriptionActive: false }
          : s
      ));

      setSelectedStudents([]);
      alert('تم تعطيل الاشتراكات');
    } catch (error) {
      console.error('Error deactivating subscriptions:', error);
      alert('حدث خطأ أثناء تعطيل الاشتراكات');
    }
    setProcessingStudents([]);
  };

  // WhatsApp Bulk Functions
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllFiltered = () => {
    const allIds = filteredStudents.map(s => s.uid);
    setSelectedStudents(allIds);
  };

  const deselectAll = () => {
    setSelectedStudents([]);
  };

  const openWhatsAppBulk = () => {
    if (selectedStudents.length === 0) {
      alert('يرجى اختيار الطلاب أولاً');
      return;
    }
    setShowBulkModal(true);
  };

  const sendWhatsAppBulk = () => {
    if (!bulkMessage.trim()) {
      alert('يرجى كتابة الرسالة');
      return;
    }

    const selectedStudentData = students.filter(s => selectedStudents.includes(s.uid));
    const encodedMessage = encodeURIComponent(bulkMessage);

    // فتح نوافذ واتساب لكل طالب
    selectedStudentData.forEach((student, index) => {
      if (student.phone) {
        // تنظيف رقم الهاتف
        let phone = student.phone.replace(/\D/g, '');
        // إضافة رمز الدولة إذا لم يكن موجوداً
        if (!phone.startsWith('966') && !phone.startsWith('+966')) {
          phone = '966' + phone.replace(/^0/, '');
        }
        
        // فتح رابط واتساب مع تأخير بسيط بين كل رسالة
        setTimeout(() => {
          window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
        }, index * 500);
      }
    });

    setShowBulkModal(false);
    setBulkMessage('');
    setSelectedStudents([]);
  };

  // Study Periods Functions
  const savePeriod = async () => {
    if (!newPeriod.name || !newPeriod.startDate || !newPeriod.endDate) {
      alert('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

    try {
      const periodData = {
        name: newPeriod.name,
        type: newPeriod.type,
        startDate: Timestamp.fromDate(new Date(newPeriod.startDate)),
        endDate: Timestamp.fromDate(new Date(newPeriod.endDate)),
        isActive: new Date(newPeriod.startDate) <= new Date() && new Date(newPeriod.endDate) >= new Date(),
        centerId: newPeriod.centerId || null
      };

      if (editingPeriod) {
        await updateDoc(doc(db, 'studyPeriods', editingPeriod.id), periodData);
        alert('تم تحديث فترة الدراسة بنجاح');
      } else {
        await addDoc(collection(db, 'studyPeriods'), periodData);
        alert('تم إضافة فترة الدراسة بنجاح');
      }

      setShowPeriodModal(false);
      setEditingPeriod(null);
      setNewPeriod({
        name: '',
        type: 'first_semester',
        startDate: '',
        endDate: '',
        centerId: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error saving period:', error);
      alert('حدث خطأ أثناء حفظ فترة الدراسة');
    }
  };

  const editPeriod = (period: StudyPeriod) => {
    setEditingPeriod(period);
    setNewPeriod({
      name: period.name,
      type: period.type,
      startDate: period.startDate.toDate().toISOString().split('T')[0],
      endDate: period.endDate.toDate().toISOString().split('T')[0],
      centerId: period.centerId || ''
    });
    setShowPeriodModal(true);
  };

  const deletePeriod = async (periodId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفترة؟')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'studyPeriods', periodId));
      setStudyPeriods(prev => prev.filter(p => p.id !== periodId));
      alert('تم حذف الفترة بنجاح');
    } catch (error) {
      console.error('Error deleting period:', error);
      alert('حدث خطأ أثناء حذف الفترة');
    }
  };

  const togglePeriodActive = async (period: StudyPeriod) => {
    try {
      await updateDoc(doc(db, 'studyPeriods', period.id), {
        isActive: !period.isActive
      });

      // إذا تم تعطيل الفترة، تعطيل حسابات الطلاب
      if (period.isActive) {
        let studentsToDeactivate;
        if (period.centerId) {
          studentsToDeactivate = students.filter(s => s.centerId === period.centerId);
        } else {
          studentsToDeactivate = students;
        }

        for (const student of studentsToDeactivate) {
          await updateDoc(doc(db, 'users', student.uid), {
            subscriptionActive: false
          });
        }
      }

      fetchData();
    } catch (error) {
      console.error('Error toggling period:', error);
      alert('حدث خطأ');
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString('ar-SA');
  };

  const getPeriodStatus = (period: StudyPeriod) => {
    const now = new Date();
    const start = period.startDate.toDate();
    const end = period.endDate.toDate();

    if (now < start) return { label: 'لم تبدأ', class: 'upcoming' };
    if (now > end) return { label: 'انتهت', class: 'ended' };
    return { label: 'جارية', class: 'active' };
  };

  if (loading) {
    return (
      <div className="subscriptions-page">
        <div className="loading-spinner">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="subscriptions-page">
      <div className="page-header">
        <h1>💳 إدارة الاشتراكات</h1>
        <p className="page-description">
          تفعيل وإدارة اشتراكات الطلاب وفترات الدراسة
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          👥 اشتراكات الطلاب
        </button>
        <button
          className={`tab-btn ${activeTab === 'periods' ? 'active' : ''}`}
          onClick={() => setActiveTab('periods')}
        >
          📅 فترات الدراسة
        </button>
      </div>

      {/* Tab Content - Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div className="tab-content">
          {/* Filters Section */}
          <div className="filters-section">
            <div className="filter-group">
              <label>المركز</label>
              <select
                value={filterCenterId}
                onChange={(e) => setFilterCenterId(e.target.value)}
                className="filter-select"
              >
                <option value="">جميع المراكز</option>
                {centers.map(center => (
                  <option key={center.id} value={center.id}>{center.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>الحلقة</label>
              <select
                value={filterGroupId}
                onChange={(e) => setFilterGroupId(e.target.value)}
                className="filter-select"
              >
                <option value="">جميع الحلقات</option>
                {filteredGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>الحالة</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="filter-select"
              >
                <option value="all">الكل</option>
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="actions-bar">
            <div className="selection-info">
              <span className="selected-count">
                {selectedStudents.length > 0 
                  ? `تم اختيار ${selectedStudents.length} طالب`
                  : `إجمالي: ${filteredStudents.length} طالب`
                }
              </span>
              <button 
                className="btn-link"
                onClick={selectedStudents.length > 0 ? deselectAll : selectAllFiltered}
              >
                {selectedStudents.length > 0 ? 'إلغاء التحديد' : 'تحديد الكل'}
              </button>
            </div>

            <div className="action-buttons">
              <button 
                className="btn btn-success"
                onClick={activateAllSelected}
                disabled={selectedStudents.length === 0}
              >
                ✅ تفعيل المحدد
              </button>
              <button 
                className="btn btn-danger"
                onClick={deactivateAllSelected}
                disabled={selectedStudents.length === 0}
              >
                ❌ تعطيل المحدد
              </button>
              <button 
                className="btn btn-whatsapp"
                onClick={openWhatsAppBulk}
                disabled={selectedStudents.length === 0}
              >
                📱 إرسال WhatsApp
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="table-container">
            <table className="students-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={() => selectedStudents.length === filteredStudents.length ? deselectAll() : selectAllFiltered()}
                    />
                  </th>
                  <th>الاسم</th>
                  <th>الهاتف</th>
                  <th>المركز</th>
                  <th>الحلقة</th>
                  <th>حالة الاشتراك</th>
                  <th>آخر تفعيل</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-message">
                      لا يوجد طلاب مطابقين للفلاتر المحددة
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => (
                    <tr key={student.uid} className={selectedStudents.includes(student.uid) ? 'selected' : ''}>
                      <td className="checkbox-col">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.uid)}
                          onChange={() => toggleStudentSelection(student.uid)}
                        />
                      </td>
                      <td className="student-name">{student.name}</td>
                      <td className="student-phone">{student.phone || '-'}</td>
                      <td>{student.centerName}</td>
                      <td>{student.groupName}</td>
                      <td>
                        <span className={`status-badge ${student.subscriptionActive ? 'active' : 'inactive'}`}>
                          {student.subscriptionActive ? '✓ نشط' : '✗ غير نشط'}
                        </span>
                      </td>
                      <td>
                        <span className="date-cell">
                          {student.lastActivationDate 
                            ? new Date(student.lastActivationDate).toLocaleDateString('ar-SA')
                            : '-'
                          }
                        </span>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button
                            className={`btn btn-sm ${student.subscriptionActive ? 'btn-warning' : 'btn-success'}`}
                            onClick={() => toggleStudentSubscription(student.uid, !!student.subscriptionActive)}
                            disabled={processingStudents.includes(student.uid)}
                          >
                            {processingStudents.includes(student.uid) 
                              ? '...' 
                              : student.subscriptionActive ? 'تعطيل' : 'تفعيل'
                            }
                          </button>
                          {student.phone && (
                            <a
                              href={`https://wa.me/${student.phone.replace(/\D/g, '').replace(/^0/, '966')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-whatsapp-icon"
                              title="إرسال رسالة واتساب"
                            >
                              📱
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content - Study Periods */}
      {activeTab === 'periods' && (
        <div className="tab-content">
          <div className="periods-header">
            <h2>فترات الدراسة</h2>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setEditingPeriod(null);
                setNewPeriod({
                  name: '',
                  type: 'first_semester',
                  startDate: '',
                  endDate: '',
                  centerId: ''
                });
                setShowPeriodModal(true);
              }}
            >
              ➕ إضافة فترة جديدة
            </button>
          </div>

          <div className="periods-info-box">
            <p>
              <strong>💡 ملاحظة:</strong> عند انتهاء فترة الدراسة، سيتم تعطيل حسابات جميع الطلاب تلقائياً 
              حتى يتم تجديد اشتراكهم يدوياً.
            </p>
          </div>

          <div className="periods-grid">
            {studyPeriods.length === 0 ? (
              <div className="empty-periods">
                <p>لم يتم إضافة فترات دراسة بعد</p>
              </div>
            ) : (
              studyPeriods.map(period => {
                const status = getPeriodStatus(period);
                return (
                  <div key={period.id} className={`period-card ${status.class}`}>
                    <div className="period-header">
                      <h3>{period.name}</h3>
                      <span className={`period-status ${status.class}`}>
                        {status.label}
                      </span>
                    </div>
                    
                    <div className="period-details">
                      <div className="period-type">
                        <span className="label">النوع:</span>
                        <span className="value">
                          {PERIOD_TYPES.find(t => t.value === period.type)?.label}
                        </span>
                      </div>
                      <div className="period-dates">
                        <div className="date-item">
                          <span className="label">من:</span>
                          <span className="value">{formatDate(period.startDate)}</span>
                        </div>
                        <div className="date-item">
                          <span className="label">إلى:</span>
                          <span className="value">{formatDate(period.endDate)}</span>
                        </div>
                      </div>
                      {period.centerId && (
                        <div className="period-center">
                          <span className="label">المركز:</span>
                          <span className="value">
                            {centers.find(c => c.id === period.centerId)?.name || 'غير محدد'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="period-actions">
                      <button
                        className={`btn btn-sm ${period.isActive ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => togglePeriodActive(period)}
                      >
                        {period.isActive ? '⏸️ تعطيل' : '▶️ تفعيل'}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => editPeriod(period)}
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deletePeriod(period.id)}
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Bulk Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content bulk-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📱 إرسال رسالة WhatsApp جماعية</h2>
              <button className="close-btn" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="selected-info">
                <p>سيتم إرسال الرسالة إلى <strong>{selectedStudents.length}</strong> طالب</p>
              </div>
              
              <div className="message-templates">
                <label>قوالب سريعة:</label>
                <div className="template-buttons">
                  <button
                    className="template-btn"
                    onClick={() => setBulkMessage('السلام عليكم ورحمة الله وبركاته\n\nنذكركم بتجديد اشتراككم في حلقة تحفيظ القرآن الكريم.\n\nجزاكم الله خيراً')}
                  >
                    تذكير بالتجديد
                  </button>
                  <button
                    className="template-btn"
                    onClick={() => setBulkMessage('السلام عليكم ورحمة الله وبركاته\n\nتم تفعيل اشتراككم بنجاح.\n\nبارك الله فيكم ووفقكم لحفظ كتابه.')}
                  >
                    تأكيد التفعيل
                  </button>
                  <button
                    className="template-btn"
                    onClick={() => setBulkMessage('السلام عليكم ورحمة الله وبركاته\n\nنود إعلامكم بأن فترة الدراسة الجديدة ستبدأ قريباً.\n\nيرجى تجديد الاشتراك لمواصلة الحضور.\n\nجزاكم الله خيراً')}
                  >
                    بدء فترة جديدة
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>نص الرسالة:</label>
                <textarea
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  rows={6}
                  className="message-textarea"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>
                إلغاء
              </button>
              <button className="btn btn-whatsapp" onClick={sendWhatsAppBulk}>
                📱 إرسال الرسائل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Period Modal */}
      {showPeriodModal && (
        <div className="modal-overlay" onClick={() => setShowPeriodModal(false)}>
          <div className="modal-content period-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPeriod ? '✏️ تعديل فترة الدراسة' : '➕ إضافة فترة دراسة جديدة'}</h2>
              <button className="close-btn" onClick={() => setShowPeriodModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>اسم الفترة *</label>
                <input
                  type="text"
                  value={newPeriod.name}
                  onChange={(e) => setNewPeriod(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: الفصل الدراسي الأول 1447"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>نوع الفترة *</label>
                <select
                  value={newPeriod.type}
                  onChange={(e) => setNewPeriod(prev => ({ ...prev, type: e.target.value as StudyPeriod['type'] }))}
                  className="form-select"
                >
                  {PERIOD_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>تاريخ البدء *</label>
                  <input
                    type="date"
                    value={newPeriod.startDate}
                    onChange={(e) => setNewPeriod(prev => ({ ...prev, startDate: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>تاريخ الانتهاء *</label>
                  <input
                    type="date"
                    value={newPeriod.endDate}
                    onChange={(e) => setNewPeriod(prev => ({ ...prev, endDate: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>المركز (اختياري)</label>
                <select
                  value={newPeriod.centerId}
                  onChange={(e) => setNewPeriod(prev => ({ ...prev, centerId: e.target.value }))}
                  className="form-select"
                >
                  <option value="">جميع المراكز</option>
                  {centers.map(center => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))}
                </select>
                <small className="form-hint">اتركه فارغاً لتطبيق الفترة على جميع المراكز</small>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPeriodModal(false)}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={savePeriod}>
                {editingPeriod ? 'تحديث' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
