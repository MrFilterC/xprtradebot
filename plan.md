# App.jsx Modülerleştirme Planı

Bu plan, `App.jsx` dosyasının okunabilirliğini ve yönetilebilirliğini artırmak amacıyla modülerleştirilmesini açıklamaktadır.

## 1. Adım: Sabitlerin Ayrılması

*   **Hedef:** Sık kullanılan sabit değerleri merkezi bir dosyada toplamak.
*   **Yapılacaklar:**
    *   `src/constants.js` adında yeni bir dosya oluştur.
    *   `App.jsx` içerisindeki `PROXY_URL` ve `RPC_ENDPOINT` sabitlerini `src/constants.js` dosyasına taşı ve export et.
    *   `App.jsx` içerisinde bu sabitleri yeni dosyadan import et.

## 2. Adım: API Çağrılarının Modülleştirilmesi

*   **Hedef:** Tüm backend ve harici API (Solana RPC, Proxy Sunucu, Jito) çağrılarını ayrı bir modülde toplamak.
*   **Yapılacaklar:**
    *   `src/api.js` adında yeni bir dosya oluştur.
    *   Aşağıdaki fonksiyonların API çağrı mantıklarını `src/api.js` içerisine taşı:
        *   `sendTransaction` içindeki `/proxy/trade` çağrısı.
        *   `launchToken` içindeki `/proxy/ipfs` ve `/proxy/trade` çağrıları.
        *   `launchBundle` içindeki `/proxy/ipfs`, `/proxy/trade` ve `/proxy/jito` çağrıları.
        *   `fetchWalletBalances` içindeki `Connection.getBalance` çağrısı.
    *   Bu yeni API fonksiyonları, gerekli parametreleri alacak ve `Promise` döndürecek şekilde tasarlanacak.
    *   `App.jsx` (ve daha sonra oluşturulacak diğer modüller) bu API fonksiyonlarını import edip kullanacak.

## 3. Adım: Cüzdan Yönetimi için Custom Hook Oluşturma

*   **Hedef:** Cüzdanlarla ilgili state ve fonksiyonları bir custom React hook (`useWalletManager`) içinde toplamak.
*   **Yapılacaklar:**
    *   `src/hooks/useWalletManager.js` adında yeni bir dosya oluştur.
    *   Aşağıdaki state'leri bu hook içine taşı:
        *   `wallets`, `setWallets`
        *   `walletBalances`, `setWalletBalances`
        *   `isLoadingBalances`, `setIsLoadingBalances`
        *   `showImportModal`, `setShowImportModal`
        *   `importPrivateKey`, `setImportPrivateKey`
        *   `importWalletName`, `setImportWalletName`
        *   `importError`, `setImportError`
        *   `editingWalletId`, `setEditingWalletId`
        *   `editWalletName`, `setEditWalletName`
    *   Aşağıdaki cüzdan yönetimi fonksiyonlarını bu hook içine taşı ve `api.js`'i kullanacak şekilde güncelle (gerekirse):
        *   `createWallet`
        *   `importWallet`
        *   `closeImportModal`
        *   `deleteWallet`
        *   `startEditingWalletName`
        *   `cancelEditingWalletName`
        *   `updateWalletName`
        *   `fetchWalletBalances` (Bu fonksiyon `api.js`'teki ilgili API çağrısını kullanacak)
    *   Hook, bu state'leri ve fonksiyonları döndürecek.

## 4. Adım: Ana Fonksiyonel Alanlar için Bileşenler Oluşturma

*   **Hedef:** Token oluşturma, bundle oluşturma, token trade etme ve cüzdan yönetimi arayüzlerini kendi bileşenlerine ayırmak.
*   **Yapılacaklar:**
    *   `src/components/` adında bir klasör oluştur.
    *   **`src/components/TransactionResult.jsx`:**
        *   İşlem sonuçlarını (başarı/hata mesajları, Solscan linki) göstermek için genel bir bileşen oluştur. Prop olarak `status`, `signature`/`signatures`, `errorMessage` alabilir.
    *   **`src/components/ImportWalletModal.jsx`:**
        *   Cüzdan import etme modal'ının JSX'ini ve ilgili form state'lerini (`importPrivateKey`, `importWalletName`, `importError`) buraya taşı.
        *   `useWalletManager` hook'undan `importWallet` ve `closeImportModal` fonksiyonlarını prop olarak alabilir veya doğrudan hook'u kullanabilir.
    *   **`src/components/WalletItem.jsx`:**
        *   Cüzdan listesindeki her bir cüzdanı gösteren JSX'i buraya taşı.
        *   Prop olarak `wallet` objesini, `editingWalletId`, `editWalletName`, `walletBalances[wallet.id]` ve düzenleme/silme/kopyalama handler fonksiyonlarını (`startEditingWalletName`, `updateWalletName`, `cancelEditingWalletName`, `deleteWallet`, `copyToClipboard`) alacak.
    *   **`src/components/WalletManagerView.jsx`:**
        *   Cüzdan Yönetimi sekmesinin tüm JSX'ini buraya taşı.
        *   `useWalletManager` hook'unu kullanarak cüzdan listesini, bakiyeleri ve ilgili fonksiyonları alacak.
        *   `WalletItem` ve `ImportWalletModal` bileşenlerini render edecek.
        *   "Create New Wallet" ve "Import Wallet" butonlarının logiğini yönetecek.
    *   **`src/components/TokenLaunchForm.jsx`:**
        *   Token Launch sekmesinin form JSX'ini buraya taşı.
        *   İlgili state'leri (`launchFormData`, `selectedFile`, `launchStatus`, `launchSignature`, `launchLoading`, `errorMessage`) ve handler fonksiyonlarını (`handleLaunchInputChange`, `handleFileChange`) kendi içinde yönetecek.
        *   `launchToken` fonksiyonunu ( `api.js`'teki ilgili API çağrılarını kullanacak şekilde güncellenmiş) kendi içinde barındıracak.
        *   `TransactionResult` bileşenini kullanarak işlem sonucunu gösterecek.
    *   **`src/components/BundleLaunchForm.jsx`:**
        *   Bundle Launch sekmesinin form JSX'ini buraya taşı.
        *   İlgili state'leri (`bundleFormData`, `selectedBundleFile`, `bundleStatus`, `bundleSignatures`, `bundleLoading`, `bundleErrorMessage`) ve handler fonksiyonlarını (`handleBundleInputChange`, `handleBundleFileChange`) kendi içinde yönetecek.
        *   `launchBundle` fonksiyonunu ( `api.js`'teki ilgili API çağrılarını kullanacak şekilde güncellenmiş) kendi içinde barındıracak.
        *   `TransactionResult` bileşenini kullanarak işlem sonucunu gösterecek.
    *   **`src/components/TradeForm.jsx`:**
        *   Trade Tokens bölümünün form JSX'ini buraya taşı.
        *   İlgili state'leri (`formData`, `transactionStatus`, `transactionSignature`, `loading`) ve handler fonksiyonlarını (`handleInputChange`, `handleSellPercentage`) kendi içinde yönetecek.
        *   `sendTransaction` fonksiyonunu ( `api.js`'teki ilgili API çağrısını kullanacak şekilde güncellenmiş) kendi içinde barındıracak.
        *   `TransactionResult` bileşenini kullanarak işlem sonucunu gösterecek.

## 5. Adım: App.jsx'in Yeniden Düzenlenmesi

*   **Hedef:** `App.jsx`'i ana yönlendirici ve state düzenleyicisi olarak basitleştirmek.
*   **Yapılacaklar:**
    *   Oluşturulan tüm yeni modülleri (`constants.js`, `api.js`), hook'ları (`useWalletManager.js`) ve bileşenleri (`TokenLaunchForm.jsx`, `BundleLaunchForm.jsx`, `TradeForm.jsx`, `WalletManagerView.jsx`) import et.
    *   `App.jsx`'teki state ve fonksiyonların büyük çoğunluğu ilgili hook'lara ve bileşenlere taşınmış olacak.
    *   `App.jsx` ana sayfa düzenini (`header`, `main` vs.), ana navigasyon state'lerini (`activeTab`, `activeWindow`) ve bu state'lere göre doğru bileşenleri render etme mantığını koruyacak.
    *   Örneğin:
        ```jsx
        function App() {
          const [activeTab, setActiveTab] = useState('tokenLaunch');
          const [activeWindow, setActiveWindow] = useState('main');

          // ... (gerekirse diğer global state'ler veya context'ler)

          return (
            <div className="App">
              <header className="App-header">
                {/* ... header içeriği ... */}
              </header>
              
              {activeWindow === 'main' ? (
                <main className="App-content">
                  <div className="token-launch-section">
                    {/* Tab navigation */}
                    {activeTab === 'tokenLaunch' && <TokenLaunchForm />}
                    {activeTab === 'bundleLaunch' && <BundleLaunchForm />}
                    {/* İlgili işlem sonuçları burada veya bileşenlerin içinde yönetilebilir */}
                  </div>
                  <div className="trade-section">
                    <TradeForm />
                    {/* İlgili işlem sonuçları burada veya bileşenin içinde yönetilebilir */}
                  </div>
                </main>
              ) : (
                <WalletManagerView />
              )}
            </div>
          );
        }
        ```

## Genel Notlar

*   Her adımda, yapılan değişikliklerin uygulamanın mevcut işlevselliğini bozmadığından emin olunmalıdır.
*   Props geçişleri ve state yönetimi dikkatlice planlanmalıdır. Gerekirse React Context API veya başka bir state management kütüphanesi (Zustand, Redux Toolkit vb.) düşünülebilir, ancak başlangıç için props ve custom hook'lar yeterli olacaktır.
*   CSS (`App.css`) dosyası da bileşen bazlı olarak bölünebilir veya mevcut haliyle kullanılmaya devam edilebilir. Bu plan şimdilik CSS bölünmesini kapsamıyor.
*   Tüm `Keypair.fromSecretKey(bs58.decode(privateKey))` işlemleri, ilgili form bileşenlerinde veya API çağrısı yapılmadan hemen önce yapılmalıdır. Private key'ler state'te tutulmaya devam edilebilir ancak bileşenler arasında gereksiz yere geçirilmemelidir.
*   `localStorage` işlemleri (`solana-wallets`) `useWalletManager` hook'u içinde yönetilmelidir. 