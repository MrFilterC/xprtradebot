import React, { useState, useRef, useEffect } from 'react';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { RPC_ENDPOINT } from '../constants';
import { uploadMetadataApi, createBundleTransactionsApi, sendBundleToJitoApi } from '../api';

const BundleLaunchForm = ({ wallets, onBundleLaunchComplete, priorityFee, slippage, pool }) => {
  const [bundleFormData, setBundleFormData] = useState({
    selectedBundleWalletIds: {
        wallet1: '', wallet2: '', wallet3: '', wallet4: '', wallet5: ''
    },
    creatorAmount: 1,
    bundleAmount1: 1,
    bundleAmount2: 1,
    bundleAmount3: 1,
    bundleAmount4: 1,
    bundleAmount5: 1,
    name: '',
    symbol: '',
    description: '',
    twitter: '',
    telegram: '',
    website: '',
  });

  const [selectedMainWalletId, setSelectedMainWalletId] = useState('');
  const [showBundleSocialLinks, setShowBundleSocialLinks] = useState(false);
  const bundleFileInputRef = useRef(null);
  const [selectedBundleFile, setSelectedBundleFile] = useState(null);

  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleErrorMessage, setBundleErrorMessage] = useState('');

  useEffect(() => {
    if (wallets && wallets.length > 0 && !selectedMainWalletId) {
      setSelectedMainWalletId(wallets[0].id);
    }
  }, [wallets, selectedMainWalletId]);

  const handleBundleInputChange = (e) => {
    const { name, value } = e.target;
    setBundleFormData({
      ...bundleFormData,
      [name]: value
    });
  };

  const handleBundleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedBundleFile(e.target.files[0]);
    }
  };

  const handleBundleWalletSelectionChange = (walletNumber, selectedId) => {
    setBundleFormData(prevData => ({
        ...prevData,
        selectedBundleWalletIds: {
            ...prevData.selectedBundleWalletIds,
            [`wallet${walletNumber}`]: selectedId
        }
    }));
  };

  const launchBundle = async (e) => {
    e.preventDefault();
    setBundleErrorMessage('');

    if (!selectedBundleFile) {
      alert('Please select an image file for your token');
      return;
    }

    const mainWallet = wallets.find(w => w.id === selectedMainWalletId);
    if (!mainWallet) {
        alert('Please select a main wallet for bundle launch.');
        return;
    }

    const firstBundleWalletId = bundleFormData.selectedBundleWalletIds.wallet1;
    const firstBundleWallet = firstBundleWalletId ? wallets.find(w => w.id === firstBundleWalletId) : null;

    if (!firstBundleWallet) {
      alert('Please select at least one bundle wallet (Bundle Wallet 1).');
      return;
    }

    setBundleLoading(true);
    if (onBundleLaunchComplete) onBundleLaunchComplete(null, []);

    try {
      const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');
      
      const signerKeyPairs = [Keypair.fromSecretKey(bs58.decode(mainWallet.privateKey))];
      
      for (let i = 1; i <= 5; i++) {
        const walletId = bundleFormData.selectedBundleWalletIds[`wallet${i}`];
        if (walletId) {
            const bundleWallet = wallets.find(w => w.id === walletId);
            if (bundleWallet && bundleWallet.privateKey) {
                 signerKeyPairs.push(Keypair.fromSecretKey(bs58.decode(bundleWallet.privateKey)));
            } else if (bundleWallet && !bundleWallet.privateKey){
                console.warn(`Bundle Wallet ${i} (${bundleWallet.name}) selected but has no private key.`);
            }
        }
      }
      
      const mintKeypair = Keypair.generate();

      const formDataForApi = new FormData();
      formDataForApi.append("file", selectedBundleFile);
      formDataForApi.append("name", bundleFormData.name);
      formDataForApi.append("symbol", bundleFormData.symbol);
      formDataForApi.append("description", bundleFormData.description);
      formDataForApi.append("twitter", bundleFormData.twitter);
      formDataForApi.append("telegram", bundleFormData.telegram);
      formDataForApi.append("website", bundleFormData.website);
      formDataForApi.append("showName", "true");

      const metadataResponseJSON = await uploadMetadataApi(formDataForApi);

      const bundledTxArgs = [
        {
          "publicKey": mainWallet.publicKey,
          "action": "create",
          "tokenMetadata": {
            name: metadataResponseJSON.metadata.name, 
            symbol: metadataResponseJSON.metadata.symbol, 
            uri: metadataResponseJSON.metadataUri
          },
          "mint": mintKeypair.publicKey.toBase58(),
          "denominatedInSol": "true",
          "amount": parseFloat(bundleFormData.creatorAmount),
          "slippage": parseInt(slippage),
          "priorityFee": parseFloat(priorityFee),
          "pool": pool
        }
      ];
      
      const buyAmounts = [
        bundleFormData.bundleAmount1,
        bundleFormData.bundleAmount2,
        bundleFormData.bundleAmount3,
        bundleFormData.bundleAmount4,
        bundleFormData.bundleAmount5
      ];
      
      let actualSignerIndex = 1;
      for (let i = 1; i <= 5; i++) {
        const walletId = bundleFormData.selectedBundleWalletIds[`wallet${i}`];
        const selectedBundleWallet = walletId ? wallets.find(w => w.id === walletId) : null;

        if (selectedBundleWallet && buyAmounts[i-1] > 0 && actualSignerIndex < signerKeyPairs.length) { 
            bundledTxArgs.push({
              "publicKey": selectedBundleWallet.publicKey,
              "action": "buy", 
              "mint": mintKeypair.publicKey.toBase58(), 
              "denominatedInSol": "true",  
              "amount": parseFloat(buyAmounts[i-1]), 
              "slippage": parseInt(slippage), 
              "priorityFee": parseFloat(priorityFee) * 0.1,
              "pool": pool
            });
            actualSignerIndex++;
        } else if (selectedBundleWallet && buyAmounts[i-1] > 0 && actualSignerIndex >= signerKeyPairs.length) {
            console.warn(`Skipping buy for Bundle Wallet ${i} as its KeyPair was not added (likely missing private key).`);
        }
      }

      const transactionsData = await createBundleTransactionsApi(bundledTxArgs);
      
      let encodedSignedTransactions = [];
      let signatures = [];
      
      for (let i = 0; i < bundledTxArgs.length; i++) {
        const tx = VersionedTransaction.deserialize(bs58.decode(transactionsData[i]));
        
        if (bundledTxArgs[i].action === "create") {
          tx.sign([mintKeypair, signerKeyPairs[0]]);
        } else {
          const buyerSignerIndex = bundledTxArgs.slice(0, i).filter(arg => arg.action === 'buy').length + 1;
          if (signerKeyPairs[buyerSignerIndex]) {
            tx.sign([signerKeyPairs[buyerSignerIndex]]);
          } else {
            throw new Error(`Signer not found for buy transaction ${i}. Check bundle wallet selections.`);
          }
        }
        
        encodedSignedTransactions.push(bs58.encode(tx.serialize()));
        signatures.push(bs58.encode(tx.signatures[0])); 
      }
      
      await sendBundleToJitoApi(encodedSignedTransactions);
      
      if (onBundleLaunchComplete) onBundleLaunchComplete('success', signatures, null, { mintAddress: mintKeypair.publicKey.toBase58(), name: bundleFormData.name, symbol: bundleFormData.symbol });
      
      for (let i = 0; i < signatures.length; i++) {
        console.log(`Bundle Transaction ${i+1}: https://solscan.io/tx/${signatures[i]}`);
      }
    } catch (error) {
      let detailedErrorMessage = "Error launching bundle";
      if (error.message) {
        detailedErrorMessage += `: ${error.message}`;
      }
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        detailedErrorMessage = `Jito API Error: ${error.response.data.error.message}`;
      } else if (error.message && error.message.includes("Network congested")) {
        detailedErrorMessage = `Jito API Error: Network congested or rate limited. Please try again later. (${error.message})`;
      }
      setBundleErrorMessage(detailedErrorMessage);
      console.error("Error launching bundle:", error);
      if (onBundleLaunchComplete) onBundleLaunchComplete('error', [], detailedErrorMessage, { name: bundleFormData.name, symbol: bundleFormData.symbol });
    } finally {
      setBundleLoading(false);
    }
  };

  return (
    <form className="launch-form" onSubmit={launchBundle}>
      <div className="form-row">
        <div className="form-group form-group-half">
            <label htmlFor="mainBundleWallet">Main Wallet (Creator)</label>
            <select
            id="mainBundleWallet"
            value={selectedMainWalletId}
            onChange={(e) => setSelectedMainWalletId(e.target.value)}
            required
            >
            <option value="" disabled>Select Main Wallet</option>
            {wallets && wallets.map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                {wallet.name} ({wallet.publicKey.substring(0, 6)}...)
                </option>
            ))}
            {(!wallets || wallets.length === 0) && <option value="" disabled>No wallets available</option>}
            </select>
        </div>
        <div className="form-group form-group-half">
            <label htmlFor="creatorAmount">Creator SOL Amount (LP)</label>
            <input 
                type="number" 
                id="creatorAmount" 
                name="creatorAmount" 
                value={bundleFormData.creatorAmount} 
                onChange={handleBundleInputChange} 
                required 
                placeholder="SOL for LP" 
                min="0.1" 
                step="0.1" 
            />
        </div>
      </div>
      
      <div className="form-group-separator">
        <h3>Bundle Wallets (Add up to 5 wallets)</h3>
        <small className="note">These wallets will also buy the token immediately after launch</small>
      </div>
      
      {[1, 2, 3, 4, 5].map(num => (
        <div className="wallet-group" key={`bundle_wallet_group_${num}`}>
          <div className="form-group wallet-key">
            <label htmlFor={`bundleWalletSelect${num}`}>Bundle Wallet {num} {num === 1 ? '' : '(Optional)'}</label>
            <select
                id={`bundleWalletSelect${num}`}
                value={bundleFormData.selectedBundleWalletIds[`wallet${num}`]}
                onChange={(e) => handleBundleWalletSelectionChange(num, e.target.value)}
            >
                <option value=""> (None Selected) </option>
                {wallets && wallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                        {wallet.name} ({wallet.publicKey.substring(0,6)}...)
                    </option>
                ))}
                 {(!wallets || wallets.length === 0) && <option value="" disabled>No wallets to select</option>}
            </select>
          </div>
          <div className="form-group wallet-amount">
            <label htmlFor={`bundleAmount${num}`}>SOL Amount (Buy)</label>
            <input
              type="number"
              id={`bundleAmount${num}`}
              name={`bundleAmount${num}`}
              value={bundleFormData[`bundleAmount${num}`]} 
              onChange={handleBundleInputChange}
              placeholder="SOL to buy token"
              min="0.01" 
              step="0.01"
              disabled={!bundleFormData.selectedBundleWalletIds[`wallet${num}`]} 
            />
          </div>
        </div>
      ))}

      <div className="form-group-separator">
        <h3>Token Details</h3>
      </div>

      <div className="form-group"><label htmlFor="bundleTokenName">Token Name</label><input type="text" id="bundleTokenName" name="name" value={bundleFormData.name} onChange={handleBundleInputChange} required placeholder="e.g. My Awesome Token"/></div>
      <div className="form-group"><label htmlFor="bundleTokenSymbol">Token Symbol</label><input type="text" id="bundleTokenSymbol" name="symbol" value={bundleFormData.symbol} onChange={handleBundleInputChange} required placeholder="e.g. MAT" maxLength="10"/></div>
      <div className="form-group"><label htmlFor="bundleTokenDescription">Description</label><textarea id="bundleTokenDescription" name="description" value={bundleFormData.description} onChange={handleBundleInputChange} placeholder="Enter token description" rows="3"/></div>
      <div className="form-group"><label htmlFor="bundleTokenImage">Token Image</label><input type="file" id="bundleTokenImage" name="image" onChange={handleBundleFileChange} accept="image/*" ref={bundleFileInputRef} required /><small className="note">Recommended size: 256x256px</small></div>
      
      <div className="form-group">
        <button 
          type="button" 
          onClick={() => setShowBundleSocialLinks(!showBundleSocialLinks)}
          className="toggle-social-button"
        >
          {showBundleSocialLinks ? 'Hide' : 'Show'} Social Links (Optional)
        </button>
      </div>

      {showBundleSocialLinks && (
        <div className="social-links-collapsible">
          <div className="form-group">
            <label htmlFor="bundleTokenTwitter">Twitter URL</label>
            <input type="text" id="bundleTokenTwitter" name="twitter" value={bundleFormData.twitter} onChange={handleBundleInputChange} placeholder="e.g. https://twitter.com/username"/>
          </div>
          <div className="form-group">
            <label htmlFor="bundleTokenTelegram">Telegram URL</label>
            <input type="text" id="bundleTokenTelegram" name="telegram" value={bundleFormData.telegram} onChange={handleBundleInputChange} placeholder="e.g. https://t.me/groupname"/>
          </div>
          <div className="form-group">
            <label htmlFor="bundleTokenWebsite">Website URL</label>
            <input type="text" id="bundleTokenWebsite" name="website" value={bundleFormData.website} onChange={handleBundleInputChange} placeholder="e.g. https://example.com"/>
          </div>
        </div>
      )}
      
      {bundleErrorMessage && (
        <div className="cors-warning"> 
          {bundleErrorMessage}
        </div>
      )}

      <button 
        type="submit" 
        className={`submit-button ${bundleLoading ? 'loading' : ''}`}
        disabled={bundleLoading}
      >
        {bundleLoading ? 'Launching Bundle...' : 'Launch Bundle'}
      </button>
    </form>
  );
};

export default BundleLaunchForm; 