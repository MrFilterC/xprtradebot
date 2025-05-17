import { useState, useEffect } from 'react';
import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { PROXY_URL, RPC_ENDPOINT } from '../constants';
import { sendTradeTransactionApi } from '../api';
import './AdvancedTradeForm.css';

const DEFAULT_BUY_AMOUNT = '0.01'; // Default SOL amount for new wallets in a bundle
const DEFAULT_SELL_PERCENTAGE = '100'; // Default sell percentage

function AdvancedTradeForm({ 
  onTradeComplete, 
  wallets, 
  walletBalances, 
  isLoadingBalances,
  priorityFee, 
  slippage,    
  pool,         
  addToast,
  mintAddress,
  setMintAddress,
  bundleGroupsConfig,
  setBundleGroupsConfig
}) {
  const [loadingStates, setLoadingStates] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  
  const [walletSelectorOpenForBundle, setWalletSelectorOpenForBundle] = useState(null);
  const [batchInputValues, setBatchInputValues] = useState({}); // New state for batch inputs

  const handleGlobalInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mint') {
      setMintAddress(value);
    }
  };

  const copyMintToClipboard = () => {
    if (mintAddress) {
      navigator.clipboard.writeText(mintAddress)
        .then(() => addToast && addToast('success', 'Mint address copied!'))
        .catch(err => {
          console.error('Failed to copy mint address: ', err);
          addToast && addToast('error', 'Failed to copy mint address.');
        });
    } else {
      addToast && addToast('info', 'Mint address is empty.');
    }
  };

  const toggleWalletSelector = (bundleIndex) => {
    setWalletSelectorOpenForBundle(walletSelectorOpenForBundle === bundleIndex ? null : bundleIndex);
  };

  const handleAddWalletToBundle = (bundleIndex, walletId) => {
    setBundleGroupsConfig(prevGroups => 
      prevGroups.map((group, index) => {
        if (index === bundleIndex && !group.walletsConfig.find(w => w.walletId === walletId)) {
          return { 
            ...group, 
            walletsConfig: [
              ...group.walletsConfig, 
              { walletId, buyAmountSol: DEFAULT_BUY_AMOUNT, sellPercentage: DEFAULT_SELL_PERCENTAGE }
            ]
          }; 
        }
        return group;
      })
    );
  };

  const handleRemoveWalletFromBundle = (bundleIndex, walletIdToRemove) => {
    setBundleGroupsConfig(prevGroups =>
      prevGroups.map((group, index) => 
        index === bundleIndex 
          ? { 
              ...group, 
              walletsConfig: group.walletsConfig.filter(w => w.walletId !== walletIdToRemove),
              activeInTradeWalletIds: group.activeInTradeWalletIds.filter(id => id !== walletIdToRemove)
            } 
          : group
      )
    );
  };

  const handleWalletParamChange = (bundleIndex, walletId, paramName, value) => {
    setBundleGroupsConfig(prevGroups =>
      prevGroups.map((group, index) => {
        if (index === bundleIndex) {
          return {
            ...group,
            walletsConfig: group.walletsConfig.map(wc => 
              wc.walletId === walletId ? { ...wc, [paramName]: value } : wc
            ),
          };
        }
        return group;
      })
    );
  };

  const toggleWalletActiveForTrade = (bundleIndex, walletId) => {
    setBundleGroupsConfig(prevGroups =>
      prevGroups.map((group, index) => {
        if (index === bundleIndex) {
          const isActive = group.activeInTradeWalletIds.includes(walletId);
          return {
            ...group,
            activeInTradeWalletIds: isActive
              ? group.activeInTradeWalletIds.filter(id => id !== walletId)
              : [...group.activeInTradeWalletIds, walletId],
          };
        }
        return group;
      })
    );
  };

  const handleSelectAllInBundle = (bundleIndex) => {
    setBundleGroupsConfig(prevGroups =>
      prevGroups.map((group, index) => 
        index === bundleIndex 
          ? { ...group, activeInTradeWalletIds: group.walletsConfig.map(wc => wc.walletId) } 
          : group
      )
    );
  };

  const handleDeselectAllInBundle = (bundleIndex) => {
    setBundleGroupsConfig(prevGroups =>
      prevGroups.map((group, index) => 
        index === bundleIndex 
          ? { ...group, activeInTradeWalletIds: [] } 
          : group
      )
    );
  };

  const handleBatchInputChange = (bundleIndex, type, subType, value) => {
    setBatchInputValues(prev => ({
      ...prev,
      [bundleIndex]: {
        ...(prev[bundleIndex] || {}),
        [type]: {
          ...(prev[bundleIndex]?.[type] || {}),
          [subType]: value
        }
      }
    }));
  };

  const handleSetRandomAllForBundle = (bundleIndex, type) => {
    const bundle = bundleGroupsConfig[bundleIndex];
    if (!bundle) {
        addToast('error', 'Bundle configuration not found.');
        return;
    }
    const bundleInputs = batchInputValues[bundleIndex]?.[type];
    const bundleName = bundle.name || `Bundle ${bundleIndex + 1}`;

    if (!bundleInputs || 
        String(bundleInputs.min).trim() === '' || 
        String(bundleInputs.max).trim() === '') {
      addToast('error', `Please enter both min and max values for ${type} in ${bundleName}.`);
      return;
    }

    const min = parseFloat(bundleInputs.min);
    const max = parseFloat(bundleInputs.max);

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      addToast('error', `Invalid min/max for ${type} in ${bundleName}. Please enter positive numbers.`);
      return;
    }
    if (min > max) {
      addToast('error', `Min value cannot be greater than max value for ${type} in ${bundleName}.`);
      return;
    }
    if (type === 'sell' && (min > 100 || max > 100)) {
      addToast('error', `Sell percentage cannot exceed 100 for ${bundleName}.`);
      return;
    }

    const targetProperty = type === 'buy' ? 'buyAmountSol' : 'sellPercentage';
    const decimals = type === 'buy' ? 3 : 0; 

    setBundleGroupsConfig(prevGroups =>
      prevGroups.map((group, index) => {
        if (index === bundleIndex) {
          if (!group.walletsConfig || group.walletsConfig.length === 0) {
            addToast('info', `No wallets in ${group.name} to set ${type} values for.`);
            return group;
          }
          return {
            ...group,
            walletsConfig: group.walletsConfig.map(wc => {
              let randomValue = Math.random() * (max - min) + min;
              if (type === 'buy') {
                randomValue = parseFloat(randomValue.toFixed(decimals));
              } else { 
                randomValue = Math.floor(randomValue);
              }
              randomValue = Math.max(min, Math.min(max, randomValue)); 
              if (type === 'sell') randomValue = Math.min(100, randomValue);

              return {
                ...wc,
                [targetProperty]: String(randomValue)
              };
            })
          };
        }
        return group;
      })
    );
    addToast('success', `All ${type} amounts for ${bundleName} randomly set between ${min}${type === 'buy' ? ' SOL' : '%'} and ${max}${type === 'buy' ? ' SOL' : '%'}.`);
  };

  const executeTradeAction = async (bundleIndex, actionType, walletsToProcess, getAmountCallback) => {
    const bundle = bundleGroupsConfig[bundleIndex];
    if (!bundle) {
        addToast('error', 'Bundle configuration not found.');
        return;
    }
    if (walletsToProcess.length === 0) {
      addToast('error', `No wallets to process for ${actionType} in ${bundle.name}.`);
      return;
    }
    if (!mintAddress) {
        addToast('error', 'Global Token Mint Address is required.');
        return;
    }

    const loadingKey = `bundle-${bundleIndex}-${actionType}`;
    setLoadingStates(prev => ({ ...prev, [loadingKey]: true }));
    setErrorMessage('');

    for (const walletConfig of walletsToProcess) {
        const wallet = wallets.find(w => w.id === walletConfig.walletId);
        if (!wallet) continue;

        let currentSignature = null;
        let currentError = null;
        let currentStatus = 'error';
        let amountForApi;

        if (actionType === 'sell') {
            amountForApi = `${getAmountCallback(walletConfig)}%`;
        } else {
            amountForApi = getAmountCallback(walletConfig);
        }

        if ((actionType === 'buy' && (isNaN(parseFloat(amountForApi)) || parseFloat(amountForApi) <= 0)) || 
            (actionType === 'sell' && (!String(amountForApi).endsWith('%') || parseFloat(String(amountForApi).replace('%','')) <= 0 || parseFloat(String(amountForApi).replace('%','')) > 100))) {
            currentError = `Invalid ${actionType} parameter for ${wallet.name}: ${amountForApi}`;
            addToast('error', currentError);
            onTradeComplete(currentStatus, currentSignature, currentError, { actionType, walletName: wallet.name, mint: mintAddress, amount: String(amountForApi), bundleName: bundle.name });
            continue; 
        }
        
        const displayAmount = actionType === 'sell' ? `${amountForApi}` : amountForApi;

        const tradeDetailsForLog = {
            actionType,
            walletName: wallet.name,
            walletId: wallet.id,
            mint: mintAddress,
            amount: displayAmount,
            pool: pool,
            slippage: slippage,
            priorityFee: priorityFee,
            bundleName: bundle.name 
        };

        try {
            const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');
            const tradePayload = {
                publicKey: wallet.publicKey,
                action: actionType,
                mint: mintAddress,
                denominatedInSol: 'true',
                amount: amountForApi,
                slippage: parseInt(slippage),
                priorityFee: parseFloat(priorityFee),
                pool: pool, 
            };
            
            const transactionBuffer = await sendTradeTransactionApi(tradePayload);
            const tx = VersionedTransaction.deserialize(new Uint8Array(transactionBuffer));
            const signerKeyPair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
            tx.sign([signerKeyPair]);
            currentSignature = await web3Connection.sendTransaction(tx);
            currentStatus = 'success';
            console.log(`Advanced Transaction (${actionType}) for ${wallet.name} (${wallet.publicKey}) in bundle ${bundle.name}: https://solscan.io/tx/${currentSignature}`);

        } catch (err) {
            console.error(`Error during advanced ${actionType} for ${wallet.name}:`, err);
            currentError = err.message || `An unexpected error occurred during advanced ${actionType}.`;
            if (err.message && err.message.toLowerCase().includes('reached end of buffer unexpectedly')) {
                currentError = 'Failed to prepare transaction. The received data was incomplete or invalid. Please check proxy server logs.';
            }
            currentStatus = 'error';
        } finally {
            setLoadingStates(prev => ({ ...prev, [`bundle-${bundleIndex}-${actionType}-${wallet.id}`]: false }));
            onTradeComplete(currentStatus, currentSignature, currentError, tradeDetailsForLog);
        }
    }
    setLoadingStates(prev => ({ ...prev, [loadingKey]: false }));
  };

  const handleBundleBuy = (bundleIndex) => {
    const bundle = bundleGroupsConfig[bundleIndex];
    if (!bundle) return;
    const activeWalletsInBundle = bundle.walletsConfig.filter(wc => bundle.activeInTradeWalletIds.includes(wc.walletId));
    executeTradeAction(bundleIndex, 'buy', activeWalletsInBundle, wc => wc.buyAmountSol);
  };

  const handleBundleSell = (bundleIndex) => {
    const bundle = bundleGroupsConfig[bundleIndex];
    if (!bundle) return;
    const activeWalletsInBundle = bundle.walletsConfig.filter(wc => bundle.activeInTradeWalletIds.includes(wc.walletId));
    executeTradeAction(bundleIndex, 'sell', activeWalletsInBundle, wc => wc.sellPercentage);
  };

  const handleBundleDump = (bundleIndex) => {
    const bundle = bundleGroupsConfig[bundleIndex];
    if (!bundle) return;
    const allAssignedWalletsInBundle = bundle.walletsConfig;
    if(allAssignedWalletsInBundle.length === 0) {
        addToast('info', `No wallets in ${bundle.name} to DUMP.`);
        return;
    }
    executeTradeAction(bundleIndex, 'sell', allAssignedWalletsInBundle, () => '100');
  };
  
  return (
    <div className="advanced-trade-form-container">
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div className="global-mint-input-area">
        <h3>Global Token Mint Address</h3>
        <div className="form-group mint-address-group" style={{ margin: '0 auto', maxWidth: '600px'}}>
          <div className="input-with-icon">
            <input
              type="text"
              id="advanced-trade-mint-global"
              name="mint"
              value={mintAddress}
              onChange={handleGlobalInputChange}
              required
              placeholder="Enter Token Mint Address for all bundles (e.g., So111...)"
            />
            <button type="button" onClick={copyMintToClipboard} className="copy-icon-button" title="Copy Mint Address">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-clipboard" viewBox="0 0 16 16">
                    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="bundles-area">
        <div className="bundles-grid">
          {bundleGroupsConfig.map((bundle, bundleIndex) => (
            <div key={bundle.id} className={`bundle-card`}>
              <div className="bundle-header">
                <h3>{bundle.name}</h3>
                <div className="bundle-header-actions">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleSelectAllInBundle(bundleIndex); }} 
                    className="bundle-action-btn select-all-btn"
                    title={`Select all ${bundle.walletsConfig.length} wallet(s) in this bundle for trade`}
                    disabled={bundle.walletsConfig.length === 0}
                  >
                    Select All ({bundle.activeInTradeWalletIds.length}/{bundle.walletsConfig.length})
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeselectAllInBundle(bundleIndex); }} 
                    className="bundle-action-btn deselect-all-btn"
                    title="Deselect all wallets in this bundle for trade"
                    disabled={bundle.activeInTradeWalletIds.length === 0}
                  >
                    Deselect All
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleWalletSelector(bundleIndex); }} 
                    className="bundle-action-btn add-wallet-to-bundle-btn"
                    title="Add/Remove Wallets in this Bundle"
                  >
                    + Wallets
                  </button>
                   <button 
                    onClick={(e) => { e.stopPropagation(); handleBundleDump(bundleIndex); }} 
                    className="bundle-action-btn dump-btn"
                    title={`Sell ALL holdings (100%) for ALL wallets in ${bundle.name}`}
                    disabled={loadingStates[`bundle-${bundleIndex}-sell`] || bundle.walletsConfig.length === 0}
                  >
                    DUMP
                  </button>
                </div>
              </div>

              <div className="bundle-batch-set-controls">
                <div className="batch-set-group">
                  <span className="batch-label">Buy (SOL):</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={batchInputValues[bundleIndex]?.buy?.min ?? ''}
                    onChange={(e) => handleBatchInputChange(bundleIndex, 'buy', 'min', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="batch-input batch-input-min"
                    min="0" step="any"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={batchInputValues[bundleIndex]?.buy?.max ?? ''}
                    onChange={(e) => handleBatchInputChange(bundleIndex, 'buy', 'max', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="batch-input batch-input-max"
                    min="0" step="any"
                  />
                  <button 
                    onClick={() => handleSetRandomAllForBundle(bundleIndex, 'buy')}
                    disabled={!bundle || !bundle.walletsConfig || bundle.walletsConfig.length === 0}
                    className="batch-set-button"
                    title={`Set random SOL buy amount for all wallets in ${bundle.name}`}
                  >
                    Set Buy
                  </button>
                </div>
                <div className="batch-set-group">
                  <span className="batch-label">Sell (%):</span>
                  <input
                    type="number"
                    placeholder="Min"
                    value={batchInputValues[bundleIndex]?.sell?.min ?? ''}
                    onChange={(e) => handleBatchInputChange(bundleIndex, 'sell', 'min', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="batch-input batch-input-min"
                    min="0" max="100" step="1"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={batchInputValues[bundleIndex]?.sell?.max ?? ''}
                    onChange={(e) => handleBatchInputChange(bundleIndex, 'sell', 'max', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="batch-input batch-input-max"
                    min="0" max="100" step="1"
                  />
                  <button 
                    onClick={() => handleSetRandomAllForBundle(bundleIndex, 'sell')}
                    disabled={!bundle || !bundle.walletsConfig || bundle.walletsConfig.length === 0}
                    className="batch-set-button"
                    title={`Set random % sell amount for all wallets in ${bundle.name}`}
                  >
                    Set Sell
                  </button>
                </div>
              </div>

              <div className="bundle-wallets">
                {bundle.walletsConfig.length === 0 ? (
                  <p className="no-wallets-in-bundle">No wallets assigned. Click '+ Wallets' to add.</p>
                ) : (
                  bundle.walletsConfig.map(walletConfig => {
                    const wallet = wallets.find(w => w.id === walletConfig.walletId);
                    if (!wallet) return null;
                    const balance = walletBalances ? walletBalances[wallet.id] : undefined;
                    const isLoadingBalance = isLoadingBalances && balance === undefined;
                    const isActiveForTrade = bundle.activeInTradeWalletIds.includes(walletConfig.walletId);
                    return (
                      <div 
                        key={walletConfig.walletId} 
                        className={`wallet-chip-grid ${isActiveForTrade ? 'active-for-trade' : ''}`}
                        onClick={() => toggleWalletActiveForTrade(bundleIndex, walletConfig.walletId)}
                        title={isActiveForTrade ? `Deselect ${wallet.name} for trade` : `Select ${wallet.name} for trade`}
                      >
                        <div className="wallet-chip-header">
                          <span className="wallet-chip-name">
                            {wallet.name} 
                            <span className="wallet-chip-balance">
                              ({isLoadingBalance ? '...' : balance !== undefined ? `${typeof balance === 'number' ? balance.toFixed(3) : balance} SOL` : 'N/A'})
                            </span>
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveWalletFromBundle(bundleIndex, walletConfig.walletId); }} 
                            className="remove-wallet-chip-btn"
                            title="Remove from Bundle"
                          >
                            &times;
                          </button>
                        </div>
                        <div className="wallet-chip-inputs">
                          <input 
                            type="number" 
                            className="wallet-input buy-input"
                            value={walletConfig.buyAmountSol}
                            onChange={(e) => handleWalletParamChange(bundleIndex, walletConfig.walletId, 'buyAmountSol', e.target.value)}
                            onClick={(e) => e.stopPropagation()} 
                            placeholder="Buy SOL"
                            min="0" 
                            step="any"
                          />
                          <input 
                            type="number" 
                            className="wallet-input sell-input"
                            value={walletConfig.sellPercentage}
                            onChange={(e) => handleWalletParamChange(bundleIndex, walletConfig.walletId, 'sellPercentage', e.target.value)}
                            onClick={(e) => e.stopPropagation()} 
                            placeholder="Sell %"
                            min="0" max="100" step="1"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {walletSelectorOpenForBundle === bundleIndex && (
                <div className="wallet-selector-dropdown">
                  <div className="wallet-selector-header">
                    <h4>Available Wallets to Add to {bundle.name}</h4>
                    <button 
                      onClick={() => toggleWalletSelector(null)} 
                      className="close-wallet-selector-btn"
                      title="Close Wallet Selector"
                    >
                      &times;
                    </button>
                  </div>
                  {(() => {
                    const allAssignedWalletIdsInOtherBundles = new Set();
                    bundleGroupsConfig.forEach((b, i) => {
                      if (i !== bundleIndex) {
                        b.walletsConfig.forEach(wc => allAssignedWalletIdsInOtherBundles.add(wc.walletId));
                      }
                    });

                    return (!wallets || wallets.length === 0) ? <p>No wallets in Wallet Manager.</p> :
                      wallets.map(wallet => {
                        const isInCurrentBundle = bundle.walletsConfig.find(wc => wc.walletId === wallet.id);
                        const isInAnotherBundle = allAssignedWalletIdsInOtherBundles.has(wallet.id);
                        
                        const isDisabled = !!isInCurrentBundle || isInAnotherBundle;
                        let title = '';
                        if (isInCurrentBundle) {
                          title = `${wallet.name} is already in this bundle.`
                        } else if (isInAnotherBundle) {
                          title = `${wallet.name} is already in another bundle.`
                        } else {
                          title = `Add ${wallet.name} to ${bundle.name}`;
                        }

                        return (
                          <div 
                            key={wallet.id} 
                            className={`wallet-selector-item ${isDisabled ? 'disabled' : ''}`}
                            onClick={!isDisabled ? () => handleAddWalletToBundle(bundleIndex, wallet.id) : undefined}
                            title={title}
                          >
                            {wallet.name}
                            {isInCurrentBundle ? 
                              <span className="tick-mark">✓ In this bundle</span> : 
                              (isInAnotherBundle ? 
                                <span className="tick-mark-other">🔒 In another bundle</span> : 
                                null
                              )
                            }
                          </div>
                        );
                      });
                  })()}
                </div>
              )}
              <div className="bundle-trade-actions">
                <button 
                  type="button" 
                  onClick={() => handleBundleBuy(bundleIndex)} 
                  disabled={loadingStates[`bundle-${bundleIndex}-buy`] || bundle.activeInTradeWalletIds.length === 0}
                  className="submit-button buy-button bundle-specific-btn"
                >
                  {loadingStates[`bundle-${bundleIndex}-buy`] ? 'Buying...' : `Buy with ${bundle.activeInTradeWalletIds.length} Selected`}
                </button>
                <button 
                  type="button" 
                  onClick={() => handleBundleSell(bundleIndex)} 
                  disabled={loadingStates[`bundle-${bundleIndex}-sell`] || bundle.activeInTradeWalletIds.length === 0}
                  className="submit-button sell-button bundle-specific-btn"
                >
                  {loadingStates[`bundle-${bundleIndex}-sell`] ? 'Selling...' : `Sell with ${bundle.activeInTradeWalletIds.length} Selected`}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdvancedTradeForm; 