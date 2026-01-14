import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: string[]; // الأدوار المسموح لها بالوصول
  showBadge?: boolean; // لإظهار عداد
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'لوحة التحكم', icon: '📊', roles: ['admin', 'supervisor', 'teacher'] },
  // صفحات المطور فقط
  { path: '/centers', label: 'مراكز القرآن', icon: '🏫', roles: ['admin'] },
  { path: '/batch-import', label: 'استيراد جماعي', icon: '📦', roles: ['admin'] },
  { path: '/teachers', label: 'المعلمون', icon: '👨‍🏫', roles: ['admin'] },
  { path: '/students', label: 'الطلاب', icon: '👨‍🎓', roles: ['admin'] },
  // صفحات المشرف
  { path: '/pending-requests', label: 'طلبات الانتظار', icon: '⏳', roles: ['supervisor'], showBadge: true },
  { path: '/tracks', label: 'المساقات', icon: '📋', roles: ['supervisor'] },
  { path: '/groups', label: 'المجموعات', icon: '👥', roles: ['supervisor'] },
  { path: '/teachers', label: 'المعلمون', icon: '👨‍🏫', roles: ['supervisor'] },
  { path: '/students', label: 'الطلاب', icon: '👨‍🎓', roles: ['supervisor'] },
  // صفحات المعلم
  { path: '/groups', label: 'حلقاتي', icon: '👥', roles: ['teacher'] },
  { path: '/students', label: 'طلابي', icon: '👨‍🎓', roles: ['teacher'] },
  { path: '/attendance', label: 'تسجيل الحضور', icon: '✅', roles: ['teacher'] },
  { path: '/achievements', label: 'تحصيل الطالب', icon: '🏆', roles: ['teacher'] },
  // صفحات الطالب
  { path: '/my-progress', label: 'تحصيلي', icon: '📈', roles: ['student'] },
  // صفحات عامة
  { path: '/messages', label: 'الرسائل', icon: '💬', roles: ['admin', 'supervisor', 'teacher', 'student', 'parent'], showBadge: true },
  { path: '/curriculum', label: 'المنهج', icon: '📚', roles: ['supervisor', 'teacher', 'student'] },
  { path: '/leaderboard', label: 'المتصدرين', icon: '🥇', roles: ['supervisor', 'teacher', 'student'] }
];

const Sidebar = () => {
  const { logout, isAdmin, userProfile, isSupervisor, activeRole, availableRoles, switchRole, hasMultipleRoles, getSupervisorCenterIds } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [newStudentsCount, setNewStudentsCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const location = useLocation();

  // إغلاق القائمة عند تغيير الصفحة
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // منع التمرير عند فتح القائمة
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!isSupervisor) return;
      const centerIds = getSupervisorCenterIds();
      if (centerIds.length === 0) return;
      
      try {
        // جلب الطلاب في المراكز المخصصة ثم تصفيتهم
        let totalPending = 0;
        for (const centerId of centerIds) {
          const studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('centerId', '==', centerId)
          );
          const snapshot = await getDocs(studentsQuery);
          // عد الطلاب الذين حالتهم pending_registration فقط
          const pendingRegistrations = snapshot.docs.filter(doc => 
            doc.data().status === 'pending_registration'
          );
          totalPending += pendingRegistrations.length;
        }
        setPendingCount(totalPending);
      } catch (error) {
        console.error('Error fetching pending count:', error);
      }
    };

    fetchPendingCount();
    // تحديث كل 30 ثانية
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [isSupervisor, userProfile]);

  // جلب عدد الطلاب الجدد (للمعلمين فقط)
  useEffect(() => {
    if (!userProfile?.uid || userProfile.role !== 'teacher') return;

    const fetchNewStudentsCount = async () => {
      try {
        // جلب الحلقات التي يدرسها المعلم
        const groupsQuery = query(
          collection(db, 'groups'),
          where('teacherId', '==', userProfile.uid)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupIds = groupsSnapshot.docs.map(doc => doc.id);

        if (groupIds.length === 0) {
          setNewStudentsCount(0);
          return;
        }

        // جلب الطلاب الجدد الذين في هذه الحلقات
        let totalNewStudents = 0;
        for (const groupId of groupIds) {
          const newStudentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('status', '==', 'waiting_teacher_approval'),
            where('groupId', '==', groupId)
          );
          const snapshot = await getDocs(newStudentsQuery);
          totalNewStudents += snapshot.docs.length;
        }

        setNewStudentsCount(totalNewStudents);
      } catch (error) {
        console.error('Error fetching new students count:', error);
      }
    };

    fetchNewStudentsCount();
    // تحديث كل 30 ثانية
    const interval = setInterval(fetchNewStudentsCount, 30000);
    return () => clearInterval(interval);
  }, [userProfile?.uid, userProfile?.role]);

  // جلب عدد الرسائل غير المقروءة
  useEffect(() => {
    if (!userProfile?.uid) return;

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userProfile.uid)
    );

    const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
      let totalUnread = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.unreadCount && data.unreadCount[userProfile.uid]) {
          totalUnread += data.unreadCount[userProfile.uid];
        }
      });
      setUnreadMessagesCount(totalUnread);
    });

    return () => unsubscribe();
  }, [userProfile?.uid]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  };

  const canViewItem = (item: NavItem): boolean => {
    // صفحات بدون تحديد أدوار = للجميع
    if (!item.roles) return true;

    // التحقق من الصلاحية النشطة
    if (!activeRole) return false;
    return item.roles.includes(activeRole);
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'admin': return 'مطور';
      case 'supervisor': return 'مشرف';
      case 'teacher': return 'معلم';
      case 'student': return 'طالب';
      case 'parent': return 'ولي أمر';
      default: return role;
    }
  };

  const getRoleIcon = (role: string): string => {
    switch (role) {
      case 'admin': return '👨‍💻';
      case 'supervisor': return '👨‍💼';
      case 'teacher': return '👨‍🏫';
      case 'student': return '👨‍🎓';
      case 'parent': return '👨‍👧';
      default: return '👤';
    }
  };

  const handleRoleSwitch = (role: string) => {
    switchRole(role as any);
    setShowRoleSwitcher(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-header__brand">
          <span role="img" aria-label="Quran">📖</span>
          رحلة الماهر
        </div>
        <button 
          className={`hamburger-btn ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="القائمة"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Overlay */}
      <div 
        className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar__brand">
          <span role="img" aria-label="Quran">
            📖
          </span>{' '}
          رحلة الماهر
        </div>
        
        {userProfile && (
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">
              {userProfile.name}
            </div>
            <div className="sidebar__user-role-container">
              <span className="sidebar__user-role">
                {getRoleIcon(activeRole || userProfile.role)} {getRoleLabel(activeRole || userProfile.role)}
              </span>
              {hasMultipleRoles && (
                <button 
                  className="sidebar__role-switch-btn"
                  onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                  title="تبديل الصلاحية"
                >
                  🔄
                </button>
              )}
            </div>
            {showRoleSwitcher && hasMultipleRoles && (
              <div className="sidebar__role-switcher">
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    className={`sidebar__role-option ${activeRole === role ? 'active' : ''}`}
                    onClick={() => handleRoleSwitch(role)}
                  >
                    {getRoleIcon(role)} {getRoleLabel(role)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        <nav className="sidebar__nav">
          {navItems.filter(canViewItem).map((item) => (
            <NavLink
              key={item.path + item.label}
              to={item.path}
              className={({ isActive }) =>
                isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
              }
            >
              <span className="sidebar__link-icon">{item.icon}</span>
              <span className="sidebar__link-text">{item.label}</span>
              {item.showBadge && item.path === '/pending-requests' && pendingCount > 0 && (
                <span className="sidebar__badge">{pendingCount}</span>
              )}
              {item.showBadge && item.path === '/messages' && unreadMessagesCount > 0 && (
                <span className="sidebar__badge">{unreadMessagesCount}</span>
              )}
              {item.path === '/students' && item.label === 'طلابي' && newStudentsCount > 0 && (
                <span className="sidebar__badge">{newStudentsCount}</span>
              )}
            </NavLink>
          ))}
          {process.env.NODE_ENV === 'development' && isAdmin && (
            <NavLink
              to="/dev-tools"
              className={({ isActive }) =>
                isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
              }
            >
              <span className="sidebar__link-icon">🛠️</span>
              <span className="sidebar__link-text">أدوات المطور</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar__bottom-actions">
          <NavLink
            to="/change-password"
            className={({ isActive }) =>
              isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
            }
          >
            <span className="sidebar__link-icon">🔐</span>
            <span className="sidebar__link-text">تغيير كلمة المرور</span>
          </NavLink>
          <button type="button" className="sidebar__logout" onClick={handleLogout}>
            <span className="sidebar__link-icon">🚪</span>
            <span className="sidebar__link-text">تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

