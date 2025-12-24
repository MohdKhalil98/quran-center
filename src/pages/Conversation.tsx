import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useMessages, Message } from '../hooks/useMessages';
import { useMessaging } from '../hooks/useMessaging';
import { Conversation as ConversationType } from '../hooks/useConversations';
import '../styles/Messages.css';

const Conversation = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { userProfile } = useAuth();
  const { messages, loading: loadingMessages } = useMessages(conversationId || null);
  const { sendMessage, sending } = useMessaging();
  const navigate = useNavigate();
  
  const [conversation, setConversation] = useState<ConversationType | null>(null);
  const [loadingConv, setLoadingConv] = useState(true);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // جلب بيانات المحادثة
  useEffect(() => {
    const fetchConversation = async () => {
      if (!conversationId) return;
      
      setLoadingConv(true);
      try {
        const convDoc = await getDoc(doc(db, 'conversations', conversationId));
        if (convDoc.exists()) {
          setConversation({ id: convDoc.id, ...convDoc.data() } as ConversationType);
        } else {
          navigate('/messages');
        }
      } catch (error) {
        console.error('Error fetching conversation:', error);
        navigate('/messages');
      }
      setLoadingConv(false);
    };

    fetchConversation();
  }, [conversationId, navigate]);

  // التمرير لأسفل عند وصول رسائل جديدة
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // الحصول على اسم المحادثة
  const getConversationTitle = (): string => {
    if (!conversation) return 'محادثة';
    
    if (conversation.type === 'group' && conversation.groupName) {
      return conversation.groupName;
    }
    
    const otherParticipant = conversation.participants.find(p => p !== userProfile?.uid);
    if (otherParticipant && conversation.participantNames) {
      return conversation.participantNames[otherParticipant] || 'مستخدم';
    }
    
    return 'محادثة';
  };

  // الحصول على وصف المحادثة
  const getConversationSubtitle = (): string => {
    if (!conversation) return '';
    
    if (conversation.type === 'group') {
      return `${conversation.participants.length} مشارك`;
    }
    
    const otherParticipant = conversation.participants.find(p => p !== userProfile?.uid);
    if (otherParticipant && conversation.participantRoles) {
      const role = conversation.participantRoles[otherParticipant];
      const roleNames: Record<string, string> = {
        admin: 'مطور',
        supervisor: 'مشرف',
        teacher: 'معلم',
        student: 'طالب',
        parent: 'ولي أمر'
      };
      return roleNames[role] || '';
    }
    
    return '';
  };

  // إرسال الرسالة
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || !conversationId || sending) return;
    
    const text = messageText;
    setMessageText('');
    
    const success = await sendMessage(conversationId, text);
    
    if (!success) {
      setMessageText(text);
    }
    
    inputRef.current?.focus();
  };

  // التعامل مع الضغط على Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // تنسيق الوقت
  const formatMessageTime = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  // تنسيق التاريخ للفاصل
  const formatDateSeparator = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'اليوم';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'أمس';
    } else {
      return date.toLocaleDateString('ar-SA', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  // التحقق من الحاجة لفاصل تاريخ
  const needsDateSeparator = (currentMsg: Message, prevMsg: Message | null): boolean => {
    if (!prevMsg) return true;
    
    const currentDate = currentMsg.timestamp?.toDate ? 
      currentMsg.timestamp.toDate() : new Date((currentMsg.timestamp as unknown as number));
    const prevDate = prevMsg.timestamp?.toDate ? 
      prevMsg.timestamp.toDate() : new Date((prevMsg.timestamp as unknown as number));
    
    return currentDate.toDateString() !== prevDate.toDateString();
  };

  // الحصول على أيقونة الدور
  const getRoleIcon = (role: string): string => {
    const roleIcons: Record<string, string> = {
      admin: '⚙️',
      supervisor: '👔',
      teacher: '👨‍🏫',
      student: '👨‍🎓',
      parent: '👨‍👩‍👦'
    };
    return roleIcons[role] || '👤';
  };

  if (loadingConv) {
    return (
      <div className="conversation-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>جاري تحميل المحادثة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-page">
      {/* رأس المحادثة */}
      <div className="conversation-header">
        <button 
          className="back-button"
          onClick={() => navigate('/messages')}
        >
          ←
        </button>
        
        <div className="conversation-avatar-large">
          {conversation?.type === 'group' ? '👥' : '👤'}
        </div>
        
        <div className="conversation-title-section">
          <h2>{getConversationTitle()}</h2>
          <span className="conversation-subtitle">{getConversationSubtitle()}</span>
        </div>
      </div>

      {/* منطقة الرسائل */}
      <div className="messages-area">
        {loadingMessages ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>جاري تحميل الرسائل...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-messages">
            <span className="empty-icon">💬</span>
            <p>لا توجد رسائل بعد</p>
            <p className="hint">ابدأ المحادثة بإرسال رسالة</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwn = message.senderId === userProfile?.uid;
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showDateSeparator = needsDateSeparator(message, prevMessage);
              const showSenderName = conversation?.type === 'group' && 
                !isOwn && 
                (!prevMessage || prevMessage.senderId !== message.senderId);
              
              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="date-separator">
                      <span>{formatDateSeparator(message.timestamp)}</span>
                    </div>
                  )}
                  
                  <div className={`message-wrapper ${isOwn ? 'own' : 'other'}`}>
                    {showSenderName && (
                      <div className="message-sender">
                        <span className="sender-icon">
                          {getRoleIcon(message.senderRole)}
                        </span>
                        <span className="sender-name">{message.senderName}</span>
                      </div>
                    )}
                    
                    <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
                      <p className="message-text">{message.text}</p>
                      <span className="message-time">
                        {formatMessageTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* حقل إدخال الرسالة */}
      <form className="message-input-form" onSubmit={handleSendMessage}>
        <div className="message-input-container">
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك..."
            className="message-input"
            rows={1}
            disabled={sending}
          />
          
          <button 
            type="submit" 
            className="send-button"
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <span className="spinner-small"></span>
            ) : (
              <span>إرسال</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Conversation;
