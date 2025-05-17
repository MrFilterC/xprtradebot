import React, { useState, useCallback } from 'react';
import { PublicKey, Keypair } from '@solana/web3.js';

const QuickLaunchForm = ({
  wallets,
  globalSettings,
  onLaunchComplete,
  addLogEntry,
  addToast,
  sendAndConfirmTransactionSignedByMintAndWallet,
  uploadMetadataApi,
  createTokenApi
}) => {
  const [creatorWalletAddress, setCreatorWalletAddress] = useState('');
  const [tickerName, setTickerName] = useState('');
  const [tokenImageFile, setTokenImageFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setTokenImageFile(event.target.files[0]);
    }
  };

  const handleLaunch = useCallback(async (solAmount) => {
    if (!creatorWalletAddress || !tickerName || !tokenImageFile) {
      addToast('Please select a creator wallet, enter a ticker/name, and select a token image.', 'error');
      return;
    }

    setIsSubmitting(true);
    const launchDetails = { name: tickerName, symbol: tickerName, solAmount };
    addLogEntry(`Quick Launch init for ${tickerName} with ${solAmount} SOL.`, 'info');

    const creatorWallet = wallets.find(w => w.publicKey === creatorWalletAddress);
    if (!creatorWallet) {
      const errorMsg = 'Creator wallet not found.';
      addToast(errorMsg, 'error');
      setIsSubmitting(false);
      onLaunchComplete(null, null, errorMsg, { ...launchDetails, error: errorMsg });
      return;
    }

    const mintKeypair = Keypair.generate();
    const mintPublicKey = mintKeypair.publicKey.toString();
    launchDetails.mintAddress = mintPublicKey;
    addLogEntry(`Generated Mint Keypair: ${mintPublicKey}`, 'info');

    try {
      // 1. Upload metadata
      const metadataFormData = new FormData();
      metadataFormData.append('name', tickerName);
      metadataFormData.append('symbol', tickerName);
      metadataFormData.append('description', '');
      metadataFormData.append('file', tokenImageFile);
      metadataFormData.append('twitter', '');
      metadataFormData.append('telegram', '');
      metadataFormData.append('website', '');
      metadataFormData.append('showName', 'true');

      addLogEntry(`Uploading metadata for ${tickerName}...`, 'info');
      const metadataResponse = await uploadMetadataApi(metadataFormData);

      if (metadataResponse.error || !metadataResponse.uri) {
        const errorMsg = `Metadata upload failed: ${metadataResponse.error || 'No URI returned'}`;
        addToast(errorMsg, 'error');
        addLogEntry(errorMsg, 'error');
        setIsSubmitting(false);
        onLaunchComplete(null, mintPublicKey, errorMsg, { ...launchDetails, error: errorMsg, metadataError: metadataResponse.error });
        return;
      }
      const metadataUri = metadataResponse.uri;
      launchDetails.metadataUri = metadataUri;
      addLogEntry(`Metadata uploaded successfully: ${metadataUri}`, 'success');

      // 2. Prepare transaction for token creation
      const payload = {
        action: 'create',
        publicKey: creatorWallet.publicKey,
        mint: mintPublicKey,
        tokenMetadata: {
          name: tickerName,
          symbol: tickerName,
          uri: metadataUri
        },
        denominatedInSol: "true",
        amount: parseFloat(solAmount.toString()),
        priorityFee: parseFloat(globalSettings.priorityFee.toString()),
        slippage: parseInt(globalSettings.slippage.toString()),
        pool: globalSettings.pool
      };
      addLogEntry(`Preparing token creation transaction for ${tickerName}... Payload: ${JSON.stringify(payload)}`, 'info');
      
      const apiResponse = await createTokenApi(payload);
      console.log('[QuickLaunchForm] Response from createTokenApi:', apiResponse);

      if (!(apiResponse instanceof ArrayBuffer)) {
        const errorMsg = 'Failed to get a valid ArrayBuffer from createTokenApi.';
        console.error('[QuickLaunchForm]', errorMsg, 'Received:', apiResponse);
        addToast(errorMsg, 'error');
        addLogEntry(errorMsg, 'error');
        setIsSubmitting(false);
        onLaunchComplete(null, mintPublicKey, errorMsg, { ...launchDetails, error: errorMsg });
        return;
      }
      const buffer = apiResponse; // apiResponse is expected to be an ArrayBuffer
      console.log('[QuickLaunchForm] Buffer received, byteLength:', buffer.byteLength);
      
      addLogEntry(`Token creation buffer received for ${tickerName}. Signing and sending...`, 'info');
      console.log('[QuickLaunchForm] Calling sendAndConfirmTransactionSignedByMintAndWallet with buffer:', buffer);

      // 3. Sign and send transaction
      const { signature, error: sendError } = await sendAndConfirmTransactionSignedByMintAndWallet(
        buffer,
        mintKeypair,
        creatorWallet,
        addLogEntry,
        `Token Launch (${tickerName})`
      );

      if (signature) {
        // Success: signature is present
        onLaunchComplete(signature, mintPublicKey, null, { ...launchDetails, signature });
        
        if (sendError) {
          // If there was an accompanying non-fatal error, log it as a warning.
          addLogEntry(`Token launch for ${tickerName} succeeded with signature but encountered an issue: ${sendError}`, 'warning');
        }
      } else {
        // Failure: no signature
        const actualError = sendError || 'Unknown error during send/confirm transaction step';
        const errorMsgForLog = `Token launch for ${tickerName} failed during send/confirm: ${actualError}`;
        
        addLogEntry(errorMsgForLog, 'error'); 
        
        onLaunchComplete(null, mintPublicKey, actualError, { ...launchDetails, error: actualError, transactionError: actualError });
      }
    } catch (error) {
      const errorMsg = `An unexpected error occurred during quick launch for ${tickerName}: ${error.message}`;
      console.error(errorMsg, error);
      addLogEntry(errorMsg, 'error');
      onLaunchComplete(null, mintPublicKey, error.message, { ...launchDetails, error: error.message, exception: error });
    } finally {
      setIsSubmitting(false);
    }
  }, [creatorWalletAddress, tickerName, tokenImageFile, wallets, globalSettings, uploadMetadataApi, createTokenApi, sendAndConfirmTransactionSignedByMintAndWallet, addToast, addLogEntry, onLaunchComplete]);

  const launchAmounts = [0.5, 1, 2, 3];

  return (
    <div className="form-container quick-launch-form launch-form">
      <h3>Quick Token Launch</h3>
      <div className="form-group">
        <label htmlFor="ql-creator-wallet">Creator Wallet:</label>
        <select
          id="ql-creator-wallet"
          value={creatorWalletAddress}
          onChange={(e) => setCreatorWalletAddress(e.target.value)}
          disabled={isSubmitting}
        >
          <option value="">Select Creator Wallet</option>
          {wallets.map(wallet => (
            <option key={wallet.publicKey} value={wallet.publicKey}>
              {wallet.name} ({wallet.publicKey.substring(0, 4)}...{wallet.publicKey.substring(wallet.publicKey.length - 4)})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="ql-ticker-name">Ticker / Name:</label>
        <input
          type="text"
          id="ql-ticker-name"
          value={tickerName}
          onChange={(e) => setTickerName(e.target.value)}
          placeholder="e.g., MYTOKEN"
          disabled={isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="ql-token-image">Token Image (PNG/JPG/GIF):</label>
        <input
          type="file"
          id="ql-token-image"
          accept="image/png, image/jpeg, image/gif"
          onChange={handleImageChange}
          disabled={isSubmitting}
        />
        {tokenImageFile && <p className="file-name-display">Selected: {tokenImageFile.name}</p>}
      </div>
      
      <div className="form-group launch-buttons-group">
        <label>Launch Amount (SOL):</label>
        <div className="button-row">
          {[0.5, 1, 2, 3].map((amount) => (
            <button
              key={amount}
              type="button"
              className="submit-button"
              onClick={() => handleLaunch(amount)}
              disabled={isSubmitting || !creatorWalletAddress || !tickerName || !tokenImageFile}
            >
              {amount} SOL
            </button>
          ))}
        </div>
      </div>

      {isSubmitting && <div className="loading">Launching...</div>}
    </div>
  );
};

export default QuickLaunchForm; 