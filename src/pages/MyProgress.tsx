import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import '../styles/MyProgress.css';

import curriculum, { Level } from '../data/curriculumData';

interface Achievement {
  id: string;
  portion: string;
  fromAya: string;
  toAya: string;
  rating: number;
  notes?: string;
  assignmentPortion?: string;
  assignmentFromAya?: string;
  assignmentToAya?: string;
  date: string;
}

interface GroupInfo {
  name: string;
  trackName?: string;
  teacherName?: string;
}

const MyProgress = () => {
  const { isStudent, isParent, userProfile, isPendingApproval } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAchievements: 0,
    averageRating: 0,
    thisMonth: 0
  });

  // Calculate Progress Percentage
  const currentLevelId = userProfile?.levelId || 1;
  const currentLevel = curriculum.find(l => l.id === currentLevelId);
  const currentPartId = userProfile?.partId;
  
  let progressPercentage = 0;
  if (currentLevel) {
    const totalParts = currentLevel.parts.length;
    const currentPartIndex = currentLevel.parts.findIndex(p => p.id === currentPartId);
    if (currentPartIndex !== -1) {
      progressPercentage = Math.round(((currentPartIndex) / totalParts) * 100);
    }
  }

  useEffect(() => {
    if (userProfile?.uid) {
      fetchMyProgress();
    }
  }, [userProfile]);

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
            name: groupData.name,
            trackName,
            teacherName
          });
        }
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingStars = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'excellent';
    if (rating >= 3) return 'good';
    if (rating >= 2) return 'average';
    return 'needs-improvement';
  };

  if (!isStudent && !isParent) {
    return <Navigate to="/dashboard" replace />;
  }

  // إذا كان الطالب في حالة انتظار الموافقة
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
        </div>
      )}

      {/* الإحصائيات */}
      {/* Journey Map Section */}
      <div className="journey-section" style={{ marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>🗺️ رحلة الحفظ</h2>
        
        {/* Current Status Banner */}
        <div className="status-banner" style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#0284c7' }}>{currentLevel?.name || 'المستوى الأول'}</h3>
              <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>{currentLevel?.description}</p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>نسبة إنجاز المستوى</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '150px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercentage}%`, height: '100%', background: '#0ea5e9', borderRadius: '4px' }}></div>
                </div>
                <span style={{ fontWeight: 'bold', color: '#0ea5e9' }}>{progressPercentage}%</span>
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

        {/* Levels Timeline */}
        <div className="levels-timeline" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '2rem 0' }}>
          {/* Connecting Line */}
          <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '4px', background: '#e2e8f0', zIndex: 0, transform: 'translateY(-50%)' }}></div>
          
          {curriculum.map((level) => {
            const isCompleted = (userProfile?.completedLevels || 0) >= level.id;
            const isCurrent = (userProfile?.levelId || 1) === level.id;
            const isLocked = !isCompleted && !isCurrent;
            
            return (
              <div key={level.id} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '120px' }}>
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
                  {isCompleted ? '✓' : level.id}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: isLocked ? '#94a3b8' : '#334155', fontSize: '0.9rem' }}>{level.name}</div>
                  {isCurrent && <span className="badge badge--primary" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>الحالي</span>}
                </div>
              </div>
            );
          })}
        </div>
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
                  <span className={`rating-badge ${getRatingColor(achievement.rating)}`}>
                    {getRatingStars(achievement.rating)}
                  </span>
                </div>

                <div className="achievement-content">
                  <div className="portion-info">
                    <span className="portion-label">المقدار المحفوظ:</span>
                    <span className="portion-value">
                      {achievement.portion} (الآيات {achievement.fromAya} - {achievement.toAya})
                    </span>
                  </div>

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