# @ai16z/plugin-trading-assistant

A plugin for Eliza that provides trading and financial analysis capabilities.

## Features

- Real-time trading position tracking
- Portfolio analysis
- Risk management insights
- Market data integration

## Installation

```bash
pnpm add @ai16z/plugin-trading-assistant
```

## Usage

```typescript
import { tradingAssistantPlugin } from "@ai16z/plugin-trading-assistant";

const eliza = new Eliza();
eliza.registerPlugin(tradingAssistantPlugin);
```


## Actions

- `GET_CURRENT_POSITIONS`: Retrieve current trading positions
- `GET_TRADE_HISTORY`: Get historical trade data
- `GET_PORTFOLIO_ANALYSIS`: Analyze portfolio performance

## Providers

- `TradingDataProvider`: Provides access to trading database and market data