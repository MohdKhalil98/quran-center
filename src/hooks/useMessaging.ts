import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc,
  query, 
  where, 
  getDocs,
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserRole, UserProfile } from '../context/AuthContext';
import { useState } from 'react';

interface CreateConversationParams {
  type: 'direct' | 'group';
  participantId?: string; // للمحادثة المباشرة
  participantIds?: string[]; // للمحادثة الجماعية
  groupId?: string;
  groupName?: string;
}

export const useMessaging = () => {
  const { userProfile } = useAuth();
  const [sending, setSending] = useState(false);

  // التحقق من صلاحيات المراسلة
  const canMessageUser = (targetRole: UserRole, targetId?: string): boolean => {
    if (!userProfile) return false;
    
    const myRole = userProfile.role;
    
    // المطور يمكنه مراسلة الجميع
    if (myRole === 'admin') return true;
    
    // المشرف يمكنه مراسلة المعلمين والطلاب في مركزه
    if (myRole === 'supervisor') {
      return ['teacher', 'student', 'parent', 'admin'].includes(targetRole);
    }
    
    // المعلم يمكنه مراسلة: المشرف، الطلاب في حلقته، أولياء أمور طلابه
    if (myRole === 'teacher') {
      return ['supervisor', 'student', 'parent'].includes(targetRole);
    }
    
    // الطالب يمكنه مراسلة معلمه فقط
    if (myRole === 'student') {
      return targetRole === 'teacher';
    }
    
    // ولي الأمر يمكنه مراسلة معلم ابنه فقط
    if (myRole === 'parent') {
      return targetRole === 'teacher';
    }
    
    return false;
  };

  // جلب جهات الاتصال المتاحة للمراسلة
  const getAvailableContacts = async (): Promise<UserProfile[]> => {
    if (!userProfile) return [];
    
    const contacts: UserProfile[] = [];
    const myRole = userProfile.role;
    
    try {
      // المطور - جلب جميع المستخدمين
      if (myRole === 'admin') {
        const usersQuery = query(
          collection(db, 'users'),
          where('active', '==', true)
        );
        const snapshot = await getDocs(usersQuery);
        snapshot.forEach(doc => {
          if (doc.id !== userProfile.uid) {
            contacts.push(doc.data() as UserProfile);
          }
        });
        return contacts;
      }
      
      // المشرف - المعلمين والطلاب في مركزه
      if (myRole === 'supervisor' && userProfile.centerId) {
        const centerUsersQuery = query(
          collection(db, 'users'),
          where('centerId', '==', userProfile.centerId),
          where('active', '==', true)
        );
        const snapshot = await getDocs(centerUsersQuery);
        snapshot.forEach(doc => {
          const userData = doc.data() as UserProfile;
          if (doc.id !== userProfile.uid && ['teacher', 'student'].includes(userData.role)) {
            contacts.push(userData);
          }
        });
        return contacts;
      }
      
      // المعلم - المشرف والطلاب في حلقاته
      if (myRole === 'teacher' && userProfile.centerId) {
        // جلب المشرف
        const supervisorQuery = query(
          collection(db, 'users'),
          where('role', '==', 'supervisor'),
          where('centerId', '==', userProfile.centerId),
          where('active', '==', true)
        );
        const supervisorSnapshot = await getDocs(supervisorQuery);
        supervisorSnapshot.forEach(doc => {
          contacts.push(doc.data() as UserProfile);
        });
        
        // جلب الحلقات التي يدرسها المعلم
        const groupsQuery = query(
          collection(db, 'groups'),
          where('teacherId', '==', userProfile.uid)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupIds = groupsSnapshot.docs.map(doc => doc.id);
        
        // جلب الطلاب في هذه الحلقات
        if (groupIds.length > 0) {
          const studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('status', '==', 'approved'),
            where('active', '==', true)
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          studentsSnapshot.forEach(doc => {
            const studentData = doc.data() as UserProfile;
            if (studentData.groupId && groupIds.includes(studentData.groupId)) {
              contacts.push(studentData);
            }
          });
        }
        
        return contacts;
      }
      
      // الطالب - معلمه فقط
      if (myRole === 'student' && userProfile.groupId) {
        // جلب معلومات الحلقة للحصول على معرف المعلم
        const groupDoc = await getDocs(query(
          collection(db, 'groups'),
          where('__name__', '==', userProfile.groupId)
        ));
        
        if (!groupDoc.empty) {
          const groupData = groupDoc.docs[0].data();
          if (groupData.teacherId) {
            const teacherQuery = query(
              collection(db, 'users'),
              where('uid', '==', groupData.teacherId)
            );
            const teacherSnapshot = await getDocs(teacherQuery);
            teacherSnapshot.forEach(doc => {
              contacts.push(doc.data() as UserProfile);
            });
          }
        }
        
        return contacts;
      }
      
      // ولي الأمر - معلم ابنه
      if (myRole === 'parent' && userProfile.studentId) {
        // جلب بيانات الطالب
        const studentQuery = query(
          collection(db, 'users'),
          where('uid', '==', userProfile.studentId)
        );
        const studentSnapshot = await getDocs(studentQuery);
        
        if (!studentSnapshot.empty) {
          const studentData = studentSnapshot.docs[0].data() as UserProfile;
          if (studentData.groupId) {
            // جلب معلومات الحلقة
            const groupDoc = await getDocs(query(
              collection(db, 'groups'),
              where('__name__', '==', studentData.groupId)
            ));
            
            if (!groupDoc.empty) {
              const groupData = groupDoc.docs[0].data();
              if (groupData.teacherId) {
                const teacherQuery = query(
                  collection(db, 'users'),
                  where('uid', '==', groupData.teacherId)
                );
                const teacherSnapshot = await getDocs(teacherQuery);
                teacherSnapshot.forEach(doc => {
                  contacts.push(doc.data() as UserProfile);
                });
              }
            }
          }
        }
        
        return contacts;
      }
      
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
    
    return contacts;
  };

  // البحث عن محادثة موجودة أو إنشاء واحدة جديدة
  const findOrCreateConversation = async (params: CreateConversationParams): Promise<string | null> => {
    if (!userProfile) return null;
    
    try {
      if (params.type === 'direct' && params.participantId) {
        // البحث عن محادثة مباشرة موجودة
        const existingQuery = query(
          collection(db, 'conversations'),
          where('type', '==', 'direct'),
          where('participants', 'array-contains', userProfile.uid)
        );
        
        const existingSnapshot = await getDocs(existingQuery);
        
        for (const docSnap of existingSnapshot.docs) {
          const data = docSnap.data();
          if (data.participants.includes(params.participantId)) {
            return docSnap.id;
          }
        }
        
        // إنشاء محادثة جديدة
        // جلب بيانات المشارك الآخر
        const participantQuery = query(
          collection(db, 'users'),
          where('uid', '==', params.participantId)
        );
        const participantSnapshot = await getDocs(participantQuery);
        
        if (participantSnapshot.empty) {
          throw new Error('المستخدم غير موجود');
        }
        
        const participantData = participantSnapshot.docs[0].data() as UserProfile;
        
        const newConversation = {
          type: 'direct',
          participants: [userProfile.uid, params.participantId],
          participantNames: {
            [userProfile.uid]: userProfile.name,
            [params.participantId]: participantData.name
          },
          participantRoles: {
            [userProfile.uid]: userProfile.role,
            [params.participantId]: participantData.role
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unreadCount: {
            [userProfile.uid]: 0,
            [params.participantId]: 0
          }
        };
        
        const docRef = await addDoc(collection(db, 'conversations'), newConversation);
        return docRef.id;
      }
      
      // محادثة جماعية للحلقة
      if (params.type === 'group' && params.groupId) {
        // البحث عن محادثة جماعية موجودة للحلقة
        const existingQuery = query(
          collection(db, 'conversations'),
          where('type', '==', 'group'),
          where('groupId', '==', params.groupId)
        );
        
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
          return existingSnapshot.docs[0].id;
        }
        
        // إنشاء محادثة جماعية جديدة
        if (params.participantIds && params.participantIds.length > 0) {
          const participantNames: Record<string, string> = {};
          const participantRoles: Record<string, string> = {};
          const unreadCount: Record<string, number> = {};
          
          // جلب بيانات جميع المشاركين
          for (const participantId of params.participantIds) {
            const pQuery = query(
              collection(db, 'users'),
              where('uid', '==', participantId)
            );
            const pSnapshot = await getDocs(pQuery);
            if (!pSnapshot.empty) {
              const pData = pSnapshot.docs[0].data() as UserProfile;
              participantNames[participantId] = pData.name;
              participantRoles[participantId] = pData.role;
              unreadCount[participantId] = 0;
            }
          }
          
          const newConversation = {
            type: 'group',
            groupId: params.groupId,
            groupName: params.groupName || 'محادثة جماعية',
            participants: params.participantIds,
            participantNames,
            participantRoles,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            unreadCount
          };
          
          const docRef = await addDoc(collection(db, 'conversations'), newConversation);
          return docRef.id;
        }
      }
      
    } catch (error) {
      console.error('Error finding/creating conversation:', error);
      throw error;
    }
    
    return null;
  };

  // إرسال رسالة
  const sendMessage = async (conversationId: string, text: string): Promise<boolean> => {
    if (!userProfile || !text.trim()) return false;
    
    setSending(true);
    
    try {
      // إضافة الرسالة إلى مجموعة الرسائل الفرعية
      const messageData = {
        conversationId,
        senderId: userProfile.uid,
        senderName: userProfile.name,
        senderRole: userProfile.role,
        text: text.trim(),
        timestamp: serverTimestamp(),
        readBy: [userProfile.uid]
      };
      
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);
      
      // تحديث آخر رسالة في المحادثة
      const convRef = doc(db, 'conversations', conversationId);
      
      // جلب المحادثة للحصول على المشاركين
      const convQuery = query(
        collection(db, 'conversations'),
        where('__name__', '==', conversationId)
      );
      const convSnapshot = await getDocs(convQuery);
      
      if (!convSnapshot.empty) {
        const convData = convSnapshot.docs[0].data();
        const updateData: Record<string, unknown> = {
          lastMessage: {
            text: text.trim(),
            senderId: userProfile.uid,
            senderName: userProfile.name,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        };
        
        // زيادة عداد الرسائل غير المقروءة للمشاركين الآخرين
        for (const participantId of convData.participants) {
          if (participantId !== userProfile.uid) {
            (updateData as Record<string, any>)[`unreadCount.${participantId}`] = increment(1);
          }
        }
        
        await updateDoc(convRef, updateData as Record<string, any>);
      }
      
      setSending(false);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      setSending(false);
      return false;
    }
  };

  // تحديث المشاركين في محادثة جماعية (إضافة طالب جديد)
  const addParticipantToGroupChat = async (groupId: string, newParticipantId: string): Promise<boolean> => {
    try {
      // البحث عن المحادثة الجماعية للحلقة
      const existingQuery = query(
        collection(db, 'conversations'),
        where('type', '==', 'group'),
        where('groupId', '==', groupId)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (existingSnapshot.empty) {
        // لا توجد محادثة جماعية للحلقة
        return false;
      }
      
      const convDoc = existingSnapshot.docs[0];
      const convData = convDoc.data();
      
      // التحقق من عدم وجود المشارك مسبقاً
      if (convData.participants.includes(newParticipantId)) {
        return true; // موجود بالفعل
      }
      
      // جلب بيانات المشارك الجديد
      const participantQuery = query(
        collection(db, 'users'),
        where('uid', '==', newParticipantId)
      );
      const participantSnapshot = await getDocs(participantQuery);
      
      if (participantSnapshot.empty) {
        return false;
      }
      
      const participantData = participantSnapshot.docs[0].data() as UserProfile;
      
      // تحديث المحادثة
      const convRef = doc(db, 'conversations', convDoc.id);
      await updateDoc(convRef, {
        participants: [...convData.participants, newParticipantId],
        [`participantNames.${newParticipantId}`]: participantData.name,
        [`participantRoles.${newParticipantId}`]: participantData.role,
        [`unreadCount.${newParticipantId}`]: 0
      });
      
      return true;
    } catch (error) {
      console.error('Error adding participant to group chat:', error);
      return false;
    }
  };

  return {
    canMessageUser,
    getAvailableContacts,
    findOrCreateConversation,
    sendMessage,
    addParticipantToGroupChat,
    sending
  };
};
