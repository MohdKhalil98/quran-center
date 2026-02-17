import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { quranCurriculum, QuranJuz, QuranSurah } from '../data/quranCurriculum';
import { useMessaging } from '../hooks/useMessaging';
import '../styles/MyProgress.css';

// Adapted interfaces for Quran curriculum
interface CurriculumStage {
  id: string;
  name: string;
  order: number;
  memorization: string;
  nearReview: string;
  farReview: string;
  ayahCount?: number;
}

interface CurriculumLevel {
  id: string;
  name: string;
  order: number;
  stages: CurriculumStage[];
  juzNumber?: number;
}

interface Achievement {
  id: string;
  // Legacy fields
  portion?: string;
  fromAya?: string;
  toAya?: string;
  rating: number;
  notes?: string;
  assignmentPortion?: string;
  assignmentFromAya?: string;
  assignmentToAya?: string;
  date: string;
  // New challenge system fields
  challengeType?: 'memorization' | 'near_review' | 'far_review';
  challengeContent?: string;
  challengePassed?: boolean;
  levelId?: string;
  levelName?: string;
  stageId?: string;
  stageName?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  trackName?: string;
  teacherName?: string;
  teacherId?: string;
}

const MyProgress = () => {
  const { isStudent, isParent, userProfile, isPendingApproval } = useAuth();
  const { findOrCreateConversation } = useMessaging();
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [centerName, setCenterName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);
  const [stats, setStats] = useState({
    totalAchievements: 0,
    averageRating: 0,
    thisMonth: 0
  });
  
  // New curriculum from Firebase
  const [curriculumLevels, setCurriculumLevels] = useState<CurriculumLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<CurriculumLevel | null>(null);
  const [currentStage, setCurrentStage] = useState<CurriculumStage | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set());
  const [challengeProgress, setChallengeProgress] = useState<{
    memorization: { completed: number; total: number; remaining: number };
    near_review: { completed: number; total: number; remaining: number };
    far_review: { completed: number; total: number; remaining: number };
  }>({
    memorization: { completed: 0, total: 0, remaining: 0 },
    near_review: { completed: 0, total: 0, remaining: 0 },
    far_review: { completed: 0, total: 0, remaining: 0 }
  });
  const [currentRequiredChallenge, setCurrentRequiredChallenge] = useState<string>('');

  // ========== المشاركة في الفترة الدراسية ==========
  const [activePeriod, setActivePeriod] = useState<{
    id: string;
    name: string;
    startDate: Timestamp;
    endDate: Timestamp;
    subscriptionFee: number;
    currency: string;
    paymentDeadline?: Timestamp;
  } | null>(null);
  const [participationStatus, setParticipationStatus] = useState<'participating' | 'not_participating' | 'pending'>('pending');
  const [participationStatusId, setParticipationStatusId] = useState<string>('');
  const [updatingParticipation, setUpdatingParticipation] = useState(false);

  useEffect(() => {
    if (userProfile?.uid) {
      fetchCurriculum();
      fetchMyProgress();
      fetchActivePeriod();
      // جلب اسم المركز
      if (userProfile?.centerId) {
        getDoc(doc(db, 'centers', userProfile.centerId)).then(centerDoc => {
          if (centerDoc.exists()) {
            setCenterName(centerDoc.data().name);
          }
        });
      }
    }
  }, [userProfile]);

  // Convert QuranJuz to CurriculumLevel format
  const convertToCurriculumLevel = (juz: QuranJuz, index: number): CurriculumLevel => {
    const stages: CurriculumStage[] = juz.surahs.map((surah, surahIndex) => {
      // Get previous surah for near review
      const prevSurah = surahIndex > 0 ? juz.surahs[surahIndex - 1] : null;
      // Get surah 2 positions back for far review  
      const farSurah = surahIndex > 1 ? juz.surahs[surahIndex - 2] : null;
      
      return {
        id: surah.id,
        name: `سورة ${surah.name}`,
        order: surah.order,
        memorization: `سورة ${surah.name} (${surah.ayahCount} آية)`,
        nearReview: prevSurah ? `سورة ${prevSurah.name}` : 'لا يوجد',
        farReview: farSurah ? `سورة ${farSurah.name}` : 'لا يوجد',
        ayahCount: surah.ayahCount
      };
    });

    return {
      id: juz.id,
      name: juz.name,
      order: juz.order,
      stages,
      juzNumber: juz.juzNumber
    };
  };

  // Fetch curriculum from local data
  const fetchCurriculum = async () => {
    try {
      // Convert quranCurriculum to CurriculumLevel format
      const levels: CurriculumLevel[] = quranCurriculum.map((juz, index) => 
        convertToCurriculumLevel(juz, index)
      );
      
      setCurriculumLevels(levels);
      
      // Find current level and stage based on user's levelId/stageId
      if (levels.length > 0) {
        const level = levels.find(l => l.id === userProfile?.levelId) || levels[0];
        setCurrentLevel(level);
        
        if (level.stages && level.stages.length > 0) {
          const stage = level.stages.find(s => s.id === userProfile?.stageId) || level.stages[0];
          setCurrentStage(stage);
          
          // Fetch completed challenges for current stage from Firebase
          if (userProfile?.uid) {
            const achievementsQuery = query(
              collection(db, 'student_achievements'),
              where('studentId', '==', userProfile.uid),
              where('stageId', '==', stage.id),
              where('challengePassed', '==', true)
            );
            const achievementsSnap = await getDocs(achievementsQuery);
            const completed = new Set<string>();
            
            // Track ayah progress for each challenge type
            const ayahProgress: {
              memorization: Set<number>;
              near_review: Set<number>;
              far_review: Set<number>;
            } = {
              memorization: new Set(),
              near_review: new Set(),
              far_review: new Set()
            };
            
            achievementsSnap.forEach(doc => {
              const data = doc.data();
              if (data.challengeType && data.fromAya && data.toAya) {
                const from = parseInt(data.fromAya);
                const to = parseInt(data.toAya);
                for (let i = from; i <= to; i++) {
                  if (data.challengeType === 'memorization') {
                    ayahProgress.memorization.add(i);
                  } else if (data.challengeType === 'near_review') {
                    ayahProgress.near_review.add(i);
                  } else if (data.challengeType === 'far_review') {
                    ayahProgress.far_review.add(i);
                  }
                }
              }
            });
            
            const totalAyahs = stage.ayahCount || 0;
            
            // Calculate progress for each challenge
            const progress = {
              memorization: {
                completed: ayahProgress.memorization.size,
                total: totalAyahs,
                remaining: Math.max(0, totalAyahs - ayahProgress.memorization.size)
              },
              near_review: {
                completed: ayahProgress.near_review.size,
                total: totalAyahs,
                remaining: Math.max(0, totalAyahs - ayahProgress.near_review.size)
              },
              far_review: {
                completed: ayahProgress.far_review.size,
                total: totalAyahs,
                remaining: Math.max(0, totalAyahs - ayahProgress.far_review.size)
              }
            };
            
            setChallengeProgress(progress);
            
            // Mark challenges as completed if all ayahs are done
            if (progress.memorization.remaining === 0 && progress.memorization.completed > 0) {
              completed.add('memorization');
            }
            if (progress.near_review.remaining === 0 && progress.near_review.completed > 0) {
              completed.add('near_review');
            }
            if (progress.far_review.remaining === 0 && progress.far_review.completed > 0) {
              completed.add('far_review');
            }
            
            setCompletedChallenges(completed);
            
            // Determine current required challenge
            const nearReviewEmpty = !stage.nearReview || stage.nearReview === '-' || stage.nearReview === 'لا يوجد';
            const farReviewEmpty = !stage.farReview || stage.farReview === '-' || stage.farReview === 'لا يوجد';
            
            if (progress.memorization.remaining > 0) {
              setCurrentRequiredChallenge('memorization');
            } else if (!nearReviewEmpty && progress.near_review.remaining > 0) {
              setCurrentRequiredChallenge('near_review');
            } else if (!farReviewEmpty && progress.far_review.remaining > 0) {
              setCurrentRequiredChallenge('far_review');
            } else {
              setCurrentRequiredChallenge('completed');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading curriculum:', error);
    }
  };

  // Calculate progress percentage based on stages
  const calculateProgress = (): number => {
    if (!currentLevel || !currentStage || !currentLevel.stages) return 0;
    const totalStages = currentLevel.stages.length;
    const currentStageIndex = currentLevel.stages.findIndex(s => s.id === currentStage.id);
    if (currentStageIndex === -1) return 0;
    return Math.round((currentStageIndex / totalStages) * 100);
  };

  const getChallengeLabel = (type: string): string => {
    switch (type) {
      case 'memorization': return '📖 الحفظ';
      case 'near_review': return '🔄 المراجعة القريبة';
      case 'far_review': return '📚 المراجعة البعيدة';
      default: return type;
    }
  };

  const isChallengeEmpty = (value: string): boolean => {
    if (!value) return true;
    const emptyValues = ['-', 'لا يوجد', 'لايوجد', '', 'null', 'undefined'];
    return emptyValues.includes(value.trim().toLowerCase()) || value.trim() === '';
  };

  const fetchMyProgress = async () => {
    if (!userProfile?.uid) return;

    try {
      // جلب التحصيلات - بدون orderBy لتجنب مشاكل composite index
      const achievementsQuery = query(
        collection(db, 'student_achievements'),
        where('studentId', '==', userProfile.uid)
      );
      const achievementsSnap = await getDocs(achievementsQuery);
      let achievementsList = achievementsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Achievement));

      // ترتيب التحصيلات محلياً حسب التاريخ (الأحدث أولاً)
      achievementsList.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });

      setAchievements(achievementsList);

      // حساب الإحصائيات
      if (achievementsList.length > 0) {
        const avgRating = achievementsList.reduce((acc, a) => acc + a.rating, 0) / achievementsList.length;
        const thisMonth = achievementsList.filter(a => {
          const achievementDate = new Date(a.date);
          const now = new Date();
          return achievementDate.getMonth() === now.getMonth() && 
                 achievementDate.getFullYear() === now.getFullYear();
        }).length;

        setStats({
          totalAchievements: achievementsList.length,
          averageRating: Math.round(avgRating * 10) / 10,
          thisMonth: thisMonth
        });
      }

      // جلب معلومات الحلقة إذا كان الطالب منضم لحلقة
      if (userProfile.groupId) {
        const groupDoc = await getDoc(doc(db, 'groups', userProfile.groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          
          // جلب اسم المسار
          let trackName = '';
          if (groupData.trackId) {
            const trackDoc = await getDoc(doc(db, 'tracks', groupData.trackId));
            if (trackDoc.exists()) {
              trackName = trackDoc.data().name;
            }
          }

          // جلب اسم المعلم
          let teacherName = '';
          if (groupData.teacherId) {
            const teacherDoc = await getDoc(doc(db, 'users', groupData.teacherId));
            if (teacherDoc.exists()) {
              teacherName = teacherDoc.data().name;
            }
          }

          setGroupInfo({
            id: userProfile.groupId,
            name: groupData.name,
            trackName,
            teacherName,
            teacherId: groupData.teacherId
          });
        }
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  // جلب الفترة الدراسية النشطة وحالة المشاركة
  const fetchActivePeriod = async () => {
    if (!userProfile?.uid) return;
    try {
      // جلب الفترات النشطة
      const periodsQuery = query(
        collection(db, 'studyPeriods'),
        where('isActive', '==', true)
      );
      const periodsSnap = await getDocs(periodsQuery);
      
      if (periodsSnap.empty) {
        setActivePeriod(null);
        return;
      }

      // البحث عن فترة المركز أو الفترة العامة
      let matchedPeriod: any = null;
      periodsSnap.forEach(docSnap => {
        const data = docSnap.data();
        const period = { id: docSnap.id, ...data };
        // الفترة الخاصة بالمركز أولاً
        if (data.centerId && data.centerId === userProfile.centerId) {
          matchedPeriod = period;
        }
        // الفترة العامة إذا لم تكن هناك فترة خاصة
        if (!matchedPeriod && !data.centerId) {
          matchedPeriod = period;
        }
      });

      if (matchedPeriod) {
        setActivePeriod({
          id: matchedPeriod.id,
          name: matchedPeriod.name,
          startDate: matchedPeriod.startDate,
          endDate: matchedPeriod.endDate,
          subscriptionFee: matchedPeriod.subscriptionFee || 0,
          currency: matchedPeriod.currency || 'دينار بحريني',
          paymentDeadline: matchedPeriod.paymentDeadline
        });

        // جلب حالة مشاركة الطالب
        const statusQuery = query(
          collection(db, 'studentPeriodStatuses'),
          where('studentId', '==', userProfile.uid),
          where('periodId', '==', matchedPeriod.id)
        );
        const statusSnap = await getDocs(statusQuery);
        if (!statusSnap.empty) {
          const statusDoc = statusSnap.docs[0];
          const statusData = statusDoc.data();
          setParticipationStatus(statusData.participation || 'pending');
          setParticipationStatusId(statusDoc.id);
        }
      }
    } catch (error) {
      console.error('Error fetching active period:', error);
    }
  };

  // تحديث حالة المشاركة
  const updateParticipation = async (newStatus: 'participating' | 'not_participating') => {
    if (!participationStatusId) return;
    setUpdatingParticipation(true);
    try {
      await updateDoc(doc(db, 'studentPeriodStatuses', participationStatusId), {
        participation: newStatus,
        updatedAt: Timestamp.now()
      });
      setParticipationStatus(newStatus);
    } catch (error) {
      console.error('Error updating participation:', error);
      alert('حدث خطأ أثناء تحديث حالة المشاركة');
    }
    setUpdatingParticipation(false);
  };

  if (!isStudent && !isParent) {
    return <Navigate to="/dashboard" replace />;
  }

  // إذا كان الطالب في حالة انتظار الموافقة أو تحديد المستوى
  if (isPendingApproval) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>تقدمي</h1>
        </header>
        <div className="pending-approval-message">
          <div className="pending-icon">⏳</div>
          <h2>طلبك قيد المراجعة</h2>
          <p>يتم مراجعة طلب انضمامك من قبل المشرف.</p>
          <p>سيتم إشعارك فور الموافقة على طلبك.</p>
        </div>
      </section>
    );
  }

  // إذا كان الطالب في انتظار تحديد المستوى من المعلم
  if (userProfile?.status === 'waiting_teacher_approval') {
    return (
      <section className="page">
        <header className="page__header">
          <h1>تقدمي</h1>
        </header>
        <div className="pending-approval-message">
          <div className="pending-icon">📚</div>
          <h2>مبارك! لقد اجتزت المقابلة بنجاح 🎉</h2>
          <p>أنت الآن طالب في <strong>{centerName || 'مركز تحفيظ القرآن الكريم'}</strong></p>
          <p style={{ marginTop: '15px', color: '#1976d2' }}>
            <strong>⏳ في انتظار تحديد مستواك من قبل المعلم</strong>
          </p>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            سيقوم المعلم بتحديد المستوى المناسب لك قريباً، وستتمكن من متابعة تقدمك.
          </p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>تقدمي</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>تقدمي في الحفظ</h1>
        <p>متابعة تحصيلي وإنجازاتي في حفظ القرآن الكريم</p>
      </header>

      {/* بطاقة المشاركة في الفترة الدراسية */}
      {activePeriod && (
        <div className="participation-card">
          <div className="participation-card-header">
            <span className="participation-icon">📅</span>
            <div>
              <h3>{activePeriod.name}</h3>
              <p className="participation-period-info">
                رسوم الاشتراك: {activePeriod.subscriptionFee} {activePeriod.currency}
                {activePeriod.paymentDeadline && (
                  <> | آخر يوم للدفع: {activePeriod.paymentDeadline.toDate().toLocaleDateString('ar-BH')}</>
                )}
              </p>
            </div>
          </div>

          <div className="participation-status-section">
            {participationStatus === 'pending' ? (
              <>
                <p className="participation-question">هل ترغب في المشاركة في هذه الفترة الدراسية؟</p>
                <div className="participation-buttons">
                  <button
                    className="btn-participate yes"
                    onClick={() => updateParticipation('participating')}
                    disabled={updatingParticipation}
                  >
                    {updatingParticipation ? '⏳' : '✅'} نعم، أريد المشاركة
                  </button>
                  <button
                    className="btn-participate no"
                    onClick={() => updateParticipation('not_participating')}
                    disabled={updatingParticipation}
                  >
                    {updatingParticipation ? '⏳' : '❌'} لا، لن أشارك
                  </button>
                </div>
              </>
            ) : (
              <div className="participation-current-status">
                <span className={`participation-badge ${participationStatus}`}>
                  {participationStatus === 'participating' ? '✅ أنت مشارك في هذه الفترة' : '❌ أنت غير مشارك في هذه الفترة'}
                </span>
                <button
                  className="btn-change-participation"
                  onClick={() => updateParticipation(participationStatus === 'participating' ? 'not_participating' : 'participating')}
                  disabled={updatingParticipation}
                >
                  {updatingParticipation ? '⏳ جاري التحديث...' : '🔄 تغيير'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* معلومات الحلقة */}
      {groupInfo && (
        <div className="group-info-card">
          <div className="group-info-header">
            <span className="group-icon">📚</span>
            <div>
              <h3>{groupInfo.name}</h3>
              {groupInfo.trackName && <span className="track-name">{groupInfo.trackName}</span>}
            </div>
          </div>
          {groupInfo.teacherName && (
            <div className="teacher-info">
              <span className="teacher-icon">👨‍🏫</span>
              <span>المعلم: {groupInfo.teacherName}</span>
            </div>
          )}
          <button 
            className="btn-group-chat"
            onClick={async () => {
              if (!groupInfo.teacherId) return;
              setOpeningChat(true);
              try {
                // فتح محادثة مباشرة مع المعلم
                const conversationId = await findOrCreateConversation({
                  type: 'direct',
                  participantId: groupInfo.teacherId
                });
                if (conversationId) {
                  navigate(`/messages/${conversationId}`);
                }
              } catch (error) {
                console.error('Error opening chat:', error);
              }
              setOpeningChat(false);
            }}
            disabled={openingChat || !groupInfo.teacherId}
          >
            {openingChat ? '⏳ جاري الفتح...' : '💬 مراسلة المعلم'}
          </button>
        </div>
      )}

      {/* Current Required Challenge Banner */}
      {currentStage && currentRequiredChallenge && currentRequiredChallenge !== 'completed' && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '16px',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>
              {currentRequiredChallenge === 'memorization' ? '📖' : currentRequiredChallenge === 'near_review' ? '🔄' : '📚'}
            </span>
            <div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>التحدي المطلوب الآن</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                {currentRequiredChallenge === 'memorization' ? 'الحفظ' : currentRequiredChallenge === 'near_review' ? 'المراجعة القريبة' : 'المراجعة البعيدة'}
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '10px' }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: '500' }}>
              {currentRequiredChallenge === 'memorization' && currentStage.memorization}
              {currentRequiredChallenge === 'near_review' && currentStage.nearReview}
              {currentRequiredChallenge === 'far_review' && currentStage.farReview}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span>
                ✅ مكتمل: {challengeProgress[currentRequiredChallenge as keyof typeof challengeProgress]?.completed || 0} آية
              </span>
              <span style={{ background: 'rgba(255,255,255,0.3)', padding: '0.25rem 0.75rem', borderRadius: '20px', fontWeight: 'bold' }}>
                ⏳ متبقي: {challengeProgress[currentRequiredChallenge as keyof typeof challengeProgress]?.remaining || 0} آية
              </span>
            </div>
          </div>
        </div>
      )}

      {/* All Challenges Completed */}
      {currentRequiredChallenge === 'completed' && (
        <div style={{
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '16px',
          marginBottom: '1.5rem',
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(34, 197, 94, 0.4)'
        }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🎉</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>أحسنت! أكملت جميع تحديات هذه المرحلة</div>
          <div style={{ marginTop: '0.5rem', opacity: 0.9 }}>انتظر انتقالك للمرحلة التالية</div>
        </div>
      )}

      {/* Journey Map Section - Using Firebase Curriculum */}
      <div className="journey-section" style={{ marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>🗺️ رحلة الحفظ</h2>
        
        {/* Current Status Banner */}
        <div className="status-banner" style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#0284c7' }}>{currentLevel?.name || 'المستوى الأول'}</h3>
              <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>
                المرحلة الحالية: {currentStage?.name || 'غير محددة'}
              </p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>نسبة إنجاز المستوى</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '150px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${calculateProgress()}%`, height: '100%', background: '#0ea5e9', borderRadius: '4px' }}></div>
                </div>
                <span style={{ fontWeight: 'bold', color: '#0ea5e9' }}>{calculateProgress()}%</span>
              </div>
            </div>
          </div>
          
          {userProfile?.levelStatus === 'pending_supervisor' && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '6px', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⏳</span>
              <strong>بانتظار اعتماد المشرف للانتقال للمستوى التالي</strong>
            </div>
          )}
        </div>

        {/* Current Stage Challenges */}
        {currentStage && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#334155' }}>🎯 تحديات المرحلة الحالية: {currentStage.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {/* Memorization Challenge */}
              <div style={{
                padding: '1rem',
                borderRadius: '8px',
                background: completedChallenges.has('memorization') ? '#dcfce7' : 
                            challengeProgress.memorization.completed > 0 ? '#fff7ed' : '#f8fafc',
                border: completedChallenges.has('memorization') ? '2px solid #22c55e' : 
                        challengeProgress.memorization.completed > 0 ? '2px solid #f97316' : '2px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>📖</span>
                  <span style={{ fontWeight: 'bold' }}>الحفظ</span>
                  {completedChallenges.has('memorization') && <span style={{ color: '#22c55e' }}>✓</span>}
                  {!completedChallenges.has('memorization') && challengeProgress.memorization.completed > 0 && <span style={{ color: '#f97316' }}>⏳</span>}
                </div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{currentStage.memorization}</p>
                {completedChallenges.has('memorization') ? (
                  <p style={{ margin: '0.5rem 0 0', color: '#22c55e', fontSize: '0.85rem', fontWeight: '500' }}>✅ مكتمل</p>
                ) : challengeProgress.memorization.completed > 0 ? (
                  <p style={{ margin: '0.5rem 0 0', color: '#f97316', fontSize: '0.85rem', fontWeight: '500' }}>
                    ⏳ متبقي {challengeProgress.memorization.remaining} آية من {challengeProgress.memorization.total}
                  </p>
                ) : null}
              </div>
              
              {/* Near Review Challenge */}
              {!isChallengeEmpty(currentStage.nearReview) && (
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: completedChallenges.has('near_review') ? '#dcfce7' : 
                              challengeProgress.near_review.completed > 0 ? '#fff7ed' : '#f8fafc',
                  border: completedChallenges.has('near_review') ? '2px solid #22c55e' : 
                          challengeProgress.near_review.completed > 0 ? '2px solid #f97316' : '2px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🔄</span>
                    <span style={{ fontWeight: 'bold' }}>المراجعة القريبة</span>
                    {completedChallenges.has('near_review') && <span style={{ color: '#22c55e' }}>✓</span>}
                    {!completedChallenges.has('near_review') && challengeProgress.near_review.completed > 0 && <span style={{ color: '#f97316' }}>⏳</span>}
                  </div>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{currentStage.nearReview}</p>
                  {completedChallenges.has('near_review') ? (
                    <p style={{ margin: '0.5rem 0 0', color: '#22c55e', fontSize: '0.85rem', fontWeight: '500' }}>✅ مكتمل</p>
                  ) : challengeProgress.near_review.completed > 0 ? (
                    <p style={{ margin: '0.5rem 0 0', color: '#f97316', fontSize: '0.85rem', fontWeight: '500' }}>
                      ⏳ متبقي {challengeProgress.near_review.remaining} آية من {challengeProgress.near_review.total}
                    </p>
                  ) : null}
                </div>
              )}
              
              {/* Far Review Challenge */}
              {!isChallengeEmpty(currentStage.farReview) && (
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: completedChallenges.has('far_review') ? '#dcfce7' : 
                              challengeProgress.far_review.completed > 0 ? '#fff7ed' : '#f8fafc',
                  border: completedChallenges.has('far_review') ? '2px solid #22c55e' : 
                          challengeProgress.far_review.completed > 0 ? '2px solid #f97316' : '2px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>📚</span>
                    <span style={{ fontWeight: 'bold' }}>المراجعة البعيدة</span>
                    {completedChallenges.has('far_review') && <span style={{ color: '#22c55e' }}>✓</span>}
                    {!completedChallenges.has('far_review') && challengeProgress.far_review.completed > 0 && <span style={{ color: '#f97316' }}>⏳</span>}
                  </div>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{currentStage.farReview}</p>
                  {completedChallenges.has('far_review') ? (
                    <p style={{ margin: '0.5rem 0 0', color: '#22c55e', fontSize: '0.85rem', fontWeight: '500' }}>✅ مكتمل</p>
                  ) : challengeProgress.far_review.completed > 0 ? (
                    <p style={{ margin: '0.5rem 0 0', color: '#f97316', fontSize: '0.85rem', fontWeight: '500' }}>
                      ⏳ متبقي {challengeProgress.far_review.remaining} آية من {challengeProgress.far_review.total}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Levels Timeline - From Firebase */}
        {curriculumLevels.length > 0 && (
          <div className="levels-timeline" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '2rem 0', overflowX: 'auto' }}>
            {/* Connecting Line */}
            <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '4px', background: '#e2e8f0', zIndex: 0, transform: 'translateY(-50%)' }}></div>
            
            {curriculumLevels.map((level, index) => {
              const isCompleted = (userProfile?.completedLevels || 0) >= level.order;
              const isCurrent = currentLevel?.id === level.id;
              const isLocked = !isCompleted && !isCurrent;
              
              return (
                <div key={level.id} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    background: isCompleted ? '#22c55e' : (isCurrent ? '#3b82f6' : '#cbd5e1'),
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    border: isCurrent ? '4px solid #dbeafe' : '4px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: isLocked ? '#94a3b8' : '#334155', fontSize: '0.85rem' }}>{level.name}</div>
                    {isCurrent && <span className="badge badge--primary" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>الحالي</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📖</div>
          <div className="stat-value">{stats.totalAchievements}</div>
          <div className="stat-label">إجمالي التحصيلات</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{stats.averageRating}</div>
          <div className="stat-label">متوسط التقييم</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{stats.thisMonth}</div>
          <div className="stat-label">هذا الشهر</div>
        </div>
      </div>

      {/* قائمة التحصيلات */}
      <div className="achievements-section">
        <h2>سجل التحصيل</h2>

        {achievements.length === 0 ? (
          <div className="no-achievements">
            <div className="no-achievements-icon">📝</div>
            <h3>لا توجد تحصيلات مسجلة</h3>
            <p>سيتم عرض تحصيلاتك هنا بعد تسجيلها من قبل المعلم</p>
          </div>
        ) : (
          <div className="achievements-list">
            {achievements.map(achievement => {
              const date = new Date(achievement.date);
              const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
              const dayName = dayNames[date.getDay()];
              const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
              
              return (
              <div key={achievement.id} className="achievement-card">
                <div className="achievement-header">
                  <span className="achievement-date">
                    {dayName} - {formattedDate}
                  </span>
                  <span className="rating-badge">
                    {achievement.rating}/10 ⭐
                  </span>
                </div>

                <div className="achievement-content">
                  {/* New Challenge System Display */}
                  {achievement.challengeType ? (
                    <>
                      <div className="portion-info">
                        <span className="portion-label">نوع التحدي:</span>
                        <span className="portion-value challenge-type-badge">
                          {getChallengeLabel(achievement.challengeType)}
                        </span>
                      </div>
                      
                      {achievement.levelName && (
                        <div className="portion-info">
                          <span className="portion-label">المستوى:</span>
                          <span className="portion-value">{achievement.levelName}</span>
                        </div>
                      )}
                      
                      {achievement.stageName && (
                        <div className="portion-info">
                          <span className="portion-label">المرحلة:</span>
                          <span className="portion-value">{achievement.stageName}</span>
                        </div>
                      )}
                      
                      {achievement.challengeContent && (
                        <div className="portion-info">
                          <span className="portion-label">المحتوى:</span>
                          <span className="portion-value">{achievement.challengeContent}</span>
                        </div>
                      )}
                      
                      <div className="portion-info">
                        <span className="portion-label">النتيجة:</span>
                        <span className={`portion-value status-badge ${achievement.challengePassed !== false ? 'passed' : 'retry'}`}>
                          {achievement.challengePassed !== false ? '✅ ناجح' : '🔄 إعادة'}
                        </span>
                      </div>
                    </>
                  ) : (
                    /* Legacy Display */
                    <div className="portion-info">
                      <span className="portion-label">المقدار المحفوظ:</span>
                      <span className="portion-value">
                        {achievement.portion} {achievement.fromAya && `(الآيات ${achievement.fromAya} - ${achievement.toAya})`}
                      </span>
                    </div>
                  )}

                  {achievement.notes && (
                    <div className="teacher-notes">
                      <span className="notes-label">💬 ملاحظات المعلم:</span>
                      <p className="notes-value">{achievement.notes}</p>
                    </div>
                  )}

                  {achievement.assignmentPortion && (
                    <div className="assignment-info">
                      <span className="assignment-label">📝 الواجب:</span>
                      <span className="assignment-value">
                        {achievement.assignmentPortion} 
                        {achievement.assignmentFromAya && ` (${achievement.assignmentFromAya} - ${achievement.assignmentToAya})`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default MyProgress;