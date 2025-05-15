import React from 'react';
import './LogsView.css'; // Stil dosyası için import

const LogsView = ({ logs }) => {
  if (!logs || logs.length === 0) {
    return (
      <div className="logs-view">
        <h2>Application Logs</h2>
        <p>No log entries yet.</p>
      </div>
    );
  }

  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString(); // Kullanıcının lokal zaman formatına göre gösterim
  };

  return (
    <div className="logs-view">
      <h2>Application Logs</h2>
      <div className="logs-container">
        {logs.map(log => (
          <div key={log.id} className={`log-entry log-${log.type}`}>
            <div className="log-header">
              <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
              <span className="log-action">Action: {log.action}</span>
            </div>
            <div className="log-message">{log.message}</div>
            {log.details && Object.keys(log.details).length > 0 && (
              <details className="log-details">
                <summary>Details</summary>
                <pre>{JSON.stringify(log.details, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogsView; 