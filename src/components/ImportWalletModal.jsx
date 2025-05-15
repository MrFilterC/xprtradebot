import React from 'react';

const ImportWalletModal = ({
  show,
  onClose,
  privateKey,
  setPrivateKey,
  walletName,
  setWalletName,
  error,
  onImport
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Import Existing Wallet</h3>
        <div className="form-group">
          <label htmlFor="importPrivateKeyModal">Private Key</label>
          <input
            type="password"
            id="importPrivateKeyModal" // Different id to avoid conflict with App.jsx if both rendered (though unlikely now)
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Enter wallet private key (base58 format)"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="importWalletNameModal">Wallet Name (Optional)</label>
          <input
            type="text"
            id="importWalletNameModal" // Different id
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            placeholder="Enter a name for this wallet"
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="modal-actions">
          <button 
            className="cancel-button" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="import-button" 
            onClick={onImport}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportWalletModal; 