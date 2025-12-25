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
  const { logout, isAdmin, userProfile, isSupervisor } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      if (!isSupervisor || !userProfile?.centerId) return;
      
      try {
        const pendingQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('centerId', '==', userProfile.centerId),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(pendingQuery);
        setPendingCount(snapshot.size);
      } catch (error) {
        console.error('Error fetching pending count:', error);
      }
    };

    fetchPendingCount();
    // تحديث كل 30 ثانية
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [isSupervisor, userProfile]);

  // جلب عدد الرسائل غير المقروءة
  useEffect(() => {
    if (!userProfile?.uid) return;

    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userProfile.uid),
      orderBy('updatedAt', 'desc')
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

    // التحقق من دور المستخدم
    if (!userProfile) return false;
    return item.roles.includes(userProfile.role);
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
            <div className="sidebar__user-role">
              {userProfile.role === 'admin' && 'مطور'}
              {userProfile.role === 'supervisor' && 'مشرف'}
              {userProfile.role === 'teacher' && 'معلم'}
              {userProfile.role === 'student' && 'طالب'}
              {userProfile.role === 'parent' && 'ولي أمر'}
            </div>
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
        <button type="button" className="sidebar__logout" onClick={handleLogout}>
          <span className="sidebar__link-icon">🚪</span>
          <span className="sidebar__link-text">تسجيل الخروج</span>
        </button>
      </aside>
    </>
  );
};

export default Sidebar;

