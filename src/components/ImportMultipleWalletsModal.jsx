import React, { useState } from 'react';

const ImportMultipleWalletsModal = ({
  show,
  onClose,
  onImportMultiple,
  addToast, // Toast mesajları için
  addLogEntry // Loglama için
}) => {
  const [walletsText, setWalletsText] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!show) {
    return null;
  }

  const handleImport = async () => {
    if (!walletsText.trim()) {
      addToast && addToast('error', 'Please enter wallet data.');
      return;
    }

    setProcessing(true);
    const lines = walletsText.trim().split('\n');
    const walletsToImport = [];
    const results = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length !== 2) {
        results.push({ 
          status: 'error',
          name: `Line ${i + 1}`, 
          message: 'Invalid format. Use: Wallet Name,Private Key'
        });
        continue;
      }

      const name = parts[0].trim();
      const privateKey = parts[1].trim();

      if (!name || !privateKey) {
        results.push({
          status: 'error',
          name: `Line ${i + 1} (Name: ${name || 'N/A'})`,
          message: 'Wallet name or private key cannot be empty.'
        });
        continue;
      }
      // Burada privateKey için temel bir geçerlilik kontrolü eklenebilir (uzunluk, karakterler vb.)
      // Şimdilik basit bir kontrol yapalım (bs58 formatında olması beklenir, ama bu daha karmaşık bir validasyon)
      if (privateKey.length < 40 || privateKey.length > 100 || privateKey.includes(' ')) { // Çok temel bir kontrol
        results.push({
            status: 'error',
            name: name,
            message: `Invalid private key format for ${name}.`
        });
        continue;
      }

      walletsToImport.push({ name, privateKey });
    }

    if (walletsToImport.length > 0) {
      const importResults = await onImportMultiple(walletsToImport);
      results.push(...importResults);
    } 

    // Sonuçları kullanıcıya bildir
    let successCount = 0;
    let errorCount = 0;

    results.forEach(result => {
      if (result.status === 'success') {
        successCount++;
        addLogEntry && addLogEntry('success', 'Import Wallet (Batch)', result.message, result.details || { name: result.name });
      } else {
        errorCount++;
        addToast && addToast('error', `${result.name}: ${result.message}`);
        addLogEntry && addLogEntry('error', 'Import Wallet (Batch) Error', `${result.name}: ${result.message}`, result.details || {});
      }
    });

    if (walletsToImport.length > 0 || results.find(r => r.status === 'error')) {
        if (successCount > 0 && errorCount === 0) {
            addToast('success', `Successfully imported ${successCount} wallet(s).`);
        } else if (successCount > 0 && errorCount > 0) {
            addToast('info', `Imported ${successCount} wallet(s). ${errorCount} wallet(s) failed.`);
        } else if (successCount === 0 && errorCount > 0 && walletsToImport.length > 0) {
            addToast('error', `Failed to import ${errorCount} wallet(s). Check logs for details.`);
        } else if (successCount === 0 && errorCount > 0 && walletsToImport.length === 0 && lines.length > 0) {
             addToast('error', `Failed to process any wallets. Check format or logs.`);
        }
    }
    
    setProcessing(false);
    if (successCount > 0 && errorCount === 0 && walletsToImport.length > 0) { // Sadece hepsi başarılıysa ve en az 1 tane import edildiyse kapat
        setWalletsText(''); // Textarea'yı temizle
        onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{minWidth: '500px'}}> {/* Biraz daha geniş olabilir */}
        <h3>Import Multiple Wallets</h3>
        <p>Enter each wallet on a new line in the format: <strong><code>Wallet Name,Private Key</code></strong></p>
        <div className="form-group">
          <label htmlFor="multipleWalletsText">Wallet Data:</label>
          <textarea
            id="multipleWalletsText"
            value={walletsText}
            onChange={(e) => setWalletsText(e.target.value)}
            placeholder="My Wallet 1,yourPrivateKeyHere1\nMy Wallet 2,yourPrivateKeyHere2\n..."
            rows="10"
            style={{ width: '100%', minHeight: '150px', whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'scroll'}}
            disabled={processing}
          />
        </div>
        
        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={processing}
          >
            Cancel
          </button>
          <button 
            className="import-button" // Aynı stili kullanabiliriz
            onClick={handleImport}
            disabled={processing || !walletsText.trim()}
          >
            {processing ? 'Processing...' : 'Import Wallets'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportMultipleWalletsModal; 