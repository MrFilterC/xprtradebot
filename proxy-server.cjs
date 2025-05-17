const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const upload = multer();
const app = express();
// PORT'u Render'dan veya yerel için 3000'den al
const PORT = process.env.PORT || 3000;

// İzin verilen kaynakların listesi
const whitelist = [
  'http://localhost:5173', // Yerel Vite dev sunucusu
  'https://www.x-pr.trading', // Canlı Vercel siteniz
  'https://xpr-proxy.onrender.com' // Render proxy'nizin kendi adresi (bazen gerekli olabilir)
];

const corsOptions = {
  origin: function (origin, callback) {
    // 'origin' tanımsızsa (örn: aynı kaynaklı istekler veya Postman gibi araçlar) izin ver
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// IPFS proxy
app.post('/proxy/ipfs', upload.single('file'), async (req, res) => {
  try {
    const formData = new FormData();
    
    // Dosyayı FormData'ya ekle
    if (req.file) {
      formData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    }
    
    // Diğer form alanlarını ekle
    for (const key in req.body) {
      formData.append(key, req.body[key]);
    }
    
    // Pump.fun API'ye isteği yönlendir
    const response = await fetch('https://pump.fun/api/ipfs', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trade API proxy
app.post('/proxy/trade', express.json(), async (req, res) => {
  try {
    const response = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    if (response.status !== 200) {
      return res.status(response.status).send(await response.text());
    }
    
    const arrayBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'application/octet-stream');
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Trade proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Jito Bundle API proxy
app.post('/proxy/jito', express.json(), async (req, res) => {
  try {
    const response = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      return res.status(response.status).send(await response.text());
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Jito proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
}); 