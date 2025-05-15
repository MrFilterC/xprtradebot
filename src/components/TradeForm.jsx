import { useState, useEffect } from 'react';
import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { PROXY_URL, RPC_ENDPOINT } from '../constants'; // Adjusted path
import { sendTradeTransactionApi } from '../api'; // Adjusted path

function TradeForm({ 
  onTradeComplete, 
  wallets, 
  walletBalances, 
  isLoadingBalances,
  priorityFee, 
  slippage,    
  pool,        
  addToast, 
  formData, 
  setFormData, 
  selectedWalletIds, 
  setSelectedWalletIds 
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeBuyAmount, setActiveBuyAmount] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));
    if (name === 'amount') {
      setActiveBuyAmount(null);
    }
  };

  const handleBuyAmountShortcut = (solAmount) => {
    setFormData(prevData => ({
      ...prevData,
      amount: String(solAmount)
    }));
    setActiveBuyAmount(solAmount);
  };

  const handleSellPercentage = (percentage) => {
    setFormData(prevData => ({
      ...prevData,
      sellPercentage: String(percentage),
    }));
  };

  const handleWalletSelectionChange = (walletId) => {
    setSelectedWalletIds(prevSelectedWalletIds => {
      if (prevSelectedWalletIds.includes(walletId)) {
        return prevSelectedWalletIds.filter(id => id !== walletId);
      } else {
        return [...prevSelectedWalletIds, walletId];
      }
    });
  };

  const executeTrade = async (actionType) => {
    setLoading(true);
    setErrorMessage('');

    if (selectedWalletIds.length === 0) {
      setErrorMessage('Please select at least one wallet.');
      setLoading(false);
      onTradeComplete('error', null, 'Please select at least one wallet.', { actionType, walletName: 'N/A', mint: formData.mint });
      return;
    }

    if (!formData.mint) {
        setErrorMessage('Token Mint Address is required.');
        setLoading(false);
        onTradeComplete('error', null, 'Token Mint Address is required.', { actionType, walletName: 'N/A', mint: formData.mint });
        return;
    }

    for (const walletId of selectedWalletIds) {
      const selectedWallet = wallets.find(w => w.id === walletId);
      if (!selectedWallet) continue;

      const { publicKey, privateKey } = selectedWallet;
      let currentSignature = null;
      let currentError = null;
      let currentStatus = null;

      let amountValue;
      if (actionType === 'sell') {
        amountValue = `${formData.sellPercentage}%`;
      } else {
        amountValue = parseFloat(formData.amount);
      }

      const tradeDetailsForLog = {
        actionType,
        walletName: selectedWallet.name,
        walletId: selectedWallet.id,
        mint: formData.mint,
        amount: amountValue,
        pool: pool,
        slippage: slippage,
        priorityFee: priorityFee
      };

      try {
        const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');
        
        const tradePayload = {
          publicKey: publicKey,
          action: actionType,
          mint: formData.mint,
          denominatedInSol: 'true',
          amount: amountValue,
          slippage: parseInt(slippage),
          priorityFee: parseFloat(priorityFee),
          pool: pool === 'auto' ? undefined : pool,
        };

        const transactionBuffer = await sendTradeTransactionApi(tradePayload);
        const tx = VersionedTransaction.deserialize(new Uint8Array(transactionBuffer));
        const signerKeyPair = Keypair.fromSecretKey(bs58.decode(privateKey));
        tx.sign([signerKeyPair]);
        currentSignature = await web3Connection.sendTransaction(tx);
        currentStatus = 'success';
        console.log(`Transaction (${actionType}) for ${selectedWallet.name} (${publicKey}): https://solscan.io/tx/${currentSignature}`);
      } catch (error) {
        currentError = error.message || `Error processing ${actionType} trade for ${selectedWallet.name}`;
        currentStatus = 'error';
        console.error(`Error for ${selectedWallet.name} (${publicKey}) during ${actionType}:`, currentError);
      }
      onTradeComplete(currentStatus, currentSignature, currentError, tradeDetailsForLog);
    }
    setLoading(false);
  };

  const copyMintToClipboard = () => {
    if (formData.mint) {
      navigator.clipboard.writeText(formData.mint)
        .then(() => {
          if (addToast) addToast('success', 'Mint address copied!');
        })
        .catch(err => {
          console.error('Failed to copy mint address: ', err);
          if (addToast) addToast('error', 'Failed to copy mint address.');
        });
    } else {
      if (addToast) addToast('info', 'Mint address is empty.');
    }
  };

  return (
    <div className="trade-form-container">
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      <div className="form-group wallet-list-group">
        <label className="wallet-list-label">Select Wallet(s)</label>
        {(!wallets || wallets.length === 0) ? (
          <small className="note">No wallets available. Please create or import a wallet in Wallet Manager.</small>
        ) : (
          <div className="wallet-grid-container">
            {wallets.map(wallet => {
              const balance = walletBalances ? walletBalances[wallet.id] : undefined;
              const isLoadingBalance = isLoadingBalances && balance === undefined;
              const isSelected = selectedWalletIds.includes(wallet.id);
              return (
                <div 
                  key={wallet.id} 
                  className={`wallet-grid-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleWalletSelectionChange(wallet.id)}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleWalletSelectionChange(wallet.id);}}
                >
                  <div className="wallet-name-grid">{wallet.name}</div>
                  <div className="wallet-balance-grid">
                    {isLoadingBalance ? (
                      <span className="loading-balance-small">Loading...</span>
                    ) : balance !== undefined ? (
                      typeof balance === 'number' 
                        ? `${balance.toFixed(3)} SOL` 
                        : `${balance}`
                    ) : (
                      <span className="loading-balance-small">N/A</span> 
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="shared-trade-inputs">
        <div className="form-group mint-address-group">
          <label htmlFor="trade-mint">Token Mint Address</label>
          <div className="input-with-icon">
            <input
              type="text"
              id="trade-mint"
              name="mint"
              value={formData.mint}
              onChange={handleInputChange}
              required
              placeholder="e.g., So11111111111111111111111111111111111111112"
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
      <div className="buy-sell-panels-container">
        <div className="action-panel buy-panel">
          <div className="form-group">
            <label htmlFor="trade-amount">Amount (SOL)</label>
            <input
              type="number"
              id="trade-amount"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              required
              min="0"
              step="any"
              placeholder="Amount to buy in SOL"
            />
          </div>
          <div className="amount-shortcuts buy-shortcuts">
            <button type="button" onClick={() => handleBuyAmountShortcut(0.1)} className={activeBuyAmount === 0.1 ? 'active' : ''}>0.1</button>
            <button type="button" onClick={() => handleBuyAmountShortcut(0.25)} className={activeBuyAmount === 0.25 ? 'active' : ''}>0.25</button>
            <button type="button" onClick={() => handleBuyAmountShortcut(0.5)} className={activeBuyAmount === 0.5 ? 'active' : ''}>0.5</button>
            <button type="button" onClick={() => handleBuyAmountShortcut(1)} className={activeBuyAmount === 1 ? 'active' : ''}>1</button>
          </div>
          <button 
            type="button" 
            onClick={() => executeTrade('buy')} 
            disabled={loading || selectedWalletIds.length === 0}
            className="submit-button buy-button"
          >
            {loading ? 'Processing...' : 'Buy'}
          </button>
        </div>
        <div className="action-panel sell-panel">
          <div className="form-group sell-percentage-buttons">
            <label htmlFor="trade-sell-percentage-input">Sell Percentage</label>
            <input
              type="number"
              id="trade-sell-percentage-input"
              name="sellPercentage"
              value={formData.sellPercentage}
              onChange={handleInputChange}
              min="0"
              max="100"
              step="1"
              placeholder="Sell % (e.g., 100)"
              style={{marginBottom: '10px'}}
            />
            <div>
              <div className="percentage-buttons">
                {[25, 50, 75, 100].map((perc) => (
                  <button
                    type="button"
                    key={perc}
                    className={`percentage-button ${formData.sellPercentage === perc.toString() ? 'active' : ''}`}
                    onClick={() => handleSellPercentage(perc.toString())}
                  >
                    {perc}%
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => executeTrade('sell')} 
            disabled={loading || selectedWalletIds.length === 0}
            className="submit-button sell-button"
          >
            {loading ? 'Processing...' : 'Sell'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TradeForm; 