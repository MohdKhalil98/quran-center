import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import quranCurriculum from '../data/quranCurriculum';
import { arabicReadingCurriculum } from '../data/arabicReadingCurriculum';
import '../styles/Shared.css';
import '../styles/Students.css';

interface StudentUser extends UserProfile {
  groupName?: string;
  centerName?: string;
}

interface Center {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  teacherId?: string;
  trackId?: string;
  centerId?: string;
}

interface Track {
  id: string;
  name: string;
}

interface Level {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
}

const Students = () => {
  const { userProfile, isSupervisor, isAdmin, isTeacher, getSupervisorCenterIds, canAccessCenter } = useAuth();
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [newStudents, setNewStudents] = useState<StudentUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [teacherGroupIds, setTeacherGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [filterCenterId, setFilterCenterId] = useState<string>('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [selectedNewStudent, setSelectedNewStudent] = useState<StudentUser | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [currentTrackType, setCurrentTrackType] = useState<'quran' | 'arabic_reading'>('quran');
  const [deleting, setDeleting] = useState(false);
  // نافذة التعديل
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentUser | null>(null);
  const [editFormData, setEditFormData] = useState({
    email: '',
    phone: '',
    levelId: '',
    levelName: ''
  });
  const [saving, setSaving] = useState(false);
  // فلاتر جديدة
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [searchName, setSearchName] = useState<string>('');
  // تقسيم الصفحات
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 20;

  useEffect(() => {
    fetchData();
  }, [isSupervisor, isTeacher, userProfile]);

  const fetchData = async () => {
    try {
      // Fetch centers
      const centersSnapshot = await getDocs(collection(db, 'centers'));
      const centersList = centersSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name
      }));
      setCenters(centersList);

      // Fetch tracks (المساقات)
      const tracksSnapshot = await getDocs(collection(db, 'tracks'));
      const tracksList = tracksSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name
      }));
      setTracks(tracksList);

      // Fetch groups
      const groupsQuery = query(collection(db, 'groups'), orderBy('name'));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsList = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        teacherId: doc.data().teacherId,
        trackId: doc.data().trackId,
        centerId: doc.data().centerId
      }));
      setGroups(groupsList);

      // Get teacher's group IDs if teacher
      let myGroupIds: string[] = [];
      if (isTeacher && userProfile?.uid) {
        myGroupIds = groupsList
          .filter(g => g.teacherId === userProfile.uid)
          .map(g => g.id);
        setTeacherGroupIds(myGroupIds);
      }

      // Fetch students from users collection (role = student, status = approved)
      // جلب جميع الطلاب المعتمدين وجميع الطلاب الذين ينتظرون موافقة المعلم
      const studentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student')
      );
      
      const snapshot = await getDocs(studentsQuery);
      let studentsList = snapshot.docs
        .filter(doc => {
          const status = doc.data().status;
          // عرض الطلاب المعتمدين و الطلاب في انتظار موافقة المعلم فقط
          return status === 'approved' || status === 'waiting_teacher_approval';
        })
        .map((doc) => {
          const data = doc.data() as StudentUser;
          return {
            ...data,
            groupName: groupsList.find(g => g.id === data.groupId)?.name || 'غير محدد',
            centerName: centersList.find(c => c.id === data.centerId)?.name || ''
          } as StudentUser;
        });
      
      // تصفية الطلاب حسب الدور
      if (isTeacher && myGroupIds.length > 0) {
        // المعلم يرى فقط طلاب حلقاته
        studentsList = studentsList.filter(s => myGroupIds.includes(s.groupId || ''));
      } else if (isSupervisor) {
        // المشرف يرى طلاب مراكزه (دعم مراكز متعددة)
        const supervisorCenterIds = getSupervisorCenterIds();
        if (supervisorCenterIds.length > 0) {
          studentsList = studentsList.filter(s => s.centerId && supervisorCenterIds.includes(s.centerId));
          
          // إذا كان لديه مركز واحد فقط، يتم تعيينه في الفلتر تلقائياً
          if (supervisorCenterIds.length === 1) {
            setFilterCenterId(supervisorCenterIds[0]);
          }
        }
      }
      // المطور يرى جميع الطلاب (بدون تصفية)
      
      setStudents(studentsList);

      // Fetch new students (waiting for teacher approval) for teachers only
      if (isTeacher && myGroupIds.length > 0) {
        // جلب جميع الطلاب الجدد ثم تصفيتهم في الكود (لتجنب الحاجة إلى index معقد)
        // البحث عن الطلاب المنتظرين موافقة المعلم
        const newStudentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'waiting_teacher_approval')
        );
        const newStudentsSnapshot = await getDocs(newStudentsQuery);
        
        const newStudentsList = newStudentsSnapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as StudentUser;
            return {
              ...data,
              uid: docSnap.id, // استخدام Document ID من Firestore
              groupName: groupsList.find(g => g.id === data.groupId)?.name || 'غير محدد',
              centerName: centersList.find(c => c.id === data.centerId)?.name || ''
            } as StudentUser;
          })
          // تصفية الطلاب الذين في حلقات المعلم فقط
          .filter(student => myGroupIds.includes(student.groupId || ''));
        setNewStudents(newStudentsList);

        // جلب المستويات من منهج القرآن (الأجزاء من 1 إلى 30)
        const levelsList = quranCurriculum.map((juz) => ({
          id: juz.id,
          name: juz.name
        }));
        setLevels(levelsList);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleToggleStatus = async (student: StudentUser) => {
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        active: !student.active
      });
      fetchData();
    } catch (error) {
      console.error('Error updating student:', error);
      alert('حدث خطأ أثناء تحديث حالة الطالب');
    }
  };

  const handleOpenEditModal = (student: StudentUser) => {
    setEditingStudent(student);
    
    // تحديد نوع المساق بناءً على الحلقة
    const studentGroup = groups.find(g => g.id === student.groupId);
    const trackId = studentGroup?.trackId || '';
    const track = tracks.find(t => t.id === trackId);
    const trackName = track?.name || '';
    
    const isArabicReading = trackName.includes('تأسيس') || 
                           trackName.includes('قراءة') ||
                           trackName.includes('عربية') ||
                           trackName.toLowerCase().includes('arabic') || 
                           trackName.toLowerCase().includes('reading');
    
    if (isArabicReading) {
      setCurrentTrackType('arabic_reading');
      const arabicLevels = arabicReadingCurriculum.map((level) => ({
        id: level.id,
        name: level.name
      }));
      setLevels(arabicLevels);
    } else {
      setCurrentTrackType('quran');
      const quranLevels = quranCurriculum.map((juz) => ({
        id: juz.id,
        name: juz.name
      }));
      setLevels(quranLevels);
    }
    
    setEditFormData({
      email: student.email || '',
      phone: student.phone || '',
      levelId: student.levelId || '',
      levelName: student.levelName || ''
    });
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditingStudent(null);
    setIsEditModalOpen(false);
    setEditFormData({ email: '', phone: '', levelId: '', levelName: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    
    setSaving(true);
    try {
      const updateData: { [key: string]: string } = {};
      
      // المعلم والمشرف يمكنهم تعديل المستوى
      if (editFormData.levelId && editFormData.levelId !== editingStudent.levelId) {
        const selectedLevel = levels.find(l => l.id === editFormData.levelId);
        updateData.levelId = editFormData.levelId;
        updateData.levelName = selectedLevel?.name || '';
        
        // تحديد المرحلة الأولى بناءً على نوع المساق
        let firstStage: { id: string; name: string };
        if (currentTrackType === 'arabic_reading') {
          const levelData = arabicReadingCurriculum.find(level => level.id === editFormData.levelId);
          if (levelData && levelData.lessons && levelData.lessons.length > 0) {
            firstStage = { id: levelData.lessons[0].id, name: levelData.lessons[0].name };
            updateData.stageId = firstStage.id;
            updateData.stageName = firstStage.name;
          }
        } else {
          const levelData = quranCurriculum.find(juz => juz.id === editFormData.levelId);
          if (levelData && levelData.surahs && levelData.surahs.length > 0) {
            firstStage = { id: levelData.surahs[0].id, name: levelData.surahs[0].name };
            updateData.stageId = firstStage.id;
            updateData.stageName = firstStage.name;
          }
        }
      }
      
      // المشرف فقط يمكنه تعديل البريد الإلكتروني ورقم التواصل
      let emailChanged = false;
      if (isSupervisor || isAdmin) {
        if (editFormData.email !== editingStudent.email) {
          updateData.email = editFormData.email;
          emailChanged = true;
        }
        if (editFormData.phone !== editingStudent.phone) {
          updateData.phone = editFormData.phone;
        }
      }
      
      if (Object.keys(updateData).length === 0) {
        alert('لم يتم إجراء أي تغييرات');
        setSaving(false);
        return;
      }
      
      await updateDoc(doc(db, 'users', editingStudent.uid), updateData);
      
      // إذا تم تغيير البريد الإلكتروني، إرسال طلب للمطور لتحديثه في Firebase Auth
      if (emailChanged) {
        await addDoc(collection(db, 'admin_requests'), {
          type: 'update_auth_email',
          userId: editingStudent.uid,
          userName: editingStudent.name,
          oldEmail: editingStudent.email,
          newEmail: editFormData.email,
          requestedBy: userProfile?.name || 'Unknown',
          requestedByRole: userProfile?.role,
          requestedAt: new Date().toISOString(),
          status: 'pending',
          message: `طلب تغيير البريد الإلكتروني للمستخدم ${editingStudent.name} من ${editingStudent.email} إلى ${editFormData.email}`
        });
      }
      
      // تحديث الـ state مباشرة
      setStudents(prev => prev.map(s => 
        s.uid === editingStudent.uid 
          ? { ...s, ...updateData } as StudentUser
          : s
      ));
      
      // تحديث selectedStudent إذا كان مفتوحاً
      if (selectedStudent?.uid === editingStudent.uid) {
        setSelectedStudent({ ...selectedStudent, ...updateData } as StudentUser);
      }
      
      if (emailChanged) {
        alert('تم تحديث بيانات الطالب بنجاح.\n\n📧 تم إرسال طلب للمطور لتحديث البريد الإلكتروني في نظام تسجيل الدخول.');
      } else {
        alert('تم تحديث بيانات الطالب بنجاح');
      }
      handleCloseEditModal();
    } catch (error) {
      console.error('Error updating student:', error);
      alert('حدث خطأ أثناء تحديث بيانات الطالب');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDetailsModal = (student: StudentUser) => {
    setSelectedStudent(student);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedStudent(null);
    setIsDetailsModalOpen(false);
  };

  const handleOpenLevelModal = (student: StudentUser) => {
    setSelectedNewStudent(student);
    
    // تحديد نوع المساق بناءً على الحلقة
    const studentGroup = groups.find(g => g.id === student.groupId);
    const trackId = studentGroup?.trackId || '';
    
    // جلب اسم المساق من قائمة المساقات
    const track = tracks.find(t => t.id === trackId);
    const trackName = track?.name || '';
    
    // تحديد إذا كان مساق القراءة العربية أو القرآن بناءً على اسم المساق
    const isArabicReading = trackName.includes('تأسيس') || 
                           trackName.includes('قراءة') ||
                           trackName.includes('عربية') ||
                           trackName.toLowerCase().includes('arabic') || 
                           trackName.toLowerCase().includes('reading');
    
    console.log('Track ID:', trackId, 'Track Name:', trackName, 'Is Arabic Reading:', isArabicReading);
    
    if (isArabicReading) {
      setCurrentTrackType('arabic_reading');
      // جلب مستويات القراءة العربية
      const arabicLevels = arabicReadingCurriculum.map((level) => ({
        id: level.id,
        name: level.name
      }));
      setLevels(arabicLevels);
    } else {
      setCurrentTrackType('quran');
      // جلب مستويات حفظ القرآن
      const quranLevels = quranCurriculum.map((juz) => ({
        id: juz.id,
        name: juz.name
      }));
      setLevels(quranLevels);
    }
    
    setShowLevelModal(true);
  };

  const handleCloseLevelModal = () => {
    setSelectedNewStudent(null);
    setShowLevelModal(false);
    setSelectedLevelId('');
  };

  const handleDeleteNewStudent = async (student: StudentUser) => {
    if (!window.confirm(`هل أنت متأكد من حذف الطالب ${student.name} من قائمة الانتظار؟`)) {
      return;
    }

    try {
      // حذف الطالب من Firebase
      await updateDoc(doc(db, 'users', student.uid), {
        status: 'rejected'
      });

      // إزالة فورية من الـ state
      setNewStudents(prev => prev.filter(s => s.uid !== student.uid));
      
      alert('تم حذف الطالب من قائمة الانتظار');
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('حدث خطأ أثناء حذف الطالب');
    }
  };

  const handleApproveNewStudent = async () => {
    if (!selectedNewStudent || !selectedLevelId) {
      alert('يرجى اختيار المستوى');
      return;
    }

    if (!selectedNewStudent.uid) {
      alert('خطأ: لا يوجد معرف للطالب');
      return;
    }

    try {
      let firstStage: { id: string; name: string };
      const selectedLevel = levels.find(l => l.id === selectedLevelId);
      
      // تحديد المرحلة الأولى بناءً على نوع المساق
      if (currentTrackType === 'arabic_reading') {
        // منهج القراءة العربية
        const selectedLevelData = arabicReadingCurriculum.find(level => level.id === selectedLevelId);
        
        if (!selectedLevelData || !selectedLevelData.lessons || selectedLevelData.lessons.length === 0) {
          alert('لا توجد دروس لهذا المستوى');
          return;
        }
        
        firstStage = {
          id: selectedLevelData.lessons[0].id,
          name: selectedLevelData.lessons[0].name
        };
      } else {
        // منهج حفظ القرآن
        const selectedLevelData = quranCurriculum.find(juz => juz.id === selectedLevelId);
        
        if (!selectedLevelData || !selectedLevelData.surahs || selectedLevelData.surahs.length === 0) {
          alert('لا توجد مراحل لهذا المستوى');
          return;
        }
        
        firstStage = {
          id: selectedLevelData.surahs[0].id,
          name: selectedLevelData.surahs[0].name
        };
      }

      // تحديث حالة الطالب وتعيين المستوى الابتدائي
      await updateDoc(doc(db, 'users', selectedNewStudent.uid), {
        status: 'approved',
        levelId: selectedLevelId,
        levelName: selectedLevel?.name || '',
        stageId: firstStage.id,
        stageName: firstStage.name,
        trackType: currentTrackType, // حفظ نوع المساق
        approvedByTeacherAt: new Date().toISOString()
      });

      // تحديث فوري للـ state - إزالة الطالب من قائمة الطلاب الجدد
      setNewStudents(prev => prev.filter(s => s.uid !== selectedNewStudent.uid));
      
      // إضافة الطالب إلى قائمة الطلاب الرسميين مع جميع البيانات المطلوبة
      const groupsList = groups; // جلب الحلقات المحفوظة
      const centersList = centers; // جلب المراكز المحفوظة
      
      setStudents(prev => [...prev, {
        ...selectedNewStudent,
        status: 'approved',
        levelId: selectedLevelId,
        levelName: selectedLevel?.name || '',
        stageId: firstStage.id,
        stageName: firstStage.name,
        groupName: groupsList.find(g => g.id === selectedNewStudent.groupId)?.name || 'غير محدد',
        centerName: centersList.find(c => c.id === selectedNewStudent.centerId)?.name || ''
      }]);

      alert('تم قبول الطالب وتعيين المستوى بنجاح');
      handleCloseLevelModal();
      
      // تحديث البيانات من Firebase للتأكد من التزامن
      setTimeout(() => {
        fetchData();
      }, 500);
    } catch (error) {
      console.error('Error approving new student:', error);
      alert('حدث خطأ أثناء قبول الطالب');
    }
  };

  // فلترة الطلاب
  const filteredStudents = students.filter(s => {
    if (filterCenterId && s.centerId !== filterCenterId) return false;
    if (filterGroupId && s.groupId !== filterGroupId) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterActive === 'active' && !s.active) return false;
    if (filterActive === 'inactive' && s.active) return false;
    if (searchName && !s.name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  });

  // حسابات الصفحات
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);

  // إعادة تعيين الصفحة عند تغيير الفلتر
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCenterId, filterGroupId, filterStatus, filterActive, searchName]);

  // الحلقات المتاحة للفلتر - تصفية حسب المركز المختار
  const availableGroups = isTeacher 
    ? groups.filter(g => teacherGroupIds.includes(g.id))
    : filterCenterId 
      ? groups.filter(g => g.centerId === filterCenterId)
      : groups;

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>{isTeacher ? 'طلابي' : 'الطلاب'}</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>
          {isTeacher ? 'طلابي' : 'الطلاب'}
          {isTeacher && newStudents.length > 0 && (
            <span style={{
              backgroundColor: '#4caf50',
              color: 'white',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              marginRight: '10px',
              fontWeight: '700'
            }}>
              {newStudents.length}
            </span>
          )}
        </h1>
        <p>{isTeacher ? 'عرض طلاب حلقاتي.' : 'عرض بيانات الطلاب المسجلين.'}</p>
      </header>

      <div className="page-actions-header">
        {!isTeacher && (
          <p className="info-note">💡 الطلاب يسجلون أنفسهم من صفحة التسجيل، ويتم قبولهم من صفحة "طلبات الانتظار"</p>
        )}

        <div className="filters-section">
          {/* البحث بالاسم */}
          <input
            type="text"
            className="filter-input"
            placeholder="🔍 بحث بالاسم..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{ minWidth: '150px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
          />
          
          {(isAdmin || (isSupervisor && getSupervisorCenterIds().length > 1)) && (
            <select 
              className="filter-select"
              value={filterCenterId} 
              onChange={(e) => {
                setFilterCenterId(e.target.value);
                setFilterGroupId(''); // إعادة تعيين فلتر الحلقات عند تغيير المركز
              }}
            >
              <option value="">جميع المراكز</option>
              {(isSupervisor ? centers.filter(c => getSupervisorCenterIds().includes(c.id)) : centers).map(center => (
                <option key={center.id} value={center.id}>{center.name}</option>
              ))}
            </select>
          )}
          {availableGroups.length > 1 && (
            <select 
              className="filter-select"
              value={filterGroupId} 
              onChange={(e) => setFilterGroupId(e.target.value)}
            >
              <option value="">{isTeacher ? 'جميع حلقاتي' : 'جميع الحلقات'}</option>
              {availableGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          )}
          
          {/* فلتر حالة التسجيل */}
          <select 
            className="filter-select"
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">جميع حالات التسجيل</option>
            <option value="approved">✅ معتمد</option>
            <option value="waiting_teacher_approval">⏳ بانتظار الموافقة</option>
          </select>
          
          {/* فلتر حالة التفعيل */}
          <select 
            className="filter-select"
            value={filterActive} 
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <option value="">جميع حالات التفعيل</option>
            <option value="active">✅ نشط</option>
            <option value="inactive">⏸️ معطل</option>
          </select>
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

      <div className="students-count-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <span className="count-badge">{filteredStudents.length}</span> طالب
          {totalPages > 1 && (
            <span style={{ marginRight: '15px', color: '#666', fontSize: '0.9rem' }}>
              (الصفحة {currentPage} من {totalPages})
            </span>
          )}
        </div>
        {(filterCenterId || filterGroupId || filterStatus || filterActive || searchName) && (
          <button
            onClick={() => {
              setFilterCenterId('');
              setFilterGroupId('');
              setFilterStatus('');
              setFilterActive('');
              setSearchName('');
            }}
            style={{
              background: '#f44336',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            ❌ إعادة تعيين الفلاتر
          </button>
        )}
      </div>

      {/* قسم الطلاب الجدد - للمعلمين فقط */}
      {isTeacher && newStudents.length > 0 && (
        <>
          <div className="section-header">
            <h2>📥 الطلاب الجدد (بانتظار تحديد المستوى)</h2>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>رقم الهاتف</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {newStudents.map((student) => (
                  <tr key={student.uid}>
                    <td>{student.name}</td>
                    <td>{student.phone || '-'}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleOpenLevelModal(student)}
                      >
                        ✅ تحديد المستوى
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <hr style={{ margin: '30px 0', borderColor: '#e0e0e0' }} />
        </>
      )}

      {viewMode === 'cards' ? (
        <div className="cards-container">
          {currentStudents.length === 0 ? (
            <p className="empty-state">لا يوجد طلاب حتى الآن</p>
          ) : (
            currentStudents.map((student) => {
              // تحديد حالة التسجيل بناءً على status
              let statusText = '';
              let statusColor = '';
              if (student.status === 'approved') {
                statusText = '✅ معتمد';
                statusColor = '#4caf50';
              } else if (student.status === 'waiting_teacher_approval') {
                statusText = '⏳ بانتظار الموافقة';
                statusColor = '#ff9800';
              } else if (student.status === 'pending_registration') {
                statusText = '📝 قيد التسجيل';
                statusColor = '#2196f3';
              } else {
                statusText = student.status || 'غير محدد';
                statusColor = '#9e9e9e';
              }

              return (
                <article key={student.uid} className="data-card">
                  <header className="data-card-header">
                    <div>
                      <h3>{student.name}</h3>
                      <p className="data-card-id">{student.email}</p>
                    </div>
                    <div className="data-card-tag">
                      <span className={student.active ? 'active' : 'inactive'}>
                        {student.active ? '✅ نشط' : '⏸️ معطل'}
                      </span>
                    </div>
                  </header>
                  <section className="data-card-body">
                    <div className="data-card-row">
                      <label>رقم الهاتف:</label>
                      <span>{student.phone || '-'}</span>
                    </div>
                    <div className="data-card-row">
                      <label>الحلقة:</label>
                      <span>{student.groupName}</span>
                    </div>
                    {!isTeacher && (
                      <div className="data-card-row">
                        <label>المركز:</label>
                        <span>{student.centerName || '-'}</span>
                      </div>
                    )}
                    <div className="data-card-row">
                      <label>حالة التسجيل:</label>
                      <span style={{
                        backgroundColor: statusColor,
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        display: 'inline-block'
                      }}>
                        {statusText}
                      </span>
                    </div>
                  </section>
                  <footer className="data-card-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleOpenDetailsModal(student)}
                    >
                      المزيد
                    </button>
                  </footer>
                </article>
              );
            })
          )}
        </div>
      ) : (
        <div className="table-card">
          {filteredStudents.length === 0 ? (
            <p>لا يوجد طلاب حتى الآن</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{width: '130px'}}>الاسم</th>
                  <th style={{width: '180px'}}>البريد الإلكتروني</th>
                  <th style={{width: '100px'}}>الهاتف</th>
                  <th style={{width: '120px'}}>الحلقة</th>
                  {!isTeacher && <th style={{width: '120px'}}>المركز</th>}
                  <th style={{width: '80px'}}>التفعيل</th>
                  <th style={{width: '120px'}}>التسجيل</th>
                  <th style={{width: '80px'}}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {currentStudents.map((student) => {
                  // تحديد حالة التسجيل بناءً على status
                  let statusText = '';
                  let statusColor = '';
                  if (student.status === 'approved') {
                    statusText = 'معتمد';
                    statusColor = '#4caf50';
                  } else if (student.status === 'waiting_teacher_approval') {
                    statusText = 'بانتظار';
                    statusColor = '#ff9800';
                  } else if (student.status === 'pending_registration') {
                    statusText = 'قيد التسجيل';
                    statusColor = '#2196f3';
                  } else {
                    statusText = student.status || 'غير محدد';
                    statusColor = '#9e9e9e';
                  }

                  return (
                    <tr key={student.uid}>
                      <td title={student.name} style={{fontWeight: 600}}>{student.name}</td>
                      <td title={student.email} style={{fontSize: '0.8rem', direction: 'ltr', textAlign: 'left'}}>{student.email}</td>
                      <td style={{direction: 'ltr', textAlign: 'center', fontSize: '0.85rem'}}>{student.phone || '-'}</td>
                      <td title={student.groupName} style={{fontSize: '0.82rem'}}>{student.groupName}</td>
                      {!isTeacher && <td title={student.centerName} style={{fontSize: '0.82rem'}}>{student.centerName || '-'}</td>}
                      <td style={{textAlign: 'center'}}>
                        <span className={`status-badge ${student.active ? 'active' : 'inactive'}`} style={{fontSize: '0.75rem', padding: '3px 8px'}}>
                          {student.active ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <span style={{
                          backgroundColor: statusColor,
                          color: 'white',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}>
                          {statusText}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenDetailsModal(student)}
                          style={{padding: '5px 12px', fontSize: '0.8rem'}}
                        >
                          المزيد
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* التنقل بين الصفحات */}
      {totalPages > 1 && (
        <div className="pagination" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginTop: '20px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: currentPage === 1 ? '#f5f5f5' : 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              color: currentPage === 1 ? '#999' : '#333'
            }}
          >
            « الأولى
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: currentPage === 1 ? '#f5f5f5' : 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              color: currentPage === 1 ? '#999' : '#333'
            }}
          >
            ‹ السابق
          </button>
          
          {/* أرقام الصفحات */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i): number => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return pageNum;
          }).map((pageNum: number) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                style={{
                  padding: '8px 14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: currentPage === pageNum ? '#4caf50' : 'white',
                  color: currentPage === pageNum ? 'white' : '#333',
                  cursor: 'pointer',
                  fontWeight: currentPage === pageNum ? 'bold' : 'normal'
                }}
              >
                {pageNum}
              </button>
          ))}
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: currentPage === totalPages ? '#f5f5f5' : 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              color: currentPage === totalPages ? '#999' : '#333'
            }}
          >
            التالي ›
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: currentPage === totalPages ? '#f5f5f5' : 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              color: currentPage === totalPages ? '#999' : '#333'
            }}
          >
            الأخيرة »
          </button>
        </div>
      )}

      {isDetailsModalOpen && selectedStudent && (
        <div className="modal-overlay" onClick={handleCloseDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تفاصيل الطالب: {selectedStudent.name}</h2>
              <button className="close-btn" onClick={handleCloseDetailsModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="details-list">
                <p><strong>البريد الإلكتروني:</strong> {selectedStudent.email}</p>
                <p><strong>رقم الهاتف:</strong> {selectedStudent.phone || '-'}</p>
                <p><strong>الحلقة:</strong> {selectedStudent.groupName}</p>
                <p><strong>المركز:</strong> {selectedStudent.centerName || 'غير محدد'}</p>
                <p><strong>حالة التفعيل:</strong> <span className={`status-badge ${selectedStudent.active ? 'active' : 'inactive'}`}>{selectedStudent.active ? '✅ نشط' : '⏸️ معطل'}</span></p>
                <p><strong>حالة التسجيل:</strong> 
                  <span style={{
                    marginRight: '10px',
                    backgroundColor: selectedStudent.status === 'approved' ? '#4caf50' : selectedStudent.status === 'waiting_teacher_approval' ? '#ff9800' : selectedStudent.status === 'pending_registration' ? '#2196f3' : '#9e9e9e',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    display: 'inline-block'
                  }}>
                    {selectedStudent.status === 'approved' ? '✅ معتمد' : selectedStudent.status === 'waiting_teacher_approval' ? '⏳ بانتظار الموافقة' : selectedStudent.status === 'pending_registration' ? '📝 قيد التسجيل' : selectedStudent.status || 'غير محدد'}
                  </span>
                </p>
                <p><strong>تاريخ التسجيل:</strong> {new Date(selectedStudent.createdAt).toLocaleDateString('ar-EG')}</p>
              </div>
            </div>
            <div className="modal-footer">
              {/* زر التعديل - للمعلم والمشرف والمسؤول */}
              {(isTeacher || isSupervisor || isAdmin) && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    handleCloseDetailsModal();
                    handleOpenEditModal(selectedStudent);
                  }}
                >
                  ✏️ تعديل
                </button>
              )}
              {!isTeacher && (
                <button
                  className={`btn ${selectedStudent.active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => {
                    handleToggleStatus(selectedStudent);
                    handleCloseDetailsModal();
                  }}
                >
                  {selectedStudent.active ? '⏸️ إيقاف' : '▶️ تفعيل'}
                </button>
              )}
              <button 
                className="btn btn-danger" 
                onClick={async () => {
                  if (!selectedStudent?.uid) return;
                  if (!window.confirm(`هل أنت متأكد من حذف الطالب "${selectedStudent.name}"؟\n\nسيتم حذف بياناته من قاعدة البيانات وإرسال طلب للمطور لحذفه من نظام المصادقة.`)) return;
                  
                  setDeleting(true);
                  try {
                    // إرسال رسالة للمطور لحذف الطالب من Auth
                    await addDoc(collection(db, 'admin_requests'), {
                      type: 'delete_auth_user',
                      userId: selectedStudent.uid,
                      userName: selectedStudent.name,
                      userEmail: selectedStudent.email,
                      requestedBy: userProfile?.name || 'Unknown',
                      requestedByRole: userProfile?.role,
                      requestedAt: new Date().toISOString(),
                      status: 'pending',
                      message: `طلب حذف المستخدم ${selectedStudent.name} (${selectedStudent.email}) من Firebase Auth`
                    });
                    
                    // حذف بيانات الطالب من Firestore
                    await deleteDoc(doc(db, 'users', selectedStudent.uid));
                    
                    // تحديث الـ state
                    setStudents(prev => prev.filter(s => s.uid !== selectedStudent.uid));
                    alert('تم حذف بيانات الطالب وإرسال طلب للمطور لحذفه من نظام المصادقة');
                    handleCloseDetailsModal();
                  } catch (error) {
                    console.error('Error deleting student:', error);
                    alert('حدث خطأ أثناء حذف الطالب');
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
              >
                {deleting ? '⏳ جاري الحذف...' : '🗑️ حذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تحديد المستوى للطلاب الجدد */}
      {showLevelModal && selectedNewStudent && (
        <div className="modal-overlay" onClick={handleCloseLevelModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تحديد المستوى للطالب: {selectedNewStudent.name}</h2>
              <button className="close-btn" onClick={handleCloseLevelModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>الحلقة:</label>
                <p className="info-text">{selectedNewStudent.groupName}</p>
              </div>
              <div className="form-group">
                <label>اختر المستوى الحالي للطالب:</label>
                <select
                  className="form-control"
                  value={selectedLevelId}
                  onChange={(e) => setSelectedLevelId(e.target.value)}
                >
                  <option value="">-- اختر المستوى --</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
                <small className="help-text">
                  💡 سيتم البدء من المرحلة الأولى في المستوى المحدد
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-success"
                onClick={handleApproveNewStudent}
                disabled={!selectedLevelId}
              >
                ✅ قبول الطالب
              </button>
              <button className="btn btn-secondary" onClick={handleCloseLevelModal}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل بيانات الطالب */}
      {isEditModalOpen && editingStudent && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ تعديل بيانات الطالب: {editingStudent.name}</h2>
              <button className="close-btn" onClick={handleCloseEditModal}>&times;</button>
            </div>
            <div className="modal-body">
              {/* المشرف والمسؤول يمكنهم تعديل البريد الإلكتروني */}
              {(isSupervisor || isAdmin) && (
                <div className="form-group">
                  <label>📧 البريد الإلكتروني:</label>
                  <input
                    type="email"
                    className="form-control"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    placeholder="أدخل البريد الإلكتروني"
                    dir="ltr"
                  />
                  <small className="help-text" style={{ color: '#ff9800' }}>
                    ⚠️ ملاحظة: تغيير البريد الإلكتروني هنا يغير البيانات المحفوظة فقط، ولا يغير بيانات تسجيل الدخول
                  </small>
                </div>
              )}
              
              {/* المشرف والمسؤول يمكنهم تعديل رقم التواصل */}
              {(isSupervisor || isAdmin) && (
                <div className="form-group">
                  <label>📱 رقم التواصل:</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="أدخل رقم التواصل"
                    dir="ltr"
                  />
                </div>
              )}
              
              {/* المعلم والمشرف يمكنهم تعديل المستوى */}
              <div className="form-group">
                <label>📚 المستوى الحالي:</label>
                <select
                  className="form-control"
                  value={editFormData.levelId}
                  onChange={(e) => {
                    const selectedLevel = levels.find(l => l.id === e.target.value);
                    setEditFormData({ 
                      ...editFormData, 
                      levelId: e.target.value,
                      levelName: selectedLevel?.name || ''
                    });
                  }}
                >
                  <option value="">-- اختر المستوى --</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
                <small className="help-text">
                  💡 عند تغيير المستوى، سيتم البدء من المرحلة الأولى في المستوى الجديد
                </small>
              </div>
              
              {isTeacher && (
                <div style={{ 
                  backgroundColor: '#fff3e0', 
                  padding: '10px', 
                  borderRadius: '6px', 
                  marginTop: '15px',
                  border: '1px solid #ffcc80'
                }}>
                  <small style={{ color: '#e65100' }}>
                    ℹ️ كمعلم، يمكنك تعديل مستوى الطالب فقط. لتعديل البريد الإلكتروني أو رقم التواصل، يرجى التواصل مع المشرف.
                  </small>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-success"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? '⏳ جاري الحفظ...' : '💾 حفظ التغييرات'}
              </button>
              <button className="btn btn-secondary" onClick={handleCloseEditModal}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Students;

