console.log("VITE_PROXY_URL from import.meta.env:", import.meta.env.VITE_PROXY_URL);

export const PROXY_URL = import.meta.env.VITE_PROXY_URL || "http://localhost:3000";
export const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=23750c00-b047-4444-84ae-39dae001dccd"; 