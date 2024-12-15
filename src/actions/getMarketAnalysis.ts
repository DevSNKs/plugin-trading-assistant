import { Action, IAgentRuntime, Memory, State, HandlerCallback, ModelClass, Content, messageCompletionFooter } from "@ai16z/eliza";
import { composeContext, generateMessageResponse } from "@ai16z/eliza";
import { TradingDataService } from "../services/tradingDataProvider";

const marketAnalysisTemplate = `
# Task: Generate a response analyzing market data for {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{recentMessages}}

{{messageDirections}}

The response should:
- Be in {{agentName}}'s professional market analyst style
- Address the specific metrics or indicators the user asked about
- Provide clear insights based on the data
- Highlight notable patterns or anomalies
- Be concise but informative

{{providers}}

SQL Query used to extract data:
{{query}}

Extracted Market Data:
{{marketData}}

# Instructions: Write a response addressing the user's question about market conditions. Use the extracted data to support your analysis.
` + messageCompletionFooter;

const sqlQueryGenerationTemplate = `
# Task: Generate a SQL query to extract market data for {{agentName}}, in order to answer the user's question/request.

{{recentMessages}}

# Important: Address only the latest user request.

{{providers}}

# Important: All the data need to be extracted from a table named "full_1h_history_perp", which contains the following columns:
- "volume_zscore"
- "ema13"
- "ema13_diff"
- "ema13_diff_normalized"
- "ema13_diff_zscore"
- "ema200_diff"
- "ema200_diff_normalized"
- "ema200_diff_zscore"
- "ema25"
- "ema25_diff"
- "ema25_diff_normalized"
- "ema25_diff_zscore"
- "ema32"
- "ema32_diff"
- "ema32_diff_normalized"
- "ema32_diff_zscore"
- "oi"
- "oi_change"
- "rsi"
- "sma100"
- "sma100_diff"
- "sma100_diff_normalized"
- "sma100_diff_zscore"
- "changepercent"
- "changepercent_normalized"
- "changepercent_zscore"
- "changeprice"
- "close"
- "funding"
- "funding_rolling"
- "high"
- "high_to_low"
- "high_to_low_normalized"
- "high_to_low_zscore"
- "low"
- "no_trades"
- "open"
- "pivothigh"
- "pivotlow"
- "resistance"
- "returns_btc"
- "returns_btc_rolling"
- "returns_btc_rolling_normalized"
- "returns_btc_rolling_zscore"
- "returns_rolling"
- "returns_rolling_normalized"
- "returns_rolling_zscore"
- "stochrsi"
- "support"
- "taker_buy_quote_asset_vol"
- "time"
- "trade_normalized"
- "trade_rolling"
- "trade_rolling_normalized"
- "trade_rolling_zscore"
- "trade_zscore"
- "volatility"
- "volatility_mean"
- "volume"
- "volume_change"
- "volume_change_normalized"
- "volume_change_zscore"
- "volume_normalized"
- "symbol"

Be smart and select the columns you need to answer the user's question.

# Important: Remeber this is a Postgres database, so use the correct syntax for Postgres.

# Instructions: Write a SQL query to extract the data needed to answer the user's question. Just return the query, no other text.
` + messageCompletionFooter + `\nIgnore "action" field in the response, just place NONE in the action field.`;

export const getMarketAnalysisAction = (tradingService: TradingDataService): Action => ({
    name: "GET_MARKET_ANALYSIS",
    similes: ["MARKET_CONDITIONS", "MARKET_MOMENTUM", "PRICE_ANALYSIS", "MARKET_METRICS"],
    description: "Analyze market conditions and metrics from historical data",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return true;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        try {
            // TODO: Generate SQL query using LLM based on message.content.text
            // For now, using a placeholder query
            const queryResponse = await generateMessageResponse({
                runtime,
                context: composeContext({
                    state,
                    template: sqlQueryGenerationTemplate
                }),
                modelClass: ModelClass.LARGE
            });

            const query = queryResponse.text;
            console.log("Query:", query);

            const marketData = await tradingService.getMarketAnalysisData(
                runtime.character.settings.secrets.TRADING_DB_URL,
                query,
            );

            if (!state) {
                state = await runtime.composeState(message);
            }

            state = {
                ...state,
                marketData: JSON.stringify(marketData, null, 2),
                currentMessage: message.content.text,
                query: query
            };

            const context = composeContext({
                state,
                template: marketAnalysisTemplate
            });

            // Check token count before proceeding
            const TOKEN_LIMIT = 30000; // OpenAI Tier 1 rate limit
            const AVERAGE_CHARS_PER_TOKEN = 4; // Rough estimate
            const estimatedTokens = Math.ceil(JSON.stringify(context).length / AVERAGE_CHARS_PER_TOKEN);

            if (estimatedTokens > TOKEN_LIMIT) {
                await callback({
                    text: `I apologize, but your request would generate too much data (estimated ${estimatedTokens.toLocaleString()} tokens) and exceed my current processing limits (${TOKEN_LIMIT.toLocaleString()} tokens). Please try to:\n\n` +
                          `1. Narrow down the time range\n` +
                          `2. Request fewer metrics\n` +
                          `3. Focus on specific aspects of the market\n\n` +
                          `This will help me provide a more focused and efficient analysis.`
                });
                return null;
            }

            // If within limits, proceed with the response generation
            const response = await generateMessageResponse({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            runtime.databaseAdapter.log({
                body: { message, context, response },
                userId: message.userId,
                roomId: message.roomId,
                type: "market_analysis"
            });

            await callback(response);
            return response;
        } catch (error) {
            console.error('Error in market analysis:', error);
            await callback({
                    text: "I apologize, but I encountered an error while analyzing the market data. Please try again later."
                });
            return null;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "What coins are showing momentum right now?" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me analyze the market data for you.",
                    action: "GET_MARKET_ANALYSIS"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "How is ETH performing today?" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll check ETH's performance metrics.",
                    action: "GET_MARKET_ANALYSIS"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "How is BTC looking?" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll check BTC's performance metrics.",
                    action: "GET_MARKET_ANALYSIS"
                }
            }
        ]
    ]
});
