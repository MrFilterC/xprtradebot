import React, { useState, useEffect, useCallback } from 'react';
import { Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
// API functions will be passed as props from App.jsx

const MAX_BUNDLE_WALLETS = 5;
const DEFAULT_LAUNCH_AMOUNTS = [0.5, 1, 2, 3];

const QuickBundleForm = ({
  wallets, 
  globalSettings, 
  onBundleLaunchComplete, 
  addLogEntry, 
  addToast, 
  uploadMetadataApi,
  createBundleTransactionsApi,
  sendBundleToJitoApi,
}) => {
  const [creatorWalletId, setCreatorWalletId] = useState('');
  // Initialize with 2 bundle wallet slots, user can add more up to MAX_BUNDLE_WALLETS
  const [bundleWalletsData, setBundleWalletsData] = useState([
    { id: `bw-slot-0`, walletId: '', solAmount: '0.1' }, 
    { id: `bw-slot-1`, walletId: '', solAmount: '0.1' }  
  ]);
  const [tokenName, setTokenName] = useState('');
  const [tokenImageFile, setTokenImageFile] = useState(null);
  // creatorSolAmount will be passed directly from the button click

  const [customLaunchAmounts, setCustomLaunchAmounts] = useState([...DEFAULT_LAUNCH_AMOUNTS]);
  const [launchAmountInputs, setLaunchAmountInputs] = useState([...DEFAULT_LAUNCH_AMOUNTS.map(String)]);
  const [bulkBundleSolInput, setBulkBundleSolInput] = useState('0.1');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (wallets && wallets.length > 0 && !creatorWalletId) {
      setCreatorWalletId(wallets[0].id);
    }
  }, [wallets, creatorWalletId]);

  const handleImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setTokenImageFile(event.target.files[0]);
      addLogEntry('info', 'Quick Bundle', `Image selected: ${event.target.files[0].name}`);
    }
  };

  const handleBundleWalletChange = (index, field, value) => {
    const updatedBundleWallets = bundleWalletsData.map((item, idx) => 
      idx === index ? { ...item, [field]: value } : item
    );
    setBundleWalletsData(updatedBundleWallets);
  };
  
  const addBundleWalletSlot = () => {
    if (bundleWalletsData.length < MAX_BUNDLE_WALLETS) {
      setBundleWalletsData([
        ...bundleWalletsData,
        { id: `bw-slot-${bundleWalletsData.length}`, walletId: '', solAmount: '0.1' }
      ]);
    }
  };

  const removeBundleWalletSlot = (indexToRemove) => {
    if (bundleWalletsData.length > 0) { // Allow removing till 0, add will add first one back if needed
      setBundleWalletsData(bundleWalletsData.filter((_, index) => index !== indexToRemove));
    }
  };

  const handleLaunchAmountInputChange = (index, value) => {
    const newInputs = [...launchAmountInputs];
    newInputs[index] = value;
    setLaunchAmountInputs(newInputs);
  };

  const handleSetLaunchAmounts = () => {
    const newAmounts = launchAmountInputs.map(val => parseFloat(val) || 0).slice(0, 4);
    // Ensure 4 amounts, padding with 0 if necessary, though UI has 4 inputs
    while (newAmounts.length < 4) newAmounts.push(0);
    setCustomLaunchAmounts(newAmounts);
    addToast('info', 'Launch amounts updated for buttons.');
    addLogEntry('info', 'Quick Bundle', `Custom launch amounts set to: ${newAmounts.join(', ')}`);
  };

  const handleSetAllBundleSol = () => {
    const amount = parseFloat(bulkBundleSolInput);
    if (isNaN(amount) || amount <= 0) {
      addToast('error', 'Please enter a valid positive SOL amount for bundle wallets.');
      return;
    }
    setBundleWalletsData(prevData => 
      prevData.map(bw => bw.walletId ? { ...bw, solAmount: bulkBundleSolInput } : bw)
    );
    addToast('info', `SOL amount for active bundle wallets set to ${bulkBundleSolInput}.`);
    addLogEntry('info', 'Quick Bundle', `All active bundle wallets SOL amount set to: ${bulkBundleSolInput}`);
  };

  // This function now directly handles the launch with a specific SOL amount
  const handleLaunchButtonClick = async (solAmountForCreator) => {
    addLogEntry('info', 'Quick Bundle', `Launch initiated with ${solAmountForCreator} SOL for creator.`);

    if (!creatorWalletId || !tokenName || !tokenImageFile) {
      addToast('error', 'Please select Creator Wallet, enter Token Name, and select Token Image.');
      return;
    }

    const activeBundleWalletsConfig = bundleWalletsData.filter(bw => bw.walletId && parseFloat(bw.solAmount) > 0);
    if (activeBundleWalletsConfig.length === 0 && bundleWalletsData.some(bw => bw.walletId)) {
        addToast('error', 'A bundle wallet is selected but its SOL amount is 0 or invalid. Please set a valid SOL amount or remove the wallet selection.');
        return;
    }
    if (activeBundleWalletsConfig.length === 0 && !bundleWalletsData.some(bw => bw.walletId)) {
        // If no bundle wallets are even selected (all slots are empty for walletId), this might be an intended solo-creator quick bundle.
        // Depending on requirements, we might allow this or enforce at least one bundle wallet.
        // For now, let's assume bundle is optional IF no slots are filled. If a slot has a walletId, amount must be > 0.
        addLogEntry('info', 'Quick Bundle', 'No active bundle wallets configured. Proceeding with creator launch only (if supported by backend logic for bundles).');
        // If backend createBundleTransactionsApi strictly requires buy transactions, this will fail. 
        // This path assumes the API can handle a "bundle" of one (the create transaction).
    }
    
    setIsSubmitting(true);
    const launchDetails = {
        name: tokenName,
        symbol: tokenName, 
        creatorAmount: solAmountForCreator,
        bundleWalletsConfig: activeBundleWalletsConfig.map(bw => ({ 
            walletId: bw.walletId, 
            solAmount: bw.solAmount,
        }))
    };

    const creatorWallet = wallets.find(w => w.id === creatorWalletId);
    if (!creatorWallet || !creatorWallet.privateKey) {
      addToast('error', 'Creator wallet not found or private key is missing.');
      addLogEntry('error', 'Quick Bundle', 'Creator wallet not found or private key missing.');
      onBundleLaunchComplete('error', [], 'Creator wallet error.', launchDetails);
      setIsSubmitting(false);
      return;
    }
    launchDetails.creatorWalletName = creatorWallet.name;
    launchDetails.creatorWalletAddress = creatorWallet.publicKey;

    try {
      const mintKeypair = Keypair.generate();
      launchDetails.mintAddress = mintKeypair.publicKey.toString();
      addLogEntry('info', 'Quick Bundle', `Generated Mint Keypair: ${launchDetails.mintAddress}`);

      addLogEntry('info', 'Quick Bundle', `Uploading metadata for ${tokenName}...`);
      const metadataFormData = new FormData();
      metadataFormData.append('name', tokenName);
      metadataFormData.append('symbol', tokenName); 
      metadataFormData.append('description', ''); 
      metadataFormData.append('file', tokenImageFile);
      metadataFormData.append('twitter', '');
      metadataFormData.append('telegram', '');
      metadataFormData.append('website', '');
      metadataFormData.append('showName', 'true');

      const metadataResponse = await uploadMetadataApi(metadataFormData);
      if (metadataResponse.error || !metadataResponse.uri) {
        const errorMsg = `Metadata upload failed: ${metadataResponse.error || 'No URI returned'}`;
        addToast('error', errorMsg);
        addLogEntry('error', 'Quick Bundle', errorMsg, { metadataError: metadataResponse.error });
        onBundleLaunchComplete('error', [], errorMsg, { ...launchDetails, error: errorMsg });
        setIsSubmitting(false);
        return;
      }
      const metadataUri = metadataResponse.uri;
      launchDetails.metadataUri = metadataUri;
      addLogEntry('success', 'Quick Bundle', `Metadata uploaded: ${metadataUri}`);

      const bundledTxArgs = [];
      bundledTxArgs.push({
        publicKey: creatorWallet.publicKey,
        action: "create",
        tokenMetadata: { name: tokenName, symbol: tokenName, uri: metadataUri },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: "true",
        amount: parseFloat(solAmountForCreator),
        slippage: parseInt(globalSettings.slippage),
        priorityFee: parseFloat(globalSettings.priorityFee),
        pool: globalSettings.pool
      });
      addLogEntry('info', 'Quick Bundle', `Prepared create tx for ${tokenName} with ${solAmountForCreator} SOL.`);

      const allSignersForBundle = [Keypair.fromSecretKey(bs58.decode(creatorWallet.privateKey))];
      const processedBundleWalletsForDetails = [];

      for (const bwData of activeBundleWalletsConfig) {
        const bundleWallet = wallets.find(w => w.id === bwData.walletId);
        if (bundleWallet && bundleWallet.privateKey) {
          processedBundleWalletsForDetails.push({ 
              walletId: bundleWallet.id,
              walletName: bundleWallet.name,
              publicKey: bundleWallet.publicKey,
              solAmount: bwData.solAmount 
          });
          allSignersForBundle.push(Keypair.fromSecretKey(bs58.decode(bundleWallet.privateKey)));
          
          bundledTxArgs.push({
            publicKey: bundleWallet.publicKey,
            action: "buy",
            mint: mintKeypair.publicKey.toBase58(),
            denominatedInSol: "true",
            amount: parseFloat(bwData.solAmount),
            slippage: parseInt(globalSettings.slippage),
            priorityFee: parseFloat(globalSettings.priorityFee) * 0.1, 
            pool: globalSettings.pool
          });
          addLogEntry('info', 'Quick Bundle', `Prepared buy tx for ${bundleWallet.name} with ${bwData.solAmount} SOL.`);
        } else {
          addLogEntry('warning', 'Quick Bundle', `Skipping bundle wallet ${bwData.walletId} (not found or no private key).`);
        }
      }
      launchDetails.bundleWallets = processedBundleWalletsForDetails;
      
      // If only create tx is present but bundle wallets were configured (meaning they had errors like no private key)
      if (bundledTxArgs.length <= 1 && activeBundleWalletsConfig.length > 0) { 
         const errorMsg = 'Failed to prepare buy transactions for configured bundle wallets. Ensure they have private keys and are valid.';
         addToast('error', errorMsg);
         addLogEntry('error', 'Quick Bundle', errorMsg);
         onBundleLaunchComplete('error', [], errorMsg, launchDetails);
         setIsSubmitting(false);
         return;
      }
      // If activeBundleWalletsConfig was empty from start, and we allow it, then bundledTxArgs will only have create.
      // The createBundleTransactionsApi must be able to handle a single (create) transaction argument.
      
      addLogEntry('info', 'Quick Bundle', `Fetching ${bundledTxArgs.length} transaction buffers from API...`);
      const transactionsData_base58 = await createBundleTransactionsApi(bundledTxArgs);

      if (!transactionsData_base58 || transactionsData_base58.length !== bundledTxArgs.length) {
        const errorMsg = 'API did not return the correct number of transaction buffers for the bundle.';
        addToast('error', errorMsg);
        addLogEntry('error', 'Quick Bundle', errorMsg, { apiResponse: transactionsData_base58 });
        onBundleLaunchComplete('error', [], errorMsg, launchDetails);
        setIsSubmitting(false);
        return;
      }
      addLogEntry('success', 'Quick Bundle', `Received ${transactionsData_base58.length} transaction buffers.`);

      let encodedSignedTransactions = [];
      let signatures = [];
      
      addLogEntry('info', 'Quick Bundle', 'Signing transactions...');
      for (let i = 0; i < transactionsData_base58.length; i++) {
        const txBuffer_base58 = transactionsData_base58[i];
        const transaction = VersionedTransaction.deserialize(bs58.decode(txBuffer_base58));
        const actionDetails = bundledTxArgs[i];

        if (actionDetails.action === "create") {
          transaction.sign([mintKeypair, allSignersForBundle[0]]); 
        } else { 
          const buyerWalletIndexInAllSigners = processedBundleWalletsForDetails.findIndex(bw => bw.publicKey === actionDetails.publicKey) + 1;
          if (allSignersForBundle[buyerWalletIndexInAllSigners]) {
            transaction.sign([allSignersForBundle[buyerWalletIndexInAllSigners]]);
          } else {
            throw new Error(`Signer not found for buy transaction for wallet ${actionDetails.publicKey}. Index: ${buyerWalletIndexInAllSigners}`);
          }
        }
        encodedSignedTransactions.push(bs58.encode(transaction.serialize()));
        const sig = bs58.encode(transaction.signatures[0]);
        signatures.push(sig);
        addLogEntry('info', 'Quick Bundle', `Tx ${i+1} signed (Action: ${actionDetails.action}, Wallet: ${actionDetails.publicKey.substring(0,4)}, Sig: ${sig.substring(0,6)}...).`);
      }
      
      addLogEntry('info', 'Quick Bundle', `Sending ${encodedSignedTransactions.length} signed transactions to Jito...`);
      await sendBundleToJitoApi(encodedSignedTransactions);
      addLogEntry('success', 'Quick Bundle', 'Bundle sent to Jito successfully!');

      onBundleLaunchComplete('success', signatures, null, {
        ...launchDetails,
        signatures 
      });

    } catch (error) {
      console.error("Quick Bundle Launch Error:", error);
      const errorMsg = `Quick Bundle launch failed: ${error.message || 'Unknown error'}`;
      addLogEntry('error', 'Quick Bundle', errorMsg, { errorObj: error });
      addToast('error', errorMsg.substring(0, 100)); 
      onBundleLaunchComplete('error', [], error.message || 'Unknown error', { ...launchDetails, error: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const areLaunchPrerequisitesMet = () => {
    // For launch buttons to be active, basic info must be there.
    // The check for active bundle wallets is inside handleLaunchButtonClick to give a more specific error.
    return creatorWalletId && tokenName && tokenImageFile;
  };

  return (
    <div className="form-container quick-bundle-form launch-form">
      <h3>Quick Bundle Launch</h3>
      
      <div className="form-group">
        <label htmlFor="qb-creator-wallet">Creator Wallet:</label>
        <select
          id="qb-creator-wallet"
          value={creatorWalletId}
          onChange={(e) => setCreatorWalletId(e.target.value)}
          disabled={isSubmitting}
        >
          <option value="">Select Creator Wallet</option>
          {wallets.map(wallet => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name} ({wallet.publicKey.substring(0, 4)}...{wallet.publicKey.substring(wallet.publicKey.length - 4)})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="qb-token-name">Token Name/Ticker:</label>
        <input
          type="text"
          id="qb-token-name"
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          placeholder="e.g., MYBUNDLE"
          disabled={isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="qb-token-image">Token Image (PNG/JPG/GIF):</label>
        <input
          type="file"
          id="qb-token-image"
          accept="image/png, image/jpeg, image/gif"
          onChange={handleImageChange}
          disabled={isSubmitting}
        />
        {tokenImageFile && <p className="file-name-display">Selected: {tokenImageFile.name}</p>}
      </div>
      
      <h4>Bundle Wallets</h4>
      <div className="bundle-bulk-set-section" style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '10px', padding:'10px', border:'1px solid #2c3e50', borderRadius:'8px', backgroundColor:'#1f2937' }}>
        <div className="form-group" style={{flexGrow: 1, marginBottom: 0}}>
            <label htmlFor="qb-bulk-bundle-sol">Set SOL for All Active Bundle Wallets:</label>
            <input
            type="number"
            id="qb-bulk-bundle-sol"
            value={bulkBundleSolInput}
            onChange={(e) => setBulkBundleSolInput(e.target.value)}
            placeholder="e.g., 0.1"
            min="0.001"
            step="0.001"
            disabled={isSubmitting}
            />
        </div>
        <button 
            type="button" 
            onClick={handleSetAllBundleSol} 
            disabled={isSubmitting}
            className="button secondary"
            style={{ height: 'calc(2.25rem + 8px)', lineHeight:'1.5' /* Match input height */}}
        >
            Set All
        </button>
      </div>

      {bundleWalletsData.map((bw, index) => (
        <div key={bw.id} className="form-row bundle-wallet-config" style={{ alignItems: 'flex-end', marginBottom: '10px' }}>
          <div className="form-group" style={{ flexGrow: 2, marginRight: '10px' }}>
            <label htmlFor={`qb-bundle-wallet-${index}`}>Bundle Wallet {index + 1}:</label>
            <select
              id={`qb-bundle-wallet-${index}`}
              value={bw.walletId}
              onChange={(e) => handleBundleWalletChange(index, 'walletId', e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Select Bundle Wallet</option>
              {wallets.filter(w => w.id !== creatorWalletId).map(wallet => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} ({wallet.publicKey.substring(0, 4)}...)
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flexGrow: 1, marginRight: '10px' }}>
            <label htmlFor={`qb-bundle-sol-${index}`}>SOL Amount:</label>
            <input
              type="number"
              id={`qb-bundle-sol-${index}`}
              value={bw.solAmount}
              onChange={(e) => handleBundleWalletChange(index, 'solAmount', e.target.value)}
              placeholder="e.g., 0.1"
              min="0.001"
              step="0.001"
              disabled={isSubmitting || !bw.walletId} 
            />
          </div>
          {bundleWalletsData.length > 0 && (
             <button 
                type="button" 
                onClick={() => removeBundleWalletSlot(index)} 
                disabled={isSubmitting}
                className="delete-button button-small"
                style={{ marginLeft: 'auto', marginBottom: '1rem' }}
            >
                X
            </button>
          )}
        </div>
      ))}
      {bundleWalletsData.length < MAX_BUNDLE_WALLETS && (
        <button 
            type="button" 
            onClick={addBundleWalletSlot} 
            disabled={isSubmitting}
            className="button secondary button-small"
            style={{ marginBottom: '20px' }} 
        >
            + Add Bundle Wallet Slot
        </button>
      )}
      
      <div className="launch-amount-override-section" style={{marginTop: '20px'}}>
        {launchAmountInputs.map((val, index) => (
            <div key={`launch-override-${index}`} className="form-group">
                <label htmlFor={`lao-${index}`}>Btn {index+1} SOL:</label>
                <input 
                    type="number" 
                    id={`lao-${index}`}
                    value={val}
                    onChange={(e) => handleLaunchAmountInputChange(index, e.target.value)}
                    placeholder={`Amt ${index+1}`}
                    min="0.001" 
                    step="0.001"
                    disabled={isSubmitting}
                />
            </div>
        ))}
        <button 
            type="button" 
            onClick={handleSetLaunchAmounts} 
            disabled={isSubmitting}
            className="button secondary"
        >
            Set Amounts
        </button>
      </div>

      <div className="form-group" style={{ marginTop: '10px' }}>
        <label>Launch with Creator Amount (SOL):</label>
        <div className="button-row">
          {customLaunchAmounts.map((amount, index) => (
            <button
              key={`creator-launch-${index}-${amount}`}
              type="button"
              className={`submit-button`}
              onClick={() => handleLaunchButtonClick(amount)}
              disabled={isSubmitting || !areLaunchPrerequisitesMet() || amount <= 0}
              title={amount <= 0 ? "Amount must be greater than 0" : `Launch with ${amount} SOL`}
            >
              {amount > 0 ? `Launch ${amount} SOL` : `Set Amt ${index+1}`}
            </button>
          ))}
        </div>
      </div>

      {isSubmitting && <div className="loading" style={{marginTop: '15px'}}>Launching Quick Bundle... Please wait.</div>}
    </div>
  );
};

export default QuickBundleForm; 