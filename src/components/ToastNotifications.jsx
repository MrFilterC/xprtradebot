import React from 'react';
import './ToastNotifications.css'; // Stil dosyası için import

const ToastNotifications = ({ toasts, removeToast }) => {
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-notifications-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast-notification toast-${toast.type}`}>
          <div className="toast-message">{toast.message}</div>
          <button 
            className="toast-close-button" 
            onClick={() => removeToast(toast.id)}
            title="Close"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastNotifications; 