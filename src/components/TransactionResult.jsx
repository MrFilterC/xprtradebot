import React from 'react';

const TransactionResult = ({ status, message, signature, signatures, errorMessage }) => {
  if (!status) return null;

  if (status === 'success') {
    return (
      <div className="transaction-result success">
        <h3>{message || 'Transaction Successful!'}</h3>
        {signature && (
          <p>
            Transaction Signature: {signature}
            <br />
            <a 
              href={`https://solscan.io/tx/${signature}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              View on Solscan
            </a>
          </p>
        )}
        {signatures && signatures.length > 0 && (
          <div className="bundle-signatures">
            {signatures.map((sig, index) => (
              <div key={index} className="bundle-tx">
                <p>Transaction {index + 1}: {sig}</p>
                <a 
                  href={`https://solscan.io/tx/${sig}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  View on Solscan
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="transaction-result error">
        <h3>{message || 'Transaction Failed'}</h3>
        {errorMessage && <p>{errorMessage}</p>}
        <p>Please check the console for more details.</p>
      </div>
    );
  }

  return null;
};

export default TransactionResult; 