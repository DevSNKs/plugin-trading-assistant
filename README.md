# @ai16z/plugin-trading-assistant

<div align="center">
    <img src="./assets/avatar.jpg" alt="quantai" width="400">
    <br><br>
    <a href="https://t.me/MetaAnomaly">🧑🏻‍💻 Need Help?</a>
    <br><br>
</div>

A plugin for Eliza that provides trading and financial analysis capabilities.

## Features

- Database integration
- Real-time trading position tracking
- Portfolio analysis
- Risk management insights
- Market data integration
- Trading positions tweet content generation

## Installation

Use the install script to install the plugin into your Eliza repository.

```bash
python3 install/install.py
```

## Usage

```bash
pnpm run start --character='characters/quantai.character.json'
```


## Actions

- `GET_CURRENT_POSITIONS`: Retrieve current trading positions and calulate PnLs
- `GET_TRADE_HISTORY`: Get historical trade data
- `GET_MARKET_ANALYSIS`: Get market analysis based on historical data
- `GET_REAL_TIME_MARKET_DATA`: Get real-time market data