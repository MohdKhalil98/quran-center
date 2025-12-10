import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import '../styles/MyProgress.css';

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