import { useState, useCallback, useEffect } from 'react';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { fetchWalletBalanceApi } from '../api'; // api.js dosyasının yolu

export const useWalletManager = (isWalletManagerActive) => {
  // Wallets state for wallet manager
  const [wallets, setWallets] = useState(() => {
    const savedWallets = localStorage.getItem('solana-wallets');
    return savedWallets ? JSON.parse(savedWallets) : [];
  });

  // Wallets balance state
  const [walletBalances, setWalletBalances] = useState({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  // Import wallet modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPrivateKey, setImportPrivateKey] = useState('');
  const [importWalletName, setImportWalletName] = useState('');
  const [importError, setImportError] = useState('');
  
  // Edit wallet name state
  const [editingWalletId, setEditingWalletId] = useState(null);
  const [editWalletName, setEditWalletName] = useState('');

  // Cüzdan bakiyelerini getir
  const fetchWalletBalances = useCallback(async () => {
    if (wallets.length === 0) return;
    
    setIsLoadingBalances(true);
    try {
      const balances = {};
      await Promise.all(wallets.map(async (wallet) => {
        try {
          balances[wallet.id] = await fetchWalletBalanceApi(wallet.publicKey);
        } catch (error) {
          balances[wallet.id] = 'Error';
        }
      }));
      setWalletBalances(balances);
    } catch (error) {
      console.error('Error fetching wallet balances in hook:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [wallets]); // fetchWalletBalanceApi bağımlılıklardan çıkarıldı, çünkü api.js'den geliyor ve değişmiyor.

  // Wallet Manager aktif olduğunda ve her 10 saniyede bir bakiyeleri güncelle
  useEffect(() => {
    if (isWalletManagerActive) {
      fetchWalletBalances();
      const intervalId = setInterval(fetchWalletBalances, 10000);
      return () => clearInterval(intervalId);
    }
  }, [isWalletManagerActive, fetchWalletBalances]);

  // Yeni cüzdan oluşturma
  const createWallet = () => {
    try {
      const newKeypair = Keypair.generate();
      const publicKey = newKeypair.publicKey.toString();
      const privateKey = bs58.encode(newKeypair.secretKey);
      const walletName = `Wallet ${wallets.length + 1}`;
      const newWallet = {
        id: Date.now().toString(),
        publicKey,
        privateKey,
        name: walletName
      };
      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      localStorage.setItem('solana-wallets', JSON.stringify(updatedWallets));
      return { status: 'success', action: 'Create Wallet', message: `Wallet '${walletName}' created successfully.`, details: { publicKey, name: walletName } };
    } catch (error) {
      console.error('Error creating wallet:', error);
      // alert('Failed to create wallet'); // Kullanıcıya geri bildirim
      return { status: 'error', action: 'Create Wallet', message: `Failed to create wallet: ${error.message}`, details: { error } };
    }
  };
  
  // Mevcut bir cüzdanı import etme
  const importWallet = () => {
    // setImportError(''); // This will be handled by the component using the return value
    if (!importPrivateKey.trim()) {
      // setImportError('Private key is required');
      return { status: 'error', action: 'Import Wallet', message: 'Private key is required.', isValidationError: true };
    }
    try {
      const secretKey = bs58.decode(importPrivateKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      const publicKey = keypair.publicKey.toString();
      const walletExists = wallets.some(wallet => wallet.publicKey === publicKey);
      if (walletExists) {
        // setImportError('This wallet is already in your list');
        return { status: 'error', action: 'Import Wallet', message: 'This wallet is already in your list.', isValidationError: true, details: { publicKey } };
      }
      const walletName = importWalletName.trim() || `Imported Wallet ${wallets.length + 1}`;
      const newWallet = {
        id: Date.now().toString(),
        publicKey,
        privateKey: importPrivateKey,
        name: walletName
      };
      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      localStorage.setItem('solana-wallets', JSON.stringify(updatedWallets));
      // setShowImportModal(false); // Component should handle this based on success
      // setImportPrivateKey('');
      // setImportWalletName('');
      return { status: 'success', action: 'Import Wallet', message: `Wallet '${walletName}' imported successfully.`, details: { publicKey, name: walletName } };
    } catch (error) {
      console.error('Error importing wallet:', error);
      // setImportError('Invalid private key format');
      return { status: 'error', action: 'Import Wallet', message: `Invalid private key format: ${error.message}`, isValidationError: true, details: { error } };
    }
  };
  
  const closeImportModal = () => {
    setShowImportModal(false);
    setImportPrivateKey('');
    setImportWalletName('');
    setImportError('');
  };
  
  const deleteWallet = (id) => {
    const walletToDelete = wallets.find(wallet => wallet.id === id);
    const updatedWallets = wallets.filter(wallet => wallet.id !== id);
    setWallets(updatedWallets);
    localStorage.setItem('solana-wallets', JSON.stringify(updatedWallets));
    if (walletToDelete) {
      return { status: 'success', action: 'Delete Wallet', message: `Wallet '${walletToDelete.name}' deleted successfully.`, details: { name: walletToDelete.name, id } };
    }
    return { status: 'info', action: 'Delete Wallet', message: 'Wallet not found or already deleted.', details: { id } }; // Should not happen if UI is correct
  };
  
  const startEditingWalletName = (id, currentName) => {
    setEditingWalletId(id);
    setEditWalletName(currentName);
  };
  
  const cancelEditingWalletName = () => {
    setEditingWalletId(null);
    setEditWalletName('');
  };
  
  const updateWalletName = (id) => {
    const trimmedName = editWalletName.trim();
    if (!trimmedName) {
      return { status: 'error', action: 'Update Wallet Name', message: 'Wallet name cannot be empty.', isValidationError: true, details: { id } };
    }
    let oldName = '';
    const updatedWallets = wallets.map(wallet => {
      if (wallet.id === id) {
        oldName = wallet.name;
        return { ...wallet, name: trimmedName };
      }
      return wallet;
    });
    setWallets(updatedWallets);
    localStorage.setItem('solana-wallets', JSON.stringify(updatedWallets));
    // setEditingWalletId(null); // Component can handle this
    // setEditWalletName('');
    return { status: 'success', action: 'Update Wallet Name', message: `Wallet name updated from '${oldName}' to '${trimmedName}'.`, details: { id, oldName, newName: trimmedName } };
  };

  // Cüzdan bilgilerini kopyalama App.jsx'te kalabilir veya buraya taşınabilir.
  // Şimdilik App.jsx'te bırakıyorum çünkü global bir utility gibi duruyor.

  return {
    wallets,
    setWallets, // Geçici olarak, App.jsx'teki useEffect için
    walletBalances,
    isLoadingBalances,
    fetchWalletBalances, // Döndürülmeli
    showImportModal,
    setShowImportModal, // Modal'ı dışarıdan kontrol etmek için
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
    startEditingWalletName,
    cancelEditingWalletName,
    updateWalletName,
    setEditWalletName, // input için
  };
}; 