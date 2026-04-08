import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/StudentAchievements.css';
import ConfirmModal from '../components/ConfirmModal';
import MessageBox from '../components/MessageBox';
import { useAuth } from '../context/AuthContext';
import quranCurriculum, { QuranLevel, QuranStage, QuranSurah, getAllSurahsInLevel, getNextStage } from '../data/quranCurriculum';
import { arabicReadingCurriculum, ArabicLevel, ArabicLesson, ARABIC_READING_POINTS, getNextLesson as getNextArabicLesson, getNextLevel as getNextArabicLevel } from '../data/arabicReadingCurriculum';

// Recitation types
type RecitationType = 'memorization' | 'near_review' | 'far_review';

interface StudentAchievement {
  id?: string;
  studentId: string;
  studentName?: string;
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
  challengeType?: RecitationType;
  challengeContent?: string;
  challengePassed?: boolean;
  levelId?: string;
  levelName?: string;
  stageId?: string;
  stageName?: string;
}

interface HomeworkData {
  id?: string;
  studentId: string;
  teacherId: string;
  recitationType: RecitationType;
  surahId: string;
  surahName: string;
  fromAya: string;
  toAya: string;
  notes: string;
  createdAt: string;
  status: 'pending' | 'completed';
  levelId: string;
  levelName: string;
}

const POINTS_SYSTEM = {
  MEMORIZATION: 30,
  NEAR_REVIEW: 20,
  FAR_REVIEW: 20,
  LEVEL_COMPLETION: 200,
  PERFECT_RATING_BONUS: 10,
  RETRY_PENALTY: -5,
};

interface StudentAchievementsProps {
  embedded?: boolean;
  externalStudents?: any[];
  externalSessionDate?: string;
  externalGroupId?: string;
  attendanceSaved?: boolean;
}

const StudentAchievements = ({ embedded, externalStudents, externalSessionDate, externalGroupId, attendanceSaved }: StudentAchievementsProps = {}) => {
  const { userProfile, isTeacher, isSupervisor, getSupervisorCenterIds } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedRecitationType, setSelectedRecitationType] = useState<RecitationType>('memorization');
  const [selectedSurah, setSelectedSurah] = useState('');
  const [fromAya, setFromAya] = useState('1');
  const [toAya, setToAya] = useState('');
  const [rating, setRating] = useState(10);
  const challengePassed = rating >= 4;
  const [studentNotes, setStudentNotes] = useState('');
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');
  const [messageBox, setMessageBox] = useState<{ show: boolean; type: 'success' | 'error' | 'info'; message: string }>({ show: false, type: 'info', message: '' });
  const [studentStatuses, setStudentStatuses] = useState<any>({});
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [currentStudyPeriod, setCurrentStudyPeriod] = useState<any>(null);
  const [selectedTrack, setSelectedTrack] = useState<string>('quran');
  const [arabicLessonNotes, setArabicLessonNotes] = useState('');
  const [arabicLessonRating, setArabicLessonRating] = useState(10);
  const arabicChallengePassed = arabicLessonRating >= 4;
  
  // Homework state
  const [pendingHomework, setPendingHomework] = useState<HomeworkData | null>(null);
  const [showHomeworkForm, setShowHomeworkForm] = useState(false);
  const [justRecorded, setJustRecorded] = useState(false);
  const [homeworkRecitationType, setHomeworkRecitationType] = useState<RecitationType>('memorization');
  const [homeworkSurahId, setHomeworkSurahId] = useState('');
  const [homeworkFromAya, setHomeworkFromAya] = useState('1');
  const [homeworkToAya, setHomeworkToAya] = useState('');
  const [homeworkNotes, setHomeworkNotes] = useState('');

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort state for achievement history table
  const [historySortCol, setHistorySortCol] = useState<string>('date');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('desc');

  // Edit state
  const [editingAchievement, setEditingAchievement] = useState<any>(null);

  // Attendance-based filtering state
  const [todayPresentStudentIds, setTodayPresentStudentIds] = useState<Set<string>>(new Set());
  const [attendanceChecked, setAttendanceChecked] = useState(false);
  const [attendanceRegistered, setAttendanceRegistered] = useState(false);

  // Helper: get the recording date (use external date in embedded mode, otherwise now)
  const getRecordingDate = (): string => {
    if (embedded && externalSessionDate) {
      return new Date(externalSessionDate + 'T12:00:00').toISOString();
    }
    return new Date().toISOString();
  };

  const showMessage = (type: 'success' | 'error' | 'info', message: string) => {
    setMessageBox({ show: true, type, message });
  };

  // Fetch current study period
  useEffect(() => {
    const fetchStudyPeriod = async () => {
      try {
        const periodsSnap = await getDocs(collection(db, 'studyPeriods'));
        const now = new Date();
        for (const doc of periodsSnap.docs) {
          const data = doc.data();
          const start = new Date(data.startDate);
          const end = new Date(data.endDate);
          if (now >= start && now <= end && data.status === 'active') {
            setCurrentStudyPeriod({ id: doc.id, ...data });
            break;
          }
        }
      } catch (err) {
        console.error('Error fetching study period:', err);
      }
    };
    fetchStudyPeriod();
  }, []);

  // In embedded mode, use external students from parent
  useEffect(() => {
    if (!embedded) return;
    if (externalStudents) {
      setStudents(externalStudents);
      const ids = new Set<string>(externalStudents.map((s: any) => s.id));
      setTodayPresentStudentIds(ids);
      setAttendanceRegistered(!!attendanceSaved);
      setAttendanceChecked(true);
    } else {
      setStudents([]);
      setAttendanceRegistered(false);
      setAttendanceChecked(true);
    }
  }, [embedded, externalStudents, attendanceSaved]);

  // Fetch students for teacher (standalone mode only)
  useEffect(() => {
    if (embedded) return;
    const fetchStudents = async () => {
      if (!userProfile) return;
      try {
        const studentsSnap = await getDocs(collection(db, 'users'));
        const groupsSnap = await getDocs(collection(db, 'groups'));

        let teacherGroupIds: string[] = [];
        let supervisorCenterIds: string[] = [];

        if (isSupervisor) {
          supervisorCenterIds = getSupervisorCenterIds ? getSupervisorCenterIds() : [];
          groupsSnap.docs.forEach(g => {
            const data = g.data();
            if (supervisorCenterIds.includes(data.centerId)) {
              teacherGroupIds.push(g.id);
            }
          });
        } else {
          groupsSnap.docs.forEach(g => {
            if (g.data().teacherId === userProfile.uid) {
              teacherGroupIds.push(g.id);
            }
          });
        }

        const studentsList = studentsSnap.docs
          .filter(s => {
            const data = s.data();
            return data.role === 'student' && teacherGroupIds.includes(data.groupId);
          })
          .map(s => ({ id: s.id, ...s.data() }));

        // Fetch today's attendance to filter students
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const allAttendanceSnap = await getDocs(collection(db, 'attendance'));
        const presentIds = new Set<string>();
        let hasAnyAttendanceToday = false;

        allAttendanceSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (!teacherGroupIds.includes(data.groupId)) return;

          let date: Date | null = null;
          if (data.date && typeof data.date.toDate === 'function') {
            date = data.date.toDate();
          } else if (data.date) {
            date = new Date(data.date);
          }
          if (!date) return;

          if (date >= todayStart && date < todayEnd) {
            hasAnyAttendanceToday = true;
            if (data.status === 'حاضر' || data.status === 'متأخر') {
              presentIds.add(data.studentId);
            }
          }
        });

        setTodayPresentStudentIds(presentIds);
        setAttendanceRegistered(hasAnyAttendanceToday);
        setAttendanceChecked(true);

        // Show only present students; if no attendance registered, show empty list
        if (hasAnyAttendanceToday) {
          setStudents(studentsList.filter(s => presentIds.has(s.id)));
        } else {
          setStudents([]);
        }
      } catch (err) {
        console.error('Error fetching students:', err);
      }
    };
    fetchStudents();
  }, [embedded, userProfile, isSupervisor, getSupervisorCenterIds, isTeacher]);

  // Fetch achievements and student statuses
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const achievementsSnap = await getDocs(query(collection(db, 'student_achievements'), orderBy('date', 'desc')));
        const allAchievements = achievementsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentAchievement));
        setAchievements(allAchievements);
        
        // Fetch student statuses
        const statusesSnap = await getDocs(collection(db, 'studentPeriodStatuses'));
        const statusMap: any = {};
        statusesSnap.docs.forEach(d => {
          const data = d.data();
          statusMap[data.studentId] = { id: d.id, ...data };
        });
        setStudentStatuses(statusMap);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, [refreshCounter]);

  // Fetch pending homework when student changes
  useEffect(() => {
    const fetchHomework = async () => {
      if (!selectedStudent) {
        setPendingHomework(null);
        setJustRecorded(false);
        setShowHomeworkForm(false);
        return;
      }
      try {
        const hwQuery = query(
          collection(db, 'student_homework'),
          where('studentId', '==', selectedStudent),
          where('status', '==', 'pending')
        );
        const hwSnap = await getDocs(hwQuery);
        if (!hwSnap.empty) {
          const hwDoc = hwSnap.docs[0];
          setPendingHomework({ id: hwDoc.id, ...hwDoc.data() } as HomeworkData);
        } else {
          setPendingHomework(null);
        }
      } catch (err) {
        console.error('Error fetching homework:', err);
        setPendingHomework(null);
      }
      setJustRecorded(false);
      setShowHomeworkForm(false);
    };
    fetchHomework();
  }, [selectedStudent, refreshCounter]);

  // Get student's current level and stage group (مرحلة)
  const getStudentLevel = (studentId: string): { level: QuranLevel; stageGroup: QuranStage } => {
    const defaultLevel = quranCurriculum[0];
    const defaultStage = defaultLevel.stages[0];

    // Read from users document only (single source of truth)
    const student = students.find(s => s.id === studentId);
    if (student?.levelId) {
      const level = quranCurriculum.find(l => l.id === student.levelId);
      if (level) {
        const stageGroup = level.stages.find(s => s.id === student.stageId);
        return { level, stageGroup: stageGroup || level.stages[0] };
      }
    }
    return { level: defaultLevel, stageGroup: defaultStage };
  };

  // Check if a surah is fully memorized by a student
  const isSurahFullyMemorized = (studentId: string, surahId: string): boolean => {
    const surahAchievements = achievements.filter(
      a => a.studentId === studentId && a.stageId === surahId && a.challengeType === 'memorization' && a.challengePassed
    );
    if (surahAchievements.length === 0) return false;
    // Find the surah ayah count from curriculum
    for (const level of quranCurriculum) {
      for (const stage of level.stages) {
        const surah = stage.surahs.find(s => s.id === surahId);
        if (surah) {
          const totalAyahs = surah.ayahCount;
          let coveredAyahs = new Set<number>();
          surahAchievements.forEach(a => {
            const from = parseInt(a.fromAya || '1');
            const to = parseInt(a.toAya || String(totalAyahs));
            for (let i = from; i <= to; i++) coveredAyahs.add(i);
          });
          return coveredAyahs.size >= totalAyahs;
        }
      }
    }
    return false;
  };

  // Count memorized surahs in a stage group (مرحلة)
  const countMemorizedSurahsInStage = (studentId: string, stageGroup: QuranStage): number => {
    return stageGroup.surahs.filter(surah => isSurahFullyMemorized(studentId, surah.id)).length;
  };

  // Count memorized surahs in an entire level
  const countMemorizedSurahsInLevel = (studentId: string, level: QuranLevel): number => {
    return getAllSurahsInLevel(level).filter(surah => isSurahFullyMemorized(studentId, surah.id)).length;
  };

  // Check if entire level is memorized
  const isLevelFullyMemorized = (studentId: string, level: QuranLevel): boolean => {
    const allSurahs = getAllSurahsInLevel(level);
    return countMemorizedSurahsInLevel(studentId, level) === allSurahs.length;
  };

  // Check if all surahs in a stage group are memorized
  const isStageFullyMemorized = (studentId: string, stageGroup: QuranStage): boolean => {
    return countMemorizedSurahsInStage(studentId, stageGroup) === stageGroup.surahs.length;
  };

  const getRecitationTypeLabel = (type: RecitationType): string => {
    switch (type) {
      case 'memorization': return 'حفظ';
      case 'near_review': return 'مراجعة قريبة';
      case 'far_review': return 'مراجعة بعيدة';
    }
  };

  const calculateCompletedAyahs = (studentId: string, surahId: string, recitationType: RecitationType): number => {
    const relevant = achievements.filter(
      a => a.studentId === studentId && a.stageId === surahId && a.challengeType === recitationType && a.challengePassed
    );
    let covered = new Set<number>();
    relevant.forEach(a => {
      const from = parseInt(a.fromAya || '1');
      const to = parseInt(a.toAya || '1');
      for (let i = from; i <= to; i++) covered.add(i);
    });
    return covered.size;
  };

  // Handle applying homework (fill form with homework data)
  const handleApplyHomework = () => {
    if (!pendingHomework) return;
    setSelectedRecitationType(pendingHomework.recitationType);
    setSelectedSurah(pendingHomework.surahId);
    setFromAya(pendingHomework.fromAya);
    setToAya(pendingHomework.toAya);
    setStudentNotes(pendingHomework.notes);
    setPendingHomework(null);
  };

  // Handle skipping homework
  const handleSkipHomework = async () => {
    if (!pendingHomework?.id) return;
    try {
      await updateDoc(doc(db, 'student_homework', pendingHomework.id), { status: 'completed' });
      setPendingHomework(null);
      showMessage('info', 'تم تخطي الواجب');
    } catch (err) {
      console.error('Error skipping homework:', err);
      showMessage('error', 'حدث خطأ أثناء تخطي الواجب');
    }
  };

  // Save homework
  const handleSaveHomework = async () => {
    if (!selectedStudent || !userProfile) return;
    if (!homeworkSurahId) {
      showMessage('error', 'يرجى اختيار السورة للواجب');
      return;
    }
    const { level, stageGroup } = getStudentLevel(selectedStudent);
    const surah = stageGroup.surahs.find(s => s.id === homeworkSurahId);
    if (!surah) return;

    try {
      // Mark any existing pending homework as completed
      const existingQuery = query(
        collection(db, 'student_homework'),
        where('studentId', '==', selectedStudent),
        where('status', '==', 'pending')
      );
      const existingSnap = await getDocs(existingQuery);
      for (const d of existingSnap.docs) {
        await updateDoc(doc(db, 'student_homework', d.id), { status: 'completed' });
      }

      const hwData: Omit<HomeworkData, 'id'> = {
        studentId: selectedStudent,
        teacherId: userProfile.uid,
        recitationType: homeworkRecitationType,
        surahId: homeworkSurahId,
        surahName: surah.name,
        fromAya: homeworkFromAya,
        toAya: homeworkToAya,
        notes: homeworkNotes,
        createdAt: new Date().toISOString(),
        status: 'pending',
        levelId: level.id,
        levelName: level.name,
      };

      await addDoc(collection(db, 'student_homework'), hwData);
      showMessage('success', 'تم حفظ الواجب بنجاح');
      setShowHomeworkForm(false);
      setHomeworkRecitationType('memorization');
      setHomeworkSurahId('');
      setHomeworkFromAya('1');
      setHomeworkToAya('');
      setHomeworkNotes('');
    } catch (err) {
      console.error('Error saving homework:', err);
      showMessage('error', 'حدث خطأ أثناء حفظ الواجب');
    }
  };

  // Record achievement
  const handleRecordAchievement = async () => {
    if (!selectedStudent || !selectedSurah) {
      showMessage('error', 'يرجى اختيار الطالب والسورة');
      return;
    }
    if (!fromAya || !toAya) {
      showMessage('error', 'يرجى تحديد نطاق الآيات');
      return;
    }

    const student = students.find(s => s.id === selectedStudent);
    const { level, stageGroup } = getStudentLevel(selectedStudent);
    const surah = availableSurahs.find(s => s.id === selectedSurah);
    if (!student || !surah) return;

    // Find the actual level/stage location of this surah (for far_review it may differ from student's current)
    let surahLevel = level;
    let surahStageGroup = stageGroup;
    if (selectedRecitationType === 'far_review') {
      for (const l of quranCurriculum) {
        for (const sg of l.stages) {
          if (sg.surahs.some(s => s.id === selectedSurah)) {
            surahLevel = l;
            surahStageGroup = sg;
            break;
          }
        }
      }
    }

    // Calculate points
    let points = 0;
    if (challengePassed) {
      switch (selectedRecitationType) {
        case 'memorization': points = POINTS_SYSTEM.MEMORIZATION; break;
        case 'near_review': points = POINTS_SYSTEM.NEAR_REVIEW; break;
        case 'far_review': points = POINTS_SYSTEM.FAR_REVIEW; break;
      }
      if (rating === 10) points += POINTS_SYSTEM.PERFECT_RATING_BONUS;
    } else {
      points = POINTS_SYSTEM.RETRY_PENALTY;
    }

    try {
      const achievementData: any = {
        studentId: selectedStudent,
        studentName: student.name || student.displayName || '',
        portion: surah.name,
        fromAya,
        toAya,
        rating,
        notes: studentNotes,
        date: getRecordingDate(),
        challengeType: selectedRecitationType,
        challengeContent: `${getRecitationTypeLabel(selectedRecitationType)}: سورة ${surah.name}`,
        challengePassed,
        levelId: surahLevel.id,
        levelName: surahLevel.name,
        stageId: surah.id,
        stageName: surah.name,
        stageGroupId: surahStageGroup.id,
        stageGroupName: surahStageGroup.name,
        points,
        teacherId: userProfile?.uid || '',
        studyPeriodId: currentStudyPeriod?.id || '',
      };

      await addDoc(collection(db, 'student_achievements'), achievementData);

      // Mark homework as completed if it was applied
      if (pendingHomework?.id) {
        await updateDoc(doc(db, 'student_homework', pendingHomework.id), { status: 'completed' });
        setPendingHomework(null);
      }

      showMessage('success', challengePassed ? 'تم تسجيل التحصيل بنجاح' : 'تم تسجيل المحاولة - يحتاج إعادة');

      // Update local achievements state so filtered surahs update immediately
      setAchievements(prev => [...prev, { ...achievementData, id: 'temp_' + Date.now() }]);

      // Show homework form option
      setJustRecorded(true);
      
      // Reset form
      setSelectedSurah('');
      setFromAya('1');
      setToAya('');
      setRating(10);
      setStudentNotes('');
      setRefreshCounter(c => c + 1);
    } catch (err) {
      console.error('Error recording achievement:', err);
      showMessage('error', 'حدث خطأ أثناء تسجيل التحصيل');
    }
  };

  // Record Arabic reading lesson
  const handleRecordArabicLesson = async () => {
    if (!selectedStudent) {
      showMessage('error', 'يرجى اختيار الطالب');
      return;
    }
    const student = students.find(s => s.id === selectedStudent);
    if (!student) return;

    const currentArabicLevelId = student.currentArabicLevelId || student.levelId || 'level1';
    const currentArabicLessonId = student.currentArabicLessonId || student.stageId || 'l1_1';
    
    const arabicLevel = arabicReadingCurriculum.find((l: ArabicLevel) => l.id === currentArabicLevelId);
    if (!arabicLevel) {
      showMessage('error', 'لم يتم العثور على المستوى الحالي');
      return;
    }
    const arabicLesson = arabicLevel.lessons.find((ls: ArabicLesson) => ls.id === currentArabicLessonId);
    if (!arabicLesson) {
      showMessage('error', 'لم يتم العثور على الدرس الحالي');
      return;
    }

    let points = 0;
    if (arabicChallengePassed) {
      points = ARABIC_READING_POINTS.LESSON_COMPLETION;
      if (arabicLessonRating === 10) points += ARABIC_READING_POINTS.PERFECT_RATING;
    } else {
      points = -5;
    }

    try {
      const achievementData: any = {
        studentId: selectedStudent,
        studentName: student.name || student.displayName || '',
        portion: arabicLesson.name,
        date: getRecordingDate(),
        challengeType: 'arabic_lesson',
        challengeContent: `${arabicLevel.name} - ${arabicLesson.name}`,
        challengePassed: arabicChallengePassed,
        levelId: arabicLevel.id,
        levelName: arabicLevel.name,
        stageId: arabicLesson.id,
        stageName: arabicLesson.name,
        notes: arabicLessonNotes,
        rating: arabicLessonRating,
        points,
        teacherId: userProfile?.uid || '',
        studyPeriodId: currentStudyPeriod?.id || '',
        track: 'arabic_reading',
      };

      await addDoc(collection(db, 'student_achievements'), achievementData);

      if (arabicChallengePassed) {
        const nextResult = getNextArabicLesson(currentArabicLevelId, currentArabicLessonId);
        if (nextResult.lesson) {
          await updateDoc(doc(db, 'users', selectedStudent), {
            currentArabicLessonId: nextResult.lesson.id,
            stageId: nextResult.lesson.id,
            stageName: nextResult.lesson.name,
          });
          setStudents(prev => prev.map(s => s.id === selectedStudent ? { ...s, currentArabicLessonId: nextResult.lesson!.id, stageId: nextResult.lesson!.id, stageName: nextResult.lesson!.name } : s));
          showMessage('success', `تم إتمام الدرس والانتقال إلى ${nextResult.lesson.name}`);
        } else {
          const nextLevel = getNextArabicLevel(currentArabicLevelId);
          if (nextLevel) {
            await updateDoc(doc(db, 'users', selectedStudent), {
              currentArabicLevelId: nextLevel.id,
              currentArabicLessonId: nextLevel.lessons[0]?.id || 'l1_1',
              levelId: nextLevel.id,
              levelName: nextLevel.name,
              stageId: nextLevel.lessons[0]?.id || 'l1_1',
              stageName: nextLevel.lessons[0]?.name || '',
            });
            setStudents(prev => prev.map(s => s.id === selectedStudent ? { ...s, currentArabicLevelId: nextLevel.id, currentArabicLessonId: nextLevel.lessons[0]?.id, levelId: nextLevel.id, levelName: nextLevel.name } : s));
            // Level completion bonus
            const bonusData = {
              ...achievementData,
              challengeType: 'arabic_level_completion',
              challengeContent: `إتمام ${arabicLevel.name}`,
              points: ARABIC_READING_POINTS.LEVEL_COMPLETION,
            };
            await addDoc(collection(db, 'student_achievements'), bonusData);
            showMessage('success', `تم إتمام ${arabicLevel.name} والانتقال إلى ${nextLevel.name}`);
          } else {
            showMessage('success', 'تم إتمام جميع مستويات القراءة العربية!');
          }
        }
      } else {
        showMessage('info', 'تم تسجيل المحاولة - يحتاج إعادة الدرس');
      }

      setArabicLessonNotes('');
      setArabicLessonRating(10);
      setRefreshCounter(c => c + 1);
    } catch (err) {
      console.error('Error recording arabic lesson:', err);
      showMessage('error', 'حدث خطأ أثناء تسجيل الدرس');
    }
  };

  // Delete achievement
  const performDeleteAchievement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'student_achievements', id));
      showMessage('success', 'تم حذف السجل بنجاح');
      setRefreshCounter(c => c + 1);
    } catch (err) {
      console.error('Error deleting achievement:', err);
      showMessage('error', 'حدث خطأ أثناء الحذف');
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setConfirmMessage('هل أنت متأكد من حذف هذا السجل؟');
    setConfirmAction(() => () => {
      performDeleteAchievement(id);
      setDeletingId(null);
    });
    setShowConfirmModal(true);
  };

  // Get filtered achievements for selected student
  const studentAchievements = selectedStudent
    ? achievements.filter(a => a.studentId === selectedStudent)
    : [];

  // Get current student info
  const selectedStudentData = students.find(s => s.id === selectedStudent);
  const { level: studentLevel, stageGroup: studentStageGroup } = selectedStudent
    ? getStudentLevel(selectedStudent)
    : { level: quranCurriculum[0], stageGroup: quranCurriculum[0].stages[0] };

  // Get surahs based on recitation type
  const availableSurahs = (() => {
    const currentSurahs = studentStageGroup?.surahs || [];
    if (!selectedStudent) return currentSurahs;

    if (selectedRecitationType === 'memorization') {
      // Only show surahs NOT yet fully memorized
      return currentSurahs.filter(s => !isSurahFullyMemorized(selectedStudent, s.id));
    }

    if (selectedRecitationType === 'far_review') {
      // Show ALL memorized surahs from ALL levels/stages
      const allMemorized: QuranSurah[] = [];
      for (const level of quranCurriculum) {
        for (const stage of level.stages) {
          for (const surah of stage.surahs) {
            if (isSurahFullyMemorized(selectedStudent, surah.id)) {
              allMemorized.push(surah);
            }
          }
        }
      }
      return allMemorized;
    }

    // near_review: show current stage surahs (default)
    return currentSurahs;
  })();

  // Arabic reading info (from users document)
  const arabicStudentData = selectedStudent ? students.find(s => s.id === selectedStudent) : null;
  const currentArabicLevelId = arabicStudentData?.currentArabicLevelId || arabicStudentData?.levelId || 'level1';
  const currentArabicLessonId = arabicStudentData?.currentArabicLessonId || arabicStudentData?.stageId || 'l1_1';
  const currentArabicLevel = arabicReadingCurriculum.find((l: ArabicLevel) => l.id === currentArabicLevelId);
  const currentArabicLesson = currentArabicLevel?.lessons.find((ls: ArabicLesson) => ls.id === currentArabicLessonId);

  // Calculate memorized surahs count in current stage group
  const memorizedCountInStage = selectedStudent ? countMemorizedSurahsInStage(selectedStudent, studentStageGroup) : 0;
  const totalSurahsInStage = studentStageGroup?.surahs.length || 0;
  // And in entire level
  const memorizedCountInLevel = selectedStudent ? countMemorizedSurahsInLevel(selectedStudent, studentLevel) : 0;
  const totalSurahsInLevel = getAllSurahsInLevel(studentLevel).length;

  // Get student track type
  const studentTrackType = selectedStudentData?.trackType || 'quran';
  const isQuranTrack = studentTrackType === 'quran';
  const isArabicTrack = studentTrackType === 'arabic_reading';
  const isBothTracks = !isQuranTrack && !isArabicTrack;

  // Stage fully memorized check (for nomination button)
  const stageFullyMemorized = selectedStudent && memorizedCountInStage >= totalSurahsInStage && totalSurahsInStage > 0;

  // Sort history table
  const toggleHistorySort = (col: string) => {
    if (historySortCol === col) {
      setHistorySortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setHistorySortCol(col);
      setHistorySortDir('desc');
    }
  };

  const sortedStudentAchievements = [...studentAchievements].sort((a, b) => {
    let valA: any, valB: any;
    switch (historySortCol) {
      case 'date': valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); break;
      case 'type': valA = a.challengeType || ''; valB = b.challengeType || ''; break;
      case 'content': valA = a.challengeContent || a.portion || ''; valB = b.challengeContent || b.portion || ''; break;
      case 'ayahs': valA = parseInt(a.fromAya || '0'); valB = parseInt(b.fromAya || '0'); break;
      case 'rating': valA = a.rating || 0; valB = b.rating || 0; break;
      case 'result': valA = a.challengePassed ? 1 : 0; valB = b.challengePassed ? 1 : 0; break;
      case 'points': valA = (a as any).points || 0; valB = (b as any).points || 0; break;
      default: valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime();
    }
    if (valA < valB) return historySortDir === 'asc' ? -1 : 1;
    if (valA > valB) return historySortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle edit achievement
  const handleEditAchievement = async () => {
    if (!editingAchievement) return;
    try {
      const { id, ...data } = editingAchievement;
      await updateDoc(doc(db, 'student_achievements', id), {
        challengeType: data.challengeType,
        challengeContent: data.challengeContent,
        fromAya: data.fromAya,
        toAya: data.toAya,
        rating: data.rating,
        challengePassed: data.rating >= 4,
        points: data.points,
        date: data.date,
      });
      setAchievements(prev => prev.map(a => a.id === id ? { ...a, ...data, challengePassed: data.rating >= 4 } : a));
      setEditingAchievement(null);
      showMessage('success', 'تم تعديل السجل بنجاح');
    } catch (err) {
      console.error('Error updating achievement:', err);
      showMessage('error', 'حدث خطأ أثناء التعديل');
    }
  };

  // Check if student is already nominated (from users document only)
  const isStudentNominated = selectedStudent &&
    students.find(s => s.id === selectedStudent)?.levelStatus === 'pending_supervisor';

  // Nominate student for exam
  const handleNominateForExam = async () => {
    if (!selectedStudent) return;
    try {
      const { level, stageGroup } = getStudentLevel(selectedStudent);
      const nextStageResult = getNextStage(level.id, stageGroup.id);
      const isLevelUp = !nextStageResult.stage;

      // Update users document only (single source of truth)
      await updateDoc(doc(db, 'users', selectedStudent), {
        levelStatus: 'pending_supervisor',
        pendingLevelUp: isLevelUp,
        pendingStageId: nextStageResult.stage?.id || null,
        pendingStageName: nextStageResult.stage?.name || null,
        pendingNextLevelId: isLevelUp ? (nextStageResult.newLevel?.id || null) : null,
        pendingNextLevelName: isLevelUp ? (nextStageResult.newLevel?.name || null) : null,
      });

      // Update local students state
      setStudents(prev => prev.map(s => s.id === selectedStudent ? { ...s, levelStatus: 'pending_supervisor' } : s));
      showMessage('success', 'تم ترشيح الطالب للامتحان بنجاح');
    } catch (err) {
      console.error('Error nominating student:', err);
      showMessage('error', 'حدث خطأ أثناء ترشيح الطالب');
    }
  };

  if (loading) {
    return <div className="achievements-container"><div className="loading">جاري التحميل...</div></div>;
  }

  return (
    <div className="achievements-container new-achievements">
      {messageBox.show && (
        <MessageBox
          open={messageBox.show}
          type={messageBox.type}
          message={messageBox.message}
          onClose={() => setMessageBox({ ...messageBox, show: false })}
        />
      )}
      {showConfirmModal && (
        <ConfirmModal
          open={showConfirmModal}
          message={confirmMessage}
          onConfirm={() => { confirmAction(); setShowConfirmModal(false); }}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      {!embedded && <h2>تسجيل تحصيل الطلاب</h2>}

      {/* Attendance Reminder - only in standalone mode */}
      {!embedded && attendanceChecked && !attendanceRegistered && (
        <div className="attendance-reminder" style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          textAlign: 'center',
          color: '#856404'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '1.1em' }}>
            ⚠️ لم يتم تسجيل الحضور لهذا اليوم
          </p>
          <p style={{ margin: '0 0 12px 0' }}>
            يرجى تسجيل الحضور أولاً حتى تظهر أسماء الطلاب الحاضرين
          </p>
          <a href="/attendance" style={{
            display: 'inline-block',
            background: '#ffc107',
            color: '#856404',
            padding: '8px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}>
            📋 انتقل لتسجيل الحضور
          </a>
        </div>
      )}

      {/* Student Selection */}
      <div className="form-section">
        <label>اختر الطالب:</label>
        <select
          value={selectedStudent}
          onChange={(e) => {
            setSelectedStudent(e.target.value);
            setSelectedSurah('');
            setFromAya('1');
            setToAya('');
            setJustRecorded(false);
            setShowHomeworkForm(false);
            // Auto-select track based on student
            const st = students.find(s => s.id === e.target.value);
            if (st?.trackType === 'arabic_reading') setSelectedTrack('arabic');
            else setSelectedTrack('quran');
          }}
        >
          <option value="">-- اختر طالب --</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.name || s.displayName}</option>
          ))}
        </select>
      </div>

      {selectedStudent && (
        <>
          {/* Student Current Level Info - only for Quran track */}
          {!isArabicTrack && (
            <div className="sa-level-info-bar">
              <div className="sa-level-badge-row">
                <span className="sa-level-tag">{studentLevel?.name}</span>
                <span className="sa-stage-tag">المرحلة: {studentStageGroup?.name || '-'}</span>
                <span className="sa-memorized-tag">
                  السور المحفوظة (المرحلة): {memorizedCountInStage} / {totalSurahsInStage}
                </span>
                {stageFullyMemorized && (
                  isStudentNominated ? (
                    <span className="btn-nominated">✅ تم الترشيح</span>
                  ) : (
                    <button className="btn-nominate-exam" onClick={handleNominateForExam}>
                      📝 ترشيح لامتحان
                    </button>
                  )
                )}
                <span className="sa-memorized-tag">
                  السور المحفوظة (المستوى): {memorizedCountInLevel} / {totalSurahsInLevel}
                </span>
              </div>
            </div>
          )}

          {/* Pending Homework Card */}
          {pendingHomework && !justRecorded && (
            <div className="homework-pending-card">
              <div className="homework-pending-header">
                <h3>📋 الواجب المسجل</h3>
              </div>
              <div className="homework-pending-body">
                <div className="homework-detail">
                  <span className="hw-label">نوع التسميع:</span>
                  <span className="hw-value">{getRecitationTypeLabel(pendingHomework.recitationType)}</span>
                </div>
                <div className="homework-detail">
                  <span className="hw-label">السورة:</span>
                  <span className="hw-value">سورة {pendingHomework.surahName}</span>
                </div>
                <div className="homework-detail">
                  <span className="hw-label">الآيات:</span>
                  <span className="hw-value">من {pendingHomework.fromAya} إلى {pendingHomework.toAya}</span>
                </div>
                {pendingHomework.notes && (
                  <div className="homework-detail">
                    <span className="hw-label">ملاحظات:</span>
                    <span className="hw-value">{pendingHomework.notes}</span>
                  </div>
                )}
              </div>
              <div className="homework-pending-actions">
                <button className="btn-apply" onClick={handleApplyHomework}>اعتماد الواجب</button>
                <button className="btn-skip" onClick={handleSkipHomework}>تخطي</button>
              </div>
            </div>
          )}

          {/* Track Selection - only show if student has both tracks */}
          {!isQuranTrack && !isArabicTrack && (
            <div className="track-selector">
              <button
                className={`track-btn ${selectedTrack === 'quran' ? 'active' : ''}`}
                onClick={() => setSelectedTrack('quran')}
              >
                القرآن الكريم
              </button>
              <button
                className={`track-btn ${selectedTrack === 'arabic' ? 'active' : ''}`}
                onClick={() => setSelectedTrack('arabic')}
              >
                القراءة العربية
              </button>
            </div>
          )}

          {(isQuranTrack || (!isArabicTrack && selectedTrack === 'quran')) && (
            <div className="achievement-form">
              <h3>تسجيل تحصيل القرآن</h3>
              
              {/* Recitation Type */}
              <div className="form-section">
                <label>نوع التسميع:</label>
                <select
                  value={selectedRecitationType}
                  onChange={(e) => { setSelectedRecitationType(e.target.value as RecitationType); setSelectedSurah(''); }}
                >
                  <option value="memorization">حفظ</option>
                  <option value="near_review">مراجعة قريبة</option>
                  <option value="far_review">مراجعة بعيدة</option>
                </select>
              </div>

              {/* Surah Selection */}
              <div className="form-section">
                <label>اختر السورة:</label>
                <select
                  value={selectedSurah}
                  onChange={(e) => {
                    setSelectedSurah(e.target.value);
                    setFromAya('1');
                    const surah = availableSurahs.find(s => s.id === e.target.value);
                    setToAya(surah ? String(surah.ayahCount) : '');
                  }}
                >
                  <option value="">-- اختر السورة --</option>
                  {availableSurahs.map(s => {
                    const memorized = isSurahFullyMemorized(selectedStudent, s.id);
                    const completedAyahs = calculateCompletedAyahs(selectedStudent, s.id, selectedRecitationType);
                    return (
                      <option key={s.id} value={s.id}>
                        سورة {s.name} ({s.ayahCount} آية) {memorized ? '' : completedAyahs > 0 ? `[${completedAyahs}/${s.ayahCount}]` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Ayah Range */}
              {selectedSurah && (
                <>
                  <div className="form-row">
                    <div className="form-section">
                      <label>من الآية:</label>
                      <input
                        type="number"
                        min="1"
                        max={availableSurahs.find(s => s.id === selectedSurah)?.ayahCount || 1}
                        value={fromAya}
                        onChange={(e) => setFromAya(e.target.value)}
                      />
                    </div>
                    <div className="form-section">
                      <label>إلى الآية:</label>
                      <input
                        type="number"
                        min="1"
                        max={availableSurahs.find(s => s.id === selectedSurah)?.ayahCount || 1}
                        value={toAya}
                        onChange={(e) => setToAya(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="form-section">
                    <label>التقييم: (1-10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={rating}
                      onChange={(e) => setRating(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                    />
                  </div>

                  {/* Notes */}
                  <div className="form-section">
                    <label>ملاحظات المعلم:</label>
                    <textarea
                      value={studentNotes}
                      onChange={(e) => setStudentNotes(e.target.value)}
                      placeholder="أدخل ملاحظاتك هنا..."
                      rows={3}
                    />
                  </div>

                  {/* Auto Pass/Retry based on rating */}
                  <div className="form-section pass-retry">
                    <span className={`auto-result ${challengePassed ? 'result-pass' : 'result-retry'}`}>
                      {challengePassed ? '✅ ناجح' : '❌ يحتاج إعادة'}
                    </span>
                    <span className="result-hint">
                      (النتيجة تلقائية: {rating >= 4 ? '4 فأكثر = ناجح' : 'أقل من 4 = إعادة'})
                    </span>
                  </div>

                  <button className="btn-record" onClick={handleRecordAchievement}>
                    تسجيل التحصيل
                  </button>
                </>
              )}
            </div>
          )}

          {(isArabicTrack || (!isQuranTrack && selectedTrack === 'arabic')) && (
            <div className="achievement-form">
              <h3>تسجيل درس القراءة العربية</h3>
              {currentArabicLevel && currentArabicLesson && (
                <>
                  <div className="current-lesson-info">
                    <p><strong>المستوى:</strong> {currentArabicLevel.name}</p>
                    <p><strong>الدرس الحالي:</strong> {currentArabicLesson.name}</p>
                    <p><strong>الوصف:</strong> {currentArabicLesson.description}</p>
                  </div>

                  <div className="form-section">
                    <label>التقييم: (1-10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={arabicLessonRating}
                      onChange={(e) => setArabicLessonRating(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                    />
                  </div>

                  <div className="form-section">
                    <label>ملاحظات:</label>
                    <textarea
                      value={arabicLessonNotes}
                      onChange={(e) => setArabicLessonNotes(e.target.value)}
                      placeholder="ملاحظات حول الدرس..."
                      rows={3}
                    />
                  </div>

                  <div className="form-section pass-retry">
                    <span className={`auto-result ${arabicChallengePassed ? 'result-pass' : 'result-retry'}`}>
                      {arabicChallengePassed ? '✅ ناجح' : '❌ يحتاج إعادة'}
                    </span>
                    <span className="result-hint">
                      (النتيجة تلقائية: {arabicLessonRating >= 4 ? '4 فأكثر = ناجح' : 'أقل من 4 = إعادة'})
                    </span>
                  </div>

                  <button className="btn-record" onClick={handleRecordArabicLesson}>
                    تسجيل الدرس
                  </button>
                </>
              )}
            </div>
          )}

          {/* Homework Form - shown after recording */}
          {justRecorded && !showHomeworkForm && (
            <div className="homework-form-section">
              <div className="homework-form-header">
                <p>هل تريد تسجيل واجب للجلسة القادمة؟</p>
                <div className="homework-form-actions">
                  <button className="btn-apply" onClick={() => setShowHomeworkForm(true)}>نعم، تسجيل واجب</button>
                  <button className="btn-skip" onClick={() => setJustRecorded(false)}>لا، شكراً</button>
                </div>
              </div>
            </div>
          )}

          {showHomeworkForm && (
            <div className="homework-form-section">
              <h3>تسجيل الواجب</h3>
              <div className="form-section">
                <label>نوع التسميع:</label>
                <select
                  value={homeworkRecitationType}
                  onChange={(e) => setHomeworkRecitationType(e.target.value as RecitationType)}
                >
                  <option value="memorization">حفظ</option>
                  <option value="near_review">مراجعة قريبة</option>
                  <option value="far_review">مراجعة بعيدة</option>
                </select>
              </div>
              <div className="form-section">
                <label>السورة:</label>
                <select
                  value={homeworkSurahId}
                  onChange={(e) => {
                    setHomeworkSurahId(e.target.value);
                    setHomeworkFromAya('1');
                    const surah = availableSurahs.find(s => s.id === e.target.value);
                    setHomeworkToAya(surah ? String(surah.ayahCount) : '');
                  }}
                >
                  <option value="">-- اختر السورة --</option>
                  {availableSurahs.map(s => (
                    <option key={s.id} value={s.id}>سورة {s.name} ({s.ayahCount} آية)</option>
                  ))}
                </select>
              </div>
              {homeworkSurahId && (
                <>
                  <div className="form-row">
                    <div className="form-section">
                      <label>من الآية:</label>
                      <input
                        type="number"
                        min="1"
                        value={homeworkFromAya}
                        onChange={(e) => setHomeworkFromAya(e.target.value)}
                      />
                    </div>
                    <div className="form-section">
                      <label>إلى الآية:</label>
                      <input
                        type="number"
                        min="1"
                        value={homeworkToAya}
                        onChange={(e) => setHomeworkToAya(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-section">
                    <label>ملاحظات:</label>
                    <textarea
                      value={homeworkNotes}
                      onChange={(e) => setHomeworkNotes(e.target.value)}
                      placeholder="ملاحظات للطالب..."
                      rows={2}
                    />
                  </div>
                  <div className="homework-form-actions">
                    <button className="btn-record" onClick={handleSaveHomework}>حفظ الواجب</button>
                    <button className="btn-skip" onClick={() => { setShowHomeworkForm(false); setJustRecorded(false); }}>إلغاء</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Achievement History */}
          <div className="achievements-history">
            <h3>سجل التحصيل ({studentAchievements.length})</h3>
            {studentAchievements.length === 0 ? (
              <p className="no-data">لا توجد سجلات بعد</p>
            ) : (
              <div className="achievements-table-wrapper">
                <table className="achievements-table">
                  <thead>
                    <tr>
                      <th className="sortable-th" onClick={() => toggleHistorySort('date')}>التاريخ {historySortCol === 'date' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}</th>
                      <th className="sortable-th" onClick={() => toggleHistorySort('type')}>النوع {historySortCol === 'type' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}</th>
                      <th className="sortable-th" onClick={() => toggleHistorySort('content')}>المحتوى {historySortCol === 'content' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}</th>
                      <th className="sortable-th" onClick={() => toggleHistorySort('ayahs')}>الآيات {historySortCol === 'ayahs' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}</th>
                      <th className="sortable-th" onClick={() => toggleHistorySort('rating')}>التقييم {historySortCol === 'rating' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}</th>
                      <th className="sortable-th" onClick={() => toggleHistorySort('result')}>النتيجة {historySortCol === 'result' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}</th>
                      <th className="sortable-th" onClick={() => toggleHistorySort('points')}>النقاط {historySortCol === 'points' ? (historySortDir === 'desc' ? '▼' : '▲') : ''}</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudentAchievements.map(a => (
                      <tr key={a.id} className={a.challengePassed ? 'passed' : 'failed'}>
                        <td>{new Date(a.date).toLocaleDateString('ar-SA')} {new Date(a.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{a.challengeType === 'memorization' ? 'حفظ' :
                             a.challengeType === 'near_review' ? 'مراجعة قريبة' :
                             a.challengeType === 'far_review' ? 'مراجعة بعيدة' :
                             a.challengeType === 'arabic_lesson' ? 'قراءة عربية' :
                             a.challengeType === 'stage_completion' ? 'إتمام سورة' :
                             a.challengeType === 'level_completion' ? 'إتمام مستوى' :
                             a.challengeType || '-'}</td>
                        <td>{a.challengeContent || a.portion || '-'}</td>
                        <td>{a.fromAya && a.toAya ? `${a.fromAya} - ${a.toAya}` : '-'}</td>
                        <td>{a.rating || 0} / 10</td>
                        <td>
                          <span className={`badge ${a.challengePassed ? 'badge-success' : 'badge-danger'}`}>
                            {a.challengePassed ? 'ناجح' : 'إعادة'}
                          </span>
                        </td>
                        <td>{(a as any).points || '-'}</td>
                        <td>
                          <button
                            className="btn-edit-sm"
                            onClick={() => setEditingAchievement({ ...a })}
                          >
                            تعديل
                          </button>
                          <button
                            className="btn-delete-sm"
                            onClick={() => a.id && handleDeleteClick(a.id)}
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit Achievement Modal */}
      {editingAchievement && (
        <div className="modal-overlay" onClick={() => setEditingAchievement(null)}>
          <div className="modal-content edit-modal" onClick={e => e.stopPropagation()}>
            <h3>تعديل سجل التحصيل</h3>
            <div className="edit-form">
              <label>التاريخ:</label>
              <input type="date" value={editingAchievement.date} onChange={e => setEditingAchievement({...editingAchievement, date: e.target.value})} />

              <label>النوع:</label>
              <select value={editingAchievement.challengeType} onChange={e => setEditingAchievement({...editingAchievement, challengeType: e.target.value})}>
                <option value="memorization">حفظ</option>
                <option value="near_review">مراجعة قريبة</option>
                <option value="far_review">مراجعة بعيدة</option>
              </select>

              <label>من الآية:</label>
              <input type="number" min="1" value={editingAchievement.fromAya || ''} onChange={e => setEditingAchievement({...editingAchievement, fromAya: e.target.value})} />

              <label>إلى الآية:</label>
              <input type="number" min="1" value={editingAchievement.toAya || ''} onChange={e => setEditingAchievement({...editingAchievement, toAya: e.target.value})} />

              <label>التقييم (1-10):</label>
              <input type="number" min="1" max="10" value={editingAchievement.rating || 0} onChange={e => setEditingAchievement({...editingAchievement, rating: parseInt(e.target.value) || 0})} />

              <div className="edit-actions">
                <button className="btn-save" onClick={handleEditAchievement}>حفظ التعديلات</button>
                <button className="btn-cancel" onClick={() => setEditingAchievement(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAchievements;
