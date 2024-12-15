import { Plugin, Action } from "@ai16z/eliza";
import { getCurrentPositionsAction } from "./actions/getCurrentPositions";
import { getTradeHistoryAction } from "./actions/getTradeHistory";
import { TradingDataService } from "./services/tradingDataProvider";
import { getMarketAnalysisAction } from "./actions/getMarketAnalysis";
import { getRealTimeMarketDataAction } from "./actions/getRealTimeMarketData";
import { pnlDataProviderTweets } from "./providers/pnlDataProviderTweets";

// Create a single instance of the service
const tradingDataService = new TradingDataService();

export const tradingAssistantPlugin: Plugin = {
    name: "trading-assistant",
    description: "Provides trading data access and analysis capabilities",
    actions: [
        getCurrentPositionsAction(tradingDataService),
        getTradeHistoryAction(tradingDataService),
        getMarketAnalysisAction(tradingDataService),
        getRealTimeMarketDataAction()
    ],
    providers: [pnlDataProviderTweets],
    evaluators: [],
};
