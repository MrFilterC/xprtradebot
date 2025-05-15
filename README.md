# X-PR Trading Bot

## Overview

X-PR Trading Bot is a web-based application designed for the Solana blockchain, enabling users to create tokens, manage wallets, and execute trades. It offers both basic and advanced trading functionalities, allowing users to implement various strategies, launch new tokens, and manage pre-configured transaction bundles. The application emphasizes local wallet management and provides detailed logging for all significant user actions.

## Core Technologies

*   **Frontend:** React.js
*   **State Management:** React Hooks (useState, useEffect, useContext, useReducer as part of `useWalletManager`)
*   **Blockchain Interaction:** Solana Web3.js (`@solana/web3.js`)
*   **Backend (Proxy):** Node.js with Express (see `proxy-server.cjs`) for handling sensitive operations and API interactions.
*   **Styling:** CSS

## Project Structure & Key Components

The application follows a component-based architecture.

*   **`App.jsx`**: The main React component responsible for overall layout, routing between different views (Trading Dashboard, Wallet Manager, Logs), managing global state, and integrating various sub-components.
*   **`api.js`**: Handles communication with the backend proxy server for blockchain transactions and other API calls.
*   **`constants.js`**: Stores application-wide constants, such as RPC endpoints.
*   **`proxy-server.cjs`**: A Node.js/Express based proxy server. It\'s crucial for securely handling private keys for transaction signing and interacting with external services (like Jito for bundles or metadata upload services), abstracting these complexities from the client-side.
*   **`src/components/`**: Contains all UI components:
    *   **`GlobalSettingsBar.jsx`**: Displays and manages global settings (Priority Fee, Slippage, Default Pool). It also shows the application title, total SOL balance from all managed wallets, and a "Save Settings" button.
    *   **`WalletManagerView.jsx`**: Provides an interface for creating new wallets, importing existing ones (via private key), deleting wallets, renaming them, and viewing their balances. It includes an important security notice regarding local wallet storage.
    *   **`WalletItem.jsx`**: Renders individual wallet information within the `WalletManagerView`.
    *   **`ImportWalletModal.jsx`**: A modal dialog for importing wallets using a private key.
    *   **`TokenLaunchForm.jsx`**: A form for creating new SPL tokens on the Solana network, including metadata.
    *   **`BundleLaunchForm.jsx`**: (Conceptually) A form for creating and launching pre-configured sets of transactions, often used for creating liquidity pools or other complex on-chain setups.
    *   **`TradeForm.jsx` (Basic Trade)**: Allows users to perform basic buy/sell operations for a specified token mint using selected wallets. Features SOL amount input for buys, percentage input for sells, and quick shortcut buttons.
    *   **`AdvancedTradeForm.jsx` (Advanced Trade)**: Offers more sophisticated trading options, including a global token mint address, four configurable "wallet bundles" where users can assign wallets and set per-wallet buy (in SOL) and sell (percentage) parameters. Each bundle has its own "BUY", "SELL", and "DUMP" (sell 100% of the token from all assigned wallets in the bundle) buttons.
    *   **`LogsView.jsx`**: A dedicated window that displays a chronological list of all significant actions performed within the application (token launches, trades, wallet operations), including relevant details and transaction signatures.
    *   **`ToastNotifications.jsx`**: Manages and displays temporary, non-intrusive notifications (toasts) for user feedback (e.g., success, error, information, contract address copied).
    *   **`DonationFooter.jsx`**: A subtle footer ثابت at the bottom of all pages, containing a thank-you note and a SOL address for optional donations.
*   **`src/hooks/`**:
    *   **`useWalletManager.js`**: A custom React hook encapsulating all logic related to wallet management. This includes creating, importing, deleting, and renaming wallets, as well as fetching and updating their balances. It also handles the persistence of wallet data to the browser\'s `localStorage`.
*   **`PLANNED_UPDATES.md`**: A document outlining future development plans and features for the application.

## Key Features Implemented

*   **Comprehensive Wallet Management:**
    *   Create new Solana wallets.
    *   Import existing wallets using private keys.
    *   Delete wallets.
    *   Rename wallets for better organization.
    *   View individual and total SOL balances.
    *   All wallet data (including encrypted private keys if this pattern is followed by `useWalletManager`) is stored locally in the browser\'s `localStorage`.
    *   A clear warning is displayed regarding the responsibility of backing up private keys.
*   **Token Creation:**
    *   User-friendly form to launch new SPL tokens with specified metadata (name, symbol, URI, decimals).
*   **Bundle Launching:**
    *   Interface to prepare and launch transaction bundles (e.g., for services like Jito).
*   **Flexible Trading Options:**
    *   **Basic Trade Tab:** Simplified interface for quick buy/sell actions using one or more selected wallets.
    *   **Advanced Trade Tab:**
        *   Define a global token mint address for all advanced trading operations.
        *   Organize wallets into four distinct "bundles" or "workspaces."
        *   Customize buy (in SOL) and sell (as a percentage) parameters for each wallet within a bundle.
        *   Execute per-bundle "BUY" and "SELL" actions using only the actively selected wallets within that bundle, utilizing their individual parameters.
        *   "DUMP" button per bundle to quickly sell 100% of the global token from all wallets assigned to that bundle.
        *   Convenient "Select All" / "Deselect All" wallets within a bundle for trading.
*   **Enhanced User Interface & Experience:**
    *   Intuitive tab-based navigation for different application sections (Trading Dashboard, Wallet Manager, Logs) and sub-sections (Token/Bundle Launch, Basic/Advanced Trade).
    *   Modernized and clean UI elements, including the header, buttons, and form layouts.
    *   **Dedicated Logs Window:** Provides a detailed and filterable history of all significant application events, including transaction IDs, error messages, and action parameters.
    *   **Toast Notifications:** Offers immediate, non-blocking feedback for actions such as successful trades, errors, or when a contract address is copied to the clipboard.
    *   The mint address of the last successfully created token automatically populates the mint address fields in both Basic and Advanced Trade forms.
    *   Convenient "copy to clipboard" icons for mint addresses.
*   **Global Application Settings:**
    *   Users can configure global defaults for Priority Fee (in SOL), Slippage Percentage, and the Default Pool (e.g., Pump.fun, Raydium) to be used for transactions.
    *   The `GlobalSettingsBar` prominently displays the aggregated total SOL balance of all managed wallets.
*   **Settings Persistence (`localStorage`):**
    *   A "Save Settings" button in the `GlobalSettingsBar` allows users to save their current application state and preferences to the browser\'s `localStorage`.
    *   Saved settings include:
        *   Global settings (Priority Fee, Slippage, Pool).
        *   Active tabs and window selections.
        *   The last created mint address.
        *   Data for the Basic Trade form (mint address, amount, sell percentage, selected wallets).
        *   Data for the Advanced Trade form (global mint address, configuration of all four wallet bundles including assigned wallets, their buy/sell parameters, and active trade selections).
    *   These settings are automatically loaded when the application starts, providing a persistent user experience.
*   **Secure Proxy Server:**
    *   A backend proxy server (`proxy-server.cjs`) is used to handle operations requiring private keys (like signing transactions) and to manage interactions with third-party APIs or RPC endpoints where direct client-side calls might expose sensitive information or run into CORS issues.
*   **Donation Support:**
    *   A discreet footer with a SOL address allows users to support the project\'s development by "buying a coffee." The address is easily copyable.

## Setup & Running the Application

1.  **Proxy Server:** Ensure the `proxy-server.cjs` is running. Navigate to its directory and run `node proxy-server.cjs` (or as configured).
2.  **Frontend Application:**
    *   Install dependencies: `npm install`
    *   Start the development server: `npm run dev` (or `npm start`, depending on your `package.json`)

## Future Development

Refer to the `PLANNED_UPDATES.md` file for a detailed list of upcoming features and improvements. Key items currently include:

*   **User Authentication with Supabase:** To allow users to create accounts and securely store their settings (and potentially encrypted wallet information) in the cloud, enabling a consistent experience across different devices.
*   Further UI/UX enhancements and optimizations.
