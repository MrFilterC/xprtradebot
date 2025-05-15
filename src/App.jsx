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

const APP_SETTINGS_KEY = 'xprTradingBotAppSettings'

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
  const [activeTradeViewTab, setActiveTradeViewTab] = useState(initialSettings.activeTradeViewTab || 'basic')
  const [activeWindow, setActiveWindow] = useState(initialSettings.activeWindow || 'main')
  const [initialBalancesFetched, setInitialBalancesFetched] = useState(false)
  const [lastCreatedMintAddress, setLastCreatedMintAddress] = useState(initialSettings.lastCreatedMintAddress || '')

  // Global Settings States
  const [globalPriorityFee, setGlobalPriorityFee] = useState(initialSettings.globalPriorityFee !== undefined ? initialSettings.globalPriorityFee : 0.0005)
  const [globalSlippage, setGlobalSlippage] = useState(initialSettings.globalSlippage !== undefined ? initialSettings.globalSlippage : 10)
  const [globalPool, setGlobalPool] = useState(initialSettings.globalPool || 'pump')

  const [totalBalance, setTotalBalance] = useState(0)

  const walletManagerProps = useWalletManager(activeWindow === 'walletManager')
  
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
        walletManagerProps.wallets && 
        walletManagerProps.wallets.length > 0 && 
        typeof walletManagerProps.fetchWalletBalances === 'function') {
      
      console.log("Attempting to fetch initial wallet balances for TradeForm...")
      walletManagerProps.fetchWalletBalances()
      setInitialBalancesFetched(true) // Mark as fetched to prevent re-calls from this effect
    }
  }, [walletManagerProps.wallets, walletManagerProps.fetchWalletBalances, initialBalancesFetched])

  // Effect to calculate total balance when walletBalances change
  useEffect(() => {
    if (walletManagerProps.walletBalances) {
      const sum = Object.values(walletManagerProps.walletBalances).reduce((acc, balance) => {
        if (typeof balance === 'number' && !isNaN(balance)) {
          return acc + balance
        }
        return acc
      }, 0)
      setTotalBalance(sum)
    } else {
      setTotalBalance(0)
    }
  }, [walletManagerProps.walletBalances])

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
  const handleTokenLaunchComplete = (status, signature, errorMessage, details) => {
    const action = "Token Launch"
    const logDetails = { ...details } // Start with details from form
    if (signature) logDetails.signature = signature
    if (errorMessage) logDetails.error = errorMessage

    if (status === 'success') {
      addLogEntry('success', action, `Token '${details?.name || 'N/A'}' launched successfully. CA: ${details?.mintAddress}`, logDetails)
      if (details?.mintAddress) {
        setLastCreatedMintAddress(details.mintAddress)
      }
    } else {
      addLogEntry('error', action, `Token '${details?.name || 'N/A'}' launch failed. Error: ${errorMessage || 'Unknown error'}`, logDetails)
    }
  }

  // Bundle Launch function - MOVED to BundleLaunchForm.jsx
  // const launchBundle = async (e) => { /* ... */ };

  // Callback for BundleLaunchForm to update App.jsx state
  const handleBundleLaunchComplete = (status, signatures, errorMessage, details) => {
    const action = "Bundle Launch"
    const logDetails = { ...details } // Start with details from form
    if (signatures && signatures.length > 0) logDetails.signatures = signatures
    if (errorMessage) logDetails.error = errorMessage

    if (status === 'success') {
      // For bundle, we need to identify the create action specifically for the CA toast.
      // We'll assume details.mintAddress is passed if successful, and action for addLogEntry for CA toast is handled there.
      addLogEntry('success', action, `Bundle for token '${details?.name || 'N/A'}' launched successfully. CA: ${details?.mintAddress}`, logDetails)
      if (details?.mintAddress) {
        setLastCreatedMintAddress(details.mintAddress)
      }
    } else {
      addLogEntry('error', action, `Bundle launch for token '${details?.name || 'N/A'}' failed. Error: ${errorMessage || 'Unknown error'}`, logDetails)
    }
  }

  // Callback for TradeForm to update App.jsx state
  const handleTradeComplete = (status, signature, error, tradeDetails) => {
    const action = `Trade Action (${tradeDetails?.actionType || 'N/A'}) for ${tradeDetails?.walletName || 'Unknown Wallet'}`
    if (status === 'success') {
      addLogEntry('success', action, `Trade successful. Token: ${tradeDetails?.mint || 'N/A'}. Signature: ${signature}`, { signature, tradeDetails })
    } else {
      addLogEntry('error', action, `Trade failed. Token: ${tradeDetails?.mint || 'N/A'}. Error: ${error || 'Unknown error'}`, { error, tradeDetails })
    }
  }
  
  const [logs, setLogs] = useState([])
  const [toasts, setToasts] = useState([])

  const addLogEntry = (type, action, message, details = {}) => {
    const newLog = {
      id: Date.now(), 
      timestamp: new Date().toISOString(),
      type,
      action,
      message,
      details
    }
    setLogs(prevLogs => [newLog, ...prevLogs].slice(0, 200))

    if (type === 'success' && details.mintAddress && (action.includes('Token Launch') || action.includes('Bundle Launch'))) {
      addToast('contract', `CA: ${details.mintAddress}`)
    } else if (type === 'success' && action.toLowerCase().includes('trade action')) {
      addToast('success', 'Trade successful!')
    } else if (type !== 'success' || !message.toLowerCase().includes('settings saved')) { // Avoid double toast for save
      addToast(type, message.length > 100 ? `${message.substring(0,97)}...` : message )
    }
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
    if (walletManagerProps.wallets && walletManagerProps.wallets.length > 0 && tradeFormSelectedWalletIds.length === 0) {
      // Only set if no wallets are currently selected in the saved settings for tradeForm
      // And if there isn't a more specific saved selection for tradeFormSelectedWalletIds
      if (!initialSettings.tradeFormSelectedWalletIds || initialSettings.tradeFormSelectedWalletIds.length === 0) {
          const defaultWallet = walletManagerProps.wallets[0];
          if (defaultWallet) {
            setTradeFormSelectedWalletIds([defaultWallet.id]);
          }
      }
    }
  }, [walletManagerProps.wallets, initialSettings.tradeFormSelectedWalletIds]); // Added initialSettings dependency

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
        priorityFee={globalPriorityFee}
        setPriorityFee={setGlobalPriorityFee}
        slippage={globalSlippage}
        setSlippage={setGlobalSlippage}
        pool={globalPool}
        setPool={setGlobalPool}
        totalBalance={totalBalance}
        isLoadingTotalBalance={walletManagerProps.isLoadingBalances}
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
                className={`tab-button ${activeTab === 'tokenLaunch' ? 'active' : ''}`}
                onClick={() => setActiveTab('tokenLaunch')}
              >
                Token Launch
              </button>
              <button 
                className={`tab-button ${activeTab === 'bundleLaunch' ? 'active' : ''}`}
                onClick={() => setActiveTab('bundleLaunch')}
              >
                Bundle Launch
              </button>
            </div>
            
            {activeTab === 'tokenLaunch' && (
              <TokenLaunchForm 
                onLaunchComplete={handleTokenLaunchComplete} 
                wallets={walletManagerProps.wallets}
                priorityFee={globalPriorityFee}
                slippage={globalSlippage}
                pool={globalPool}
              />
            )}
            
            {activeTab === 'bundleLaunch' && (
              <BundleLaunchForm 
                onBundleLaunchComplete={handleBundleLaunchComplete} 
                wallets={walletManagerProps.wallets}
                priorityFee={globalPriorityFee}
                slippage={globalSlippage}
                pool={globalPool}
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
                wallets={walletManagerProps.wallets} 
                walletBalances={walletManagerProps.walletBalances}
                isLoadingBalances={walletManagerProps.isLoadingBalances}
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
                wallets={walletManagerProps.wallets} 
                walletBalances={walletManagerProps.walletBalances}
                isLoadingBalances={walletManagerProps.isLoadingBalances}
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
          {...walletManagerProps} 
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