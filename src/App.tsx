import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Curriculum from './pages/Curriculum';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import UserManagement from './pages/UserManagement';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Tracks from './pages/Tracks';
import Groups from './pages/Groups';
import StudentAchievements from './pages/StudentAchievements';
import DevTools from './pages/DevTools';
import Attendance from './pages/Attendance';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tracks" element={<Tracks />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/students" element={<Students />} />
          <Route path="/achievements" element={<StudentAchievements />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/curriculum" element={<Curriculum />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/dev-tools" element={<DevTools />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
