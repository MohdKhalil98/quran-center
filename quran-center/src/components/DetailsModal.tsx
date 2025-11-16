import React from 'react';
import '../styles/DetailsModal.css';

interface DetailsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: { label: string; value: string | undefined }[];
  actions?: React.ReactNode;
}

const DetailsModal: React.FC<DetailsModalProps> = ({ open, onClose, title, fields, actions }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* صورة أو أيقونة أعلى النافذة (اختياري) */}
        {/* <div style={{marginBottom: '12px'}}><img src="/assets/books.png" alt="icon" style={{width: 60}} /></div> */}
        <h2>{title}</h2>
        <div className="details-list">
          {fields.map((field, idx) => (
            <div key={idx} className="details-row">
              <span className="details-label">{field.label}:</span>
              <span className="details-value">{field.value || '-'}</span>
            </div>
          ))}
        </div>
        <div style={{display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap'}}>
          {actions}
          <button className="btn-modal btn-modal-close" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailsModal;
