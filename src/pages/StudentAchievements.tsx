import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/StudentAchievements.css';
import ConfirmModal from '../components/ConfirmModal';
import MessageBox from '../components/MessageBox';
import { useAuth } from '../context/AuthContext';
import quranCurriculum, { QuranJuz, QuranSurah } from '../data/quranCurriculum';
import { arabicReadingCurriculum, ArabicLevel, ArabicLesson, ARABIC_READING_POINTS, getNextLesson as getNextArabicLesson, getNextLevel as getNextArabicLevel } from '../data/arabicReadingCurriculum';

// Challenge types for the 3-challenge system
type ChallengeType = 'memorization' | 'near_review' | 'far_review';

interface StudentAchievement {
  id?: string;
  studentId: string;
  studentName?: string;
  // Legacy fields for backward compatibility
  portion?: string;
  fromAya?: string;
  toAya?: string;
  rating?: number;
  notes?: string;
  assignmentPortion?: string;
  assignmentFromAya?: string;
  assignmentToAya?: string;
  date: string;
  completedStage?: boolean;
  // New challenge fields
  challengeType?: ChallengeType;
  challengeContent?: string;
  challengePassed?: boolean;
  levelId?: string;
  levelName?: string;
  stageId?: string;
  stageName?: string;
}

// Points configuration
const POINTS_SYSTEM = {
  MEMORIZATION: 30,
  NEAR_REVIEW: 20,
  FAR_REVIEW: 20,
  STAGE_COMPLETION: 30,
  LEVEL_COMPLETION: 200,
  PERFECT_RATING_BONUS: 10,
  RETRY_PENALTY: -5,
};

// Curriculum stage interface (adapted from QuranSurah)
interface CurriculumStage {
  id: string;
  name: string;
  order: number;
  memorization: string;
  nearReview: string;
  farReview: string;
  stageBonus: number;
  ayahCount: number; // عدد آيات السورة
}

interface CurriculumLevel {
  id: string;
  name: string;
  order: number;
  stages: CurriculumStage[];
  levelBonus: number;
}

// Convert QuranSurah to CurriculumStage format
const convertSurahToStage = (surah: QuranSurah, juzIndex: number, surahIndex: number): CurriculumStage => {
  // Near review: السورة السابقة فقط (كما في صفحة المنهج)
  let nearReview = '-';
  const currentJuz = quranCurriculum[juzIndex];
  
  if (surahIndex > 0) {
    // السورة السابقة في نفس الجزء
    nearReview = `سورة ${currentJuz.surahs[surahIndex - 1].name}`;
  } else if (juzIndex > 0) {
    // آخر سورة في الجزء السابق
    const prevJuz = quranCurriculum[juzIndex - 1];
    nearReview = `سورة ${prevJuz.surahs[prevJuz.surahs.length - 1].name}`;
  }
  
  // Far review: السورة قبل السابقة (كما في صفحة المنهج)
  let farReview = '-';
  if (surahIndex > 1) {
    // سورتين للخلف في نفس الجزء
    farReview = `سورة ${currentJuz.surahs[surahIndex - 2].name}`;
  } else if (surahIndex === 1 && juzIndex > 0) {
    // السورة الأولى في الجزء الحالي + نحتاج السورة الأخيرة من الجزء السابق
    const prevJuz = quranCurriculum[juzIndex - 1];
    farReview = `سورة ${prevJuz.surahs[prevJuz.surahs.length - 1].name}`;
  } else if (surahIndex === 0 && juzIndex > 0) {
    // أول سورة في الجزء - نحتاج ثاني آخر سورة من الجزء السابق
    const prevJuz = quranCurriculum[juzIndex - 1];
    if (prevJuz.surahs.length > 1) {
      farReview = `سورة ${prevJuz.surahs[prevJuz.surahs.length - 2].name}`;
    }
  }
  
  return {
    id: surah.id,
    name: surah.name,
    order: surah.order,
    memorization: `سورة ${surah.name} (${surah.ayahCount} آية)`,
    nearReview: nearReview,
    farReview: farReview,
    stageBonus: 30,
    ayahCount: surah.ayahCount
  };
};

// Convert QuranJuz to CurriculumLevel format
const convertJuzToLevel = (juz: QuranJuz, juzIndex: number): CurriculumLevel => {
  return {
    id: juz.id,
    name: juz.name,
    order: juz.order,
    stages: juz.surahs.map((surah, surahIndex) => convertSurahToStage(surah, juzIndex, surahIndex)),
    levelBonus: 200
  };
};

// Get all curriculum levels from quranCurriculum
const getCurriculumLevels = (): CurriculumLevel[] => {
  return quranCurriculum.map((juz, index) => convertJuzToLevel(juz, index));
};

const StudentAchievements = () => {
  const { userProfile, isTeacher } = useAuth();
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStudent, setFilterStudent] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  
  // Curriculum from local data (quranCurriculum.ts)
  const [curriculumLevels] = useState<CurriculumLevel[]>(getCurriculumLevels());
  
  // Track type for the selected group
  const [currentTrackType, setCurrentTrackType] = useState<'quran' | 'arabic_reading'>('quran');
  const [tracks, setTracks] = useState<{id: string; name: string}[]>([]);
  
  // Arabic Reading curriculum state
  const [arabicLevel, setArabicLevel] = useState<ArabicLevel | null>(null);
  const [arabicLesson, setArabicLesson] = useState<ArabicLesson | null>(null);
  
  // Centers and filtering
  const [centers, setCenters] = useState<{id: string; name: string}[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  
  // Teacher groups
  const [teacherGroups, setTeacherGroups] = useState<any[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupStudents, setGroupStudents] = useState<any[]>([]);
  
  // Selected student and their progress
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentLevel, setStudentLevel] = useState<CurriculumLevel | null>(null);
  const [studentStage, setStudentStage] = useState<CurriculumStage | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<Set<ChallengeType>>(new Set());
  
  // Challenge recording state
  const [selectedChallengeType, setSelectedChallengeType] = useState<ChallengeType | ''>('');
  const [challengeRating, setChallengeRating] = useState<number>(0);
  const [challengeNotes, setChallengeNotes] = useState<string>('');
  const [challengePassed, setChallengePassed] = useState<boolean>(true);
  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fromAya, setFromAya] = useState<string>('1');
  const [toAya, setToAya] = useState<string>('');
  const [completedAyahs, setCompletedAyahs] = useState<{from: number, to: number}[]>([]);
  const [nextStartAya, setNextStartAya] = useState<number>(1);

  // Message Box state
  const [messageBox, setMessageBox] = useState<{
    open: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({ open: false, type: 'info', title: '', message: '' });

  const showMessage = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setMessageBox({ open: true, type, title, message });
  };

  // Curriculum is now loaded from local quranCurriculum.ts - no Firebase fetch needed

  // Centers will be set based on teacher's groups
  // No need to fetch all centers separately

  // Fetch tracks (المساقات) on mount
  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const tracksSnapshot = await getDocs(collection(db, 'tracks'));
        const tracksList = tracksSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name
        }));
        setTracks(tracksList);
      } catch (error) {
        console.error('Error fetching tracks:', error);
      }
    };
    fetchTracks();
  }, []);

  // Fetch teacher's groups
  useEffect(() => {
    const fetchTeacherGroups = async () => {
      if (!isTeacher || !userProfile?.uid) return;
      
      try {
        const groupsQuery = query(
          collection(db, 'groups'),
          where('teacherId', '==', userProfile.uid)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        const groups = groupsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        setTeacherGroups(groups);
        setFilteredGroups(groups);
        
        // Extract unique center IDs from teacher's groups and fetch center names
        const teacherCenterIds = Array.from(new Set(groups.map(g => g.centerId).filter(Boolean)));
        if (teacherCenterIds.length > 0) {
          const centersSnapshot = await getDocs(collection(db, 'centers'));
          const allCenters = centersSnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name
          }));
          const teacherCenters = allCenters.filter(c => teacherCenterIds.includes(c.id));
          setCenters(teacherCenters);
        }
        
        // Set the center of the first group as default if available
        if (groups.length > 0 && groups[0].centerId) {
          setSelectedCenterId(groups[0].centerId);
        }
        
        if (groups.length === 1) {
          setSelectedGroupId(groups[0].id);
        }
      } catch (error) {
        console.error('Error fetching teacher groups:', error);
      }
    };

    fetchTeacherGroups();
  }, [isTeacher, userProfile?.uid]);

  // Filter groups when center changes
  useEffect(() => {
    if (selectedCenterId) {
      const filtered = teacherGroups.filter((g: any) => g.centerId === selectedCenterId);
      setFilteredGroups(filtered);
      // If current group is not in filtered list, reset
      if (selectedGroupId && !filtered.find((g: any) => g.id === selectedGroupId)) {
        if (filtered.length > 0) {
          setSelectedGroupId(filtered[0].id);
        } else {
          setSelectedGroupId('');
        }
      }
    } else {
      setFilteredGroups(teacherGroups);
    }
  }, [selectedCenterId, teacherGroups]);

  // Fetch students when group is selected
  useEffect(() => {
    const fetchGroupStudents = async () => {
      if (!isTeacher || !selectedGroupId) {
        setGroupStudents([]);
        return;
      }

      // تحديد نوع المساق للحلقة المختارة
      const selectedGroup = teacherGroups.find(g => g.id === selectedGroupId);
      if (selectedGroup && selectedGroup.trackId && tracks.length > 0) {
        const track = tracks.find(t => t.id === selectedGroup.trackId);
        const trackName = track?.name || '';
        
        const isArabicReading = trackName.includes('تأسيس') || 
                               trackName.includes('قراءة') ||
                               trackName.includes('عربية') ||
                               trackName.toLowerCase().includes('arabic') || 
                               trackName.toLowerCase().includes('reading');
        
        setCurrentTrackType(isArabicReading ? 'arabic_reading' : 'quran');
        console.log('Auto-detected track:', trackName, 'Type:', isArabicReading ? 'arabic_reading' : 'quran');
      }

      try {
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'approved'),
          where('groupId', '==', selectedGroupId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        let studentsList = studentsSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              subscriptionStatus: data.subscriptionStatus || 'inactive',
              ...data
            };
          });
        
        // تصفية الطلاب غير المشاركين (إظهار المشاركين فقط للمعلم)
        try {
          const periodsQuery = query(
            collection(db, 'studyPeriods'),
            where('isActive', '==', true)
          );
          const periodsSnap = await getDocs(periodsQuery);
          
          if (!periodsSnap.empty) {
            const activePeriodDoc = periodsSnap.docs[0];
            const activePeriodId = activePeriodDoc.id;
            const activePeriodData = activePeriodDoc.data();
            
            // التحقق من انتهاء مهلة الدفع
            let deadlinePassed = false;
            if (activePeriodData.paymentDeadline) {
              const deadline = activePeriodData.paymentDeadline.toDate();
              deadlinePassed = new Date() > deadline;
            }
            
            const statusesSnap = await getDocs(collection(db, 'studentPeriodStatuses'));
            const statuses = statusesSnap.docs
              .filter(d => d.data().periodId === activePeriodId)
              .map(d => ({ studentId: d.data().studentId, participation: d.data().participation, status: d.data().status, paymentId: d.data().paymentId }));
            
            studentsList = studentsList
              .map(student => {
                const statusRecord = statuses.find(s => s.studentId === student.id);
                const isParticipating = (statusRecord?.participation || 'not_participating') === 'participating';
                const isPaid = statusRecord?.status === 'active' || statusRecord?.status === 'exempt';
                return {
                  ...student,
                  subscriptionStatus: isParticipating && !isPaid && deadlinePassed ? 'expired' : (statusRecord?.status || student.subscriptionStatus)
                };
              })
              .filter(student => {
                const statusRecord = statuses.find(s => s.studentId === student.id);
                return (statusRecord?.participation || 'not_participating') === 'participating';
              });
          }
        } catch (error) {
          console.error('Error fetching participation statuses:', error);
        }
        
        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        setGroupStudents(studentsList);
      } catch (error) {
        console.error('Error fetching group students:', error);
      }
    };

    fetchGroupStudents();
  }, [isTeacher, selectedGroupId, tracks, teacherGroups]);

  // Fetch achievements and all students
  useEffect(() => {
    const fetchData = async () => {
      try {
        let studentsList: any[] = [];
        
        if (isTeacher && teacherGroups.length > 0) {
          const groupIds = teacherGroups.map(g => g.id);
          const groupBatches = [];
          for (let i = 0; i < groupIds.length; i += 10) {
            groupBatches.push(groupIds.slice(i, i + 10));
          }
          
          for (const batch of groupBatches) {
            const studentsQuery = query(
              collection(db, 'users'),
              where('role', '==', 'student'),
              where('status', '==', 'approved'),
              where('groupId', 'in', batch)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            const batchStudents = studentsSnapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name,
                ...data
              };
            });
            studentsList = [...studentsList, ...batchStudents];
          }
        } else if (!isTeacher) {
          const studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('status', '==', 'approved')
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          studentsList = studentsSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              ...data
            };
          });
        }

        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

        const achievementsQuery = query(collection(db, 'student_achievements'), orderBy('date', 'desc'));
        const achievementsSnapshot = await getDocs(achievementsQuery);
        const achievementsList = achievementsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as StudentAchievement));

        const studentIds = new Set(studentsList.map(s => s.id));
        const filteredAchievements = achievementsList.filter(a => studentIds.has(a.studentId));

        const achievementsWithNames = filteredAchievements.map((achievement) => ({
          ...achievement,
          studentName: studentsList.find((s) => s.id === achievement.studentId)?.name || 'غير محدد'
        }));

        setStudents(studentsList);
        setAchievements(achievementsWithNames);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    // Wait for teacher groups to load if teacher
    if (isTeacher && teacherGroups.length === 0) {
      return;
    }
    
    fetchData();
  }, [isTeacher, teacherGroups]);

  // Handle group selection
  const handleGroupSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const groupId = e.target.value;
    setSelectedGroupId(groupId);
    resetForm();
    
    // تحديد نوع المساق للحلقة المختارة
    const selectedGroup = teacherGroups.find(g => g.id === groupId);
    if (selectedGroup && selectedGroup.trackId) {
      const track = tracks.find(t => t.id === selectedGroup.trackId);
      const trackName = track?.name || '';
      
      const isArabicReading = trackName.includes('تأسيس') || 
                             trackName.includes('قراءة') ||
                             trackName.includes('عربية') ||
                             trackName.toLowerCase().includes('arabic') || 
                             trackName.toLowerCase().includes('reading');
      
      setCurrentTrackType(isArabicReading ? 'arabic_reading' : 'quran');
      console.log('Group track:', trackName, 'Type:', isArabicReading ? 'arabic_reading' : 'quran');
    } else {
      setCurrentTrackType('quran'); // الافتراضي
    }
  };

  // Handle student selection
  const handleStudentSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value;
    if (!studentId) {
      setSelectedStudent(null);
      setStudentLevel(null);
      setStudentStage(null);
      setArabicLevel(null);
      setArabicLesson(null);
      setCompletedChallenges(new Set());
      return;
    }
    
    setSelectedChallengeType('');
    setCompletedChallenges(new Set());
    
    try {
      // Fetch fresh student data from Firebase to get latest stageId/levelId
      const studentDoc = await getDocs(query(
        collection(db, 'users'),
        where('__name__', '==', studentId)
      ));
      
      let freshStudent: any = null;
      if (!studentDoc.empty) {
        const docData = studentDoc.docs[0].data();
        freshStudent = {
          id: studentDoc.docs[0].id,
          ...docData
        };
      } else {
        // Fallback to local data
        freshStudent = (isTeacher ? groupStudents : students).find((s) => s.id === studentId);
      }
      
      setSelectedStudent(freshStudent || null);
      
      // تحديد نوع المساق من بيانات الطالب أو من الحلقة
      let trackType = currentTrackType;
      
      // أولاً: التحقق من trackType المخزن في بيانات الطالب
      if (freshStudent?.trackType) {
        trackType = freshStudent.trackType;
        setCurrentTrackType(trackType);
      } 
      // ثانياً: التحقق من الحلقة إذا لم يكن موجوداً في الطالب
      else if (freshStudent?.groupId) {
        const studentGroup = teacherGroups.find(g => g.id === freshStudent.groupId) || 
                            { trackId: '' };
        if (studentGroup.trackId && tracks.length > 0) {
          const track = tracks.find(t => t.id === studentGroup.trackId);
          const trackName = track?.name || '';
          
          const isArabicReading = trackName.includes('تأسيس') || 
                                 trackName.includes('قراءة') ||
                                 trackName.includes('عربية') ||
                                 trackName.toLowerCase().includes('arabic') || 
                                 trackName.toLowerCase().includes('reading');
          
          trackType = isArabicReading ? 'arabic_reading' : 'quran';
          setCurrentTrackType(trackType);
        }
      }
      
      console.log('Student track type:', trackType, 'Student:', freshStudent?.name);
      
      // تحميل المنهج بناءً على نوع المساق
      if (trackType === 'arabic_reading') {
        // منهج القراءة العربية
        if (freshStudent) {
          const level = arabicReadingCurriculum.find(l => l.id === freshStudent.levelId) || arabicReadingCurriculum[0];
          setArabicLevel(level);
          
          const lesson = level.lessons.find(l => l.id === freshStudent.stageId) || level.lessons[0];
          setArabicLesson(lesson);
          
          // إخفاء حالة القرآن
          setStudentLevel(null);
          setStudentStage(null);
          
          console.log('Arabic Reading - Level:', level.name, 'Lesson:', lesson.name);
        }
      } else {
        // منهج حفظ القرآن
        if (freshStudent && curriculumLevels.length > 0) {
          // Find student's current level and stage from Firebase curriculum
          const level = curriculumLevels.find(l => l.id === freshStudent.levelId) || curriculumLevels[0];
          setStudentLevel(level);
          
          let currentStage: CurriculumStage | null = null;
          if (level && level.stages.length > 0) {
            currentStage = level.stages.find(s => s.id === freshStudent.stageId) || level.stages[0];
            setStudentStage(currentStage);
          } else {
            setStudentStage(null);
          }
          
          // إخفاء حالة القراءة العربية
          setArabicLevel(null);
          setArabicLesson(null);
          
          // Fetch completed challenges for this student in current stage
          if (currentStage) {
            const achievementsQuery = query(
              collection(db, 'student_achievements'),
              where('studentId', '==', studentId),
              where('stageId', '==', currentStage.id),
              where('challengePassed', '==', true)
            );
            const snapshot = await getDocs(achievementsQuery);
            
            const completed = new Set<ChallengeType>();
            snapshot.forEach(docSnap => {
              const data = docSnap.data();
              if (data.challengeType) {
                completed.add(data.challengeType as ChallengeType);
              }
            });
            setCompletedChallenges(completed);
          }
        } else {
          setStudentLevel(null);
          setStudentStage(null);
        }
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
      // Fallback to local data
      const student = (isTeacher ? groupStudents : students).find((s) => s.id === studentId);
      setSelectedStudent(student || null);
    }
  };

  // تحديث الآيات المكتملة عند اختيار تحدي جديد
  useEffect(() => {
    if (selectedStudent && studentStage && selectedChallengeType) {
      calculateCompletedAyahs(selectedStudent.id, studentStage.id, selectedChallengeType);
      // تعيين آية النهاية افتراضياً لآخر آية في السورة
      setToAya(studentStage.ayahCount.toString());
    } else {
      setCompletedAyahs([]);
      setNextStartAya(1);
      setFromAya('1');
      setToAya('');
    }
  }, [selectedStudent, studentStage, selectedChallengeType, achievements]);

  // الانتقال تلقائياً للتحدي التالي عند اكتمال جميع الآيات
  useEffect(() => {
    if (!selectedStudent || !studentStage || !selectedChallengeType) return;
    
    // الحفظ ينتقل تلقائياً للمراجعة القريبة عند اكتمال جميع الآيات
    if (selectedChallengeType === 'memorization' && isMemorizationFullyComplete()) {
      const nearReviewEmpty = isChallengeEmpty(studentStage.nearReview);
      const nearReviewComplete = isNearReviewFullyComplete();
      
      if (!nearReviewEmpty && !nearReviewComplete) {
        setSelectedChallengeType('near_review');
      } else {
        // إذا لم تكن هناك مراجعة قريبة أو مكتملة، انتقل للمراجعة البعيدة
        const farReviewEmpty = isChallengeEmpty(studentStage.farReview);
        const farReviewComplete = isFarReviewFullyComplete();
        if (!farReviewEmpty && !farReviewComplete) {
          setSelectedChallengeType('far_review');
        } else {
          setSelectedChallengeType('');
        }
      }
    }
    // المراجعة القريبة تنتقل للبعيدة عند اكتمال جميع الآيات
    else if (selectedChallengeType === 'near_review' && isNearReviewFullyComplete()) {
      const farReviewEmpty = isChallengeEmpty(studentStage.farReview);
      const farReviewComplete = isFarReviewFullyComplete();
      if (!farReviewEmpty && !farReviewComplete) {
        setSelectedChallengeType('far_review');
      } else {
        setSelectedChallengeType('');
      }
    }
    // المراجعة البعيدة تنتهي عند اكتمال جميع الآيات
    else if (selectedChallengeType === 'far_review' && isFarReviewFullyComplete()) {
      setSelectedChallengeType('');
    }
  }, [achievements, selectedChallengeType, studentStage, selectedStudent]);

  // حساب الآيات المكتملة والمتبقية للطالب في المرحلة الحالية
  const calculateCompletedAyahs = (studentId: string, stageId: string, challengeType: ChallengeType) => {
    // الحصول على جميع تحصيلات الطالب في هذه المرحلة ولنفس نوع التحدي
    const stageAchievements = achievements.filter(
      a => a.studentId === studentId && 
           a.stageId === stageId && 
           a.challengeType === challengeType &&
           a.challengePassed &&
           a.fromAya && a.toAya
    );
    
    // جمع الآيات المكتملة
    const completed: {from: number, to: number}[] = stageAchievements.map(a => ({
      from: parseInt(a.fromAya || '0'),
      to: parseInt(a.toAya || '0')
    })).filter(r => r.from > 0 && r.to > 0);
    
    setCompletedAyahs(completed);
    
    // حساب آية البداية التالية
    if (completed.length === 0) {
      setNextStartAya(1);
      setFromAya('1');
    } else {
      // ترتيب الآيات وإيجاد أعلى آية مكتملة
      const maxCompletedAya = Math.max(...completed.map(r => r.to));
      const nextAya = maxCompletedAya + 1;
      setNextStartAya(nextAya);
      setFromAya(nextAya.toString());
    }
  };

  // حساب الآيات المتبقية
  const getRemainingAyahs = (): { remaining: number; total: number; percentage: number } => {
    if (!studentStage) return { remaining: 0, total: 0, percentage: 0 };
    
    const total = studentStage.ayahCount;
    
    // حساب عدد الآيات المكتملة بدون تكرار
    const completedSet = new Set<number>();
    completedAyahs.forEach(range => {
      for (let i = range.from; i <= range.to; i++) {
        completedSet.add(i);
      }
    });
    
    const completedCount = completedSet.size;
    const remaining = Math.max(0, total - completedCount);
    const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    
    return { remaining, total, percentage };
  };

  // Get challenge content based on type
  const getChallengeContent = (type: ChallengeType): string => {
    if (!studentStage) return '';
    switch (type) {
      case 'memorization':
        return studentStage.memorization;
      case 'near_review':
        return studentStage.nearReview;
      case 'far_review':
        return studentStage.farReview;
      default:
        return '';
    }
  };

  // Get the surah name for the challenge (for progress indicator)
  const getChallengeSurahName = (type: ChallengeType): string => {
    if (!studentStage) return '';
    const content = getChallengeContent(type);
    // Extract surah name from content like "سورة الفاتحة" or "سورة سورة الفاتحة (7 آية)"
    if (content === '-' || content === 'لا يوجد') return studentStage.name;
    // Return the content as it contains the surah name
    return content.replace(/\s*\(\d+\s*آية\)/, '').trim();
  };

  // التحقق من اكتمال جميع آيات الحفظ
  const isMemorizationFullyComplete = (): boolean => {
    if (!studentStage || !selectedStudent) return false;
    
    // حساب آيات الحفظ المكتملة مباشرة من achievements
    const memorizationAchievements = achievements.filter(
      a => a.studentId === selectedStudent.id && 
           a.stageId === studentStage.id && 
           a.challengeType === 'memorization' &&
           a.challengePassed &&
           a.fromAya && a.toAya
    );
    
    if (memorizationAchievements.length === 0) return false;
    
    // جمع الآيات المكتملة
    const completedSet = new Set<number>();
    memorizationAchievements.forEach(a => {
      const from = parseInt(a.fromAya || '0');
      const to = parseInt(a.toAya || '0');
      for (let i = from; i <= to; i++) {
        completedSet.add(i);
      }
    });
    
    return completedSet.size >= studentStage.ayahCount;
  };

  // التحقق من اكتمال جميع آيات المراجعة القريبة
  const isNearReviewFullyComplete = (): boolean => {
    if (!studentStage || !selectedStudent) return false;
    if (isChallengeEmpty(studentStage.nearReview)) return true; // لا يوجد مراجعة قريبة
    
    const nearReviewAchievements = achievements.filter(
      a => a.studentId === selectedStudent.id && 
           a.stageId === studentStage.id && 
           a.challengeType === 'near_review' &&
           a.challengePassed &&
           a.fromAya && a.toAya
    );
    
    if (nearReviewAchievements.length === 0) return false;
    
    const completedSet = new Set<number>();
    nearReviewAchievements.forEach(a => {
      const from = parseInt(a.fromAya || '0');
      const to = parseInt(a.toAya || '0');
      for (let i = from; i <= to; i++) {
        completedSet.add(i);
      }
    });
    
    return completedSet.size >= studentStage.ayahCount;
  };

  // التحقق من اكتمال جميع آيات المراجعة البعيدة
  const isFarReviewFullyComplete = (): boolean => {
    if (!studentStage || !selectedStudent) return false;
    if (isChallengeEmpty(studentStage.farReview)) return true; // لا يوجد مراجعة بعيدة
    
    const farReviewAchievements = achievements.filter(
      a => a.studentId === selectedStudent.id && 
           a.stageId === studentStage.id && 
           a.challengeType === 'far_review' &&
           a.challengePassed &&
           a.fromAya && a.toAya
    );
    
    if (farReviewAchievements.length === 0) return false;
    
    const completedSet = new Set<number>();
    farReviewAchievements.forEach(a => {
      const from = parseInt(a.fromAya || '0');
      const to = parseInt(a.toAya || '0');
      for (let i = from; i <= to; i++) {
        completedSet.add(i);
      }
    });
    
    return completedSet.size >= studentStage.ayahCount;
  };

  // حساب الآيات المتبقية لتحدي معين
  const getRemainingAyahsForChallenge = (challengeType: ChallengeType): { remaining: number; total: number; percentage: number; hasProgress: boolean } => {
    if (!studentStage || !selectedStudent) return { remaining: 0, total: 0, percentage: 0, hasProgress: false };
    
    const total = studentStage.ayahCount;
    
    const challengeAchievements = achievements.filter(
      a => a.studentId === selectedStudent.id && 
           a.stageId === studentStage.id && 
           a.challengeType === challengeType &&
           a.challengePassed &&
           a.fromAya && a.toAya
    );
    
    const completedSet = new Set<number>();
    challengeAchievements.forEach(a => {
      const from = parseInt(a.fromAya || '0');
      const to = parseInt(a.toAya || '0');
      for (let i = from; i <= to; i++) {
        completedSet.add(i);
      }
    });
    
    const completedCount = completedSet.size;
    const remaining = Math.max(0, total - completedCount);
    const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    
    return { remaining, total, percentage, hasProgress: completedCount > 0 };
  };

  // Get challenge label
  const getChallengeLabel = (type: ChallengeType): string => {
    switch (type) {
      case 'memorization':
        return '📖 الحفظ';
      case 'near_review':
        return '🔄 المراجعة القريبة';
      case 'far_review':
        return '📚 المراجعة البعيدة';
      default:
        return '';
    }
  };

  // Get points for challenge type
  const getChallengePoints = (type: ChallengeType, passed: boolean, rating: number): number => {
    if (!passed) return POINTS_SYSTEM.RETRY_PENALTY;
    
    let basePoints = 0;
    switch (type) {
      case 'memorization':
        basePoints = POINTS_SYSTEM.MEMORIZATION;
        break;
      case 'near_review':
        basePoints = POINTS_SYSTEM.NEAR_REVIEW;
        break;
      case 'far_review':
        basePoints = POINTS_SYSTEM.FAR_REVIEW;
        break;
    }
    
    // Add perfect rating bonus
    if (rating >= 9) {
      basePoints += POINTS_SYSTEM.PERFECT_RATING_BONUS;
    }
    
    return basePoints;
  };

  // Helper function to check if a challenge is empty/not applicable
  const isChallengeEmpty = (value: string): boolean => {
    if (!value) return true;
    const emptyValues = ['-', 'لا يوجد', 'لايوجد', '', 'null', 'undefined'];
    return emptyValues.includes(value.trim().toLowerCase()) || value.trim() === '';
  };

  // Check if all required challenges are completed for current stage
  // Takes into account that some challenges may be empty (not applicable)
  // Also checks that ALL ayahs are completed for ALL challenges
  const checkStageCompletion = async (studentId: string, stageId: string, stage: CurriculumStage): Promise<boolean> => {
    try {
      const achievementsQuery = query(
        collection(db, 'student_achievements'),
        where('studentId', '==', studentId),
        where('stageId', '==', stageId),
        where('challengePassed', '==', true)
      );
      const snapshot = await getDocs(achievementsQuery);
      
      const memorizationAchievements: {fromAya: number, toAya: number}[] = [];
      const nearReviewAchievements: {fromAya: number, toAya: number}[] = [];
      const farReviewAchievements: {fromAya: number, toAya: number}[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.challengeType && data.fromAya && data.toAya) {
          const range = {
            fromAya: parseInt(data.fromAya),
            toAya: parseInt(data.toAya)
          };
          
          if (data.challengeType === 'memorization') {
            memorizationAchievements.push(range);
          } else if (data.challengeType === 'near_review') {
            nearReviewAchievements.push(range);
          } else if (data.challengeType === 'far_review') {
            farReviewAchievements.push(range);
          }
        }
      });
      
      // Helper function to count completed ayahs
      const countCompletedAyahs = (achievements: {fromAya: number, toAya: number}[]): number => {
        const completedSet = new Set<number>();
        achievements.forEach(range => {
          for (let i = range.fromAya; i <= range.toAya; i++) {
            completedSet.add(i);
          }
        });
        return completedSet.size;
      };
      
      // Check which challenges are required (not empty)
      const memorizationRequired = !isChallengeEmpty(stage.memorization);
      const nearReviewRequired = !isChallengeEmpty(stage.nearReview);
      const farReviewRequired = !isChallengeEmpty(stage.farReview);
      
      const totalAyahs = stage.ayahCount;
      
      // Check if ALL ayahs are completed for each required challenge
      const memorizationDone = !memorizationRequired || countCompletedAyahs(memorizationAchievements) >= totalAyahs;
      const nearReviewDone = !nearReviewRequired || countCompletedAyahs(nearReviewAchievements) >= totalAyahs;
      const farReviewDone = !farReviewRequired || countCompletedAyahs(farReviewAchievements) >= totalAyahs;
      
      console.log('Stage completion check:', {
        stageName: stage.name,
        totalAyahs,
        memorization: { required: memorizationRequired, completed: countCompletedAyahs(memorizationAchievements), done: memorizationDone },
        nearReview: { required: nearReviewRequired, completed: countCompletedAyahs(nearReviewAchievements), done: nearReviewDone },
        farReview: { required: farReviewRequired, completed: countCompletedAyahs(farReviewAchievements), done: farReviewDone }
      });
      
      return memorizationDone && nearReviewDone && farReviewDone;
    } catch (error) {
      console.error('Error checking stage completion:', error);
      return false;
    }
  };

  // Handle recording a challenge
  const handleRecordChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStudent || !selectedChallengeType || !studentLevel || !studentStage) {
      showMessage('warning', 'تنبيه', 'يرجى اختيار الطالب ونوع التحدي');
      return;
    }

    try {
      const challengeContent = getChallengeContent(selectedChallengeType);
      const points = getChallengePoints(selectedChallengeType, challengePassed, challengeRating);
      
      const achievementData: Omit<StudentAchievement, 'id'> = {
        studentId: selectedStudent.id,
        challengeType: selectedChallengeType,
        challengeContent: challengeContent,
        challengePassed: challengePassed,
        rating: challengeRating,
        notes: challengeNotes,
        date: recordDate,
        levelId: studentLevel.id,
        levelName: studentLevel.name,
        stageId: studentStage.id,
        stageName: studentStage.name,
        fromAya: fromAya,
        toAya: toAya,
      };

      if (editingId) {
        await updateDoc(doc(db, 'student_achievements', editingId), achievementData);
        setAchievements(prev =>
          prev.map(a =>
            a.id === editingId
              ? { ...achievementData, id: editingId, studentName: selectedStudent.name }
              : a
          )
        );
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'student_achievements'), achievementData);
        setAchievements(prev => [
          { ...achievementData, id: docRef.id, studentName: selectedStudent.name },
          ...prev
        ]);

        // Update student's points
        const newPoints = (selectedStudent.totalPoints || 0) + points;
        await updateDoc(doc(db, 'users', selectedStudent.id), {
          totalPoints: newPoints
        });

        // If challenge passed, update student's current challenge and UI
        if (challengePassed) {
          // Update completed challenges in UI immediately
          setCompletedChallenges(prev => {
            const newSet = new Set(prev);
            newSet.add(selectedChallengeType);
            return newSet;
          });
          
          // Determine next challenge based on what's available in this stage
          let nextChallenge: ChallengeType | null = null;
          if (selectedChallengeType === 'memorization' && !isChallengeEmpty(studentStage.nearReview)) {
            nextChallenge = 'near_review';
          } else if (selectedChallengeType === 'near_review' && !isChallengeEmpty(studentStage.farReview)) {
            nextChallenge = 'far_review';
          }
          
          // Update student's current challenge in database
          if (nextChallenge) {
            await updateDoc(doc(db, 'users', selectedStudent.id), {
              currentChallenge: nextChallenge
            });
          }
          
          // Check if all required challenges are completed for this stage
          const allCompleted = await checkStageCompletion(selectedStudent.id, studentStage.id, studentStage);
          
          if (allCompleted) {
            const isLastStage = studentStage.order === studentLevel.stages.length;
            const nextStage = isLastStage ? null : studentLevel.stages.find(s => s.order === studentStage.order + 1);
            
            // Add stage completion bonus
            const bonusPoints = newPoints + POINTS_SYSTEM.STAGE_COMPLETION;
            
            if (isLastStage) {
              // Last stage in level - need supervisor approval to move to next level
              await updateDoc(doc(db, 'users', selectedStudent.id), {
                stageStatus: 'pending_supervisor',
                pendingLevelUp: true,
                currentChallenge: 'memorization',
                totalPoints: bonusPoints
              });
              
              // Update local state
              setGroupStudents(prev => prev.map(s => 
                s.id === selectedStudent.id 
                  ? { ...s, stageStatus: 'pending_supervisor', pendingLevelUp: true, currentChallenge: 'memorization', totalPoints: bonusPoints }
                  : s
              ));
              
              showMessage('success', '🎉 أحسنت!', 'تم إتمام جميع تحديات المستوى!\nبانتظار اعتماد المشرف للانتقال للمستوى التالي.');
            } else {
              // Not last stage - automatically move to next stage (no supervisor needed)
              await updateDoc(doc(db, 'users', selectedStudent.id), {
                stageId: nextStage?.id,
                stageName: nextStage?.name,
                currentChallenge: 'memorization',
                totalPoints: bonusPoints
              });
              
              // Update local state to reflect the new stage
              setGroupStudents(prev => prev.map(s => 
                s.id === selectedStudent.id 
                  ? { ...s, stageId: nextStage?.id, stageName: nextStage?.name, currentChallenge: 'memorization', totalPoints: bonusPoints }
                  : s
              ));
              
              // Update UI immediately to show the new stage
              if (nextStage) {
                setStudentStage(nextStage);
                setCompletedChallenges(new Set()); // Reset completed challenges for new stage
              }
              
              showMessage('success', '✅ تم إتمام المرحلة', `تم إتمام المرحلة بنجاح!\nتم الانتقال تلقائياً إلى ${nextStage?.name}`);
            }
            
            // Only reset challenge selection, keep student selected to continue
            setSelectedChallengeType('');
            setChallengeRating(0);
            setChallengeNotes('');
            setChallengePassed(true);
            return;
          } else {
            // Show progress message and clear selected challenge type only
            const challengeLabels: Record<ChallengeType, string> = {
              'memorization': 'الحفظ',
              'near_review': 'المراجعة القريبة',
              'far_review': 'المراجعة البعيدة'
            };
            
            if (nextChallenge) {
              showMessage('success', '✅ أحسنت!', `تم اجتياز ${challengeLabels[selectedChallengeType]}!\nالتحدي التالي: ${challengeLabels[nextChallenge]}`);
            }
            
            // Only reset challenge selection, keep student selected
            setSelectedChallengeType('');
            setChallengeRating(0);
            setChallengeNotes('');
            setChallengePassed(true);
            return;
          }
        }
      }

      resetForm();
    } catch (error) {
      console.error('Error recording challenge:', error);
      showMessage('error', 'خطأ', 'حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.');
    }
  };

  // دالة تسجيل إتمام درس القراءة العربية
  const handleRecordArabicLesson = async () => {
    if (!selectedStudent || !arabicLevel || !arabicLesson) {
      showMessage('error', 'خطأ', 'يرجى اختيار الطالب');
      return;
    }

    try {
      // حساب النقاط
      let points = ARABIC_READING_POINTS.LESSON_COMPLETION;
      if (challengeRating === 5) {
        points += ARABIC_READING_POINTS.PERFECT_RATING;
      }

      // تسجيل الإنجاز
      await addDoc(collection(db, 'student_achievements'), {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        trackType: 'arabic_reading',
        levelId: arabicLevel.id,
        levelName: arabicLevel.name,
        stageId: arabicLesson.id,
        stageName: arabicLesson.name,
        challengeType: 'lesson_completion',
        challengePassed: true,
        rating: challengeRating,
        notes: challengeNotes,
        points: points,
        date: recordDate,
        recordedBy: userProfile?.uid,
        recordedAt: new Date().toISOString()
      });

      // الحصول على الدرس التالي
      const { lesson: nextLesson, levelCompleted } = getNextArabicLesson(arabicLevel.id, arabicLesson.id);

      if (levelCompleted) {
        // انتهى المستوى - يحتاج موافقة المشرف للانتقال للمستوى التالي
        const nextLevel = getNextArabicLevel(arabicLevel.id);
        const bonusPoints = (selectedStudent.points || 0) + points + ARABIC_READING_POINTS.LEVEL_COMPLETION;
        
        if (nextLevel) {
          // هناك مستوى تالي - انتظار موافقة المشرف
          await updateDoc(doc(db, 'users', selectedStudent.id), {
            stageStatus: 'pending_supervisor',
            pendingLevelUp: true,
            trackType: 'arabic_reading',
            points: bonusPoints
          });
          
          // تحديث الواجهة
          setGroupStudents(prev => prev.map(s => 
            s.id === selectedStudent.id 
              ? { ...s, stageStatus: 'pending_supervisor', pendingLevelUp: true, points: bonusPoints }
              : s
          ));
          
          showMessage('success', '🎉 مبارك!', `أتم الطالب ${arabicLevel.name} بنجاح!\nبانتظار اعتماد المشرف للانتقال إلى ${nextLevel.name}.`);
        } else {
          // انتهى من كل المستويات!
          await updateDoc(doc(db, 'users', selectedStudent.id), {
            points: bonusPoints,
            completedCurriculum: true,
            stageStatus: null,
            pendingLevelUp: null
          });
          
          showMessage('success', '🏆 تهانينا!', 'أتم الطالب منهج القراءة العربية بالكامل!');
        }
      } else if (nextLesson) {
        // الانتقال للدرس التالي
        await updateDoc(doc(db, 'users', selectedStudent.id), {
          stageId: nextLesson.id,
          stageName: nextLesson.name,
          points: (selectedStudent.points || 0) + points
        });
        
        showMessage('success', '✅ تم', `تم تسجيل الدرس بنجاح. الدرس التالي: ${nextLesson.name}`);
        
        // تحديث الواجهة
        setArabicLesson(nextLesson);
      }

      // إعادة تعيين الملاحظات
      setChallengeNotes('');
      setChallengeRating(0);

    } catch (error) {
      console.error('Error recording arabic lesson:', error);
      showMessage('error', 'خطأ', 'حدث خطأ أثناء حفظ البيانات');
    }
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setStudentLevel(null);
    setStudentStage(null);
    setArabicLevel(null);
    setArabicLesson(null);
    setSelectedChallengeType('');
    setChallengeRating(0);
    setChallengeNotes('');
    setChallengePassed(true);
    setRecordDate(new Date().toISOString().split('T')[0]);
    setEditingId(null);
    setCompletedChallenges(new Set());
    setFromAya('1');
    setToAya('');
  };

  const handleDeleteAchievement = (id: string) => {
    setConfirmTargetId(id);
    setConfirmOpen(true);
  };

  const performDeleteAchievement = async () => {
    const id = confirmTargetId;
    setConfirmOpen(false);
    setConfirmTargetId(null);
    if (!id) return;
    
    try {
      // Find the achievement being deleted
      const achievementToDelete = achievements.find(a => a.id === id);
      
      if (achievementToDelete) {
        const studentId = achievementToDelete.studentId;
        const deletedStageId = achievementToDelete.stageId;
        const deletedLevelId = achievementToDelete.levelId;
        const deletedChallengeType = achievementToDelete.challengeType;
        const challengePassed = achievementToDelete.challengePassed ?? true; // Default true for old records
        
        // Find the student from local state or fetch fresh from Firebase
        let student = groupStudents.find(s => s.id === studentId) || students.find(s => s.id === studentId);
        
        // Fetch fresh student data from Firebase to ensure we have latest stageId/levelId
        if (student) {
          const usersSnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', studentId)));
          if (!usersSnapshot.empty) {
            const freshData = usersSnapshot.docs[0].data();
            student = { ...student, ...freshData };
          }
        }
        
        if (student && challengePassed) {
          // Calculate points to deduct based on challenge type or rating
          let pointsToDeduct = 0;
          
          if (deletedChallengeType) {
            // New system with challenge types
            if (deletedChallengeType === 'memorization') pointsToDeduct = POINTS_SYSTEM.MEMORIZATION;
            else if (deletedChallengeType === 'near_review') pointsToDeduct = POINTS_SYSTEM.NEAR_REVIEW;
            else if (deletedChallengeType === 'far_review') pointsToDeduct = POINTS_SYSTEM.FAR_REVIEW;
          } else {
            // Old system - estimate points based on rating
            const rating = achievementToDelete.rating || 5;
            pointsToDeduct = rating * 6; // Approximate old point calculation
          }
          
          // Add perfect rating bonus if applicable
          if (achievementToDelete.rating === 5) {
            pointsToDeduct += POINTS_SYSTEM.PERFECT_RATING_BONUS;
          }
          
          const newPoints = Math.max(0, (student.totalPoints || 0) - pointsToDeduct);
          
          // If achievement has stage/level info, handle progress reversion
          if (deletedStageId && deletedLevelId && deletedChallengeType) {
            // Get ALL remaining achievements for this student (excluding the one being deleted)
            const allRemainingAchievements = achievements.filter(
              a => a.id !== id && 
                   a.studentId === studentId && 
                   a.challengePassed
            );
            
            // Get remaining achievements for the deleted stage only
            const remainingStageAchievements = allRemainingAchievements.filter(
              a => a.stageId === deletedStageId
            );
            
            // Determine what challenges remain completed in deleted stage
            const remainingChallenges = new Set(remainingStageAchievements.map(a => a.challengeType));
            
            // Check if student has moved to a different stage/level after this achievement
            const studentCurrentStageId = student.stageId;
            const studentCurrentLevelId = student.levelId;
            
            console.log('Delete Achievement Debug:', {
              deletedStageId,
              deletedLevelId,
              studentCurrentStageId,
              studentCurrentLevelId,
              remainingChallenges: Array.from(remainingChallenges),
              remainingAchievementsInStage: remainingStageAchievements.length,
              allRemainingAchievements: allRemainingAchievements.length
            });
            
            // If this is the LAST achievement for this student (no more achievements at all)
            // Reset them to the first stage (Fatiha)
            if (allRemainingAchievements.length === 0) {
              const firstLevel = curriculumLevels[0]; // جزء عم
              const firstStage = firstLevel.stages[0]; // سورة الفاتحة
              
              await updateDoc(doc(db, 'users', studentId), {
                levelId: firstLevel.id,
                levelName: firstLevel.name,
                stageId: firstStage.id,
                stageName: firstStage.name,
                currentChallenge: 'memorization',
                totalPoints: 0,
                stageStatus: 'active',
                pendingLevelUp: false
              });
              
              // Update local state
              setGroupStudents(prev => prev.map(s => 
                s.id === studentId 
                  ? { 
                      ...s, 
                      levelId: firstLevel.id,
                      levelName: firstLevel.name,
                      stageId: firstStage.id,
                      stageName: firstStage.name,
                      currentChallenge: 'memorization',
                      totalPoints: 0,
                      stageStatus: 'active',
                      pendingLevelUp: false
                    }
                  : s
              ));
              
              showMessage('info', 'تم إعادة التعيين', `تم إرجاع الطالب ${student.name} إلى البداية (${firstStage.name})`);
              
            } else {
              // There are still other achievements - check if we need to revert stage
              const studentMovedToNewStage = studentCurrentStageId !== deletedStageId;
              const studentMovedToNewLevel = studentCurrentLevelId !== deletedLevelId;
              
              if (studentMovedToNewStage || studentMovedToNewLevel) {
                // Student has moved forward - revert them back to the deleted stage
                const deletedLevel = curriculumLevels.find(l => l.id === deletedLevelId);
                const deletedStage = deletedLevel?.stages.find(s => s.id === deletedStageId);
                
                if (deletedLevel && deletedStage) {
                  // Determine which challenge to set based on what's left
                  let revertChallenge: ChallengeType = deletedChallengeType;
                  
                  // Deduct stage completion bonus since we're reverting
                  let totalDeduct = pointsToDeduct + POINTS_SYSTEM.STAGE_COMPLETION;
                  const finalPoints = Math.max(0, (student.totalPoints || 0) - totalDeduct);
                  
                  await updateDoc(doc(db, 'users', studentId), {
                    levelId: deletedLevelId,
                    levelName: deletedLevel.name,
                    stageId: deletedStageId,
                    stageName: deletedStage.name,
                    currentChallenge: revertChallenge,
                    totalPoints: finalPoints,
                    stageStatus: 'active',
                    pendingLevelUp: false
                  });
                  
                  // Update local state
                  setGroupStudents(prev => prev.map(s => 
                    s.id === studentId 
                      ? { 
                          ...s, 
                          levelId: deletedLevelId,
                          levelName: deletedLevel.name,
                          stageId: deletedStageId,
                          stageName: deletedStage.name,
                          currentChallenge: revertChallenge,
                          totalPoints: finalPoints,
                          stageStatus: 'active',
                          pendingLevelUp: false
                        }
                      : s
                  ));
                  
                  showMessage('info', 'تم إرجاع التقدم', `تم إرجاع الطالب ${student.name} إلى ${deletedStage.name} وخصم ${totalDeduct} نقطة`);
                }
              } else {
                // Student is still on the same stage - just update currentChallenge
                let newCurrentChallenge: ChallengeType = deletedChallengeType;
              
                await updateDoc(doc(db, 'users', studentId), {
                  currentChallenge: newCurrentChallenge,
                  totalPoints: newPoints
                });
                
                // Update local state
                setGroupStudents(prev => prev.map(s => 
                  s.id === studentId 
                    ? { ...s, currentChallenge: newCurrentChallenge, totalPoints: newPoints }
                    : s
                ));
                
                showMessage('success', 'تم الحذف', `تم حذف التحصيل وخصم ${pointsToDeduct} نقطة`);
              }
            }
          } else {
            // Old achievement without stage/level info - just deduct points
            await updateDoc(doc(db, 'users', studentId), {
              totalPoints: newPoints
            });
            
            // Update local state
            setGroupStudents(prev => prev.map(s => 
              s.id === studentId 
                ? { ...s, totalPoints: newPoints }
                : s
            ));
            
            showMessage('success', 'تم الحذف', `تم حذف التحصيل وخصم ${pointsToDeduct} نقطة`);
          }
        }
      }
      
      // Delete the achievement
      await deleteDoc(doc(db, 'student_achievements', id));
      setAchievements((prev) => prev.filter((a) => a.id !== id));
      
    } catch (error) {
      console.error('Error deleting achievement:', error);
      showMessage('error', 'خطأ', 'حدث خطأ أثناء حذف البيانات. يرجى المحاولة مرة أخرى.');
    }
  };

  const filteredAchievements = achievements.filter((a) => {
    const matchesStudent = !filterStudent || a.studentId === filterStudent;
    const matchesSearch =
      !searchText ||
      a.studentName?.toLowerCase().includes(searchText.toLowerCase()) ||
      (a.challengeContent || a.portion || '').toLowerCase().includes(searchText.toLowerCase());
    return matchesStudent && matchesSearch;
  });

  // دالة للتحقق إذا كان التحصيل هو الأخير للطالب (يمكن حذفه فقط)
  const isLastAchievementForStudent = (achievementId: string, studentId: string): boolean => {
    // الحصول على جميع تحصيلات هذا الطالب مرتبة حسب التاريخ
    const studentAchievements = achievements
      .filter(a => a.studentId === studentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // التحصيل الأول هو الأحدث (الأخير المسجل)
    return studentAchievements.length > 0 && studentAchievements[0].id === achievementId;
  };

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>تحصيل الطالب</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>🎯 تسجيل تحديات الطلاب</h1>
        <p>تسجيل اجتياز تحديات الحفظ والمراجعة للطلاب</p>
      </header>

      {/* Challenge Recording Form */}
      <form className="form-card challenge-form" onSubmit={handleRecordChallenge}>
        <h3>{editingId ? '✏️ تعديل التحدي' : '📝 تسجيل تحدي جديد'}</h3>
        
        {/* Center Selection for Teachers */}
        {isTeacher && teacherGroups.length > 0 && centers.length > 0 && (
          <div className="form-group">
            <label htmlFor="centerSelect">المركز</label>
            <select
              id="centerSelect"
              name="centerSelect"
              value={selectedCenterId}
              onChange={(e) => setSelectedCenterId(e.target.value)}
            >
              <option value="">-- كل المراكز --</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Group Selection for Teachers */}
        {isTeacher && teacherGroups.length > 0 && (
          <div className="form-group">
            <label htmlFor="groupSelect">الحلقة *</label>
            <select
              id="groupSelect"
              name="groupSelect"
              value={selectedGroupId}
              onChange={handleGroupSelect}
              required
            >
              <option value="">اختر الحلقة</option>
              {filteredGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Student Selection */}
        <div className="form-group">
          <label htmlFor="studentId">الطالب *</label>
          <select
            id="studentId"
            name="studentId"
            value={selectedStudent?.id || ''}
            onChange={(e) => {
              const studentId = e.target.value;
              const student = (isTeacher ? groupStudents : students).find((s: any) => s.id === studentId);
              const isExpired = student && student.subscriptionStatus === 'expired';
              if (!isExpired) {
                handleStudentSelect(e);
              }
            }}
            required
            disabled={isTeacher && !selectedGroupId}
          >
            <option value="">{isTeacher && !selectedGroupId ? 'اختر الحلقة أولاً' : 'اختر الطالب'}</option>
            {(isTeacher ? groupStudents : students).map((student: any) => {
              const isExpired = student.subscriptionStatus === 'expired';
              return (
                <option 
                  key={student.id} 
                  value={student.id}
                  disabled={isExpired}
                  className={isExpired ? 'inactive-student-option' : ''}
                >
                  {student.name}{isExpired ? ' (لم يجدد الاشتراك)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Arabic Reading Curriculum Interface */}
        {selectedStudent && currentTrackType === 'arabic_reading' && arabicLevel && arabicLesson && (
          <div className="student-progress-info arabic-reading-mode">
            <div className="progress-header">
              <h4>📖 موقع الطالب الحالي - القراءة العربية</h4>
            </div>
            <div className="progress-badges">
              <div className="level-info">
                <span className="badge-label">المستوى:</span>
                <span className="level-badge">{arabicLevel.name}</span>
              </div>
              <div className="lesson-info-badge">
                <span className="badge-label">الدرس:</span>
                <span className="stage-badge">{arabicLesson.name}</span>
              </div>
            </div>
            
            {/* Single Lesson Card for Arabic Reading */}
            <div className="arabic-lesson-card">
              <div className="lesson-icon">📚</div>
              <div className="lesson-info">
                <h5>الدرس الحالي</h5>
                <p>{arabicLesson.name}</p>
              </div>
              <div className="lesson-points">
                {ARABIC_READING_POINTS.LESSON_COMPLETION} نقطة
              </div>
            </div>
            
            {/* Arabic Reading Recording Form */}
            <div className="arabic-recording-form">
              <h4>📝 تسجيل إتمام الدرس</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label>التقييم</label>
                  <select 
                    value={challengeRating} 
                    onChange={(e) => setChallengeRating(Number(e.target.value))}
                    className="rating-select"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} - {'⭐'.repeat(n)}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>التاريخ</label>
                  <input 
                    type="date" 
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>ملاحظات</label>
                <textarea
                  value={challengeNotes}
                  onChange={(e) => setChallengeNotes(e.target.value)}
                  placeholder="ملاحظات عن أداء الطالب..."
                  rows={2}
                />
              </div>
              
              <div className="form-actions">
                <button 
                  className="btn btn-success"
                  onClick={handleRecordArabicLesson}
                >
                  ✅ تسجيل إتمام الدرس والانتقال للتالي
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quran Memorization Interface */}
        {selectedStudent && currentTrackType === 'quran' && studentLevel && studentStage && (
          <div className="student-progress-info">
            <div className="progress-header">
              <h4>📊 موقع الطالب الحالي</h4>
            </div>
            <div className="progress-badges">
              <span className="level-badge">{studentLevel.name}</span>
              <span className="stage-badge">{studentStage.name}</span>
            </div>
            
            {/* Three Challenges Display */}
            <div className="challenges-grid">
              {/* Memorization Challenge */}
              {(() => {
                const memorizationComplete = isMemorizationFullyComplete();
                const hasPartialProgress = completedAyahs.length > 0 && !memorizationComplete;
                return (
                  <div 
                    className={`challenge-card memorization ${selectedChallengeType === 'memorization' ? 'selected' : ''} ${memorizationComplete ? 'completed' : ''} ${hasPartialProgress ? 'partial' : ''}`}
                    onClick={() => !memorizationComplete && setSelectedChallengeType('memorization')}
                  >
                    {memorizationComplete && <div className="completed-badge">✓</div>}
                    {hasPartialProgress && <div className="partial-badge">⏳</div>}
                    <div className="challenge-icon">📖</div>
                    <div className="challenge-title">الحفظ</div>
                    <div className="challenge-content">{studentStage.memorization}</div>
                    <div className="challenge-points">
                      {memorizationComplete ? '✅ مكتمل' : hasPartialProgress ? `⏳ متبقي ${getRemainingAyahs().remaining} آية` : `${POINTS_SYSTEM.MEMORIZATION} نقطة`}
                    </div>
                  </div>
                );
              })()}
              
              {/* Near Review Challenge */}
              {(() => {
                const isEmpty = isChallengeEmpty(studentStage.nearReview);
                const memorizationComplete = isMemorizationFullyComplete();
                const isLocked = !memorizationComplete && !isEmpty;
                const nearReviewComplete = isNearReviewFullyComplete();
                const nearReviewProgress = getRemainingAyahsForChallenge('near_review');
                const hasPartialProgress = nearReviewProgress.hasProgress && !nearReviewComplete;
                const isDisabled = isEmpty;
                
                return (
                  <div 
                    className={`challenge-card near-review ${selectedChallengeType === 'near_review' ? 'selected' : ''} ${nearReviewComplete ? 'completed' : ''} ${isLocked ? 'locked' : ''} ${isDisabled ? 'disabled' : ''} ${hasPartialProgress ? 'partial' : ''}`}
                    onClick={() => !isLocked && !isDisabled && !nearReviewComplete && setSelectedChallengeType('near_review')}
                  >
                    {nearReviewComplete && <div className="completed-badge">✓</div>}
                    {isLocked && <div className="lock-badge">🔒</div>}
                    {hasPartialProgress && !isLocked && <div className="partial-badge">⏳</div>}
                    <div className="challenge-icon">🔄</div>
                    <div className="challenge-title">المراجعة القريبة</div>
                    <div className="challenge-content">{studentStage.nearReview}</div>
                    <div className="challenge-points">
                      {nearReviewComplete ? '✅ مكتمل' : isLocked ? 'أكمل الحفظ أولاً' : isDisabled ? 'لا يوجد' : hasPartialProgress ? `⏳ متبقي ${nearReviewProgress.remaining} آية` : `${POINTS_SYSTEM.NEAR_REVIEW} نقطة`}
                    </div>
                  </div>
                );
              })()}
              
              {/* Far Review Challenge */}
              {(() => {
                const nearReviewEmpty = isChallengeEmpty(studentStage.nearReview);
                const farReviewEmpty = isChallengeEmpty(studentStage.farReview);
                const memorizationComplete = isMemorizationFullyComplete();
                const nearReviewComplete = isNearReviewFullyComplete();
                // If near review is empty, far review depends on memorization
                // Otherwise, it depends on near review completion
                const prerequisiteCompleted = nearReviewEmpty 
                  ? memorizationComplete
                  : nearReviewComplete;
                const isLocked = !prerequisiteCompleted && !farReviewEmpty;
                const farReviewComplete = isFarReviewFullyComplete();
                const farReviewProgress = getRemainingAyahsForChallenge('far_review');
                const hasPartialProgress = farReviewProgress.hasProgress && !farReviewComplete;
                const isDisabled = farReviewEmpty;
                
                return (
                  <div 
                    className={`challenge-card far-review ${selectedChallengeType === 'far_review' ? 'selected' : ''} ${farReviewComplete ? 'completed' : ''} ${isLocked ? 'locked' : ''} ${isDisabled ? 'disabled' : ''} ${hasPartialProgress ? 'partial' : ''}`}
                    onClick={() => !isLocked && !isDisabled && !farReviewComplete && setSelectedChallengeType('far_review')}
                  >
                    {farReviewComplete && <div className="completed-badge">✓</div>}
                    {isLocked && <div className="lock-badge">🔒</div>}
                    {hasPartialProgress && !isLocked && <div className="partial-badge">⏳</div>}
                    <div className="challenge-icon">📚</div>
                    <div className="challenge-title">المراجعة البعيدة</div>
                    <div className="challenge-content">{studentStage.farReview}</div>
                    <div className="challenge-points">
                      {farReviewComplete ? '✅ مكتمل' : isLocked ? (nearReviewEmpty ? 'أكمل الحفظ أولاً' : 'أكمل المراجعة القريبة أولاً') : isDisabled ? 'لا يوجد' : hasPartialProgress ? `⏳ متبقي ${farReviewProgress.remaining} آية` : `${POINTS_SYSTEM.FAR_REVIEW} نقطة`}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Challenge Recording Fields */}
        {selectedChallengeType && (
          <div className="challenge-recording-section">
            <h4>📋 تسجيل نتيجة: {getChallengeLabel(selectedChallengeType)}</h4>
            
            {/* Progress Indicator - For All Challenge Types */}
            {studentStage && selectedChallengeType && (
              <div className="ayah-progress-indicator">
                {(() => {
                  const challengeProgress = getRemainingAyahsForChallenge(selectedChallengeType);
                  const { remaining, total, percentage, hasProgress } = challengeProgress;
                  const isComplete = remaining === 0 && hasProgress;
                  const challengeLabel = selectedChallengeType === 'memorization' ? 'الحفظ' : 
                                        selectedChallengeType === 'near_review' ? 'المراجعة القريبة' : 'المراجعة البعيدة';
                  const surahName = getChallengeSurahName(selectedChallengeType);
                  return (
                    <>
                      <div className="progress-header">
                        <span className="progress-title">📊 تقدم {challengeLabel} في {surahName}</span>
                        <span className={`progress-percentage ${isComplete ? 'complete' : ''}`}>
                          {percentage}%
                        </span>
                      </div>
                      <div className="progress-bar-container">
                        <div 
                          className={`progress-bar-fill ${isComplete ? 'complete' : ''}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="progress-details">
                        {isComplete ? (
                          <span className="complete-message">✅ تم إتمام {challengeLabel} لجميع الآيات!</span>
                        ) : (
                          <>
                            <span className="completed-count">✅ مكتمل: {total - remaining} آية</span>
                            <span className="remaining-count">⏳ متبقي: {remaining} آية من {total}</span>
                          </>
                        )}
                      </div>
                      {completedAyahs.length > 0 && (
                        <div className="completed-ranges">
                          <span className="ranges-label">الآيات المسجلة:</span>
                          {completedAyahs.map((range, idx) => (
                            <span key={idx} className="range-badge">
                              {range.from === range.to ? `آية ${range.from}` : `${range.from}-${range.to}`}
                            </span>
                          ))}
                        </div>
                      )}
                      {!isComplete && nextStartAya > 1 && (
                        <div className="next-aya-hint">
                          💡 الآية التالية للتسميع: <strong>{nextStartAya}</strong>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            
            {/* Aya Range Selection */}
            <div className="form-row aya-range-row">
              <div className="form-group">
                <label htmlFor="fromAya">من الآية *</label>
                <input
                  type="number"
                  id="fromAya"
                  min="1"
                  max={studentStage?.ayahCount || 999}
                  placeholder="1"
                  value={fromAya}
                  onChange={(e) => setFromAya(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="toAya">إلى الآية *</label>
                <input
                  type="number"
                  id="toAya"
                  min="1"
                  max={studentStage?.ayahCount || 999}
                  placeholder={studentStage?.ayahCount?.toString() || 'آخر آية'}
                  value={toAya}
                  onChange={(e) => setToAya(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="challengeRating">التقييم (1-10) *</label>
                <input
                  type="number"
                  id="challengeRating"
                  min="1"
                  max="10"
                  value={challengeRating || ''}
                  onChange={(e) => setChallengeRating(Number(e.target.value))}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="recordDate">التاريخ *</label>
                <input
                  type="date"
                  id="recordDate"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="challengeNotes">ملاحظات المعلم</label>
              <textarea
                id="challengeNotes"
                placeholder="أضف ملاحظاتك هنا..."
                value={challengeNotes}
                onChange={(e) => setChallengeNotes(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="pass-fail-section">
              <label className="result-label">نتيجة التحدي:</label>
              <div className="result-buttons">
                <button
                  type="button"
                  className={`result-btn pass ${challengePassed ? 'active' : ''}`}
                  onClick={() => setChallengePassed(true)}
                >
                  ✅ ناجح
                </button>
                <button
                  type="button"
                  className={`result-btn retry ${!challengePassed ? 'active' : ''}`}
                  onClick={() => setChallengePassed(false)}
                >
                  🔄 إعادة
                </button>
              </div>
            </div>
            
            <div className="points-preview">
              <span className="points-label">النقاط المتوقعة:</span>
              <span className={`points-value ${!challengePassed ? 'negative' : ''}`}>
                {getChallengePoints(selectedChallengeType, challengePassed, challengeRating)} نقطة
              </span>
              {challengeRating >= 9 && challengePassed && (
                <span className="bonus-indicator">+{POINTS_SYSTEM.PERFECT_RATING_BONUS} مكافأة تميز!</span>
              )}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn btn-success" 
            disabled={!selectedStudent || !selectedChallengeType}
          >
            {editingId ? 'تحديث' : 'حفظ التحدي'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              إلغاء
            </button>
          )}
        </div>
      </form>

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="ابحث عن طالب أو تحدي..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
            />
          </div>
          <select
            value={filterStudent}
            onChange={(e) => setFilterStudent(e.target.value)}
            className="filter-select"
          >
            <option value="">جميع الطلاب</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="عرض البطاقات"
            >
              📋
            </button>
            <button
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="عرض الجدول"
            >
              📊
            </button>
          </div>
        </div>
      </div>

      {/* Achievements Display */}
      {filteredAchievements.length === 0 ? (
        <div className="empty-state">
          <p>لا توجد تحديات مسجلة حتى الآن</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="achievements-cards-container">
          {filteredAchievements.map((achievement) => (
            <article key={achievement.id} className="achievement-card challenge-card-display">
              <div className="achievement-header">
                <h3>{achievement.studentName || 'طالب غير محدد'}</h3>
                <span className={`rating rating-badge rating-${achievement.rating}`}>
                  {achievement.rating}/10
                </span>
              </div>
              
              <div className="achievement-body">
                {/* Challenge Type Badge */}
                <div className="achievement-row">
                  <span className="label">نوع التحدي:</span>
                  <span className={`challenge-type-badge ${achievement.challengeType}`}>
                    {achievement.challengeType === 'memorization' && '📖 الحفظ'}
                    {achievement.challengeType === 'near_review' && '🔄 المراجعة القريبة'}
                    {achievement.challengeType === 'far_review' && '📚 المراجعة البعيدة'}
                    {!achievement.challengeType && achievement.portion}
                  </span>
                </div>
                
                {/* Content */}
                <div className="achievement-row">
                  <span className="label">المحتوى:</span>
                  <span className="value">{achievement.challengeContent || achievement.portion}</span>
                </div>

                {/* Aya Range */}
                {(achievement.fromAya || achievement.toAya) && (
                  <div className="achievement-row">
                    <span className="label">الآيات:</span>
                    <span className="value aya-range">
                      من آية {achievement.fromAya || '1'} إلى آية {achievement.toAya || '؟'}
                    </span>
                  </div>
                )}

                {/* Level & Stage */}
                {achievement.levelName && (
                  <div className="achievement-row">
                    <span className="label">المستوى:</span>
                    <span className="value">{achievement.levelName}</span>
                  </div>
                )}
                
                {achievement.stageName && (
                  <div className="achievement-row">
                    <span className="label">المرحلة:</span>
                    <span className="value">{achievement.stageName}</span>
                  </div>
                )}

                {/* Pass/Fail Status */}
                <div className="achievement-row">
                  <span className="label">النتيجة:</span>
                  <span className={`status-badge ${achievement.challengePassed ? 'passed' : 'retry'}`}>
                    {achievement.challengePassed !== false ? '✅ ناجح' : '🔄 إعادة'}
                  </span>
                </div>

                {/* Notes */}
                {achievement.notes && (
                  <div className="achievement-row">
                    <span className="label">ملاحظات:</span>
                    <span className="value notes">{achievement.notes}</span>
                  </div>
                )}

                {/* Date */}
                <div className="achievement-row">
                  <span className="label">التاريخ:</span>
                  <span className="value date">
                    {new Date(achievement.date).toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              <div className="achievement-actions">
                {isLastAchievementForStudent(achievement.id || '', achievement.studentId) && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteAchievement(achievement.id || '')}
                  >
                    🗑️ حذف
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>الطالب</th>
                <th>نوع التحدي</th>
                <th>المحتوى</th>
                <th>المستوى/المرحلة</th>
                <th>التقييم</th>
                <th>النتيجة</th>
                <th>التاريخ</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredAchievements.map((achievement) => (
                <tr key={achievement.id}>
                  <td>{achievement.studentName}</td>
                  <td>
                    <span className={`challenge-type-badge ${achievement.challengeType}`}>
                      {achievement.challengeType === 'memorization' && '📖 حفظ'}
                      {achievement.challengeType === 'near_review' && '🔄 قريبة'}
                      {achievement.challengeType === 'far_review' && '📚 بعيدة'}
                      {!achievement.challengeType && '-'}
                    </span>
                  </td>
                  <td>{achievement.challengeContent || achievement.portion || '-'}</td>
                  <td>{achievement.levelName || '-'} / {achievement.stageName || '-'}</td>
                  <td>
                    <span className={`rating rating-${achievement.rating}`}>
                      {achievement.rating}/10
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${achievement.challengePassed !== false ? 'passed' : 'retry'}`}>
                      {achievement.challengePassed !== false ? '✅' : '🔄'}
                    </span>
                  </td>
                  <td>{new Date(achievement.date).toLocaleDateString('ar-SA')}</td>
                  <td>
                    {isLastAchievementForStudent(achievement.id || '', achievement.studentId) && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteAchievement(achievement.id || '')}
                      >
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <ConfirmModal
        open={confirmOpen}
        message="هل أنت متأكد من حذف هذا التحدي؟"
        onConfirm={performDeleteAchievement}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmTargetId(null);
        }}
      />

      {/* Message Box */}
      <MessageBox
        open={messageBox.open}
        type={messageBox.type}
        title={messageBox.title}
        message={messageBox.message}
        onClose={() => setMessageBox({ ...messageBox, open: false })}
      />
    </section>
  );
};

export default StudentAchievements;
