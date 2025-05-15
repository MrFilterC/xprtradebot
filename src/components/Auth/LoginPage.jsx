import React, { useState } from 'react';
import { supabase } from '../../supabaseClient'; // supabaseClient.js dosyasının doğru yolda olduğundan emin olun
// import { useNavigate } from 'react-router-dom'; // Eğer react-router-dom kullanıyorsanız

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // const navigate = useNavigate(); // Eğer react-router-dom kullanıyorsanız

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // RLS politikalarınız `current_setting` kullandığı için,
      // bu direkt sorgu RLS tarafından engellenebilir.
      // Normalde, RLS olmadan veya daha basit bir 'select' politikasıyla şöyle bir sorgu yapardık:
      const { data, error: queryError } = await supabase
        .from('allowed_users')
        .select('*')
        .eq('username', username)
        .eq('invite_code', inviteCode)
        .single(); // Tek bir kayıt bekliyoruz

      if (queryError) {
        // Eğer RLS engelliyorsa veya başka bir sorgu hatası varsa buraya düşer.
        // Supabase'in döndürdüğü hataya göre RLS politikasını gözden geçirmemiz gerekebilir.
        console.error('Supabase query error:', queryError);
        setError(`Login failed: ${queryError.message}. Check RLS policies or credentials.`);
        setLoading(false);
        return;
      }

      if (data) {
        // Başarılı giriş
        console.log('Login successful:', data);
        // Burada kullanıcı oturumunu yönetmek için bir mekanizma ekleyebilirsiniz.
        // Örneğin, bir token saklayabilir veya bir context güncelleyebilirsiniz.
        localStorage.setItem('userAuthenticated', 'true'); // Basit bir örnek
        localStorage.setItem('username', data.username);
        
        if (onLoginSuccess) {
          onLoginSuccess(); 
        }
        // navigate('/dashboard'); // Ana sayfaya yönlendirme (react-router-dom ile)
        window.location.reload(); // Veya sayfayı yeniden yükleyerek App.jsx'in durumu kontrol etmesini sağlayın
      } else {
        // Kullanıcı bulunamadı veya bilgiler yanlış
        setError('Invalid username or invite code.');
      }
    } catch (catchError) {
      console.error('Login error:', catchError);
      setError('An unexpected error occurred during login.');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <h2>X-PR Trading Bot Login</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '300px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <div>
          <label htmlFor="username" style={{ display: 'block', marginBottom: '5px' }}>Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="inviteCode" style={{ display: 'block', marginBottom: '5px' }}>Invite Code</label>
          <input
            type="text"
            id="inviteCode"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage; 