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
import Centers from './pages/Centers';
import PendingRequests from './pages/PendingRequests';
import MyProgress from './pages/MyProgress';
import Leaderboard from './pages/Leaderboard';
import Messages from './pages/Messages';
import Conversation from './pages/Conversation';
import ChangePassword from './pages/ChangePassword';
import BatchImport from './pages/BatchImport';
import { useAuth } from './context/AuthContext';

// Component to handle default redirect based on role
const DefaultRedirect = () => {
  const { userProfile } = useAuth();
  
  if (userProfile?.role === 'student') {
    return <Navigate to="/my-progress" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DefaultRedirect />} />
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
          {/* New Routes */}
          <Route path="/centers" element={<Centers />} />
          <Route path="/pending-requests" element={<PendingRequests />} />
          <Route path="/my-progress" element={<MyProgress />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Conversation />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/batch-import" element={<BatchImport />} />
        </Route>
      </Route>
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}

export default App;
