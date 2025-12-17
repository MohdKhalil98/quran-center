import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/StudentAchievements.css';
import ConfirmModal from '../components/ConfirmModal';
import MessageBox from '../components/MessageBox';
import { useAuth } from '../context/AuthContext';
import quranCurriculum, { QuranJuz, QuranSurah, getDefaultLevel, getDefaultStage } from '../data/quranCurriculum';

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
  // Calculate near review (previous 2 surahs)
  const nearReviewParts: string[] = [];
  const currentJuz = quranCurriculum[juzIndex];
  
  // Get previous surahs from current juz
  for (let i = surahIndex - 1; i >= Math.max(0, surahIndex - 2); i--) {
    nearReviewParts.push(currentJuz.surahs[i].name);
  }
  
  // If we need more surahs, get from previous juz
  if (nearReviewParts.length < 2 && juzIndex > 0) {
    const prevJuz = quranCurriculum[juzIndex - 1];
    const remaining = 2 - nearReviewParts.length;
    for (let i = prevJuz.surahs.length - 1; i >= Math.max(0, prevJuz.surahs.length - remaining); i--) {
      nearReviewParts.push(prevJuz.surahs[i].name);
    }
  }
  
  // Calculate far review (from earlier completed juz)
  let farReview = '-';
  if (juzIndex > 0) {
    // Review from 2 juz back if available
    const farJuzIndex = Math.max(0, juzIndex - 2);
    const farJuz = quranCurriculum[farJuzIndex];
    if (farJuz.surahs.length > 0) {
      const randomSurah = farJuz.surahs[Math.floor(surahIndex % farJuz.surahs.length)];
      farReview = randomSurah.name;
    }
  }
  
  return {
    id: surah.id,
    name: surah.name,
    order: surah.order,
    memorization: `${surah.name} (${surah.ayahCount} آية)`,
    nearReview: nearReviewParts.length > 0 ? nearReviewParts.join(' + ') : '-',
    farReview: farReview,
    stageBonus: 30
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
  
  // Teacher groups
  const [teacherGroups, setTeacherGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupStudents, setGroupStudents] = useState<any[]>([]);
  
  // Selected student and their progress
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentLevel, setStudentLevel] = useState<CurriculumLevel | null>(null);
  const [studentStage, setStudentStage] = useState<CurriculumStage | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<Set<ChallengeType>>(new Set());
  
  // Challenge recording state
  const [selectedChallengeType, setSelectedChallengeType] = useState<ChallengeType | ''>('');
  const [challengeRating, setChallengeRating] = useState<number>(5);
  const [challengeNotes, setChallengeNotes] = useState<string>('');
  const [challengePassed, setChallengePassed] = useState<boolean>(true);
  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().split('T')[0]);

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
        }));
        setTeacherGroups(groups);
        
        if (groups.length === 1) {
          setSelectedGroupId(groups[0].id);
        }
      } catch (error) {
        console.error('Error fetching teacher groups:', error);
      }
    };

    fetchTeacherGroups();
  }, [isTeacher, userProfile?.uid]);

  // Fetch students when group is selected
  useEffect(() => {
    const fetchGroupStudents = async () => {
      if (!isTeacher || !selectedGroupId) {
        setGroupStudents([]);
        return;
      }

      try {
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'approved'),
          where('groupId', '==', selectedGroupId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsList = studentsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            ...data
          };
        });
        
        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        setGroupStudents(studentsList);
      } catch (error) {
        console.error('Error fetching group students:', error);
      }
    };

    fetchGroupStudents();
  }, [isTeacher, selectedGroupId]);

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
  };

  // Handle student selection
  const handleStudentSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value;
    if (!studentId) {
      setSelectedStudent(null);
      setStudentLevel(null);
      setStudentStage(null);
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
    } catch (error) {
      console.error('Error fetching student data:', error);
      // Fallback to local data
      const student = (isTeacher ? groupStudents : students).find((s) => s.id === studentId);
      setSelectedStudent(student || null);
    }
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
  const checkStageCompletion = async (studentId: string, stageId: string, stage: CurriculumStage): Promise<boolean> => {
    try {
      const achievementsQuery = query(
        collection(db, 'student_achievements'),
        where('studentId', '==', studentId),
        where('stageId', '==', stageId),
        where('challengePassed', '==', true)
      );
      const snapshot = await getDocs(achievementsQuery);
      
      const completedTypes = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.challengeType) {
          completedTypes.add(data.challengeType);
        }
      });
      
      // Check which challenges are required (not empty)
      const memorizationRequired = !isChallengeEmpty(stage.memorization);
      const nearReviewRequired = !isChallengeEmpty(stage.nearReview);
      const farReviewRequired = !isChallengeEmpty(stage.farReview);
      
      // Check if all required challenges are completed
      const memorizationDone = !memorizationRequired || completedTypes.has('memorization');
      const nearReviewDone = !nearReviewRequired || completedTypes.has('near_review');
      const farReviewDone = !farReviewRequired || completedTypes.has('far_review');
      
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
            setChallengeRating(5);
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
            setChallengeRating(5);
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

  const resetForm = () => {
    setSelectedStudent(null);
    setStudentLevel(null);
    setStudentStage(null);
    setSelectedChallengeType('');
    setChallengeRating(5);
    setChallengeNotes('');
    setChallengePassed(true);
    setRecordDate(new Date().toISOString().split('T')[0]);
    setEditingId(null);
    setCompletedChallenges(new Set());
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
      await deleteDoc(doc(db, 'student_achievements', id));
      setAchievements((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Error deleting achievement:', error);
      showMessage('error', 'خطأ', 'حدث خطأ أثناء حذف البيانات. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleEditAchievement = (achievement: StudentAchievement) => {
    const student = students.find((s) => s.id === achievement.studentId);
    setSelectedStudent(student || null);
    setEditingId(achievement.id || null);
    
    if (student && curriculumLevels.length > 0) {
      const level = curriculumLevels.find(l => l.id === achievement.levelId);
      setStudentLevel(level || null);
      if (level) {
        const stage = level.stages.find(s => s.id === achievement.stageId);
        setStudentStage(stage || null);
      }
    }
    
    setSelectedChallengeType(achievement.challengeType || '');
    setChallengeRating(achievement.rating || 5);
    setChallengeNotes(achievement.notes || '');
    setChallengePassed(achievement.challengePassed ?? true);
    setRecordDate(achievement.date);
  };

  const filteredAchievements = achievements.filter((a) => {
    const matchesStudent = !filterStudent || a.studentId === filterStudent;
    const matchesSearch =
      !searchText ||
      a.studentName?.toLowerCase().includes(searchText.toLowerCase()) ||
      (a.challengeContent || a.portion || '').toLowerCase().includes(searchText.toLowerCase());
    return matchesStudent && matchesSearch;
  });

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
              {teacherGroups.map((group) => (
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
            onChange={handleStudentSelect}
            required
            disabled={isTeacher && !selectedGroupId}
          >
            <option value="">{isTeacher && !selectedGroupId ? 'اختر الحلقة أولاً' : 'اختر الطالب'}</option>
            {(isTeacher ? groupStudents : students).map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>

        {/* Student Level & Stage Info */}
        {selectedStudent && studentLevel && studentStage && (
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
              <div 
                className={`challenge-card memorization ${selectedChallengeType === 'memorization' ? 'selected' : ''} ${completedChallenges.has('memorization') ? 'completed' : ''}`}
                onClick={() => !completedChallenges.has('memorization') && setSelectedChallengeType('memorization')}
              >
                {completedChallenges.has('memorization') && <div className="completed-badge">✓</div>}
                <div className="challenge-icon">📖</div>
                <div className="challenge-title">الحفظ</div>
                <div className="challenge-content">{studentStage.memorization}</div>
                <div className="challenge-points">
                  {completedChallenges.has('memorization') ? '✅ مكتمل' : `${POINTS_SYSTEM.MEMORIZATION} نقطة`}
                </div>
              </div>
              
              {/* Near Review Challenge */}
              {(() => {
                const isEmpty = isChallengeEmpty(studentStage.nearReview);
                const isLocked = !completedChallenges.has('memorization') && !isEmpty;
                const isCompleted = completedChallenges.has('near_review');
                const isDisabled = isEmpty;
                
                return (
                  <div 
                    className={`challenge-card near-review ${selectedChallengeType === 'near_review' ? 'selected' : ''} ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isLocked && !isDisabled && !isCompleted && setSelectedChallengeType('near_review')}
                  >
                    {isCompleted && <div className="completed-badge">✓</div>}
                    {isLocked && <div className="lock-badge">🔒</div>}
                    <div className="challenge-icon">🔄</div>
                    <div className="challenge-title">المراجعة القريبة</div>
                    <div className="challenge-content">{studentStage.nearReview}</div>
                    <div className="challenge-points">
                      {isCompleted ? '✅ مكتمل' : isLocked ? 'أكمل الحفظ أولاً' : isDisabled ? 'لا يوجد' : `${POINTS_SYSTEM.NEAR_REVIEW} نقطة`}
                    </div>
                  </div>
                );
              })()}
              
              {/* Far Review Challenge */}
              {(() => {
                const nearReviewEmpty = isChallengeEmpty(studentStage.nearReview);
                const farReviewEmpty = isChallengeEmpty(studentStage.farReview);
                // If near review is empty, far review depends on memorization
                // Otherwise, it depends on near review
                const prerequisiteCompleted = nearReviewEmpty 
                  ? completedChallenges.has('memorization')
                  : completedChallenges.has('near_review');
                const isLocked = !prerequisiteCompleted && !farReviewEmpty;
                const isCompleted = completedChallenges.has('far_review');
                const isDisabled = farReviewEmpty;
                
                return (
                  <div 
                    className={`challenge-card far-review ${selectedChallengeType === 'far_review' ? 'selected' : ''} ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isLocked && !isDisabled && !isCompleted && setSelectedChallengeType('far_review')}
                  >
                    {isCompleted && <div className="completed-badge">✓</div>}
                    {isLocked && <div className="lock-badge">🔒</div>}
                    <div className="challenge-icon">📚</div>
                    <div className="challenge-title">المراجعة البعيدة</div>
                    <div className="challenge-content">{studentStage.farReview}</div>
                    <div className="challenge-points">
                      {isCompleted ? '✅ مكتمل' : isLocked ? (nearReviewEmpty ? 'أكمل الحفظ أولاً' : 'أكمل المراجعة القريبة أولاً') : isDisabled ? 'لا يوجد' : `${POINTS_SYSTEM.FAR_REVIEW} نقطة`}
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
            <p className="challenge-description">المحتوى: {getChallengeContent(selectedChallengeType)}</p>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="challengeRating">التقييم (1-10) *</label>
                <input
                  type="number"
                  id="challengeRating"
                  min="1"
                  max="10"
                  value={challengeRating}
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
                <h3>{achievement.studentName}</h3>
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
                <button
                  className="btn btn-sm btn-warning"
                  onClick={() => handleEditAchievement(achievement)}
                >
                  ✏️ تعديل
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteAchievement(achievement.id || '')}
                >
                  🗑️ حذف
                </button>
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
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => handleEditAchievement(achievement)}
                    >
                      تعديل
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteAchievement(achievement.id || '')}
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
