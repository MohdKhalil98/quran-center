import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'لوحة التحكم' },
  { path: '/students', label: 'الطلاب' },
  { path: '/groups', label: 'المجموعات' },
  { path: '/curriculum', label: 'المنهج' }
];

const Sidebar = () => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span role="img" aria-label="Quran">
          📖
        </span>{' '}
        مركز التحفيظ
      </div>
      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button type="button" className="sidebar__logout" onClick={handleLogout}>
        تسجيل الخروج
      </button>
    </aside>
  );
};

export default Sidebar;

