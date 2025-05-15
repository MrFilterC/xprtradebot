import React from 'react';

const GlobalSettingsBar = ({
  priorityFee,
  setPriorityFee,
  slippage,
  setSlippage,
  pool,
  setPool,
  totalBalance,
  isLoadingTotalBalance,
  onSaveSettings,
  username,
  onLogout
}) => {
  return (
    <div className="global-settings-bar">
      <div className="settings-cluster">
        <div className="setting-item">
          <label htmlFor="globalPriorityFee">Priority Fee</label>
          <input
            type="number"
            id="globalPriorityFee"
            name="priorityFee"
            value={priorityFee}
            onChange={(e) => setPriorityFee(parseFloat(e.target.value) || 0)}
            step="0.00001"
            min="0"
            title="Default priority fee in SOL"
          />
        </div>
        <div className="setting-item">
          <label htmlFor="globalSlippage">Slippage %</label>
          <input
            type="number"
            id="globalSlippage"
            name="slippage"
            value={slippage}
            onChange={(e) => setSlippage(parseInt(e.target.value) || 0)}
            min="0"
            max="100"
            title="Default slippage percentage"
          />
        </div>
        <div className="setting-item">
          <label htmlFor="globalPool">Default Pool</label>
          <select
            id="globalPool"
            name="pool"
            value={pool}
            onChange={(e) => setPool(e.target.value)}
            title="Default exchange pool"
          >
            <option value="pump">Pump</option>
            <option value="raydium">Raydium</option>
            <option value="pump-amm">Pump AMM</option>
            <option value="launchlab">LaunchLab</option>
            {/* Adding 'auto' specifically for TradeForm if it might be a common default */}
            {/* Or, TradeForm can override this if its 'auto' logic is different */}
            <option value="auto">Auto (Trade)</option>
          </select>
        </div>
      </div>
      <div className="app-title-main">
        <h1>X-PR Trading Bot</h1>
      </div>
      <div className="settings-cluster settings-cluster-right">
        {isLoadingTotalBalance ? (
          <div className="setting-item total-balance-loading">
            <span>Loading Total...</span>
          </div>
        ) : (
          <div className="setting-item total-balance-display">
            <label>Total Balance</label>
            <span>{totalBalance !== undefined ? totalBalance.toFixed(3) : '0.000'} SOL</span>
          </div>
        )}
        {username && (
          <div className="setting-item user-info-display" style={{ display: 'flex', alignItems: 'center', marginRight: '15px' }}>
            <span title="Logged in user" style={{ marginRight: '10px' }}>User: {username}</span>
            <button onClick={onLogout} className="logout-button minimal-button" style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
          </div>
        )}
        <button onClick={onSaveSettings} className="save-settings-button">
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default GlobalSettingsBar; 