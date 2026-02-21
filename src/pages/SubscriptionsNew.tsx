import { useEffect, useState, useRef } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  addDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import Tesseract from 'tesseract.js';
import '../styles/Subscriptions.css';

// ======================== INTERFACES ========================

interface Student extends UserProfile {
  groupName?: string;
  centerName?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'exempt'; // نشط، غير نشط، معفي
  lastActivationDate?: string;
  parentPhone?: string; // رقم ولي الأمر
  siblingIds?: string[]; // معرفات الإخوة (لربط الدفعات)
}

interface Center {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  centerId?: string;
}

interface StudyPeriod {
  id: string;
  name: string;
  type: 'first_semester' | 'spring_activity' | 'second_semester' | 'summer_activity';
  startDate: Timestamp;
  endDate: Timestamp;
  isActive: boolean;
  centerId?: string;
  subscriptionFee: number; // مبلغ الاشتراك
  currency: string; // العملة
  paymentDeadline?: Timestamp; // آخر يوم للدفع
  createdAt: Timestamp;
}

interface Payment {
  id: string;
  periodId: string; // معرف الفترة الدراسية
  studentIds: string[]; // قائمة الطلاب (يمكن أن يكون أكثر من طالب)
  amount: number; // المبلغ المدفوع
  paymentDate: Timestamp;
  receiptImageUrl?: string; // رابط صورة الإيصال
  receiptData?: { // البيانات المستخرجة من الإيصال
    transactionId?: string;
    bankName?: string;
    senderName?: string;
    receiverName?: string;
    extractedAmount?: number;
  };
  payerName: string; // اسم الدافع (ولي الأمر)
  payerPhone: string; // رقم الدافع
  status: 'pending' | 'confirmed' | 'rejected'; // حالة الدفع
  notes?: string;
  createdBy: string; // من أضاف السجل
  createdAt: Timestamp;
}

interface StudentPeriodStatus {
  id: string;
  studentId: string;
  periodId: string;
  status: 'active' | 'inactive' | 'exempt'; // نشط، غير نشط، معفي
  participation?: 'participating' | 'not_participating' | 'pending'; // مشارك، غير مشارك، معلق
  paymentId?: string; // معرف الدفع إذا تم الدفع
  exemptReason?: string; // سبب الإعفاء
  updatedAt: Timestamp;
}

const PERIOD_TYPES = [
  { value: 'first_semester', label: 'الفصل الدراسي الأول' },
  { value: 'spring_activity', label: 'النشاط الربيعي' },
  { value: 'second_semester', label: 'الفصل الدراسي الثاني' },
  { value: 'summer_activity', label: 'النشاط الصيفي' }
];

const SUBSCRIPTION_STATUS = {
  active: { label: 'نشط', color: '#28a745', icon: '✅' },
  inactive: { label: 'غير نشط', color: '#dc3545', icon: '❌' },
  exempt: { label: 'معفي', color: '#17a2b8', icon: '🎓' }
};

const PARTICIPATION_STATUS = {
  participating: { label: 'مشارك', color: '#28a745', icon: '✅' },
  not_participating: { label: 'غير مشارك', color: '#dc3545', icon: '❌' },
  pending: { label: 'لم يحدد', color: '#ffc107', icon: '⏳' }
};

// ======================== COMPONENT ========================

const SubscriptionsNew = () => {
  const { userProfile, isSupervisor, isAdmin, getSupervisorCenterIds } = useAuth();
  
  // ========== States الأساسية ==========
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ========== فترات الدراسة ==========
  const [studyPeriods, setStudyPeriods] = useState<StudyPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<StudyPeriod | null>(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<StudyPeriod | null>(null);
  const [newPeriod, setNewPeriod] = useState({
    name: '',
    type: 'first_semester' as StudyPeriod['type'],
    startDate: '',
    endDate: '',
    centerId: '',
    subscriptionFee: 5,
    currency: 'دينار بحريني',
    paymentDeadline: ''
  });
  
  // ========== المدفوعات ==========
  const [payments, setPayments] = useState<Payment[]>([]);
  const [studentPeriodStatuses, setStudentPeriodStatuses] = useState<StudentPeriodStatus[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<Student | null>(null);
  const [selectedStudentsForPayment, setSelectedStudentsForPayment] = useState<string[]>([]);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payerName: '',
    payerPhone: '',
    notes: ''
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ========== OCR - استخراج البيانات من الصورة ==========
  const [isExtractingData, setIsExtractingData] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedReceiptData, setExtractedReceiptData] = useState<{
    amount?: number;
    transactionId?: string;
    bankName?: string;
    senderName?: string;
    date?: string;
    rawText?: string;
  } | null>(null);
  
  // ========== الفلاتر ==========
  const [filterCenterId, setFilterCenterId] = useState<string>('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'exempt'>('all');
  const [filterParticipation, setFilterParticipation] = useState<'all' | 'participating' | 'not_participating' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // ========== WhatsApp ==========
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string>('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSendingModal, setShowSendingModal] = useState(false);
  const [currentSendingIndex, setCurrentSendingIndex] = useState(0);
  const [sendingQueue, setSendingQueue] = useState<Student[]>([]);
  const [sendingResults, setSendingResults] = useState<{studentId: string; name: string; status: 'sent' | 'skipped' | 'no-phone'}[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // ========== قوالب الرسائل ==========
  const [messageTemplates, setMessageTemplates] = useState<{id: string; name: string; text: string}[]>([
    { id: '1', name: 'دعوة للاشتراك', text: 'السلام عليكم ورحمة الله وبركاته\n\nولي أمر الطالب {اسم_الطالب} الكريم\n\nنود إعلامكم بأن {اسم_الفترة} قد بدأت.\n\nرسوم الاشتراك: {مبلغ_الاشتراك}\nآخر موعد للدفع: {تاريخ_الانتهاء}\n\nيرجى سداد الرسوم لتفعيل حساب الطالب.\n\nجزاكم الله خيراً' },
    { id: '2', name: 'تأكيد الدفع', text: 'السلام عليكم ورحمة الله وبركاته\n\nولي أمر الطالب {اسم_الطالب} الكريم\n\nتم تأكيد استلام رسوم الاشتراك وتفعيل حساب الطالب.\n\nبارك الله فيكم ووفقكم.' },
    { id: '3', name: 'تذكير بالدفع', text: 'السلام عليكم ورحمة الله وبركاته\n\nولي أمر الطالب {اسم_الطالب} الكريم\n\nنذكركم بسداد رسوم اشتراك {اسم_الفترة}.\n\nالمبلغ المطلوب: {مبلغ_الاشتراك}\n\nفي حال عدم السداد سيتم تعليق حساب الطالب.\n\nجزاكم الله خيراً' }
  ]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // ========== Exempt Modal ==========
  const [showExemptModal, setShowExemptModal] = useState(false);
  const [exemptStudent, setExemptStudent] = useState<Student | null>(null);
  const [exemptReason, setExemptReason] = useState('');
  
  // ========== Sibling Selector ==========
  const [showSiblingSelector, setShowSiblingSelector] = useState(false);
  const [siblingSearchTerm, setSiblingSearchTerm] = useState('');
  
  // ========== Processing ==========
  const [processingStudents, setProcessingStudents] = useState<string[]>([]);

  // ========== الفترات السابقة ==========
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);

  // ========== الترتيب ==========
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pastSortColumn, setPastSortColumn] = useState<string>('');
  const [pastSortDirection, setPastSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pastFilterCenterId, setPastFilterCenterId] = useState<string>('');
  const [pastSearchTerm, setPastSearchTerm] = useState<string>('');

  // ======================== EFFECTS ========================

  useEffect(() => {
    fetchData();
  }, [isSupervisor, isAdmin, userProfile]);

  useEffect(() => {
    filterStudentsList();
  }, [students, filterCenterId, filterGroupId, filterStatus, filterParticipation, studentPeriodStatuses, activePeriod, searchTerm]);

  useEffect(() => {
    if (filterCenterId) {
      const filtered = groups.filter(g => g.centerId === filterCenterId);
      setFilteredGroups(filtered);
      if (filterGroupId && !filtered.find(g => g.id === filterGroupId)) {
        setFilterGroupId('');
      }
    } else {
      setFilteredGroups(groups);
    }
  }, [filterCenterId, groups]);

  // التحقق من انتهاء مهلة الدفع وتعطيل الحسابات غير المدفوعة
  useEffect(() => {
    const checkPaymentDeadline = async () => {
      if (!activePeriod?.paymentDeadline) return;
      
      const now = new Date();
      const deadline = activePeriod.paymentDeadline.toDate();
      
      if (now <= deadline) return; // المهلة لم تنتهِ بعد
      
      // الطلاب المشاركين الذين لم يدفعوا بعد انتهاء المهلة
      // (مشارك وحالة الاشتراك نشطة لكن بدون دفعة مؤكدة)
      const participatingUnpaid = studentPeriodStatuses.filter(s => 
        s.periodId === activePeriod.id && 
        s.participation === 'participating' &&
        s.status === 'active' &&
        !s.paymentId // لم يتم الدفع
      );

      // تغيير حالة الاشتراك إلى غير نشط للمشاركين الذين لم يدفعوا
      let changed = false;
      for (const status of participatingUnpaid) {
        try {
          await updateDoc(doc(db, 'studentPeriodStatuses', status.id), {
            status: 'inactive',
            updatedAt: Timestamp.now()
          });
          // تحديث حالة الاشتراك في وثيقة المستخدم
          await updateDoc(doc(db, 'users', status.studentId), {
            subscriptionStatus: 'inactive'
          });
          changed = true;
        } catch (error) {
          console.error('Error auto-deactivating student:', error);
        }
      }

      if (changed) {
        fetchData(); // إعادة تحميل البيانات
      }
    };

    checkPaymentDeadline();
  }, [activePeriod, studentPeriodStatuses]);

  // ======================== DATA FETCHING ========================

  const fetchData = async () => {
    setLoading(true);
    try {
      // جلب المراكز
      const centersSnapshot = await getDocs(collection(db, 'centers'));
      const centersList = centersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setCenters(centersList);

      // جلب المجموعات
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      const groupsList = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        centerId: doc.data().centerId
      }));
      setGroups(groupsList);

      // جلب فترات الدراسة
      const periodsSnapshot = await getDocs(
        query(collection(db, 'studyPeriods'), orderBy('startDate', 'desc'))
      );
      const periodsList = periodsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudyPeriod[];
      setStudyPeriods(periodsList);
      
      // تحديد الفترة النشطة
      const active = periodsList.find(p => p.isActive);
      setActivePeriod(active || null);

      // جلب المدفوعات
      const paymentsSnapshot = await getDocs(
        query(collection(db, 'payments'), orderBy('createdAt', 'desc'))
      );
      const paymentsList = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payment[];
      setPayments(paymentsList);

      // جلب حالات الطلاب للفترات
      const statusesSnapshot = await getDocs(collection(db, 'studentPeriodStatuses'));
      const statusesList = statusesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentPeriodStatus[];
      
      // إصلاح تلقائي: الطلاب غير المشاركين يجب أن تكون حالتهم غير نشطة
      for (const status of statusesList) {
        if (status.participation === 'not_participating' && status.status === 'active') {
          try {
            await updateDoc(doc(db, 'studentPeriodStatuses', status.id), {
              status: 'inactive',
              updatedAt: Timestamp.now()
            });
            await updateDoc(doc(db, 'users', status.studentId), {
              subscriptionStatus: 'inactive'
            });
            status.status = 'inactive';
          } catch (error) {
            console.error('Error fixing inconsistent status:', error);
          }
        }
      }
      
      setStudentPeriodStatuses(statusesList);

      // جلب الطلاب
      let studentsQuery;
      if (isSupervisor) {
        const supervisorCenterIds = getSupervisorCenterIds();
        if (supervisorCenterIds.length > 0) {
          studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('status', '==', 'approved')
          );
        }
      } else if (isAdmin) {
        studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'approved')
        );
      }

      if (studentsQuery) {
        const studentsSnapshot = await getDocs(studentsQuery);
        let studentsList = studentsSnapshot.docs.map(doc => {
          const data = doc.data() as Student;
          return {
            ...data,
            uid: doc.id,
            groupName: groupsList.find(g => g.id === data.groupId)?.name || 'غير محدد',
            centerName: centersList.find(c => c.id === data.centerId)?.name || 'غير محدد'
          };
        });

        if (isSupervisor) {
          const supervisorCenterIds = getSupervisorCenterIds();
          studentsList = studentsList.filter(s => 
            s.centerId && supervisorCenterIds.includes(s.centerId)
          );
          if (supervisorCenterIds.length === 1) {
            setFilterCenterId(supervisorCenterIds[0]);
          }
        }

        setStudents(studentsList);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  // ======================== FILTERING ========================

  const filterStudentsList = () => {
    let filtered = [...students];

    // البحث بالاسم أو رقم الهاتف
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(term) ||
        s.phone?.includes(term) ||
        s.parentPhone?.includes(term)
      );
    }

    if (filterCenterId) {
      filtered = filtered.filter(s => s.centerId === filterCenterId);
    }

    if (filterGroupId) {
      filtered = filtered.filter(s => s.groupId === filterGroupId);
    }

    if (filterStatus !== 'all' && activePeriod) {
      filtered = filtered.filter(s => {
        const status = getStudentPeriodStatus(s.uid);
        return status === filterStatus;
      });
    }

    if (filterParticipation !== 'all' && activePeriod) {
      filtered = filtered.filter(s => {
        const participation = getStudentParticipation(s.uid);
        return participation === filterParticipation;
      });
    }

    setFilteredStudents(filtered);
  };

  // الحصول على حالة الطالب للفترة الحالية
  const getStudentPeriodStatus = (studentId: string): 'active' | 'inactive' | 'exempt' => {
    if (!activePeriod) return 'inactive';
    const status = studentPeriodStatuses.find(
      s => s.studentId === studentId && s.periodId === activePeriod.id
    );
    return status?.status || 'inactive';
  };

  // الحصول على حالة المشاركة للطالب في الفترة الحالية
  const getStudentParticipation = (studentId: string): 'participating' | 'not_participating' | 'pending' => {
    if (!activePeriod) return 'pending';
    const status = studentPeriodStatuses.find(
      s => s.studentId === studentId && s.periodId === activePeriod.id
    );
    return status?.participation || 'pending';
  };

  // تبديل حالة المشاركة للطالب (من قبل المشرف)
  const toggleParticipation = async (studentId: string) => {
    if (!activePeriod) return;
    
    const statusRecord = studentPeriodStatuses.find(
      s => s.studentId === studentId && s.periodId === activePeriod.id
    );
    if (!statusRecord) return;
    
    setProcessingStudents(prev => [...prev, studentId]);
    
    const currentParticipation = statusRecord.participation || 'pending';
    // تبديل: pending/not_participating → participating, participating → not_participating
    const newParticipation = currentParticipation === 'participating' ? 'not_participating' : 'participating';
    // حالة الاشتراك تبقى غير نشطة إلى حين دفع الرسوم - لا تتغير بتغيير المشاركة
    // فقط الطالب الذي يدفع تصبح حالته نشطة
    
    try {
      await updateDoc(doc(db, 'studentPeriodStatuses', statusRecord.id), {
        participation: newParticipation,
        updatedAt: Timestamp.now()
      });
      
      // تحديث الحالة المحلية
      setStudentPeriodStatuses(prev => prev.map(s => 
        s.id === statusRecord.id 
          ? { ...s, participation: newParticipation }
          : s
      ));
    } catch (error) {
      console.error('Error toggling participation:', error);
      alert('حدث خطأ أثناء تحديث حالة المشاركة');
    }
    
    setProcessingStudents(prev => prev.filter(id => id !== studentId));
  };

  // الحصول على حالة المشاركة للطالب في فترة محددة
  const getStudentParticipationForPeriod = (studentId: string, periodId: string): 'participating' | 'not_participating' | 'pending' => {
    const status = studentPeriodStatuses.find(
      s => s.studentId === studentId && s.periodId === periodId
    );
    return status?.participation || 'pending';
  };

  // الحصول على حالة الطالب لفترة محددة (للفترات السابقة)
  const getStudentStatusForPeriod = (studentId: string, periodId: string): 'active' | 'inactive' | 'exempt' => {
    const status = studentPeriodStatuses.find(
      s => s.studentId === studentId && s.periodId === periodId
    );
    return status?.status || 'inactive';
  };

  // الحصول على إحصائيات فترة محددة
  const getPeriodStats = (periodId: string) => {
    const periodStudents = students.filter(s => !pastFilterCenterId || s.centerId === pastFilterCenterId);
    const activeCount = periodStudents.filter(s => getStudentStatusForPeriod(s.uid, periodId) === 'active').length;
    const inactiveCount = periodStudents.filter(s => getStudentStatusForPeriod(s.uid, periodId) === 'inactive').length;
    const exemptCount = periodStudents.filter(s => getStudentStatusForPeriod(s.uid, periodId) === 'exempt').length;
    const totalPayments = payments.filter(p => p.periodId === periodId).reduce((sum, p) => sum + (p.amount || 0), 0);
    return { activeCount, inactiveCount, exemptCount, totalPayments };
  };

  // ======================== PERIOD FUNCTIONS ========================

  const savePeriod = async () => {
    if (!newPeriod.name || !newPeriod.startDate || !newPeriod.endDate) {
      alert('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

    if (newPeriod.subscriptionFee < 0) {
      alert('مبلغ الاشتراك يجب أن يكون صفر أو أكثر');
      return;
    }

    try {
      const periodData: any = {
        name: newPeriod.name,
        type: newPeriod.type,
        startDate: Timestamp.fromDate(new Date(newPeriod.startDate)),
        endDate: Timestamp.fromDate(new Date(newPeriod.endDate)),
        isActive: true,
        subscriptionFee: newPeriod.subscriptionFee || 0,
        currency: newPeriod.currency || 'دينار بحريني',
        createdAt: Timestamp.now()
      };

      // إضافة آخر يوم للدفع إذا كان محدداً
      if (newPeriod.paymentDeadline) {
        periodData.paymentDeadline = Timestamp.fromDate(new Date(newPeriod.paymentDeadline));
      }

      // إضافة centerId فقط إذا كان محدداً
      if (newPeriod.centerId) {
        periodData.centerId = newPeriod.centerId;
      }

      // تعطيل الفترات النشطة الأخرى للمركز نفسه
      for (const period of studyPeriods) {
        if (period.isActive) {
          // إذا كانت الفترة الجديدة لمركز محدد، عطل فقط فترات نفس المركز
          // إذا كانت عامة، عطل الفترات العامة فقط
          const shouldDeactivate = newPeriod.centerId 
            ? period.centerId === newPeriod.centerId
            : !period.centerId;
          
          if (shouldDeactivate) {
            await updateDoc(doc(db, 'studyPeriods', period.id), { isActive: false });
          }
        }
      }

      if (editingPeriod) {
        await updateDoc(doc(db, 'studyPeriods', editingPeriod.id), periodData);
        alert('تم تحديث فترة الدراسة بنجاح');
      } else {
        const docRef = await addDoc(collection(db, 'studyPeriods'), periodData);
        
        // إنشاء حالات للطلاب (غير نشط افتراضياً)
        const studentsToAdd = newPeriod.centerId 
          ? students.filter(s => s.centerId === newPeriod.centerId)
          : students;
        
        for (const student of studentsToAdd) {
          await addDoc(collection(db, 'studentPeriodStatuses'), {
            studentId: student.uid,
            periodId: docRef.id,
            status: 'inactive',
            participation: 'not_participating',
            updatedAt: Timestamp.now()
          });
          // تحديث حالة الاشتراك في وثيقة المستخدم
          await updateDoc(doc(db, 'users', student.uid), {
            subscriptionStatus: 'inactive'
          });
        }
        
        alert('تم إضافة فترة الدراسة بنجاح! يمكنك الآن إرسال رسائل الدعوة للطلاب.');
      }

      setShowPeriodModal(false);
      resetPeriodForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving period:', error);
      alert('حدث خطأ أثناء حفظ فترة الدراسة: ' + (error?.message || 'خطأ غير معروف'));
    }
  };

  const resetPeriodForm = () => {
    setEditingPeriod(null);
    setNewPeriod({
      name: '',
      type: 'first_semester',
      startDate: '',
      endDate: '',
      centerId: '',
      subscriptionFee: 5,
      currency: 'دينار بحريني',
      paymentDeadline: ''
    });
  };

  const deletePeriod = async (periodId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفترة؟ سيتم حذف جميع البيانات المرتبطة بها.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'studyPeriods', periodId));
      // حذف حالات الطلاب للفترة
      const statusesToDelete = studentPeriodStatuses.filter(s => s.periodId === periodId);
      for (const status of statusesToDelete) {
        await deleteDoc(doc(db, 'studentPeriodStatuses', status.id));
      }
      fetchData();
      alert('تم حذف الفترة بنجاح');
    } catch (error) {
      console.error('Error deleting period:', error);
      alert('حدث خطأ أثناء حذف الفترة');
    }
  };

  // ======================== PAYMENT FUNCTIONS ========================

  const openPaymentModal = (student: Student) => {
    setSelectedStudentForPayment(student);
    setSelectedStudentsForPayment([student.uid]);
    setPaymentData({
      amount: activePeriod?.subscriptionFee || 0,
      payerName: student.parentPhone ? '' : student.name,
      payerPhone: student.parentPhone || student.phone || '',
      notes: ''
    });
    setReceiptFile(null);
    setReceiptPreview('');
    setShowPaymentModal(true);
  };

  // فتح نافذة الدفع لعدة طلاب (إخوة)
  const openMultiPaymentModal = () => {
    if (selectedStudents.length === 0) {
      alert('يرجى اختيار الطلاب أولاً');
      return;
    }
    setSelectedStudentsForPayment(selectedStudents);
    const firstStudent = students.find(s => s.uid === selectedStudents[0]);
    setPaymentData({
      amount: (activePeriod?.subscriptionFee || 0) * selectedStudents.length,
      payerName: '',
      payerPhone: firstStudent?.parentPhone || firstStudent?.phone || '',
      notes: `دفع جماعي لـ ${selectedStudents.length} طالب`
    });
    setReceiptFile(null);
    setReceiptPreview('');
    setShowPaymentModal(true);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // استخراج البيانات من الصورة باستخدام OCR
      await extractDataFromReceipt(file);
    }
  };

  // ========== دالة استخراج البيانات من صورة الإيصال ==========
  const extractDataFromReceipt = async (file: File) => {
    setIsExtractingData(true);
    setOcrProgress(0);
    setExtractedReceiptData(null);

    try {
      const result = await Tesseract.recognize(
        file,
        'ara+eng', // دعم العربية والإنجليزية
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const text = result.data.text;
      console.log('OCR Text:', text);

      // استخراج البيانات من النص
      const extractedData = parseReceiptText(text);
      setExtractedReceiptData(extractedData);

      // تحديث بيانات الدفع إذا تم استخراج المبلغ
      if (extractedData && extractedData.amount && extractedData.amount > 0) {
        setPaymentData(prev => ({
          ...prev,
          amount: extractedData.amount!
        }));
      }

      // ملاحظة: لا نحدث اسم الدافع تلقائياً - يبقى كما أدخله المستخدم

    } catch (error) {
      console.error('OCR Error:', error);
    } finally {
      setIsExtractingData(false);
      setOcrProgress(100);
    }
  };

  // ========== تحليل نص الإيصال واستخراج البيانات ==========
  const parseReceiptText = (text: string) => {
    const result: {
      amount?: number;
      transactionId?: string;
      bankName?: string;
      senderName?: string;
      date?: string;
      rawText?: string;
    } = {
      rawText: text
    };

    // أنماط البحث عن المبلغ
    const amountPatterns = [
      /(?:المبلغ المرسل|المبلغ|Amount|Total|الإجمالي|المجموع)[\s:]*([0-9]+[.,]?[0-9]*)/gi,
      /([0-9]+[.,][0-9]{3})\s*(?:د\.ب|BHD|دينار|BD)/gi,
      /(?:د\.ب|BHD|BD)[\s.]*([0-9]+[.,]?[0-9]*)/gi,
      /([0-9]+\.[0-9]{2,3})/g // أي رقم بفاصلة عشرية
    ];

    for (const pattern of amountPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amount = parseFloat(match[1].replace(',', '.'));
        if (amount > 0 && amount < 1000) { // نفترض أن المبلغ معقول
          result.amount = amount;
          break;
        }
      }
      if (result.amount) break;
    }

    // البحث عن رقم العملية/المعاملة - أنماط محسنة
    const transactionPatterns = [
      /(?:رقم العملية|رقم المعاملة|Reference|Ref|المرجع|Transaction|TXN)[\s:#]*([A-Z0-9\-]+)/gi,
      /([0-9]{10,}[-][A-Z0-9]+)/gi, // نمط مثل: 5123035344-BP1769526505WXDJ
      /(?:#|No\.)[\s]*([A-Z0-9]{6,})/gi,
      /([A-Z]{2}[0-9]{10,})/gi // نمط IBAN مختصر
    ];

    for (const pattern of transactionPatterns) {
      const match = pattern.exec(text);
      if (match) {
        result.transactionId = match[1];
        break;
      }
    }

    // البحث عن اسم البنك
    const bankNames = [
      'بنك البحرين الوطني', 'NBB', 'National Bank of Bahrain',
      'بنك البحرين والكويت', 'BBK', 'Bank of Bahrain and Kuwait',
      'بنك الأهلي المتحد', 'AUB', 'Ahli United Bank',
      'بيت التمويل الكويتي', 'KFH', 'Kuwait Finance House',
      'البنك الإسلامي', 'BISB', 'Bahrain Islamic Bank',
      'مصرف السلام', 'Al Salam Bank',
      'بنك الخليج المتحد', 'UGB',
      'BenefitPay', 'بنفت باي', 'بنفت',
      'كريمي', 'Credimax',
      'فوري+', 'Fawri+'
    ];

    for (const bank of bankNames) {
      if (text.toLowerCase().includes(bank.toLowerCase())) {
        result.bankName = bank;
        break;
      }
    }

    // البحث عن اسم المرسل - أنماط محسنة بناءً على OCR الفعلي
    // النص يظهر كـ: "من Yusuf albureshaid BBK" أو "من ام علي"
    const senderMatch = text.match(/من\s+([^\n]+?)(?:\s+(?:BBK|NBB|AUB|BISB|KFH|UGB|إلى)|\n|$)/i);
    if (senderMatch) {
      let name = senderMatch[1].trim();
      // إزالة أسماء البنوك من نهاية الاسم
      name = name.replace(/\s*(BBK|NBB|AUB|BISB|KFH|UGB)\s*$/gi, '').trim();
      if (name.length > 2 && name.length < 50) {
        result.senderName = name;
      }
    }

    // البحث عن التاريخ - أنماط محسنة بناءً على OCR الفعلي
    // النص يظهر كـ: "2026 - 18:08 تاريخ Jan27" أو "تاريخ Jan18"
    // نبحث عن الشهر واليوم
    const monthMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i);
    const yearMatch = text.match(/(\d{4})/);
    
    if (monthMatch && yearMatch) {
      result.date = `${monthMatch[2]} ${monthMatch[1]} ${yearMatch[1]}`;
    } else if (monthMatch) {
      result.date = `${monthMatch[2]} ${monthMatch[1]}`;
    }

    return result;
  };

  const savePayment = async () => {
    if (!activePeriod) {
      alert('لا توجد فترة دراسية نشطة');
      return;
    }

    if (selectedStudentsForPayment.length === 0) {
      alert('يرجى اختيار طالب واحد على الأقل');
      return;
    }

    if (paymentData.amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }

    setUploadingReceipt(true);

    try {
      // تخزين صورة الإيصال كـ Base64 مباشرة (بدلاً من Firebase Storage)
      let receiptImageBase64 = '';
      if (receiptPreview) {
        receiptImageBase64 = receiptPreview; // الصورة محولة مسبقاً إلى Base64
      }

      // إنشاء سجل الدفع مع البيانات المستخرجة من الإيصال
      // تنظيف بيانات الإيصال لتجنب قيم undefined
      let cleanReceiptData: Payment['receiptData'] = undefined;
      if (extractedReceiptData) {
        cleanReceiptData = {};
        if (extractedReceiptData.transactionId) cleanReceiptData.transactionId = extractedReceiptData.transactionId;
        if (extractedReceiptData.bankName) cleanReceiptData.bankName = extractedReceiptData.bankName;
        if (extractedReceiptData.senderName) cleanReceiptData.senderName = extractedReceiptData.senderName;
        if (extractedReceiptData.amount) cleanReceiptData.extractedAmount = extractedReceiptData.amount;
        // إذا لم تكن هناك أي بيانات، نجعلها undefined
        if (Object.keys(cleanReceiptData).length === 0) cleanReceiptData = undefined;
      }

      const paymentRecord: Omit<Payment, 'id'> = {
        periodId: activePeriod.id,
        studentIds: selectedStudentsForPayment,
        amount: paymentData.amount,
        paymentDate: Timestamp.now(),
        receiptImageUrl: receiptImageBase64 || undefined, // نخزن Base64 هنا
        receiptData: cleanReceiptData,
        payerName: paymentData.payerName,
        payerPhone: paymentData.payerPhone,
        status: 'confirmed',
        notes: paymentData.notes,
        createdBy: userProfile?.uid || '',
        createdAt: Timestamp.now()
      };

      const paymentRef = await addDoc(collection(db, 'payments'), paymentRecord);

      // تحديث حالة الطلاب إلى نشط
      for (const studentId of selectedStudentsForPayment) {
        const existingStatus = studentPeriodStatuses.find(
          s => s.studentId === studentId && s.periodId === activePeriod.id
        );

        if (existingStatus) {
          await updateDoc(doc(db, 'studentPeriodStatuses', existingStatus.id), {
            status: 'active',
            paymentId: paymentRef.id,
            updatedAt: Timestamp.now()
          });
        } else {
          await addDoc(collection(db, 'studentPeriodStatuses'), {
            studentId,
            periodId: activePeriod.id,
            status: 'active',
            paymentId: paymentRef.id,
            updatedAt: Timestamp.now()
          });
        }

        // تحديث حالة الطالب في جدول المستخدمين
        await updateDoc(doc(db, 'users', studentId), {
          subscriptionStatus: 'active',
          lastActivationDate: new Date().toISOString()
        });
      }

      // إرسال رسالة تأكيد الدفع عبر WhatsApp
      const studentsForMessage = selectedStudentsForPayment.map(sid => students.find(s => s.uid === sid)).filter(Boolean) as Student[];
      if (studentsForMessage.length > 0) {
        const studentNames = studentsForMessage.map(s => s.name).join(' و ');
        const confirmMessage = `السلام عليكم ورحمة الله وبركاته

تم استلام رسوم الاشتراك للطالب/ة: ${studentNames}

المبلغ: ${paymentData.amount} ${activePeriod.currency || 'دينار بحريني'}
الفترة: ${activePeriod.name}

تم تفعيل حساب الطالب/ة بنجاح ✅

بارك الله فيكم ووفقكم 🤲`;

        // فتح WhatsApp للطالب الأول أو ولي أمره
        const firstStudent = studentsForMessage[0];
        const phone = paymentData.payerPhone || firstStudent.parentPhone || firstStudent.phone;
        if (phone) {
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          const fullPhone = cleanPhone.startsWith('973') ? cleanPhone : `973${cleanPhone}`;
          const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(confirmMessage)}`;
          // استخدام location.href بدلاً من window.open لأن المتصفحات على الهاتف تحظر النوافذ المنبثقة بعد العمليات غير المتزامنة
          window.location.href = whatsappUrl;
        }
      }

      alert('تم تسجيل الدفع وتفعيل الطالب بنجاح!');
      setShowPaymentModal(false);
      setSelectedStudents([]);
      setExtractedReceiptData(null);
      fetchData();
    } catch (error: any) {
      console.error('Error saving payment:', error);
      
      // رسالة خطأ أكثر تفصيلاً
      let errorMessage = 'حدث خطأ أثناء تسجيل الدفع';
      if (error?.code === 'storage/unauthorized') {
        errorMessage = 'خطأ في الصلاحيات: يرجى تفعيل Firebase Storage في لوحة التحكم';
      } else if (error?.code === 'storage/object-not-found') {
        errorMessage = 'خطأ في رفع الملف';
      } else if (error?.message) {
        errorMessage += ': ' + error.message;
      }
      
      alert(errorMessage);
    }

    setUploadingReceipt(false);
  };

  // ======================== EXEMPT FUNCTIONS ========================

  const openExemptModal = (student: Student) => {
    setExemptStudent(student);
    setExemptReason('');
    setShowExemptModal(true);
  };

  const saveExemption = async () => {
    if (!exemptStudent || !activePeriod) return;

    if (!exemptReason.trim()) {
      alert('يرجى إدخال سبب الإعفاء');
      return;
    }

    try {
      const existingStatus = studentPeriodStatuses.find(
        s => s.studentId === exemptStudent.uid && s.periodId === activePeriod.id
      );

      if (existingStatus) {
        await updateDoc(doc(db, 'studentPeriodStatuses', existingStatus.id), {
          status: 'exempt',
          exemptReason,
          updatedAt: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'studentPeriodStatuses'), {
          studentId: exemptStudent.uid,
          periodId: activePeriod.id,
          status: 'exempt',
          exemptReason,
          updatedAt: Timestamp.now()
        });
      }

      await updateDoc(doc(db, 'users', exemptStudent.uid), {
        subscriptionStatus: 'exempt'
      });

      alert('تم إعفاء الطالب بنجاح');
      setShowExemptModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving exemption:', error);
      alert('حدث خطأ');
    }
  };

  // ======================== WHATSAPP FUNCTIONS ========================

  const sendInvitations = () => {
    if (!activePeriod) {
      alert('لا توجد فترة دراسية نشطة');
      return;
    }

    // تحديد الطلاب غير النشطين
    const inactiveStudents = filteredStudents.filter(s => 
      getStudentPeriodStatus(s.uid) === 'inactive'
    );

    if (inactiveStudents.length === 0) {
      alert('جميع الطلاب مفعلين أو معفيين');
      return;
    }

    setSelectedStudents(inactiveStudents.map(s => s.uid));
    
    // إعداد رسالة الدعوة
    const inviteTemplate = messageTemplates.find(t => t.name === 'دعوة للاشتراك');
    if (inviteTemplate) {
      let message = inviteTemplate.text
        .replace(/\{اسم_الفترة\}/g, activePeriod.name)
        .replace(/\{مبلغ_الاشتراك\}/g, `${activePeriod.subscriptionFee || 5} ${activePeriod.currency || 'دينار بحريني'}`)
        .replace(/\{تاريخ_الانتهاء\}/g, activePeriod.endDate.toDate().toLocaleDateString('ar-SA'));
      setBulkMessage(message);
    }
    
    setShowBulkModal(true);
  };

  const sendWhatsAppBulk = () => {
    if (!bulkMessage.trim()) {
      alert('يرجى كتابة الرسالة');
      return;
    }

    const selectedStudentData = students.filter(s => selectedStudents.includes(s.uid));
    setSendingQueue(selectedStudentData);
    setCurrentSendingIndex(0);
    setSendingResults([]);
    setShowBulkModal(false);
    setShowSendingModal(true);
  };

  const openCurrentStudentWhatsApp = () => {
    const student = sendingQueue[currentSendingIndex];
    if (!student) return;

    const phone = student.parentPhone || student.phone;
    if (phone) {
      let cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone.startsWith('973') && !cleanPhone.startsWith('+973')) {
        cleanPhone = '973' + cleanPhone.replace(/^0/, '');
      }
      
      let personalizedMessage = bulkMessage
        .replace(/\{اسم_الطالب\}/g, student.name || '')
        .replace(/\{name\}/gi, student.name || '')
        .replace(/\{الاسم\}/g, student.name || '');
      
      const encodedMessage = encodeURIComponent(personalizedMessage);
      window.location.href = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    }
  };

  const confirmSentAndNext = () => {
    const student = sendingQueue[currentSendingIndex];
    const phone = student.parentPhone || student.phone;
    
    setSendingResults(prev => [...prev, {
      studentId: student.uid,
      name: student.name,
      status: phone ? 'sent' : 'no-phone'
    }]);

    if (currentSendingIndex < sendingQueue.length - 1) {
      setCurrentSendingIndex(prev => prev + 1);
    } else {
      finishSending();
    }
  };

  const skipCurrentStudent = () => {
    const student = sendingQueue[currentSendingIndex];
    
    setSendingResults(prev => [...prev, {
      studentId: student.uid,
      name: student.name,
      status: 'skipped'
    }]);

    if (currentSendingIndex < sendingQueue.length - 1) {
      setCurrentSendingIndex(prev => prev + 1);
    } else {
      finishSending();
    }
  };

  const finishSending = () => {
    setShowSendingModal(false);
    setShowReportModal(true);
    setBulkMessage('');
    setSelectedStudents([]);
  };

  // ======================== UTILITY FUNCTIONS ========================

  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString('ar-SA');
  };

  const getPeriodStatusLabel = (period: StudyPeriod) => {
    const now = new Date();
    const start = period.startDate.toDate();
    const end = period.endDate.toDate();

    if (now < start) return { label: 'لم تبدأ', class: 'upcoming' };
    if (now > end) return { label: 'انتهت', class: 'ended' };
    return { label: 'جارية', class: 'active' };
  };

  const getStudentPayment = (studentId: string) => {
    if (!activePeriod) return null;
    return payments.find(p => 
      p.periodId === activePeriod.id && 
      p.studentIds.includes(studentId)
    );
  };

  // ======================== SORTING ========================

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handlePastSort = (column: string) => {
    if (pastSortColumn === column) {
      setPastSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPastSortColumn(column);
      setPastSortDirection('asc');
    }
  };

  const getSortIcon = (column: string, currentSort: string, currentDir: 'asc' | 'desc') => {
    if (currentSort !== column) return ' ⇅';
    return currentDir === 'asc' ? ' ▲' : ' ▼';
  };

  const sortStudents = (studentsList: Student[], col: string, dir: 'asc' | 'desc', periodId?: string) => {
    if (!col) return studentsList;
    return [...studentsList].sort((a, b) => {
      let valA = '';
      let valB = '';
      switch (col) {
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;
        case 'phone':
          valA = a.phone || a.parentPhone || '';
          valB = b.phone || b.parentPhone || '';
          break;
        case 'center':
          valA = a.centerName || '';
          valB = b.centerName || '';
          break;
        case 'group':
          valA = a.groupName || '';
          valB = b.groupName || '';
          break;
        case 'status':
          const statusOrder = { active: '1', exempt: '2', inactive: '3' };
          if (periodId) {
            valA = statusOrder[getStudentStatusForPeriod(a.uid, periodId)] || '3';
            valB = statusOrder[getStudentStatusForPeriod(b.uid, periodId)] || '3';
          } else {
            valA = statusOrder[getStudentPeriodStatus(a.uid)] || '3';
            valB = statusOrder[getStudentPeriodStatus(b.uid)] || '3';
          }
          break;
        case 'participation':
          const partOrder = { participating: '1', pending: '2', not_participating: '3' };
          if (periodId) {
            valA = partOrder[getStudentParticipationForPeriod(a.uid, periodId)] || '2';
            valB = partOrder[getStudentParticipationForPeriod(b.uid, periodId)] || '2';
          } else {
            valA = partOrder[getStudentParticipation(a.uid)] || '2';
            valB = partOrder[getStudentParticipation(b.uid)] || '2';
          }
          break;
        default:
          return 0;
      }
      const comparison = valA.localeCompare(valB, 'ar');
      return dir === 'asc' ? comparison : -comparison;
    });
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedStudents(filteredStudents.map(s => s.uid));
  };

  const deselectAll = () => {
    setSelectedStudents([]);
  };

  // ======================== RENDER ========================

  if (loading) {
    return (
      <div className="subscriptions-page">
        <div className="loading-spinner">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="subscriptions-page">
      <div className="page-header">
        <h1>💳 إدارة الاشتراكات</h1>
        <p className="page-description">
          إدارة فترات الدراسة والاشتراكات المالية للطلاب
        </p>
      </div>

      {/* ========== الفترات السابقة ========== */}
      {studyPeriods.filter(p => !p.isActive).length > 0 && (
        <div className="past-periods-section">
          <h3 className="past-periods-title">📋 الفترات السابقة ({studyPeriods.filter(p => !p.isActive).length})</h3>
          <div className="past-periods-list">
            {studyPeriods.filter(p => !p.isActive).map(period => {
              const isExpanded = expandedPeriodId === period.id;
              const periodStatus = getPeriodStatusLabel(period);
              const stats = getPeriodStats(period.id);
              
              return (
                <div key={period.id} className={`past-period-card ${isExpanded ? 'expanded' : ''}`}>
                  <div 
                    className="past-period-header"
                    onClick={() => setExpandedPeriodId(isExpanded ? null : period.id)}
                  >
                    <div className="past-period-title-section">
                      <span className="past-period-toggle">{isExpanded ? '▼' : '◀'}</span>
                      <h4>📅 {period.name}</h4>
                      <span className={`past-period-status ${periodStatus.class}`}>
                        {periodStatus.label}
                      </span>
                    </div>
                    <div className="past-period-summary">
                      <span className="past-period-stat">✅ {stats.activeCount}</span>
                      <span className="past-period-stat">⏳ {stats.inactiveCount}</span>
                      <span className="past-period-stat">🎓 {stats.exemptCount}</span>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="past-period-details">
                      <div className="past-period-info-grid">
                        <div className="period-info-item">
                          <span className="info-icon">📆</span>
                          <div className="info-content">
                            <span className="info-label">المدة</span>
                            <span className="info-value">{formatDate(period.startDate)} - {formatDate(period.endDate)}</span>
                          </div>
                        </div>
                        <div className="period-info-item">
                          <span className="info-icon">💰</span>
                          <div className="info-content">
                            <span className="info-label">رسوم الاشتراك</span>
                            <span className="info-value">{period.subscriptionFee || 0} {period.currency || 'دينار بحريني'}</span>
                          </div>
                        </div>
                        <div className="period-info-item">
                          <span className="info-icon">💵</span>
                          <div className="info-content">
                            <span className="info-label">إجمالي المدفوعات</span>
                            <span className="info-value">{stats.totalPayments} {period.currency || 'دينار بحريني'}</span>
                          </div>
                        </div>
                        {period.centerId && (
                          <div className="period-info-item">
                            <span className="info-icon">🏛️</span>
                            <div className="info-content">
                              <span className="info-label">المركز</span>
                              <span className="info-value">{centers.find(c => c.id === period.centerId)?.name}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="past-period-stats-grid">
                        <div className="past-stat-card active">
                          <div className="past-stat-icon">✅</div>
                          <div className="past-stat-content">
                            <span className="past-stat-number">{stats.activeCount}</span>
                            <span className="past-stat-label">مشترك نشط</span>
                          </div>
                        </div>
                        <div className="past-stat-card inactive">
                          <div className="past-stat-icon">⏳</div>
                          <div className="past-stat-content">
                            <span className="past-stat-number">{stats.inactiveCount}</span>
                            <span className="past-stat-label">بانتظار الدفع</span>
                          </div>
                        </div>
                        <div className="past-stat-card exempt">
                          <div className="past-stat-icon">🎓</div>
                          <div className="past-stat-content">
                            <span className="past-stat-number">{stats.exemptCount}</span>
                            <span className="past-stat-label">معفي</span>
                          </div>
                        </div>
                      </div>

                      {/* جدول الطلاب للفترة السابقة */}
                      <div className="past-period-students">
                        <div className="past-period-students-header">
                          <h5>👥 حالة الطلاب في هذه الفترة</h5>
                          <div className="past-period-filters">
                            <input
                              type="text"
                              value={pastSearchTerm}
                              onChange={(e) => setPastSearchTerm(e.target.value)}
                              placeholder="🔍 بحث بالاسم..."
                              className="past-search-input"
                            />
                            <select
                              value={pastFilterCenterId}
                              onChange={(e) => setPastFilterCenterId(e.target.value)}
                              className="past-filter-select"
                            >
                              <option value="">جميع المراكز</option>
                              {centers.map(center => (
                                <option key={center.id} value={center.id}>{center.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="past-period-table-container">
                          <table className="past-period-table">
                            <thead>
                              <tr>
                                <th className="sortable-header" onClick={() => handlePastSort('name')}>الاسم{getSortIcon('name', pastSortColumn, pastSortDirection)}</th>
                                <th className="sortable-header" onClick={() => handlePastSort('center')}>المركز{getSortIcon('center', pastSortColumn, pastSortDirection)}</th>
                                <th className="sortable-header" onClick={() => handlePastSort('group')}>الحلقة{getSortIcon('group', pastSortColumn, pastSortDirection)}</th>
                                <th className="sortable-header" onClick={() => handlePastSort('participation')}>المشاركة{getSortIcon('participation', pastSortColumn, pastSortDirection)}</th>
                                <th className="sortable-header" onClick={() => handlePastSort('status')}>حالة الاشتراك{getSortIcon('status', pastSortColumn, pastSortDirection)}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortStudents(
                                students
                                  .filter(s => !pastFilterCenterId || s.centerId === pastFilterCenterId)
                                  .filter(s => {
                                    const st = getStudentStatusForPeriod(s.uid, period.id);
                                    return st === 'active' || st === 'exempt';
                                  })
                                  .filter(s => !pastSearchTerm.trim() || s.name?.toLowerCase().includes(pastSearchTerm.trim().toLowerCase())),
                                pastSortColumn,
                                pastSortDirection,
                                period.id
                              ).map(student => {
                                  const status = getStudentStatusForPeriod(student.uid, period.id);
                                  const statusInfo = SUBSCRIPTION_STATUS[status];
                                  const participation = getStudentParticipationForPeriod(student.uid, period.id);
                                  const participationInfo = PARTICIPATION_STATUS[participation];
                                  return (
                                    <tr key={student.uid}>
                                      <td>{student.name}</td>
                                      <td>{student.centerName}</td>
                                      <td>{student.groupName}</td>
                                      <td>
                                        <span 
                                          className={`status-badge-new participation-${participation}`}
                                          style={{ backgroundColor: participationInfo.color + '20', color: participationInfo.color }}
                                        >
                                          {participationInfo.icon} {participationInfo.label}
                                        </span>
                                      </td>
                                      <td>
                                        <span 
                                          className={`status-badge-new ${status}`}
                                          style={{ backgroundColor: statusInfo.color + '20', color: statusInfo.color }}
                                        >
                                          {statusInfo.icon} {statusInfo.label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              {students.filter(s => 
                                (!pastFilterCenterId || s.centerId === pastFilterCenterId) && 
                                ['active', 'exempt'].includes(getStudentStatusForPeriod(s.uid, period.id)) &&
                                (!pastSearchTerm.trim() || s.name?.toLowerCase().includes(pastSearchTerm.trim().toLowerCase()))
                              ).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="empty-message">لا يوجد طلاب مسجلين في هذه الفترة</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="past-period-actions">
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deletePeriod(period.id)}
                        >
                          🗑️ حذف الفترة
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== الفترة النشطة ========== */}
      {activePeriod ? (
        <div className="active-period-card">
          <div className="period-card-header">
            <div className="period-title-section">
              <h2>📅 {activePeriod.name}</h2>
              <span className="period-status-badge">جارية</span>
            </div>
            <div className="period-actions-inline">
              <button 
                className="period-action-btn edit"
                onClick={() => {
                  setEditingPeriod(activePeriod);
                  setNewPeriod({
                    name: activePeriod.name,
                    type: activePeriod.type,
                    startDate: activePeriod.startDate.toDate().toISOString().split('T')[0],
                    endDate: activePeriod.endDate.toDate().toISOString().split('T')[0],
                    centerId: activePeriod.centerId || '',
                    subscriptionFee: activePeriod.subscriptionFee || 5,
                    currency: activePeriod.currency || 'دينار بحريني',
                    paymentDeadline: activePeriod.paymentDeadline ? activePeriod.paymentDeadline.toDate().toISOString().split('T')[0] : ''
                  });
                  setShowPeriodModal(true);
                }}
                title="تعديل الفترة"
              >
                ✏️
              </button>
            </div>
          </div>
          
          <div className="period-info-grid">
            <div className="period-info-item">
              <span className="info-icon">📆</span>
              <div className="info-content">
                <span className="info-label">المدة</span>
                <span className="info-value">{formatDate(activePeriod.startDate)} - {formatDate(activePeriod.endDate)}</span>
              </div>
            </div>
            <div className="period-info-item">
              <span className="info-icon">💰</span>
              <div className="info-content">
                <span className="info-label">رسوم الاشتراك</span>
                <span className="info-value">{activePeriod.subscriptionFee || 5} {activePeriod.currency || 'دينار بحريني'}</span>
              </div>
            </div>
            {activePeriod.centerId && (
              <div className="period-info-item">
                <span className="info-icon">🏛️</span>
                <div className="info-content">
                  <span className="info-label">المركز</span>
                  <span className="info-value">{centers.find(c => c.id === activePeriod.centerId)?.name}</span>
                </div>
              </div>
            )}
            {activePeriod.paymentDeadline && (
              <div className="period-info-item">
                <span className="info-icon">⏰</span>
                <div className="info-content">
                  <span className="info-label">آخر يوم للدفع</span>
                  <span className="info-value" style={{ color: new Date() > activePeriod.paymentDeadline.toDate() ? '#dc3545' : '#28a745' }}>
                    {formatDate(activePeriod.paymentDeadline)}
                    {new Date() > activePeriod.paymentDeadline.toDate() && ' (انتهى)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="period-stats-grid">
            <div className="stat-card participating">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <span className="stat-number">
                  {students.filter(s => (!filterCenterId || s.centerId === filterCenterId) && getStudentParticipation(s.uid) === 'participating').length}
                </span>
                <span className="stat-label">مشارك</span>
              </div>
            </div>
            <div className="stat-card not-participating">
              <div className="stat-icon">❌</div>
              <div className="stat-content">
                <span className="stat-number">
                  {students.filter(s => (!filterCenterId || s.centerId === filterCenterId) && getStudentParticipation(s.uid) === 'not_participating').length}
                </span>
                <span className="stat-label">غير مشارك</span>
              </div>
            </div>
            <div className="stat-card active">
              <div className="stat-icon">💰</div>
              <div className="stat-content">
                <span className="stat-number">
                  {students.filter(s => (!filterCenterId || s.centerId === filterCenterId) && getStudentPeriodStatus(s.uid) === 'active').length}
                </span>
                <span className="stat-label">مشترك نشط</span>
              </div>
            </div>
            <div className="stat-card inactive">
              <div className="stat-icon">⏳</div>
              <div className="stat-content">
                <span className="stat-number">
                  {students.filter(s => (!filterCenterId || s.centerId === filterCenterId) && getStudentPeriodStatus(s.uid) === 'inactive').length}
                </span>
                <span className="stat-label">بانتظار الدفع</span>
              </div>
            </div>
            <div className="stat-card exempt">
              <div className="stat-icon">🎓</div>
              <div className="stat-content">
                <span className="stat-number">
                  {students.filter(s => (!filterCenterId || s.centerId === filterCenterId) && getStudentPeriodStatus(s.uid) === 'exempt').length}
                </span>
                <span className="stat-label">معفي</span>
              </div>
            </div>
          </div>

          <button 
            className="send-invitations-btn"
            onClick={sendInvitations}
          >
            <span className="btn-icon">📱</span>
            <span className="btn-text">إرسال دعوات الاشتراك</span>
            <span className="btn-count">({students.filter(s => (!filterCenterId || s.centerId === filterCenterId) && getStudentPeriodStatus(s.uid) === 'inactive').length} طالب)</span>
          </button>
        </div>
      ) : (
        <div className="no-active-period">
          <p>⚠️ لا توجد فترة دراسية نشطة</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowPeriodModal(true)}
          >
            ➕ إضافة فترة جديدة
          </button>
        </div>
      )}

      {/* ========== الفلاتر ========== */}
      <div className="filters-section">
        <div className="filter-group search-group">
          <label>🔍 البحث</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            className="filter-input search-input"
          />
        </div>

        <div className="filter-group">
          <label>المركز</label>
          <select
            value={filterCenterId}
            onChange={(e) => setFilterCenterId(e.target.value)}
            className="filter-select"
          >
            <option value="">جميع المراكز</option>
            {centers.map(center => (
              <option key={center.id} value={center.id}>{center.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>الحلقة</label>
          <select
            value={filterGroupId}
            onChange={(e) => setFilterGroupId(e.target.value)}
            className="filter-select"
          >
            <option value="">جميع الحلقات</option>
            {filteredGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>الحالة</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">الكل</option>
            <option value="active">✅ نشط</option>
            <option value="inactive">❌ غير نشط</option>
            <option value="exempt">🎓 معفي</option>
          </select>
        </div>

        <div className="filter-group">
          <label>المشاركة</label>
          <select
            value={filterParticipation}
            onChange={(e) => setFilterParticipation(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">الكل</option>
            <option value="participating">✅ مشارك</option>
            <option value="not_participating">❌ غير مشارك</option>
          </select>
        </div>
      </div>

      {/* ========== شريط الإجراءات ========== */}
      <div className="actions-bar">
        <div className="selection-info">
          <span className="selected-count">
            {selectedStudents.length > 0 
              ? `تم اختيار ${selectedStudents.length} طالب`
              : `إجمالي: ${filteredStudents.length} طالب`
            }
          </span>
          <button 
            className="btn-link"
            onClick={selectedStudents.length > 0 ? deselectAll : selectAllFiltered}
          >
            {selectedStudents.length > 0 ? 'إلغاء التحديد' : 'تحديد الكل'}
          </button>
        </div>

        <div className="action-buttons">
          <button 
            className="btn btn-primary"
            onClick={() => setShowPeriodModal(true)}
          >
            ➕ فترة جديدة
          </button>
          {selectedStudents.length > 1 && (
            <button 
              className="btn btn-success"
              onClick={openMultiPaymentModal}
            >
              💰 دفع جماعي ({selectedStudents.length})
            </button>
          )}
          <button 
            className="btn btn-whatsapp"
            onClick={() => {
              if (selectedStudents.length === 0) {
                alert('يرجى اختيار الطلاب أولاً');
                return;
              }
              setShowBulkModal(true);
            }}
            disabled={selectedStudents.length === 0}
          >
            📱 إرسال WhatsApp
          </button>
        </div>
      </div>

      {/* ========== جدول الطلاب ========== */}
      <div className="table-container">
        <table className="students-table">
          <thead>
            <tr>
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                  onChange={() => selectedStudents.length === filteredStudents.length ? deselectAll() : selectAllFiltered()}
                />
              </th>
              <th className="sortable-header" onClick={() => handleSort('name')}>الاسم{getSortIcon('name', sortColumn, sortDirection)}</th>
              <th className="sortable-header" onClick={() => handleSort('phone')}>الهاتف{getSortIcon('phone', sortColumn, sortDirection)}</th>
              <th className="sortable-header" onClick={() => handleSort('center')}>المركز{getSortIcon('center', sortColumn, sortDirection)}</th>
              <th className="sortable-header" onClick={() => handleSort('group')}>الحلقة{getSortIcon('group', sortColumn, sortDirection)}</th>
              <th className="sortable-header" onClick={() => handleSort('participation')}>المشاركة{getSortIcon('participation', sortColumn, sortDirection)}</th>
              <th className="sortable-header" onClick={() => handleSort('status')}>حالة الاشتراك{getSortIcon('status', sortColumn, sortDirection)}</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-message">
                  لا يوجد طلاب مطابقين للفلاتر المحددة
                </td>
              </tr>
            ) : (
              sortStudents(filteredStudents, sortColumn, sortDirection).map(student => {
                const status = getStudentPeriodStatus(student.uid);
                const statusInfo = SUBSCRIPTION_STATUS[status];
                const participation = getStudentParticipation(student.uid);
                const participationInfo = PARTICIPATION_STATUS[participation];
                const payment = getStudentPayment(student.uid);
                
                return (
                  <tr key={student.uid} className={selectedStudents.includes(student.uid) ? 'selected' : ''}>
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.uid)}
                        onChange={() => toggleStudentSelection(student.uid)}
                      />
                    </td>
                    <td className="student-name">{student.name}</td>
                    <td className="student-phone">{student.phone || student.parentPhone || '-'}</td>
                    <td>{student.centerName}</td>
                    <td>{student.groupName}</td>
                    <td>
                      <button 
                        className={`status-badge-new participation-${participation}`}
                        style={{ 
                          backgroundColor: participationInfo.color + '20', 
                          color: participationInfo.color,
                          border: `1px solid ${participationInfo.color}40`,
                          cursor: processingStudents.includes(student.uid) ? 'wait' : 'pointer',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          opacity: processingStudents.includes(student.uid) ? 0.6 : 1
                        }}
                        onClick={() => toggleParticipation(student.uid)}
                        disabled={processingStudents.includes(student.uid)}
                        title={participation === 'participating' ? 'اضغط لإلغاء المشاركة' : 'اضغط لتفعيل المشاركة'}
                      >
                        {processingStudents.includes(student.uid) ? '⏳' : participationInfo.icon} {participationInfo.label}
                      </button>
                    </td>
                    <td>
                      <span 
                        className={`status-badge-new ${status}`}
                        style={{ backgroundColor: statusInfo.color + '20', color: statusInfo.color }}
                      >
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        {status === 'inactive' && (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => openPaymentModal(student)}
                              title="تسجيل دفع"
                            >
                              💰 دفع
                            </button>
                            <button
                              className="btn btn-sm btn-info"
                              onClick={() => openExemptModal(student)}
                              title="إعفاء"
                            >
                              🎓 إعفاء
                            </button>
                          </>
                        )}
                        {status === 'active' && payment?.receiptImageUrl && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              // فتح نافذة جديدة لعرض صورة الإيصال
                              const newWindow = window.open('', '_blank');
                              if (newWindow) {
                                newWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>إيصال الدفع</title>
                                      <style>
                                        body { 
                                          margin: 0; 
                                          display: flex; 
                                          justify-content: center; 
                                          align-items: center; 
                                          min-height: 100vh; 
                                          background: #1a1a2e;
                                        }
                                        img { 
                                          max-width: 95%; 
                                          max-height: 95vh; 
                                          border-radius: 8px;
                                          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <img src="${payment.receiptImageUrl}" alt="إيصال الدفع" />
                                    </body>
                                  </html>
                                `);
                              }
                            }}
                            title="عرض الإيصال"
                          >
                            🧾
                          </button>
                        )}
                        {(student.phone || student.parentPhone) && (
                          <a
                            href={`https://wa.me/${(student.parentPhone || student.phone || '').replace(/\D/g, '').replace(/^0/, '973')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-whatsapp-icon"
                            title="إرسال رسالة واتساب"
                          >
                            📱
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========== Modal: إضافة/تعديل فترة ========== */}
      {showPeriodModal && (
        <div className="modal-overlay" onClick={() => setShowPeriodModal(false)}>
          <div className="modal-content period-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPeriod ? '✏️ تعديل فترة الدراسة' : '➕ إضافة فترة دراسة جديدة'}</h2>
              <button className="close-btn" onClick={() => { setShowPeriodModal(false); resetPeriodForm(); }}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>اسم الفترة *</label>
                <input
                  type="text"
                  value={newPeriod.name}
                  onChange={(e) => setNewPeriod(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: النشاط الربيعي 2026"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>نوع الفترة *</label>
                <select
                  value={newPeriod.type}
                  onChange={(e) => setNewPeriod(prev => ({ ...prev, type: e.target.value as StudyPeriod['type'] }))}
                  className="form-select"
                >
                  {PERIOD_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>تاريخ البدء *</label>
                  <input
                    type="date"
                    value={newPeriod.startDate}
                    onChange={(e) => setNewPeriod(prev => ({ ...prev, startDate: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>تاريخ الانتهاء *</label>
                  <input
                    type="date"
                    value={newPeriod.endDate}
                    onChange={(e) => setNewPeriod(prev => ({ ...prev, endDate: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>مبلغ الاشتراك *</label>
                  <input
                    type="number"
                    value={newPeriod.subscriptionFee}
                    onChange={(e) => setNewPeriod(prev => ({ ...prev, subscriptionFee: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.5"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>العملة</label>
                  <input
                    type="text"
                    value={newPeriod.currency}
                    onChange={(e) => setNewPeriod(prev => ({ ...prev, currency: e.target.value }))}
                    placeholder="دينار بحريني"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>المركز (اختياري)</label>
                <select
                  value={newPeriod.centerId}
                  onChange={(e) => setNewPeriod(prev => ({ ...prev, centerId: e.target.value }))}
                  className="form-select"
                >
                  <option value="">جميع المراكز</option>
                  {centers.map(center => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))}
                </select>
                <small className="form-hint">اتركه فارغاً لتطبيق الفترة على جميع المراكز</small>
              </div>

              <div className="form-group">
                <label>📅 آخر يوم للدفع</label>
                <input
                  type="date"
                  value={newPeriod.paymentDeadline}
                  onChange={(e) => setNewPeriod(prev => ({ ...prev, paymentDeadline: e.target.value }))}
                  className="form-input"
                />
                <small className="form-hint">بعد هذا التاريخ، سيتم تعطيل حسابات الطلاب الذين لم يدفعوا</small>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowPeriodModal(false); resetPeriodForm(); }}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={savePeriod}>
                {editingPeriod ? 'تحديث' : 'إضافة وإرسال الدعوات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Modal: تسجيل الدفع ========== */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content payment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💰 تسجيل دفع الاشتراك</h2>
              <button className="close-btn" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="payment-students-list">
                <div className="payment-students-header">
                  <h3>الطلاب المشمولين:</h3>
                  <button 
                    className="btn btn-sm btn-add-sibling"
                    onClick={() => setShowSiblingSelector(true)}
                  >
                    ➕ إضافة أخ/أخت
                  </button>
                </div>
                <ul>
                  {selectedStudentsForPayment.map(sid => {
                    const s = students.find(st => st.uid === sid);
                    return (
                      <li key={sid}>
                        <span className="student-name">👤 {s?.name}</span>
                        {selectedStudentsForPayment.length > 1 && (
                          <button 
                            className="btn-remove-student"
                            onClick={() => setSelectedStudentsForPayment(prev => prev.filter(id => id !== sid))}
                            title="إزالة"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {selectedStudentsForPayment.length > 1 && (
                  <div className="siblings-total">
                    💰 إجمالي المبلغ المقترح: <strong>{(activePeriod?.subscriptionFee || 5) * selectedStudentsForPayment.length} {activePeriod?.currency || 'د.ب'}</strong>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>المبلغ المدفوع *</label>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.5"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>اسم الدافع (ولي الأمر)</label>
                  <input
                    type="text"
                    value={paymentData.payerName}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, payerName: e.target.value }))}
                    placeholder="اسم ولي الأمر"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>رقم هاتف الدافع</label>
                  <input
                    type="tel"
                    value={paymentData.payerPhone}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, payerPhone: e.target.value }))}
                    placeholder="رقم الهاتف"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>صورة الإيصال (اختياري) - سيتم استخراج البيانات تلقائياً</label>
                <div className="receipt-upload-area">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    style={{ display: 'none' }}
                  />
                  {receiptPreview ? (
                    <div className="receipt-preview">
                      <img src={receiptPreview} alt="الإيصال" />
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => { 
                          setReceiptFile(null); 
                          setReceiptPreview(''); 
                          setExtractedReceiptData(null);
                        }}
                      >
                        ❌ إزالة
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-outline upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📷 رفع صورة الإيصال
                    </button>
                  )}
                </div>

                {/* عرض حالة استخراج البيانات */}
                {isExtractingData && (
                  <div className="ocr-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${ocrProgress}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">🔍 جاري استخراج البيانات... {ocrProgress}%</span>
                  </div>
                )}

                {/* عرض البيانات المستخرجة */}
                {extractedReceiptData && !isExtractingData && (
                  <div className="extracted-data-card">
                    <h4>📄 البيانات المستخرجة من الإيصال</h4>
                    <div className="extracted-data-grid">
                      {extractedReceiptData.amount && (
                        <div className="extracted-item">
                          <span className="extracted-label">💰 المبلغ:</span>
                          <span className="extracted-value">{extractedReceiptData.amount} د.ب</span>
                        </div>
                      )}
                      {!extractedReceiptData.amount && !extractedReceiptData.bankName && !extractedReceiptData.transactionId && (
                        <div className="extracted-item no-data">
                          <span>⚠️ لم يتم العثور على بيانات واضحة. يرجى إدخال البيانات يدوياً.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ========== بيانات الإيصال ========== */}
              <div className="receipt-data-section">
                <h4 className="section-title">📋 بيانات الإيصال</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>🏦 البنك</label>
                    <input
                      type="text"
                      value={extractedReceiptData?.bankName || ''}
                      onChange={(e) => setExtractedReceiptData(prev => prev ? { ...prev, bankName: e.target.value } : { bankName: e.target.value })}
                      placeholder="مثال: BISB, BenefitPay"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>🔢 رقم المعاملة</label>
                    <input
                      type="text"
                      value={extractedReceiptData?.transactionId || ''}
                      onChange={(e) => setExtractedReceiptData(prev => prev ? { ...prev, transactionId: e.target.value } : { transactionId: e.target.value })}
                      placeholder="رقم المرجع أو المعاملة"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>👤 اسم المرسل (في الإيصال)</label>
                    <input
                      type="text"
                      value={extractedReceiptData?.senderName || ''}
                      onChange={(e) => setExtractedReceiptData(prev => prev ? { ...prev, senderName: e.target.value } : { senderName: e.target.value })}
                      placeholder="اسم صاحب الحساب"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>📅 تاريخ التحويل</label>
                    <input
                      type="text"
                      value={extractedReceiptData?.date || ''}
                      onChange={(e) => setExtractedReceiptData(prev => prev ? { ...prev, date: e.target.value } : { date: e.target.value })}
                      placeholder="DD/MM/YYYY"
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>ملاحظات</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="أي ملاحظات إضافية..."
                  rows={3}
                  className="form-input"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                إلغاء
              </button>
              <button 
                className="btn btn-success" 
                onClick={savePayment}
                disabled={uploadingReceipt}
              >
                {uploadingReceipt ? '⏳ جاري الحفظ...' : '✅ تأكيد الدفع'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Modal: اختيار الإخوة ========== */}
      {showSiblingSelector && (
        <div className="modal-overlay" onClick={() => setShowSiblingSelector(false)}>
          <div className="modal-content sibling-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👨‍👩‍👧‍👦 إضافة أخ/أخت للدفعة</h2>
              <button className="close-btn" onClick={() => setShowSiblingSelector(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="sibling-search">
                <input
                  type="text"
                  placeholder="🔍 ابحث عن الطالب بالاسم..."
                  value={siblingSearchTerm}
                  onChange={(e) => setSiblingSearchTerm(e.target.value)}
                  className="form-input search-input"
                />
              </div>

              <div className="sibling-list">
                {filteredStudents
                  .filter(s => 
                    !selectedStudentsForPayment.includes(s.uid) && 
                    getStudentPeriodStatus(s.uid) === 'inactive' &&
                    (siblingSearchTerm === '' || s.name.includes(siblingSearchTerm))
                  )
                  .slice(0, 20)
                  .map(student => (
                    <div 
                      key={student.uid} 
                      className="sibling-item"
                      onClick={() => {
                        setSelectedStudentsForPayment(prev => [...prev, student.uid]);
                        setPaymentData(prev => ({
                          ...prev,
                          amount: (activePeriod?.subscriptionFee || 5) * (selectedStudentsForPayment.length + 1)
                        }));
                        setShowSiblingSelector(false);
                        setSiblingSearchTerm('');
                      }}
                    >
                      <div className="sibling-info">
                        <span className="sibling-name">👤 {student.name}</span>
                        <span className="sibling-group">{student.groupName || 'بدون مجموعة'}</span>
                      </div>
                      <button className="btn btn-sm btn-primary">➕ إضافة</button>
                    </div>
                  ))}
                {filteredStudents.filter(s => 
                  !selectedStudentsForPayment.includes(s.uid) && 
                  getStudentPeriodStatus(s.uid) === 'inactive' &&
                  (siblingSearchTerm === '' || s.name.includes(siblingSearchTerm))
                ).length === 0 && (
                  <div className="no-siblings">
                    <p>لا يوجد طلاب آخرين بانتظار الدفع</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSiblingSelector(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Modal: إعفاء الطالب ========== */}
      {showExemptModal && exemptStudent && (
        <div className="modal-overlay" onClick={() => setShowExemptModal(false)}>
          <div className="modal-content exempt-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎓 إعفاء الطالب</h2>
              <button className="close-btn" onClick={() => setShowExemptModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <p className="exempt-student-name">الطالب: <strong>{exemptStudent.name}</strong></p>
              
              <div className="form-group">
                <label>سبب الإعفاء *</label>
                <textarea
                  value={exemptReason}
                  onChange={(e) => setExemptReason(e.target.value)}
                  placeholder="مثال: حالة مادية صعبة، طالب متفوق، إلخ..."
                  rows={3}
                  className="form-input"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowExemptModal(false)}>
                إلغاء
              </button>
              <button className="btn btn-info" onClick={saveExemption}>
                🎓 تأكيد الإعفاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Modal: إرسال WhatsApp ========== */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content bulk-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📱 إرسال رسالة WhatsApp جماعية</h2>
              <button className="close-btn" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="selected-info">
                <p>سيتم إرسال الرسالة إلى <strong>{selectedStudents.length}</strong> طالب</p>
              </div>
              
              <div className="message-templates">
                <div className="templates-header">
                  <label>قوالب سريعة:</label>
                </div>
                <div className="template-buttons">
                  {messageTemplates.map(template => (
                    <button
                      key={template.id}
                      className="template-btn"
                      onClick={() => {
                        let msg = template.text;
                        if (activePeriod) {
                          msg = msg
                            .replace(/\{اسم_الفترة\}/g, activePeriod.name)
                            .replace(/\{مبلغ_الاشتراك\}/g, `${activePeriod.subscriptionFee || 5} ${activePeriod.currency || 'دينار بحريني'}`)
                            .replace(/\{تاريخ_الانتهاء\}/g, formatDate(activePeriod.endDate));
                        }
                        setBulkMessage(msg);
                      }}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>نص الرسالة:</label>
                <textarea
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  rows={6}
                  className="message-textarea"
                />
                <small className="form-hint variable-hint">
                  💡 المتغيرات المتاحة: {'{اسم_الطالب}'}, {'{اسم_الفترة}'}, {'{مبلغ_الاشتراك}'}, {'{تاريخ_الانتهاء}'}
                </small>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>
                إلغاء
              </button>
              <button className="btn btn-whatsapp" onClick={sendWhatsAppBulk}>
                📱 إرسال الرسائل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Modal: تقدم الإرسال ========== */}
      {showSendingModal && sendingQueue.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-content sending-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📤 إرسال الرسائل</h2>
              <div className="sending-progress-info">
                <span className="progress-text">
                  {currentSendingIndex + 1} من {sendingQueue.length}
                </span>
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar-fill"
                    style={{ width: `${((currentSendingIndex + 1) / sendingQueue.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-body">
              <div className="current-student-card">
                <div className="student-avatar">
                  {sendingQueue[currentSendingIndex]?.name?.charAt(0) || '؟'}
                </div>
                <div className="student-details">
                  <h3>{sendingQueue[currentSendingIndex]?.name}</h3>
                  <p className="student-phone-display">
                    📱 {sendingQueue[currentSendingIndex]?.parentPhone || sendingQueue[currentSendingIndex]?.phone || 'لا يوجد رقم هاتف'}
                  </p>
                  <p className="student-group-display">
                    📚 {sendingQueue[currentSendingIndex]?.groupName}
                  </p>
                </div>
              </div>

              <div className="sending-instructions">
                <div className="instruction-step">
                  <span className="step-number">1</span>
                  <span className="step-text">اضغط على "فتح واتساب" لفتح المحادثة</span>
                </div>
                <div className="instruction-step">
                  <span className="step-number">2</span>
                  <span className="step-text">أرسل الرسالة في تطبيق واتساب</span>
                </div>
                <div className="instruction-step">
                  <span className="step-number">3</span>
                  <span className="step-text">اضغط "تم الإرسال" للانتقال للطالب التالي</span>
                </div>
              </div>
            </div>

            <div className="modal-footer sending-actions">
              <button 
                className="btn btn-whatsapp"
                onClick={openCurrentStudentWhatsApp}
                disabled={!sendingQueue[currentSendingIndex]?.phone && !sendingQueue[currentSendingIndex]?.parentPhone}
              >
                📱 فتح واتساب
              </button>
              <button 
                className="btn btn-success"
                onClick={confirmSentAndNext}
              >
                ✅ تم الإرسال {currentSendingIndex < sendingQueue.length - 1 ? '→ التالي' : '→ إنهاء'}
              </button>
              <button 
                className="btn btn-warning"
                onClick={skipCurrentStudent}
              >
                ⏭️ تخطي
              </button>
              <button 
                className="btn btn-secondary"
                onClick={finishSending}
              >
                ❌ إنهاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Modal: تقرير الإرسال ========== */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content report-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 تقرير الإرسال</h2>
              <button className="close-btn" onClick={() => setShowReportModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="report-summary">
                <div className="summary-card sent">
                  <span className="summary-icon">✅</span>
                  <span className="summary-number">
                    {sendingResults.filter(r => r.status === 'sent').length}
                  </span>
                  <span className="summary-label">تم الإرسال</span>
                </div>
                <div className="summary-card skipped">
                  <span className="summary-icon">⏭️</span>
                  <span className="summary-number">
                    {sendingResults.filter(r => r.status === 'skipped').length}
                  </span>
                  <span className="summary-label">تم التخطي</span>
                </div>
                <div className="summary-card no-phone">
                  <span className="summary-icon">📵</span>
                  <span className="summary-number">
                    {sendingResults.filter(r => r.status === 'no-phone').length}
                  </span>
                  <span className="summary-label">بدون رقم</span>
                </div>
              </div>

              <div className="report-details">
                <h3>تفاصيل الإرسال:</h3>
                <div className="report-list">
                  {sendingResults.map((result, index) => (
                    <div key={result.studentId} className={`report-item ${result.status}`}>
                      <span className="report-index">{index + 1}</span>
                      <span className="report-name">{result.name}</span>
                      <span className={`report-status ${result.status}`}>
                        {result.status === 'sent' && '✅ تم الإرسال'}
                        {result.status === 'skipped' && '⏭️ تم التخطي'}
                        {result.status === 'no-phone' && '📵 بدون رقم'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowReportModal(false)}>
                ✓ إغلاق التقرير
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsNew;
