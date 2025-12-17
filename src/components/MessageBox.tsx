import React from 'react';

type MessageType = 'success' | 'error' | 'warning' | 'info';

interface Props {
  open: boolean;
  type?: MessageType;
  title?: string;
  message: string;
  onClose: () => void;
  autoClose?: number; // milliseconds, 0 to disable
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  animation: 'fadeIn 0.2s ease'
};

const getTypeStyles = (type: MessageType) => {
  const styles: Record<MessageType, { bg: string; border: string; icon: string; color: string }> = {
    success: {
      bg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
      border: '#4caf50',
      icon: '✅',
      color: '#2e7d32'
    },
    error: {
      bg: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
      border: '#f44336',
      icon: '❌',
      color: '#c62828'
    },
    warning: {
      bg: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)',
      border: '#ff9800',
      icon: '⚠️',
      color: '#e65100'
    },
    info: {
      bg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
      border: '#2196f3',
      icon: 'ℹ️',
      color: '#1565c0'
    }
  };
  return styles[type];
};

export default function MessageBox({ 
  open, 
  type = 'info', 
  title, 
  message, 
  onClose,
  autoClose = 0 
}: Props) {
  const typeStyle = getTypeStyles(type);

  React.useEffect(() => {
    if (open && autoClose > 0) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [open, autoClose, onClose]);

  if (!open) return null;

  const boxStyle: React.CSSProperties = {
    background: typeStyle.bg,
    padding: '24px 28px',
    borderRadius: '16px',
    maxWidth: '450px',
    width: '90%',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    border: `3px solid ${typeStyle.border}`,
    textAlign: 'center',
    animation: 'slideIn 0.3s ease'
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '3rem',
    marginBottom: '12px',
    display: 'block'
  };

  const titleStyle: React.CSSProperties = {
    margin: '0 0 12px 0',
    color: typeStyle.color,
    fontSize: '1.4rem',
    fontWeight: 700
  };

  const messageStyle: React.CSSProperties = {
    margin: 0,
    color: '#333',
    fontSize: '1.1rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-line'
  };

  const buttonStyle: React.CSSProperties = {
    marginTop: '20px',
    padding: '12px 40px',
    fontSize: '1rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    background: typeStyle.border,
    color: 'white',
    transition: 'all 0.2s ease'
  };

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { 
              opacity: 0; 
              transform: scale(0.9) translateY(-20px); 
            }
            to { 
              opacity: 1; 
              transform: scale(1) translateY(0); 
            }
          }
        `}
      </style>
      <div style={backdropStyle} role="dialog" aria-modal="true" onClick={onClose}>
        <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
          <span style={iconStyle}>{typeStyle.icon}</span>
          {title && <h3 style={titleStyle}>{title}</h3>}
          <p style={messageStyle}>{message}</p>
          <button 
            style={buttonStyle} 
            onClick={onClose}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            حسناً
          </button>
        </div>
      </div>
    </>
  );
}
