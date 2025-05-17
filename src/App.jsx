import React, { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import { VersionedTransaction, Connection, Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { PROXY_URL, RPC_ENDPOINT } from './constants.js'
import {
  fetchWalletBalanceApi,
  sendTradeTransactionApi,
  uploadMetadataApi,
  createTokenApi,
  createBundleTransactionsApi,
  sendBundleToJitoApi
} from './api.js'
import { useWalletManager } from './hooks/useWalletManager'
import TransactionResult from './components/TransactionResult'
import ImportWalletModal from './components/ImportWalletModal'
import WalletItem from './components/WalletItem'
import WalletManagerView from './components/WalletManagerView'
import TokenLaunchForm from './components/TokenLaunchForm'
import BundleLaunchForm from './components/BundleLaunchForm'
import TradeForm from './components/TradeForm'
import GlobalSettingsBar from './components/GlobalSettingsBar'
import LogsView from './components/LogsView'
import ToastNotifications from './components/ToastNotifications'
import AdvancedTradeForm from './components/AdvancedTradeForm'
import DonationFooter from './components/DonationFooter'
import LoginPage from './components/Auth/LoginPage'
import QuickLaunchForm from './components/QuickLaunchForm'
import QuickBundleForm from './components/QuickBundleForm'

const APP_SETTINGS_KEY = 'xprTradingBotAppSettings'

// Helper function to send and confirm a transaction signed by mint and wallet
// This function should ideally be robust, handling errors and providing feedback.
async function sendAndConfirmTransactionSignedByMintAndWallet(
  buffer,
  mintKeypair, // Keypair for the mint
  wallet,      // Wallet object, must contain privateKey
  addLogEntry, // For logging progress
  actionName   // For logging purposes, e.g., "Token Launch"
) {
  console.log(`[App|sendAndConfirm] Received buffer to process. Type: ${Object.prototype.toString.call(buffer)}, ByteLength: ${buffer?.byteLength}`, { actionName, walletName: wallet?.name });
  if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength) {
    const errorMsg = `${actionName} failed: Invalid buffer received. Expected ArrayBuffer with non-zero length.`;
    console.error('[App|sendAndConfirm]', errorMsg, 'Buffer:', buffer);
    addLogEntry('error', actionName, errorMsg);
    return { signature: null, error: 'Invalid buffer received by sendAndConfirm.' };
  }

  if (!wallet || !wallet.privateKey) {
    const errorMsg = `${actionName} failed: Wallet private key is missing.`;
    addLogEntry('error', actionName, errorMsg);
    return { signature: null, error: 'Wallet private key is missing.' };
  }
  if (!RPC_ENDPOINT) {
    const errorMsg = `${actionName} failed: RPC_ENDPOINT is not configured.`;
    addLogEntry('error', actionName, errorMsg);
    return { signature: null, error: 'RPC_ENDPOINT is not configured.' };
  }

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  addLogEntry('info', actionName, `Processing transaction with RPC: ${RPC_ENDPOINT}`);

  try {
    const transaction = VersionedTransaction.deserialize(new Uint8Array(buffer));
    console.log('[App|sendAndConfirm] Transaction object after deserialize:', transaction);
    addLogEntry('info', actionName, 'Transaction deserialized.');

    // Ensure transaction object has a sign method
    if (typeof transaction.sign !== 'function') {
      const errorMsg = `${actionName} failed: Deserialized transaction object does not have a sign method.`;
      console.error('[App|sendAndConfirm]', errorMsg, 'Transaction Object:', transaction);
      addLogEntry('error', actionName, errorMsg);
      return { signature: null, error: 'Invalid transaction object after deserialize.' };
    }

    // Sign with mint keypair
    addLogEntry('info', actionName, 'Attempting to sign with mint keypair...');
    transaction.sign([mintKeypair]);
    addLogEntry('info', actionName, 'Transaction signed by mint keypair.');

    // Sign with user's wallet keypair
    const userKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
    addLogEntry('info', actionName, 'Attempting to sign with user keypair...');
    transaction.sign([userKeypair]);
    addLogEntry('info', actionName, `Transaction signed by user wallet: ${wallet.name} (${wallet.publicKey.substring(0,4)}...).`);
    
    addLogEntry('info', actionName, 'Sending transaction to Solana network...');
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false, // Set to true if you trust the transaction and want faster submission
      maxRetries: 5,
    });
    addLogEntry('success', actionName, `Transaction sent with signature: ${signature}. Waiting for confirmation...`);

    // Confirm the transaction
    const confirmation = await connection.confirmTransaction(
        {
            signature: signature,
            blockhash: transaction.message.recentBlockhash, // Use the blockhash from the transaction
            lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
        },
        'confirmed'
    );

    if (confirmation.value.err) {
      const errorMsg = `${actionName} failed: Transaction confirmation error. ${JSON.stringify(confirmation.value.err)}`;
      addLogEntry('error', actionName, errorMsg, { errorDetails: confirmation.value.err });
      return { signature, error: `Transaction confirmation failed: ${confirmation.value.err}` };
    }

    addLogEntry('success', actionName, `Transaction confirmed successfully! Signature: ${signature}`);
    return { signature, error: null };

  } catch (error) {
    console.error(`${actionName} Error:`, error);
    let errorMessage = error.message || 'An unknown error occurred during transaction processing.';
    if (error.logs) { // Solana specific error logs
        errorMessage += ` Logs: ${error.logs.join(', ')}`;
    }
    addLogEntry('error', actionName, `${actionName} failed: ${errorMessage}`, { errorDetails: error });
    return { signature: null, error: errorMessage };
  }
}

function App() {
  // Function to load settings from localStorage
  const loadSettings = () => {
    const savedSettings = localStorage.getItem(APP_SETTINGS_KEY)
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings)
      } catch (e) {
        console.error("Failed to parse app settings from localStorage", e)
        return {} // Return empty object on error
      }
    }
    return {} // Return empty object if no settings found
  }

  const initialSettings = loadSettings()

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState('');

  const [activeTab, setActiveTab] = useState(initialSettings.activeTab || 'tokenLaunch')
  const [activeLaunchTab, setActiveLaunchTab] = useState(initialSettings.activeLaunchTab || 'tokenLaunch')
  const [activeTradeViewTab, setActiveTradeViewTab] = useState(initialSettings.activeTradeViewTab || 'basic')
  const [activeWindow, setActiveWindow] = useState(initialSettings.activeWindow || 'main')
  const [initialBalancesFetched, setInitialBalancesFetched] = useState(false)
  const [lastCreatedMintAddress, setLastCreatedMintAddress] = useState(initialSettings.lastCreatedMintAddress || '')

  // Global Settings States
  const [globalPriorityFee, setGlobalPriorityFee] = useState(initialSettings.globalPriorityFee !== undefined ? initialSettings.globalPriorityFee : 0.0005)
  const [globalSlippage, setGlobalSlippage] = useState(initialSettings.globalSlippage !== undefined ? initialSettings.globalSlippage : 10)
  const [globalPool, setGlobalPool] = useState(initialSettings.globalPool || 'pump')

  const [totalBalance, setTotalBalance] = useState(0)

  const {
    wallets,
    setWallets, // Bu hala App.jsx'te localStorage'dan yükleme için kullanılıyor olabilir
    walletBalances,
    isLoadingBalances,
    fetchWalletBalances, // WalletManagerView'e geçirmiyorduk, ama gerekirse eklenebilir
    showImportModal,
    setShowImportModal,
    importPrivateKey,
    setImportPrivateKey,
    importWalletName,
    setImportWalletName,
    importError, // Belki artık WalletManagerView içinde yönetiliyor, kontrol edilebilir
    createWallet,
    importWallet,
    importMultipleWallets, // YENİ: useWalletManager'dan al
    closeImportModal,
    deleteWallet,
    editingWalletId,
    setEditingWalletId, // App içinde de kullanılıyor olabilir (örn: düzenleme modunu iptal etmek için)
    editWalletName,
    setEditWalletName,
    startEditingWalletName,
    cancelEditingWalletName,
    updateWalletName,
  } = useWalletManager(activeTab === 'walletManager'); // isWalletManagerActive prop'u doğru şekilde yönetiliyor varsayımı

  const [transactionStatus, setTransactionStatus] = useState(null)
  const [transactionSignature, setTransactionSignature] = useState(null)
  const [loading, setLoading] = useState(false)

  // States for TransactionResult, to be updated by form components
  const [launchStatus, setLaunchStatus] = useState(null)
  const [launchSignature, setLaunchSignature] = useState(null)
  
  const [bundleStatus, setBundleStatus] = useState(null)
  const [bundleSignatures, setBundleSignatures] = useState([])

  // Trade transaction status
  const [tradeStatus, setTradeStatus] = useState(null)
  const [tradeSignature, setTradeSignature] = useState(null)
  const [tradeErrorMessage, setTradeErrorMessage] = useState('')

  // Trade form handlers - MOVED to TradeForm.jsx
  // const handleInputChange = (e) => { ... };
  // const handleSellPercentage = (percentage) => { ... };

  // Token launch form handlers - MOVED to TokenLaunchForm.jsx
  // const handleLaunchInputChange = (e) => { /* ... */ };
  // const handleFileChange = (e) => { /* ... */ };

  // Bundle launch form handlers - MOVED to BundleLaunchForm.jsx
  // const handleBundleInputChange = (e) => { /* ... */ };
  // const handleBundleFileChange = (e) => { /* ... */ };

  // Trade transaction function - MOVED to TradeForm.jsx
  // const sendTransaction = async (e) => { ... };

  // Token launch function - MOVED to TokenLaunchForm.jsx
  // const launchToken = async (e) => { /* ... */ };

  // States for TradeForm
  const defaultTradeFormData = { mint: '', amount: '1', sellPercentage: '100' };
  const [tradeFormData, setTradeFormData] = useState(initialSettings.tradeFormData || defaultTradeFormData);
  const [tradeFormSelectedWalletIds, setTradeFormSelectedWalletIds] = useState(initialSettings.tradeFormSelectedWalletIds || []);

  // States for AdvancedTradeForm
  const defaultAdvancedTradeMint = '';
  const defaultAdvancedTradeBundleGroups = Array(4).fill(null).map((_, index) => ({
    id: `bundle-${index}`,
    name: `Bundle ${index + 1}`,
    walletsConfig: [],
    activeInTradeWalletIds: [],
  }));
  const [advancedTradeMint, setAdvancedTradeMint] = useState(initialSettings.advancedTradeMint || defaultAdvancedTradeMint);
  const [advancedTradeBundleGroups, setAdvancedTradeBundleGroups] = useState(initialSettings.advancedTradeBundleGroups || defaultAdvancedTradeBundleGroups);

  // Effect to fetch initial balances when wallets are loaded
  useEffect(() => {
    if (!initialBalancesFetched && 
        wallets && 
        wallets.length > 0 && 
        typeof fetchWalletBalances === 'function') {
      
      console.log("Attempting to fetch initial wallet balances for TradeForm...")
      fetchWalletBalances()
      setInitialBalancesFetched(true) // Mark as fetched to prevent re-calls from this effect
    }
  }, [wallets, fetchWalletBalances, initialBalancesFetched])

  // Effect to calculate total balance when walletBalances change
  useEffect(() => {
    if (walletBalances) {
      const sum = Object.values(walletBalances).reduce((acc, balance) => {
        if (typeof balance === 'number' && !isNaN(balance)) {
          return acc + balance
        }
        return acc
      }, 0)
      setTotalBalance(sum)
    } else {
      setTotalBalance(0)
    }
  }, [walletBalances])

  // Check authentication status on initial load
  useEffect(() => {
    const authStatus = localStorage.getItem('userAuthenticated');
    const username = localStorage.getItem('username');
    if (authStatus === 'true' && username) {
      setIsAuthenticated(true);
      setLoggedInUsername(username);
    }
  }, []);

  const handleLoginSuccess = () => {
    const username = localStorage.getItem('username');
    setIsAuthenticated(true);
    if (username) setLoggedInUsername(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('userAuthenticated');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
    setLoggedInUsername('');
    // window.location.reload(); // Optional: to clear all component states
  };

  // Callback for TokenLaunchForm to update App.jsx state
  const handleTokenLaunchComplete = (signature, mintAddress, error, details) => {
    const action = "Token Launch";
    const tokenName = details?.name || 'N/A';
    const logDetails = { ...details };
    if (signature) logDetails.signature = signature;
    if (mintAddress) logDetails.mintAddress = mintAddress; // Ensure mintAddress is in details for logging
    if (error) logDetails.error = error;

    if (signature) { // Success if signature is present
      const successMsg = `Token '${tokenName}' launched successfully. CA: ${mintAddress}`;
      addLogEntry('success', action, successMsg, logDetails);
      addToast('success', `Token '${tokenName}' launched! CA: ${mintAddress.substring(0,4)}...`);
      setLastCreatedMintAddress(mintAddress);
      setLaunchStatus('success');
      setLaunchSignature(signature); // Store the actual signature
    } else { // Failure if no signature
      const errorMsg = error || 'Unknown error';
      const failureLogMsg = `Token '${tokenName}' launch failed. Error: ${errorMsg}`;
      const failureToastMsg = `Token '${tokenName}' launch failed: ${errorMsg.substring(0, 50)}${errorMsg.length > 50 ? '...' : ''}`;
      addLogEntry('error', action, failureLogMsg, logDetails);
      addToast('error', failureToastMsg);
      setLaunchStatus('error');
      setLaunchSignature(null);
    }
  };

  // Bundle Launch function - MOVED to BundleLaunchForm.jsx
  // const launchBundle = async (e) => { /* ... */ };

  // Callback for BundleLaunchForm to update App.jsx state
  const handleBundleLaunchComplete = (status, signatures, errorMessage, details) => {
    const action = "Bundle Launch";
    const bundleName = details?.name || 'N/A';
    const logDetails = { ...details };
    if (signatures && signatures.length > 0) logDetails.signatures = signatures;
    if (errorMessage) logDetails.error = errorMessage;

    if (status === 'success') { // Assuming 'status' is correctly passed from BundleLaunchForm
      const successMsg = `Bundle '${bundleName}' launched successfully.`;
      addLogEntry('success', action, successMsg, logDetails);
      addToast('success', `Bundle '${bundleName}' launched!`);
      if (details.mintAddress) setLastCreatedMintAddress(details.mintAddress); // If a primary mint is associated
    } else {
      const errorMsg = errorMessage || 'Unknown error';
      const failureLogMsg = `Bundle '${bundleName}' launch failed. Error: ${errorMsg}`;
      const failureToastMsg = `Bundle '${bundleName}' launch failed: ${errorMsg.substring(0,50)}${errorMsg.length > 50 ? '...' : ''}`;
      addLogEntry('error', action, failureLogMsg, logDetails);
      addToast('error', failureToastMsg);
    }
    setBundleStatus(status);
    setBundleSignatures(signatures);
  };
  
  const handleTradeComplete = (status, signature, error, tradeDetails) => {
    const action = tradeDetails.bundleName ? `Trade (${tradeDetails.bundleName})` : "Trade";
    const logDetails = { ...tradeDetails };
    if (signature) logDetails.signature = signature;
    if (error) logDetails.error = error;
  
    const tokenMint = tradeDetails.mint ? `${tradeDetails.mint.substring(0,4)}...` : 'N/A';
    const walletName = tradeDetails.walletName || 'Unknown Wallet';
    const actionType = tradeDetails.actionType ? tradeDetails.actionType.toUpperCase() : "TRADE";

    if (status === 'success') {
      const successMsg = `${actionType} of ${tokenMint} for ${walletName} successful.`;
      addLogEntry('success', action, successMsg, logDetails);
      addToast('success', `${actionType} for ${tokenMint} successful!`);
    } else {
      const errorMsg = error || 'Unknown error';
      const failureLogMsg = `${actionType} of ${tokenMint} for ${walletName} failed. Error: ${errorMsg}`;
      const failureToastMsg = `${actionType} for ${tokenMint} failed: ${errorMsg.substring(0,50)}${errorMsg.length > 50 ? '...' : ''}`;
      addLogEntry('error', action, failureLogMsg, logDetails);
      addToast('error', failureToastMsg);
    }
    // setTradeStatus(status); // Potentially manage per-trade status if needed in UI
    // setTradeSignature(signature);
    // setTradeErrorMessage(error);
  };
  
  const [logs, setLogs] = useState([])
  const [toasts, setToasts] = useState([])

  const addLogEntry = (type, action, message, details = {}) => {
    const timestamp = new Date().toISOString();
    const newLog = { id: Date.now(), timestamp, type, action, message, details };
    setLogs(prevEntries => [newLog, ...prevEntries.slice(0, 199)]); // Keep last 200 entries

    // REMOVED GENERIC TOAST FROM HERE TO AVOID DUPLICATES FOR LAUNCH/TRADE
    // Specific toasts are now handled in their respective complete handlers.
    // This function can still be used by other parts of the app that need logging AND a generic toast.
    // For example, copyToClipboard or saveSettings might still want their toasts generated here
    // if they don't have a more specific handler.

    // Example of a toast that might still be relevant from addLogEntry:
    if (action === 'Save Settings' && type === 'success') {
        addToast('success', 'Settings saved!');
    } else if (action === 'Save Settings' && type === 'error') {
        addToast('error', 'Failed to save settings.');
    } else if (action === 'Import Wallet (Batch)' && type === 'success') {
        // Summary toast is handled by ImportMultipleWalletsModal, so do nothing here.
        return;
    } else if (action === 'Import Wallet (Batch)' && type === 'error') {
        // Error for batch import might be better handled in the modal or its hook.
        // For now, let it pass if not handled by the caller.
        addToast('error', message); // Or a more generic "Batch import failed."
    }
    // Other generic toasts for 'info' or other types can be added here if needed,
    // but ensure they don't conflict with specific handlers.
  }

  const addToast = (type, message) => {
    const id = Date.now() + Math.random()
    setToasts(prevToasts => [...prevToasts, { id, type, message }])
    setTimeout(() => {
      removeToast(id)
    }, 3000)
  }

  const removeToast = (id) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id))
  }

  // Cüzdan bilgilerini kopyalama
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        addToast('success', 'Copied to clipboard!')
      })
      .catch(err => {
        console.error('Failed to copy: ', err)
        addToast('error', 'Failed to copy to clipboard.')
      })
  }

  // Function to save settings to localStorage
  const saveSettings = () => {
    const settingsToSave = {
      activeTab,
      activeLaunchTab,
      activeTradeViewTab,
      activeWindow,
      lastCreatedMintAddress,
      globalPriorityFee,
      globalSlippage,
      globalPool,
      tradeFormData, 
      tradeFormSelectedWalletIds, 
      advancedTradeMint,
      advancedTradeBundleGroups,
    }
    try {
      localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settingsToSave))
      addToast('success', 'Settings saved successfully!')
    } catch (e) {
      console.error("Failed to save app settings to localStorage", e)
      addToast('error', 'Failed to save settings.')
    }
  }

  // Effect to update tradeFormData.mint when a new token is launched
  useEffect(() => {
    if (lastCreatedMintAddress) {
      setTradeFormData(prevData => ({
        ...prevData,
        mint: lastCreatedMintAddress
      }));
    }
  }, [lastCreatedMintAddress]);

  // Effect to set initial selected wallet for TradeForm when wallets are loaded
  useEffect(() => {
    if (wallets && wallets.length > 0 && tradeFormSelectedWalletIds.length === 0) {
      // Only set if no wallets are currently selected in the saved settings for tradeForm
      // And if there isn't a more specific saved selection for tradeFormSelectedWalletIds
      if (!initialSettings.tradeFormSelectedWalletIds || initialSettings.tradeFormSelectedWalletIds.length === 0) {
          const defaultWallet = wallets[0];
          if (defaultWallet) {
            setTradeFormSelectedWalletIds([defaultWallet.id]);
          }
      }
    }
  }, [wallets, initialSettings.tradeFormSelectedWalletIds]); // Added initialSettings dependency

  // Effect to update advancedTradeMint when a new token is launched
  useEffect(() => {
    if (lastCreatedMintAddress) {
      setAdvancedTradeMint(lastCreatedMintAddress);
    }
  }, [lastCreatedMintAddress]);

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      <ToastNotifications toasts={toasts} removeToast={removeToast} />
      <GlobalSettingsBar 
        username={loggedInUsername}
        onLogout={handleLogout}
        priorityFee={globalPriorityFee}
        setPriorityFee={setGlobalPriorityFee}
        slippage={globalSlippage}
        setSlippage={setGlobalSlippage}
        pool={globalPool}
        setPool={setGlobalPool}
        totalBalance={totalBalance}
        isLoadingTotalBalance={isLoadingBalances}
        onSaveSettings={saveSettings}
      />
      <header className="app-navigation-header">
        <div className="navigation-buttons">
          <button 
            className={`nav-button ${activeWindow === 'main' ? 'active' : ''}`}
            onClick={() => setActiveWindow('main')}
          >
            Trading Dashboard
          </button>
          <button 
            className={`nav-button ${activeWindow === 'walletManager' ? 'active' : ''}`}
            onClick={() => setActiveWindow('walletManager')}
          >
            Wallet Manager
          </button>
          <button 
            className={`nav-button ${activeWindow === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveWindow('logs')}
          >
            Logs
          </button>
        </div>
      </header>
      
      {activeWindow === 'main' ? (
        <main className="App-content">
          <div className="panel-section">
            <h2>Launch</h2>
            <div className="tab-navigation">
              <button 
                className={`tab-button ${activeLaunchTab === 'tokenLaunch' ? 'active' : ''}`}
                onClick={() => setActiveLaunchTab('tokenLaunch')}
              >
                Token Launch
              </button>
              <button 
                className={`tab-button ${activeLaunchTab === 'bundleLaunch' ? 'active' : ''}`}
                onClick={() => setActiveLaunchTab('bundleLaunch')}
              >
                Bundle Launch
              </button>
              <button 
                className={`tab-button ${activeLaunchTab === 'quickLaunch' ? 'active' : ''}`}
                onClick={() => setActiveLaunchTab('quickLaunch')}
              >
                Quick Launch
              </button>
              <button 
                className={`tab-button ${activeLaunchTab === 'quickBundle' ? 'active' : ''}`}
                onClick={() => setActiveLaunchTab('quickBundle')}
              >
                Quick Bundle
              </button>
            </div>
            
            {activeLaunchTab === 'tokenLaunch' && (
              <TokenLaunchForm 
                wallets={wallets} 
                onLaunchComplete={handleTokenLaunchComplete}
                priorityFee={globalPriorityFee}
                slippage={globalSlippage}
                pool={globalPool}
                addToast={addToast}
              />
            )}
            
            {activeLaunchTab === 'bundleLaunch' && (
              <BundleLaunchForm 
                wallets={wallets} 
                onBundleLaunchComplete={handleBundleLaunchComplete}
                priorityFee={globalPriorityFee}
                slippage={globalSlippage}
                pool={globalPool}
                addToast={addToast}
              />
            )}
            {activeLaunchTab === 'quickLaunch' && (
              <QuickLaunchForm
                wallets={wallets}
                globalSettings={{ 
                  priorityFee: globalPriorityFee, 
                  slippage: globalSlippage, 
                  pool: globalPool 
                }}
                onLaunchComplete={handleTokenLaunchComplete}
                addLogEntry={addLogEntry}
                addToast={addToast}
                sendAndConfirmTransactionSignedByMintAndWallet={sendAndConfirmTransactionSignedByMintAndWallet}
                uploadMetadataApi={uploadMetadataApi}
                createTokenApi={createTokenApi}
              />
            )}
            {activeLaunchTab === 'quickBundle' && (
              <QuickBundleForm
                wallets={wallets}
                globalSettings={{
                  priorityFee: globalPriorityFee,
                  slippage: globalSlippage,
                  pool: globalPool
                }}
                onBundleLaunchComplete={handleBundleLaunchComplete}
                addLogEntry={addLogEntry}
                addToast={addToast}
                uploadMetadataApi={uploadMetadataApi}
                createBundleTransactionsApi={createBundleTransactionsApi}
                sendBundleToJitoApi={sendBundleToJitoApi}
              />
            )}
          </div>
          
          <div className="panel-section">
            <h2>Trade</h2>
            <div className="tab-navigation">
              <button 
                className={`tab-button ${activeTradeViewTab === 'basic' ? 'active' : ''}`}
                onClick={() => setActiveTradeViewTab('basic')}
              >
                Basic
              </button>
              <button 
                className={`tab-button ${activeTradeViewTab === 'advanced' ? 'active' : ''}`}
                onClick={() => setActiveTradeViewTab('advanced')}
              >
                Advanced
              </button>
            </div>

            {activeTradeViewTab === 'basic' && (
              <TradeForm 
                onTradeComplete={handleTradeComplete} 
                wallets={wallets} 
                walletBalances={walletBalances}
                isLoadingBalances={isLoadingBalances}
                priorityFee={globalPriorityFee}
                slippage={globalSlippage}
                pool={globalPool}
                addToast={addToast}
                formData={tradeFormData}
                setFormData={setTradeFormData}
                selectedWalletIds={tradeFormSelectedWalletIds}
                setSelectedWalletIds={setTradeFormSelectedWalletIds}
              />
            )}
            {activeTradeViewTab === 'advanced' && (
              <AdvancedTradeForm 
                onTradeComplete={handleTradeComplete} 
                wallets={wallets} 
                walletBalances={walletBalances}
                isLoadingBalances={isLoadingBalances}
                priorityFee={globalPriorityFee}
                slippage={globalSlippage}
                pool={globalPool}
                addToast={addToast}
                mintAddress={advancedTradeMint}
                setMintAddress={setAdvancedTradeMint}
                bundleGroupsConfig={advancedTradeBundleGroups}
                setBundleGroupsConfig={setAdvancedTradeBundleGroups}
              />
            )}
          </div>
        </main>
      ) : activeWindow === 'walletManager' ? (
        <WalletManagerView
          wallets={wallets}
          walletBalances={walletBalances}
          isLoadingBalances={isLoadingBalances}
          showImportModal={showImportModal}
          setShowImportModal={setShowImportModal}
          importPrivateKey={importPrivateKey}
          setImportPrivateKey={setImportPrivateKey}
          importWalletName={importWalletName}
          setImportWalletName={setImportWalletName}
          importError={importError}
          createWallet={createWallet}
          importWallet={importWallet}
          importMultipleWallets={importMultipleWallets}
          closeImportModal={closeImportModal}
          deleteWallet={deleteWallet}
          editingWalletId={editingWalletId}
          editWalletName={editWalletName}
          setEditWalletName={setEditWalletName}
          startEditingWalletName={startEditingWalletName}
          cancelEditingWalletName={cancelEditingWalletName}
          updateWalletName={updateWalletName}
          onCopyToClipboard={copyToClipboard}
          addLogEntry={addLogEntry}
          addToast={addToast}
        />
      ) : activeWindow === 'logs' ? (
        <LogsView logs={logs} />
      ) : (
        <div>
          <h2>Unsupported Window</h2>
          <p>The selected window type is not recognized.</p>
        </div>
      )}
      <DonationFooter />
    </div>
  )
}

export default App 