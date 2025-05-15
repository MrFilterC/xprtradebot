import { Connection, PublicKey } from '@solana/web3.js';
import { RPC_ENDPOINT, PROXY_URL } from './constants';

export const fetchWalletBalanceApi = async (publicKeyString) => {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  try {
    const publicKey = new PublicKey(publicKeyString);
    const balance = await connection.getBalance(publicKey);
    return balance / 1000000000; // Lamports to SOL
  } catch (error) {
    console.error(`Error fetching balance for wallet ${publicKeyString}:`, error);
    throw error; // Hatanın yukarıya iletilmesi daha iyi olabilir
  }
};

export const sendTradeTransactionApi = async (tradeData) => {
  const response = await fetch(`${PROXY_URL}/proxy/trade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(tradeData)
  });

  if (response.status === 200) {
    return response.arrayBuffer(); // Return ArrayBuffer to be deserialized later
  } else {
    const errorText = await response.text();
    console.error("Proxy/trade API error:", errorText);
    throw new Error(errorText); // Propagate error
  }
};

export const uploadMetadataApi = async (metadataFormData) => {
  const response = await fetch(`${PROXY_URL}/proxy/ipfs`, {
    method: "POST",
    body: metadataFormData // FormData directly as body
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Proxy/ipfs API error:", errorText);
    throw new Error('Failed to upload metadata: ' + errorText);
  }
  return response.json(); // Return the parsed JSON response
};

export const createTokenApi = async (tokenCreationData) => {
  const response = await fetch(`${PROXY_URL}/proxy/trade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(tokenCreationData)
  });

  if (response.status === 200) {
    return response.arrayBuffer(); // Return ArrayBuffer for transaction deserialization
  } else {
    const errorText = await response.text();
    console.error("Proxy/trade (create token) API error:", errorText);
    throw new Error(errorText);
  }
};

export const createBundleTransactionsApi = async (bundleArgs) => {
  const response = await fetch(`${PROXY_URL}/proxy/trade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(bundleArgs) // bundleArgs is an array of transaction arguments
  });

  if (response.status === 200) {
    return response.json(); // Expects an array of base58 encoded transaction strings
  } else {
    const errorText = await response.text();
    console.error("Proxy/trade (create bundle) API error:", errorText);
    throw new Error(errorText);
  }
};

export const sendBundleToJitoApi = async (signedTransactions) => {
  const jitoPayload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "sendBundle",
    "params": [signedTransactions] // signedTransactions is an array of base58 encoded signed transaction strings
  };

  const response = await fetch(`${PROXY_URL}/proxy/jito`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(jitoPayload)
  });

  // Jito API success is usually 200, but the actual bundle status is in the response body.
  // For now, we'll assume 200 is a successful submission, and let the caller inspect the body.
  // More robust error handling might be needed based on Jito's specific responses.
  if (!response.ok) { // Check for non-2xx responses
    const errorText = await response.text();
    console.error("Proxy/jito API error:", errorText);
    throw new Error("Error sending bundle to Jito: " + errorText);
  }
  return response.json(); // Return Jito's response
}; 