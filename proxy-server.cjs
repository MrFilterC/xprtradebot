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
  console.log('[Proxy IPFS] Received request for metadata upload.');
  try {
    const pumpFormData = new FormData();
    
    // Append file from multer
    if (req.file) {
      console.log(`[Proxy IPFS] File received: ${req.file.originalname}, size: ${req.file.size}, type: ${req.file.mimetype}`);
      pumpFormData.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    } else {
      console.log('[Proxy IPFS] No file received in request.');
    }
    
    // Append other form fields from req.body (populated by multer for text fields)
    console.log('[Proxy IPFS] req.body content:', req.body); // Log current req.body
    for (const key in req.body) {
      // removed hasOwnProperty check as req.body might not be a plain object
      // if multer processed it from multipart/form-data
      pumpFormData.append(key, req.body[key]);
      console.log(`[Proxy IPFS] Appended form field from req.body: ${key} = ${req.body[key]}`);
    }
    
    console.log('[Proxy IPFS] Forwarding request to https://pump.fun/api/ipfs');
    const pumpResponse = await fetch('https://pump.fun/api/ipfs', {
      method: 'POST',
      body: pumpFormData // Use the new FormData object
    });
    
    const responseStatus = pumpResponse.status;
    const responseStatusText = pumpResponse.statusText;
    let responseDataText = ''; // To store raw response text for logging/error
    
    console.log(`[Proxy IPFS] Response from pump.fun: Status ${responseStatus} ${responseStatusText}`);
    
    try {
      responseDataText = await pumpResponse.text(); // Get raw text first for robust error reporting
      console.log(`[Proxy IPFS] Raw response text from pump.fun: ${responseDataText}`);
    } catch (textError) {
      console.error('[Proxy IPFS] Error reading response text from pump.fun:', textError);
      // If reading text fails, we might not have more details, but still proceed based on status
    }
    
    if (!pumpResponse.ok) {
      const errorMsg = `Pump.fun API error: ${responseStatus} ${responseStatusText}. Details: ${responseDataText}`;
      console.error(`[Proxy IPFS] ${errorMsg}`);
      return res.status(responseStatus).json({ error: errorMsg, pumpErrorDetails: responseDataText });
    }
    
    // Try to parse the text as JSON
    let jsonData;
    try {
      jsonData = JSON.parse(responseDataText);
      console.log('[Proxy IPFS] Parsed JSON response from pump.fun:', jsonData);
    } catch (jsonParseError) {
      const errorMsg = `Failed to parse JSON response from pump.fun. Raw response: ${responseDataText}`;
      console.error(`[Proxy IPFS] ${errorMsg}`, jsonParseError);
      return res.status(500).json({ error: errorMsg, pumpRawResponse: responseDataText });
    }
    
    // Map metadataUri to uri if it exists, as client expects 'uri'
    if (jsonData.metadataUri && !jsonData.uri) {
      console.log('[Proxy IPFS] Mapping metadataUri to uri for client compatibility.');
      jsonData.uri = jsonData.metadataUri;
    }
    
    if (!jsonData.uri) {
      console.warn('[Proxy IPFS] Pump.fun response OK, but no URI (or metadataUri mapped to uri) found in JSON data:', jsonData);
      // Still send the data back, client will handle the missing URI
    }
    
    res.status(responseStatus).json(jsonData);
  } catch (error) {
    console.error('[Proxy IPFS] Unexpected error in /proxy/ipfs:', error.message, error.stack);
    res.status(500).json({ error: `Internal proxy error: ${error.message}` });
  }
});

// Trade API proxy
app.post('/proxy/trade', express.json(), async (req, res) => {
  console.log('[Proxy Trade] Received request.');
  console.log('[Proxy Trade] Request body (payload to pumpportal.fun):', JSON.stringify(req.body, null, 2));
  try {
    const pumpportalResponse = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    const responseStatus = pumpportalResponse.status;
    const responseStatusText = pumpportalResponse.statusText;
    
    console.log(`[Proxy Trade] Response from pumpportal.fun: Status ${responseStatus} ${responseStatusText}`);

    if (responseStatus === 200) {
      // Assuming the response is an ArrayBuffer for successful calls
      const arrayBuffer = await pumpportalResponse.arrayBuffer();
      console.log(`[Proxy Trade] Received ArrayBuffer from pumpportal.fun, size: ${arrayBuffer.byteLength}`);
      res.set('Content-Type', 'application/octet-stream');
      res.send(Buffer.from(arrayBuffer));
    } else {
      // For errors (4xx, 5xx), read the response as text and send it back
      let errorBodyText = '';
      try {
        errorBodyText = await pumpportalResponse.text();
      } catch (textError) {
        console.error('[Proxy Trade] Error reading error response text from pumpportal.fun:', textError);
        errorBodyText = 'Failed to read error response body from pumpportal.fun';
      }
      console.log('[Proxy Trade] Raw error response body from pumpportal.fun:', errorBodyText);
      res.status(responseStatus).send(errorBodyText); // Send raw error text
    }

  } catch (error) {
    console.error('Trade proxy error:', error);
    res.status(500).json({ error: `Internal proxy error: ${error.message}` });
  }
});

// Jito Bundle API proxy
app.post('/proxy/jito', express.json(), async (req, res) => {
  console.log('[Proxy Jito] Received request.');
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