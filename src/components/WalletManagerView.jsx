import React, { useState, useEffect } from 'react';
import WalletItem from './WalletItem';
import ImportWalletModal from './ImportWalletModal';

const WalletManagerView = ({
  wallets,
  walletBalances,
  isLoadingBalances,
  showImportModal,
  setShowImportModal,
  importPrivateKey,
  setImportPrivateKey,
  importWalletName,
  setImportWalletName,
  importError,
  createWallet,
  importWallet,
  closeImportModal,
  deleteWallet,
  editingWalletId,
  editWalletName,
  setEditWalletName,
  startEditingWalletName,
  cancelEditingWalletName,
  updateWalletName,
  onCopyToClipboard,
  addLogEntry,
  addToast
}) => {
  const [currentImportError, setCurrentImportError] = useState('');

  const handleCreateWallet = () => {
    const result = createWallet();
    if (result) {
      addLogEntry(result.type || result.status, result.action, result.message, result.details);
      addToast(result.type || result.status, result.message);
    }
  };

  const handleImportWallet = async () => {
    const result = importWallet();
    if (result) {
      if (result.status === 'success') {
        addLogEntry('success', result.action, result.message, result.details);
        addToast('success', result.message);
        setCurrentImportError('');
        closeImportModal();
      } else {
        setCurrentImportError(result.message);
        addLogEntry('error', result.action, result.message, result.details);
        addToast('error', result.message);
      }
    }
  };

  const handleDeleteWallet = (id) => {
    const result = deleteWallet(id);
    if (result) {
      addLogEntry(result.status, result.action, result.message, result.details);
      addToast(result.status, result.message);
    }
  };

  const handleUpdateWalletName = (id) => {
    const result = updateWalletName(id);
    if (result) {
      addLogEntry(result.status, result.action, result.message, result.details);
      addToast(result.status, result.message);
      if (result.status === 'success') {
        cancelEditingWalletName();
      }
    }
  };

  useEffect(() => {
    if (importPrivateKey || importWalletName) {
      setCurrentImportError('');
    }
  }, [importPrivateKey, importWalletName]);

  return (
    <main className="wallet-manager">
      <h2>Wallet Manager</h2>
      
      <div className="wallet-manager-warning">
        <p>
          <strong>Important Notice:</strong> Wallets created here are stored only in your local browser. 
          They cannot be recovered if deleted. Therefore, when you create a new wallet, be sure to securely 
          write down your private key or import it into a browser wallet extension like Phantom or Solflare. 
          No wallet information is stored on any server or database; all responsibility lies with you.
        </p>
      </div>

      <div className="wallet-controls">
        <button 
          className="add-wallet-button" 
          onClick={handleCreateWallet}
        >
          Create New Wallet
        </button>
        <button 
          className="import-wallet-button" 
          onClick={() => setShowImportModal(true)}
        >
          Import Wallet
        </button>
      </div>
      
      <div className="wallet-list">
        {wallets.length === 0 ? (
          <div className="no-wallets">
            <p>No wallets found. Click the button above to create or import a wallet.</p>
          </div>
        ) : (
          wallets.map(wallet => (
            <WalletItem
              key={wallet.id}
              wallet={wallet}
              isEditing={editingWalletId === wallet.id}
              editName={editWalletName}
              onSetEditName={setEditWalletName}
              onUpdateName={handleUpdateWalletName}
              onCancelEdit={cancelEditingWalletName}
              onStartEdit={startEditingWalletName}
              onDelete={handleDeleteWallet}
              onCopyToClipboard={onCopyToClipboard}
              balance={walletBalances[wallet.id]}
              isLoadingBalance={isLoadingBalances && walletBalances[wallet.id] === undefined}
            />
          ))
        )}
      </div>
      
      <ImportWalletModal 
        show={showImportModal}
        onClose={closeImportModal}
        privateKey={importPrivateKey}
        setPrivateKey={setImportPrivateKey}
        walletName={importWalletName}
        setWalletName={setImportWalletName}
        error={currentImportError}
        onImport={handleImportWallet}
      />
    </main>
  );
};

export default WalletManagerView; 