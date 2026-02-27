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

const StudentAchievements = () => {
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

  // Fetch students for teacher
  useEffect(() => {
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
        
        setStudents(studentsList);
      } catch (err) {
        console.error('Error fetching students:', err);
      }
    };
    fetchStudents();
  }, [userProfile, isSupervisor, getSupervisorCenterIds, isTeacher]);

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
    
    // First try studentPeriodStatuses
    const status = studentStatuses[studentId];
    if (status?.currentLevelId) {
      const level = quranCurriculum.find(l => l.id === status.currentLevelId);
      if (level) {
        const stageGroup = level.stages.find(s => s.id === status.currentStageId);
        return { level, stageGroup: stageGroup || level.stages[0] };
      }
    }
    // Fallback: use levelId/stageId from the student's user document
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
    const surah = stageGroup.surahs.find(s => s.id === selectedSurah);
    if (!student || !surah) return;

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
        date: new Date().toISOString(),
        challengeType: selectedRecitationType,
        challengeContent: `${getRecitationTypeLabel(selectedRecitationType)}: سورة ${surah.name}`,
        challengePassed,
        levelId: level.id,
        levelName: level.name,
        stageId: surah.id,
        stageName: surah.name,
        stageGroupId: stageGroup.id,
        stageGroupName: stageGroup.name,
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

      // Check if surah is now fully memorized and handle stage/level advancement
      if (challengePassed && selectedRecitationType === 'memorization') {
        const newFrom = parseInt(fromAya);
        const newTo = parseInt(toAya);
        let newCovered = new Set<number>();
        // Existing covered
        const relevant = achievements.filter(
          a => a.studentId === selectedStudent && a.stageId === surah.id && a.challengeType === 'memorization' && a.challengePassed
        );
        relevant.forEach(a => {
          const f = parseInt(a.fromAya || '1');
          const t = parseInt(a.toAya || '1');
          for (let i = f; i <= t; i++) newCovered.add(i);
        });
        for (let i = newFrom; i <= newTo; i++) newCovered.add(i);

        if (newCovered.size >= surah.ayahCount) {
          // Surah fully memorized! Check if all surahs in the current stage group are done
          let allSurahsInStageDone = true;
          for (const s of stageGroup.surahs) {
            if (s.id === surah.id) continue; // already checked above
            if (!isSurahFullyMemorized(selectedStudent, s.id)) {
              allSurahsInStageDone = false;
              break;
            }
          }

          if (allSurahsInStageDone) {
            // All surahs in current stage group memorized!
            const nextResult = getNextStage(level.id, stageGroup.id);
            
            if (nextResult.stage) {
              // Move to next stage group within the same level
              const statusId = studentStatuses[selectedStudent]?.id;
              if (statusId) {
                await updateDoc(doc(db, 'studentPeriodStatuses', statusId), {
                  currentStageId: nextResult.stage.id,
                  currentStageName: nextResult.stage.name,
                });
              }
              await updateDoc(doc(db, 'users', selectedStudent), {
                stageId: nextResult.stage.id,
                stageName: nextResult.stage.name,
              });
              showMessage('success', `تم إتمام ${stageGroup.name} والانتقال إلى ${nextResult.stage.name}`);
            } else {
              // Last stage in level — check if entire level is done
              // Level complete!
              const levelBonusData = {
                ...achievementData,
                challengeType: 'level_completion',
                challengeContent: `إتمام ${level.name}`,
                points: POINTS_SYSTEM.LEVEL_COMPLETION,
              };
              await addDoc(collection(db, 'student_achievements'), levelBonusData);
              
              // Set status to pending_supervisor
              const statusId = studentStatuses[selectedStudent]?.id;
              if (statusId) {
                await updateDoc(doc(db, 'studentPeriodStatuses', statusId), {
                  status: 'pending_supervisor',
                });
              }
              await updateDoc(doc(db, 'users', selectedStudent), {
                levelStatus: 'pending_supervisor',
                pendingLevelUp: true,
              });
              showMessage('success', `تم إتمام ${level.name} بالكامل! في انتظار موافقة المشرف للانتقال للمستوى التالي`);
            }
          } else {
            showMessage('success', `تم إتمام حفظ سورة ${surah.name}!`);
          }
        } else {
          showMessage('success', 'تم تسجيل التحصيل بنجاح');
        }
      } else {
        showMessage('success', challengePassed ? 'تم تسجيل التحصيل بنجاح' : 'تم تسجيل المحاولة - يحتاج إعادة');
      }

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

    const status = studentStatuses[selectedStudent];
    const currentArabicLevelId = status?.currentArabicLevelId || 'level1';
    const currentArabicLessonId = status?.currentArabicLessonId || 'lesson1';
    
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
        date: new Date().toISOString(),
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
          const statusId = studentStatuses[selectedStudent]?.id;
          if (statusId) {
            await updateDoc(doc(db, 'studentPeriodStatuses', statusId), {
              currentArabicLessonId: nextResult.lesson.id,
            });
          }
          showMessage('success', `تم إتمام الدرس والانتقال إلى ${nextResult.lesson.name}`);
        } else {
          const nextLevel = getNextArabicLevel(currentArabicLevelId);
          if (nextLevel) {
            const statusId = studentStatuses[selectedStudent]?.id;
            if (statusId) {
              await updateDoc(doc(db, 'studentPeriodStatuses', statusId), {
                currentArabicLevelId: nextLevel.id,
                currentArabicLessonId: nextLevel.lessons[0]?.id || 'lesson1',
              });
            }
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

  // Get surahs from current stage group for dropdown
  const availableSurahs = studentStageGroup?.surahs || [];

  // Arabic reading info
  const arabicStatus = selectedStudent ? studentStatuses[selectedStudent] : null;
  const currentArabicLevelId = arabicStatus?.currentArabicLevelId || 'level1';
  const currentArabicLessonId = arabicStatus?.currentArabicLessonId || 'lesson1';
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

      <h2>تسجيل تحصيل الطلاب</h2>

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
                  onChange={(e) => setSelectedRecitationType(e.target.value as RecitationType)}
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
                      <th>التاريخ</th>
                      <th>النوع</th>
                      <th>المحتوى</th>
                      <th>الآيات</th>
                      <th>التقييم</th>
                      <th>النتيجة</th>
                      <th>النقاط</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentAchievements.map(a => (
                      <tr key={a.id} className={a.challengePassed ? 'passed' : 'failed'}>
                        <td>{new Date(a.date).toLocaleDateString('ar-SA')}</td>
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
    </div>
  );
};

export default StudentAchievements;
