import React from 'react';
import './WalletItem.css'; // Import the CSS file

const WalletItem = ({
  wallet,
  isEditing,
  editName,
  onSetEditName,
  onUpdateName,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onCopyToClipboard,
  balance,
  isLoadingBalance
}) => {
  return (
    <div className="wallet-item" key={wallet.id}>
      <div className="wallet-info">
        {isEditing ? (
          <div className="edit-name-form">
            <input
              type="text"
              value={editName}
              onChange={(e) => onSetEditName(e.target.value)}
              placeholder="Enter wallet name"
              autoFocus
            />
            <div className="edit-actions">
              <button
                className="save-button"
                onClick={() => onUpdateName(wallet.id)}
              >
                Save
              </button>
              <button
                className="cancel-button"
                onClick={onCancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <h3>
            {wallet.name}
            <button
              className="edit-name-button"
              onClick={() => onStartEdit(wallet.id, wallet.name)}
              title="Edit Name"
            >
              ✏️
            </button>
          </h3>
        )}
        <div className="wallet-key-group public-key-group">
          <span className="key-label">Public Key:</span>
          <div className="key-content-wrapper">
            <span className="key-value" title={wallet.publicKey}>{wallet.publicKey}</span>
            <button 
              className="copy-button" 
              onClick={() => onCopyToClipboard(wallet.publicKey)}
              title="Copy Public Key"
            >
              Copy
            </button>
          </div>
        </div>
        <div className="wallet-key-group private-key-group">
          <span className="key-label">Private Key:</span>
          <div className="key-content-wrapper">
            <span className="key-value" title={wallet.privateKey}>{wallet.privateKey.substring(0, 8)}...{wallet.privateKey.substring(wallet.privateKey.length - 8)}</span>
            <button 
              className="copy-button" 
              onClick={() => onCopyToClipboard(wallet.privateKey)}
              title="Copy Private Key"
            >
              Copy
            </button>
          </div>
        </div>
        <div className="wallet-balance-group">
          <span className="balance-label">Balance:</span>
          <span className="balance-value">
            {isLoadingBalance ? (
              <span className="loading-balance">Loading...</span>
            ) : balance !== undefined ? (
              typeof balance === 'number' 
                ? `${balance.toFixed(6)} SOL` 
                : balance // 'Error' or other string status
            ) : (
              <span className="loading-balance">Loading...</span> // Fallback if balance is undefined and not loading
            )}
          </span>
        </div>
      </div>
      <div className="wallet-actions">
        <button 
          className="delete-button" 
          onClick={() => onDelete(wallet.id)}
          title="Delete Wallet"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default WalletItem; 