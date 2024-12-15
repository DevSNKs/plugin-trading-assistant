import axios from 'axios';

interface BinancePrice {
    symbol: string;
    price: string;
}

interface Binance24hTicker {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}

interface DexScreenerResponse {
    schemaVersion: string;
    pairs: DexScreenerPair[];
}

interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    labels?: string[];
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5: { buys: number; sells: number };
        h1: { buys: number; sells: number };
        h6: { buys: number; sells: number };
        h24: { buys: number; sells: number };
    };
    volume: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    priceChange: {
        m5: number;
        h1: number;
        h6: number;
        h24: number;
    };
    liquidity?: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv?: number;
    marketCap?: number;
    pairCreatedAt: number;
    info?: {
        imageUrl?: string;
        header?: string;
        openGraph?: string;
        websites?: Array<{
            label: string;
            url: string;
        }>;
        socials?: Array<{
            type: string;
            url: string;
        }>;
    };
}

const BINANCE_API_BASE = 'https://data-api.binance.vision/api/v3';
const DEXSCREENER_API_BASE = 'https://api.dexscreener.com/latest';

export async function getBinancePrice(symbol: string): Promise<number | null> {
    try {
        const response = await axios.get<BinancePrice>(`${BINANCE_API_BASE}/ticker/price`, {
            params: { symbol: symbol.toUpperCase() }
        });
        return parseFloat(response.data.price);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Error fetching Binance price for ${symbol}:`, error.response?.data || error.message);
        } else {
            console.error(`Error fetching Binance price for ${symbol}:`, error);
        }
        return null;
    }
}

export async function getBinance24hData(symbol: string): Promise<Binance24hTicker | null> {
    try {
        const response = await axios.get<Binance24hTicker>(`${BINANCE_API_BASE}/ticker/24hr`, {
            params: { symbol: symbol.toUpperCase() }
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Error fetching Binance 24h data for ${symbol}:`, error.response?.data || error.message);
        } else {
            console.error(`Error fetching Binance 24h data for ${symbol}:`, error);
        }
        return null;
    }
}

export async function getDexScreenerData(symbol: string): Promise<DexScreenerPair | null> {
    try {
        const response = await axios.get<DexScreenerResponse>(`${DEXSCREENER_API_BASE}/dex/search`, {
            params: { q: symbol }
        });

        if (response.data.pairs && response.data.pairs.length > 0) {
            return response.data.pairs[0];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching DexScreener data for ${symbol}:`, error);
        return null;
    }
}

// Utility function to get comprehensive token data from multiple sources
export async function getTokenData(symbol: string) {
    // For binance add "USDT" to symbol
    const binanceSymbol = `${symbol.toUpperCase()}USDT`;
    const [binancePrice, binance24h, dexScreener] = await Promise.all([
        getBinancePrice(binanceSymbol),
        getBinance24hData(binanceSymbol),
        getDexScreenerData(symbol)
    ]);

    return {
        binancePrice,
        binance24h,
        dexScreener
    };
}

export async function getCurrentPrice(symbol: string): Promise<number | null> {
    // Try Binance first
    const binanceSymbol = `${symbol.toUpperCase()}USDT`;
    const binancePrice = await getBinancePrice(binanceSymbol);

    if (binancePrice !== null) {
        return binancePrice;
    }

    // Fallback to DexScreener
    const dexScreenerData = await getDexScreenerData(symbol);
    if (dexScreenerData?.priceUsd) {
        return parseFloat(dexScreenerData.priceUsd);
    }

    return null;
}
