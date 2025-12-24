import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  limit,
  Timestamp,
  doc,
  updateDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserRole } from '../context/AuthContext';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: Timestamp;
  readBy: string[];
}

export const useMessages = (conversationId: string | null) => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId || !userProfile?.uid) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // استعلام للحصول على الرسائل مرتبة حسب الوقت
    const messagesQuery = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    // الاستماع للتحديثات اللحظية
    const unsubscribe = onSnapshot(
      messagesQuery,
      async (snapshot) => {
        const msgs: Message[] = [];
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<Message, 'id'>;
          msgs.push({ id: docSnap.id, ...data });
        });

        setMessages(msgs);
        setLoading(false);

        // تحديث عدد الرسائل غير المقروءة إلى صفر
        if (msgs.length > 0) {
          try {
            const convRef = doc(db, 'conversations', conversationId);
            await updateDoc(convRef, {
              [`unreadCount.${userProfile.uid}`]: 0
            });
          } catch (err) {
            console.error('Error updating unread count:', err);
          }
        }
      },
      (err) => {
        console.error('Error fetching messages:', err);
        setError('حدث خطأ في جلب الرسائل');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId, userProfile?.uid]);

  return { messages, loading, error };
};
