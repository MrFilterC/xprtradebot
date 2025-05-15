import React from 'react';
import './DonationFooter.css'; // We will create this CSS file

const DonationFooter = () => {
  const solAddress = 'H1gfC5MCUd8QBRB6fk2Pc137y1TBHqXYBy9AyhXTPQbX';

  const copyAddress = () => {
    navigator.clipboard.writeText(solAddress)
      .then(() => {
        // Using alert for now, as passing addToast here would require more prop drilling
        // or a context API for toast notifications.
        alert('SOL address copied to clipboard!'); 
      })
      .catch(err => {
        console.error('Failed to copy SOL address: ', err);
        alert('Failed to copy address.'); // Simple feedback for error too
      });
  };

  return (
    <footer className="donation-footer">
      <p>
        If you\'ve made a significant profit and this tool helped you get there, 
        consider buying me a coffee! SOL: 
        <span className="sol-address-container" title="Click address or icon to copy">
          <span className="sol-address-text" onClick={copyAddress}>{solAddress}</span>
          <button type="button" onClick={copyAddress} className="copy-icon-button-footer" aria-label="Copy SOL address">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-clipboard" viewBox="0 0 16 16">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>
          </button>
        </span>
      </p>
    </footer>
  );
};

export default DonationFooter; 