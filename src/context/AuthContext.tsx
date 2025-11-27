import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type UserRole = 'admin' | 'supervisor' | 'teacher' | 'student' | 'parent';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  centerId?: string; // للمشرف والمعلم
  studentId?: string; // لولي الأمر
  phone?: string;
  createdAt: string;
  active: boolean;
}

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string, phone: string, role: UserRole) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isParent: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // جلب بيانات المستخدم من Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const register = async (email: string, password: string, name: string, phone: string, role: UserRole) => {
    // إنشاء حساب المستخدم
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // حفظ بيانات المستخدم في Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: email,
      name: name,
      role: role,
      phone: phone,
      createdAt: new Date().toISOString(),
      active: true
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
    setUserProfile(userProfile);
  };

  const hasPermission = (permission: string): boolean => {
    if (!userProfile) return false;
    
    const permissions: Record<UserRole, string[]> = {
      admin: ['*'], // كل الصلاحيات
      supervisor: [
        'manage_teachers',
        'manage_groups',
        'manage_students',
        'view_reports',
        'manage_curriculum',
        'send_notifications'
      ],
      teacher: [
        'manage_own_group',
        'record_attendance',
        'update_achievements',
        'view_students',
        'contact_parents'
      ],
      student: ['view_own_progress', 'view_activities'],
      parent: ['view_child_progress', 'contact_teacher', 'renew_subscription']
    };

    const userPermissions = permissions[userProfile.role];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  };

  const isAdmin = userProfile?.role === 'admin';
  const isSupervisor = userProfile?.role === 'supervisor';
  const isTeacher = userProfile?.role === 'teacher';
  const isStudent = userProfile?.role === 'student';
  const isParent = userProfile?.role === 'parent';

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      login,
      logout,
      register,
      hasPermission,
      isAdmin,
      isSupervisor,
      isTeacher,
      isStudent,
      isParent
    }),
    [user, userProfile, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

