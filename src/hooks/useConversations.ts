import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  participantNames: Record<string, string>;
  participantRoles: Record<string, string>;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  unreadCount?: Record<string, number>;
  // للمحادثات الجماعية
  groupId?: string;
  groupName?: string;
  centerId?: string;
}

export const useConversations = () => {
  const { userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!userProfile?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // استعلام للحصول على المحادثات التي يشارك فيها المستخدم
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userProfile.uid),
      orderBy('updatedAt', 'desc')
    );

    // الاستماع للتحديثات اللحظية
    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        const convs: Conversation[] = [];
        let unread = 0;

        snapshot.forEach((doc) => {
          const data = doc.data() as Omit<Conversation, 'id'>;
          const conv = { id: doc.id, ...data };
          convs.push(conv);
          
          // حساب الرسائل غير المقروءة
          if (conv.unreadCount && conv.unreadCount[userProfile.uid]) {
            unread += conv.unreadCount[userProfile.uid];
          }
        });

        setConversations(convs);
        setTotalUnread(unread);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching conversations:', err);
        setError('حدث خطأ في جلب المحادثات');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  return { conversations, loading, error, totalUnread };
};
