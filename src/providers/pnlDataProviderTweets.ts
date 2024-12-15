import { Provider } from "@ai16z/eliza";
import { TradingDataService } from "../services/tradingDataProvider";

export const pnlDataProviderTweets: Provider = {
    get: async (runtime, message, state) => {
        // Check if this is being called from Twitter client
        if (!message.content.action || message.content.action !== "TWEET") {
            return "";
        }

        const tradingService = new TradingDataService();
        const positions = await tradingService.getCurrentPositions(
            runtime.character.settings.secrets.TRADING_DB_URL
        );

        const profitablePositions = positions.filter(p =>
            parseFloat(p.unrealized_pnl) > 0
        );

        if (profitablePositions.length === 0) {
            return "";
        }

        return profitablePositions
            .map(p => `${p.symbol}: +${p.unrealized_pnl}`)
            .join('\n');
    }
};
