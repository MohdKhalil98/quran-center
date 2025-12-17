import { useState, useCallback } from 'react';

type MessageType = 'success' | 'error' | 'warning' | 'info';

interface MessageState {
  open: boolean;
  type: MessageType;
  title: string;
  message: string;
}

export function useMessageBox() {
  const [messageBox, setMessageBox] = useState<MessageState>({
    open: false,
    type: 'info',
    title: '',
    message: ''
  });

  const showMessage = useCallback((
    type: MessageType, 
    title: string, 
    message: string
  ) => {
    setMessageBox({ open: true, type, title, message });
  }, []);

  const showSuccess = useCallback((title: string, message: string) => {
    showMessage('success', title, message);
  }, [showMessage]);

  const showError = useCallback((title: string, message: string) => {
    showMessage('error', title, message);
  }, [showMessage]);

  const showWarning = useCallback((title: string, message: string) => {
    showMessage('warning', title, message);
  }, [showMessage]);

  const showInfo = useCallback((title: string, message: string) => {
    showMessage('info', title, message);
  }, [showMessage]);

  const closeMessage = useCallback(() => {
    setMessageBox(prev => ({ ...prev, open: false }));
  }, []);

  return {
    messageBox,
    showMessage,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    closeMessage
  };
}
