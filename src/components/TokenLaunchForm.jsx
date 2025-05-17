import React, { useState, useRef, useEffect } from 'react';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { RPC_ENDPOINT } from '../constants'; // Constants
import { uploadMetadataApi, createTokenApi } from '../api'; // API functions

const TokenLaunchForm = ({ wallets, onLaunchComplete, priorityFee, slippage, pool, addToast }) => {
  const [launchFormData, setLaunchFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    twitter: '',
    telegram: '',
    website: '',
    amount: 1, // Initial buy amount in SOL
  });

  const [selectedCreatorWalletId, setSelectedCreatorWalletId] = useState('');
  const [showSocialLinks, setShowSocialLinks] = useState(false);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [launchLoading, setLaunchLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Auto-select the first wallet if available and none is selected
    if (wallets && wallets.length > 0 && !selectedCreatorWalletId) {
      setSelectedCreatorWalletId(wallets[0].id);
    }
  }, [wallets, selectedCreatorWalletId]);

  const handleLaunchInputChange = (e) => {
    const { name, value } = e.target;
    setLaunchFormData({
      ...launchFormData,
      [name]: value
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const launchToken = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!selectedFile) {
      // alert('Please select an image file for your token');
      if (addToast) addToast('error', 'Please select an image file for your token.');
      return;
    }

    const selectedWallet = wallets.find(w => w.id === selectedCreatorWalletId);
    if (!selectedWallet) {
        // alert('Please select a creator wallet.');
        if (addToast) addToast('error', 'Please select a creator wallet.');
        return;
    }

    setLaunchLoading(true);
    
    try {
      const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');
      // Use selected wallet's private key
      const signerKeyPair = Keypair.fromSecretKey(bs58.decode(selectedWallet.privateKey));
      const mintKeypair = Keypair.generate();

      const formDataForApi = new FormData();
      formDataForApi.append("file", selectedFile);
      formDataForApi.append("name", launchFormData.name);
      formDataForApi.append("symbol", launchFormData.symbol);
      formDataForApi.append("description", launchFormData.description);
      formDataForApi.append("twitter", launchFormData.twitter);
      formDataForApi.append("telegram", launchFormData.telegram);
      formDataForApi.append("website", launchFormData.website);
      formDataForApi.append("showName", "true");

      const metadataResponseJSON = await uploadMetadataApi(formDataForApi);

      const tokenCreationPayload = {
        "publicKey": selectedWallet.publicKey, // Use selected wallet's public key
        "action": "create",
        "tokenMetadata": {
          name: metadataResponseJSON.metadata.name,
          symbol: metadataResponseJSON.metadata.symbol,
          uri: metadataResponseJSON.metadataUri
        },
        "mint": mintKeypair.publicKey.toBase58(),
        "denominatedInSol": "true",
        "amount": parseFloat(launchFormData.amount),
        "slippage": parseInt(slippage),
        "priorityFee": parseFloat(priorityFee),
        "pool": pool
      };

      const transactionBuffer = await createTokenApi(tokenCreationPayload);
      const tx = VersionedTransaction.deserialize(new Uint8Array(transactionBuffer));
      tx.sign([mintKeypair, signerKeyPair]);
      const signature = await web3Connection.sendTransaction(tx);
      
      console.log("Token Launch Transaction: https://solscan.io/tx/" + signature);
      if (onLaunchComplete) onLaunchComplete('success', signature, null, { mintAddress: mintKeypair.publicKey.toBase58(), name: launchFormData.name, symbol: launchFormData.symbol });
    } catch (error) {
      const errorMessageText = error.message || "Error launching token";
      setErrorMessage(errorMessageText);
      console.error("Error launching token:", error);
      if (onLaunchComplete) onLaunchComplete('error', null, errorMessageText, { name: launchFormData.name, symbol: launchFormData.symbol });
    } finally {
      setLaunchLoading(false);
    }
  };

  return (
    <form className="launch-form" onSubmit={launchToken}>
      <div className="form-group">
        <label htmlFor="creatorWallet">Creator Wallet</label>
        <select
          id="creatorWallet"
          value={selectedCreatorWalletId}
          onChange={(e) => setSelectedCreatorWalletId(e.target.value)}
          required
        >
          <option value="" disabled>Select a wallet</option>
          {wallets && wallets.map(wallet => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name} ({wallet.publicKey.substring(0, 6)}...)
            </option>
          ))}
          {(!wallets || wallets.length === 0) && <option value="" disabled>No wallets available</option>}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="tokenName">Token Name</label>
        <input
          type="text"
          id="tokenName"
          name="name"
          value={launchFormData.name}
          onChange={handleLaunchInputChange}
          required
          placeholder="e.g. My Awesome Token"
        />
      </div>

      <div className="form-group">
        <label htmlFor="tokenSymbol">Token Symbol</label>
        <input
          type="text"
          id="tokenSymbol"
          name="symbol"
          value={launchFormData.symbol}
          onChange={handleLaunchInputChange}
          required
          placeholder="e.g. MAT"
          maxLength="10"
        />
      </div>

      <div className="form-group">
        <label htmlFor="tokenDescription">Description</label>
        <textarea
          id="tokenDescription"
          name="description"
          value={launchFormData.description}
          onChange={handleLaunchInputChange}
          placeholder="Enter token description"
          rows="3"
        />
      </div>

      <div className="form-group">
        <label htmlFor="tokenImage">Token Image</label>
        <input
          type="file"
          id="tokenImage"
          name="image"
          onChange={handleFileChange}
          accept="image/*"
          ref={fileInputRef}
          required
        />
        <small className="note">Recommended size: 256x256px</small>
      </div>

      <div className="form-group">
        <button 
          type="button" 
          onClick={() => setShowSocialLinks(!showSocialLinks)}
          className="toggle-social-button"
        >
          {showSocialLinks ? 'Hide' : 'Show'} Social Links (Optional)
        </button>
      </div>

      {showSocialLinks && (
        <div className="social-links-collapsible">
          <div className="form-group">
            <label htmlFor="tokenTwitter">Twitter URL</label>
            <input
              type="text"
              id="tokenTwitter"
              name="twitter"
              value={launchFormData.twitter}
              onChange={handleLaunchInputChange}
              placeholder="e.g. https://twitter.com/username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tokenTelegram">Telegram URL</label>
            <input
              type="text"
              id="tokenTelegram"
              name="telegram"
              value={launchFormData.telegram}
              onChange={handleLaunchInputChange}
              placeholder="e.g. https://t.me/groupname"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tokenWebsite">Website URL</label>
            <input
              type="text"
              id="tokenWebsite"
              name="website"
              value={launchFormData.website}
              onChange={handleLaunchInputChange}
              placeholder="e.g. https://example.com"
            />
          </div>
        </div>
      )}

      <div className="form-row-quad">
        <div className="form-group form-group-quarter">
          <label htmlFor="launchAmount">Initial Liquidity (SOL)</label>
          <input
            type="number"
            id="launchAmount"
            name="amount"
            value={launchFormData.amount}
            onChange={handleLaunchInputChange}
            required
            placeholder="Initial SOL"
            min="0.1"
            step="0.1"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="cors-warning"> {/* Changed from error-message to cors-warning to match App.jsx style if needed */}
          {errorMessage}
        </div>
      )}

      <button 
        type="submit" 
        className={`submit-button ${launchLoading ? 'loading' : ''}`}
        disabled={launchLoading}
      >
        {launchLoading ? 'Launching Token...' : 'Launch Token'}
      </button>
    </form>
  );
};

export default TokenLaunchForm; 