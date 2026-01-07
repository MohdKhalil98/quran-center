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
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type UserRole = 'admin' | 'supervisor' | 'teacher' | 'student' | 'parent';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole; // الصلاحية الرئيسية
  roles?: UserRole[]; // صلاحيات متعددة (اختياري)
  personalId?: string; // الرقم الشخصي - 9 أرقام
  centerId?: string; // للمشرف والمعلم والطالب
  studentId?: string; // لولي الأمر
  groupId?: string; // للطالب - الحلقة المنضم إليها
  phone?: string;
  createdAt: string;
  active: boolean;
  status?: 'pending_registration' | 'interview_scheduled' | 'waiting_teacher_approval' | 'approved' | 'rejected'; // للطلاب - حالة الموافقة
  
  // Progress Tracking - New Firebase-based curriculum
  levelId?: string; // Firebase document ID for level
  levelName?: string;
  stageId?: string; // Firebase document ID for stage
  stageName?: string;
  currentChallenge?: 'memorization' | 'near_review' | 'far_review';
  completedLevels?: number;
  totalPoints?: number;
  levelStatus?: 'in-progress' | 'pending_supervisor' | 'completed';
  stageStatus?: 'in-progress' | 'pending_supervisor';
  pendingLevelUp?: boolean;
}

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithPersonalId: (personalId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string, phone: string, role: UserRole, centerId?: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isParent: boolean;
  isPendingApproval: boolean;
  // دعم تعدد الصلاحيات
  activeRole: UserRole | null;
  availableRoles: UserRole[];
  switchRole: (role: UserRole) => void;
  hasMultipleRoles: boolean;
  getDefaultRoute: () => string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // جلب بيانات المستخدم من Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);
            // تعيين الصلاحية النشطة من localStorage أو الصلاحية الرئيسية
            const savedRole = localStorage.getItem(`activeRole_${firebaseUser.uid}`);
            if (savedRole && (profile.roles?.includes(savedRole as UserRole) || profile.role === savedRole)) {
              setActiveRole(savedRole as UserRole);
            } else {
              setActiveRole(profile.role);
            }
          } else {
            setUserProfile(null);
            setActiveRole(null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
        setActiveRole(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // تسجيل الدخول بالرقم الشخصي
  const loginWithPersonalId = async (personalId: string, password: string) => {
    // البحث عن المستخدم بالرقم الشخصي
    const q = query(collection(db, 'users'), where('personalId', '==', personalId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error('USER_NOT_FOUND');
    }

    const userData = snapshot.docs[0].data() as UserProfile;
    
    // التحقق من أن الحساب مُفعّل (اجتاز المقابلة)
    if (userData.status === 'pending_registration' || userData.status === 'interview_scheduled') {
      throw new Error('ACCOUNT_NOT_ACTIVATED');
    }

    // تسجيل الدخول باستخدام البريد الداخلي
    const internalEmail = `${personalId}@quran-center.local`;
    await signInWithEmailAndPassword(auth, internalEmail, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const register = async (email: string, password: string, name: string, phone: string, role: UserRole, centerId?: string) => {
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
      active: true,
      ...(role === 'student' && centerId ? { 
        centerId: centerId,
        status: 'pending_registration' as const // الطلاب يحتاجون موافقة المشرف
      } : {})
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

  // استخدام الصلاحية النشطة بدلاً من الصلاحية الرئيسية
  const currentRole = activeRole || userProfile?.role;
  const isAdmin = currentRole === 'admin';
  const isSupervisor = currentRole === 'supervisor';
  const isTeacher = currentRole === 'teacher';
  const isStudent = currentRole === 'student';
  const isParent = currentRole === 'parent';
  const isPendingApproval = userProfile?.status === 'pending_registration';

  // حساب الصلاحيات المتاحة
  const availableRoles: UserRole[] = useMemo(() => {
    if (!userProfile) return [];
    const roles = new Set<UserRole>();
    roles.add(userProfile.role);
    if (userProfile.roles) {
      userProfile.roles.forEach(r => roles.add(r));
    }
    return Array.from(roles);
  }, [userProfile]);

  const hasMultipleRoles = availableRoles.length > 1;

  // التبديل بين الصلاحيات
  const switchRole = (role: UserRole) => {
    if (availableRoles.includes(role) && userProfile) {
      setActiveRole(role);
      localStorage.setItem(`activeRole_${userProfile.uid}`, role);
    }
  };

  // تحديد المسار الافتراضي حسب دور المستخدم
  const getDefaultRoute = (): string => {
    if (!userProfile) return '/dashboard';
    
    const currentRole = activeRole || userProfile.role;
    
    switch (currentRole) {
      case 'student':
        return '/my-progress'; // صفحة تحصيلي للطالب
      case 'parent':
        return '/my-progress'; // صفحة تحصيل الطالب لولي الأمر
      case 'teacher':
        return '/dashboard'; // لوحة التحكم للمعلم
      case 'supervisor':
        return '/dashboard'; // لوحة التحكم للمشرف
      case 'admin':
        return '/dashboard'; // لوحة التحكم للمطور
      default:
        return '/dashboard';
    }
  };

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      login,
      loginWithPersonalId,
      logout,
      register,
      hasPermission,
      isAdmin,
      isSupervisor,
      isTeacher,
      isStudent,
      isParent,
      isPendingApproval,
      // دعم تعدد الصلاحيات
      activeRole,
      availableRoles,
      switchRole,
      hasMultipleRoles,
      getDefaultRoute
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, userProfile, loading, activeRole, availableRoles]
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

