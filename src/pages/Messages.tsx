import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConversations, Conversation } from '../hooks/useConversations';
import { useMessaging } from '../hooks/useMessaging';
import { UserProfile } from '../context/AuthContext';
import { deleteDoc, doc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Messages.css';

const Messages = () => {
  const { userProfile } = useAuth();
  const { conversations, loading, totalUnread } = useConversations();
  const { getAvailableContacts, findOrCreateConversation } = useMessaging();
  const navigate = useNavigate();
  
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [deletingConv, setDeletingConv] = useState<string | null>(null);

  // جلب جهات الاتصال المتاحة
  useEffect(() => {
    const fetchContacts = async () => {
      setLoadingContacts(true);
      try {
        const availableContacts = await getAvailableContacts();
        setContacts(availableContacts);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      }
      setLoadingContacts(false);
    };

    if (showNewChat) {
      fetchContacts();
    }
  }, [showNewChat]);

  // بدء محادثة جديدة
  const startNewChat = async (contact: UserProfile) => {
    setCreatingChat(true);
    try {
      const conversationId = await findOrCreateConversation({
        type: 'direct',
        participantId: contact.uid
      });
      
      if (conversationId) {
        navigate(`/messages/${conversationId}`);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
    setCreatingChat(false);
    setShowNewChat(false);
  };

  // فتح محادثة موجودة
  const openConversation = (conversation: Conversation) => {
    navigate(`/messages/${conversation.id}`);
  };

  // حذف محادثة
  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // منع فتح المحادثة عند الضغط على زر الحذف
    
    if (!window.confirm('هل أنت متأكد من حذف هذه المحادثة؟ سيتم حذف جميع الرسائل بشكل نهائي.')) {
      return;
    }

    setDeletingConv(conversationId);

    try {
      // حذف جميع الرسائل في المحادثة
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      // حذف كل رسالة
      const deletePromises = messagesSnapshot.docs.map(messageDoc => 
        deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageDoc.id))
      );
      await Promise.all(deletePromises);

      // حذف المحادثة نفسها
      await deleteDoc(doc(db, 'conversations', conversationId));

      // تحديث القائمة محلياً (سيتم تحديثها تلقائياً من خلال useConversations)
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('حدث خطأ أثناء حذف المحادثة');
    } finally {
      setDeletingConv(null);
    }
  };

  // الحصول على اسم المحادثة
  const getConversationName = (conv: Conversation): string => {
    if (conv.type === 'group' && conv.groupName) {
      return `👥 ${conv.groupName}`;
    }
    
    // محادثة مباشرة - عرض اسم الشخص الآخر
    const otherParticipant = conv.participants.find(p => p !== userProfile?.uid);
    if (otherParticipant && conv.participantNames) {
      return conv.participantNames[otherParticipant] || 'مستخدم';
    }
    
    return 'محادثة';
  };

  // الحصول على دور الشخص الآخر
  const getOtherParticipantRole = (conv: Conversation): string => {
    if (conv.type === 'group') return 'محادثة جماعية';
    
    const otherParticipant = conv.participants.find(p => p !== userProfile?.uid);
    if (otherParticipant && conv.participantRoles) {
      const role = conv.participantRoles[otherParticipant];
      const roleNames: Record<string, string> = {
        admin: 'مطور',
        supervisor: 'مشرف',
        teacher: 'معلم',
        student: 'طالب',
        parent: 'ولي أمر'
      };
      return roleNames[role] || role;
    }
    return '';
  };

  // تنسيق التاريخ
  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'أمس';
    } else if (days < 7) {
      return date.toLocaleDateString('ar-SA', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('ar-SA');
    }
  };

  // فلترة جهات الاتصال
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // فلترة المحادثات
  const filteredConversations = conversations.filter(conv => {
    const name = getConversationName(conv);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getRoleName = (role: string): string => {
    const roleNames: Record<string, string> = {
      admin: 'مطور',
      supervisor: 'مشرف',
      teacher: 'معلم',
      student: 'طالب',
      parent: 'ولي أمر'
    };
    return roleNames[role] || role;
  };

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

  return (
    <div className="messages-page">
      <div className="page__header">
        <h1>💬 الرسائل</h1>
        <p>تواصل مع المعلمين والطلاب</p>
      </div>

      <div className="messages-container">
        {/* شريط الأدوات */}
        <div className="messages-toolbar">
          <div className="search-box">
            <input
              type="text"
              placeholder="بحث في المحادثات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
          
          <button 
            className="btn-new-chat"
            onClick={() => setShowNewChat(true)}
          >
            <span>✏️</span>
            محادثة جديدة
          </button>
        </div>

        {/* قائمة المحادثات */}
        <div className="conversations-list">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>جاري تحميل المحادثات...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">💬</span>
              <h3>لا توجد محادثات</h3>
              <p>ابدأ محادثة جديدة للتواصل مع الآخرين</p>
              <button 
                className="btn-primary"
                onClick={() => setShowNewChat(true)}
              >
                بدء محادثة جديدة
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const unreadCount = conv.unreadCount?.[userProfile?.uid || ''] || 0;
              
              return (
                <div
                  key={conv.id}
                  className={`conversation-item ${unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => openConversation(conv)}
                >
                  <div className="conversation-avatar">
                    {conv.type === 'group' ? '👥' : '👤'}
                  </div>
                  
                  <div className="conversation-info">
                    <div className="conversation-header">
                      <span className="conversation-name">
                        {getConversationName(conv)}
                      </span>
                      <span className="conversation-time">
                        {conv.lastMessage && formatTime(conv.lastMessage.timestamp)}
                      </span>
                    </div>
                    
                    <div className="conversation-preview">
                      <span className="conversation-role">
                        {getOtherParticipantRole(conv)}
                      </span>
                      {conv.lastMessage && (
                        <span className="last-message">
                          {conv.lastMessage.senderName === userProfile?.name ? 'أنت: ' : ''}
                          {conv.lastMessage.text.substring(0, 40)}
                          {conv.lastMessage.text.length > 40 ? '...' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="conversation-actions">
                    {unreadCount > 0 && (
                      <div className="unread-badge">{unreadCount}</div>
                    )}
                    <button
                      className={`btn-delete-conversation ${deletingConv === conv.id ? 'deleting' : ''}`}
                      onClick={(e) => deleteConversation(conv.id, e)}
                      disabled={deletingConv === conv.id}
                      title="حذف المحادثة"
                    >
                      {deletingConv === conv.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* نافذة محادثة جديدة */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-content new-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>محادثة جديدة</h2>
              <button 
                className="modal-close"
                onClick={() => setShowNewChat(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="ابحث عن شخص..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <span className="search-icon">🔍</span>
              </div>
              
              <div className="contacts-list">
                {loadingContacts ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>جاري تحميل جهات الاتصال...</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">👥</span>
                    <p>لا توجد جهات اتصال متاحة</p>
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <div
                      key={contact.uid}
                      className={`contact-item ${creatingChat ? 'disabled' : ''}`}
                      onClick={() => !creatingChat && startNewChat(contact)}
                    >
                      <div className="contact-avatar">
                        {getRoleIcon(contact.role)}
                      </div>
                      <div className="contact-info">
                        <span className="contact-name">{contact.name}</span>
                        <span className="contact-role">{getRoleName(contact.role)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
