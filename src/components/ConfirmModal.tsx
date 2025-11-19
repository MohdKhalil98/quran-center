import React from 'react';

interface Props {
  open: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999
};

const boxStyle: React.CSSProperties = {
  background: '#fff',
  padding: '16px',
  borderRadius: '6px',
  maxWidth: '400px',
  width: '90%',
  boxShadow: '0 6px 18px rgba(0,0,0,0.15)'
};

export default function ConfirmModal({ open, title, message, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true">
      <div style={boxStyle}>
        {title && <h3 style={{ marginTop: 0 }}>{title}</h3>}
        <p>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            إلغاء
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            نعم، احذف
          </button>
        </div>
      </div>
    </div>
  );
}
