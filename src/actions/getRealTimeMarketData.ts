import { Action, IAgentRuntime, Memory, State, HandlerCallback, ModelClass, Content, messageCompletionFooter } from "@ai16z/eliza";
import { composeContext, generateMessageResponse } from "@ai16z/eliza";
import { getTokenData } from "../utils/marketData";

const realTimeDataTemplate = `
# Task: Generate a response about real-time market data for {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{recentMessages}}

{{messageDirections}}

The response should:
- Be in {{agentName}}'s professional market analyst style
- Focus on the specific data points the user asked about
- Be concise and precise with numbers
- Mention data source (Binance/DEX) when relevant
- Format numbers in a readable way

{{providers}}

# Available Real-Time Market Data:
{{marketData}}

# Instructions: Write a response addressing the user's question about real-time market data. Use the available data to provide accurate information.
` + messageCompletionFooter;

const symbolExtractionTemplate = `
# Task: Extract the token symbol from the user's message.

User Message:
{{currentMessage}}

Extract the symbol from the message and return it as a string with out the "$" prefix if present.
` + messageCompletionFooter + `\nIgnore "action" field, put NONE in it, If you don't find a symbol, return null in "text" field`;

export const getRealTimeMarketDataAction = (): Action => ({
    name: "GET_REALTIME_MARKET_DATA",
    similes: ["CHECK_PRICE", "SHOW_PRICE", "CHECK_VOLUME", "MARKET_CAP", "CHECK_MC"],
    description: "Retrieve and display real-time market data for a specific token",

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
            // Use small model to extract symbol from message
            const symbol = await generateMessageResponse({
                runtime,
                context: composeContext({
                    state: {
                        ...state,
                        currentMessage: message.content.text
                    },
                    template: symbolExtractionTemplate
                }),
                modelClass: ModelClass.SMALL
            });


            if (symbol.text == null || symbol.text.toUpperCase() == "NULL") {
                await callback(
                    {
                        text: "I couldn't identify which token you're asking about. Could you please specify the token symbol?"
                    }
                );
                return null;
            }

            // Fetch data from both sources
            const marketData = await getTokenData(symbol.text);

            if (!marketData.binancePrice && !marketData.dexScreener) {
                await callback({
                    text: `I couldn't find any real-time market data for ${symbol}. Please verify the token symbol and try again.`
                });
                return null;
            }

            if (!state) {
                state = await runtime.composeState(message);
            }

            state = {
                ...state,
                marketData: JSON.stringify(marketData, null, 2),
            };

            const context = composeContext({
                state,
                template: realTimeDataTemplate
            });

            const response = await generateMessageResponse({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            runtime.databaseAdapter.log({
                body: { message, context, response },
                userId: message.userId,
                roomId: message.roomId,
                type: "realtime_market_data"
            });

            await callback(response);
            return response;
        } catch (error) {
            console.error('Error fetching real-time market data:', error);
            await callback({
                text: "I apologize, but I encountered an error while fetching the real-time market data. Please try again later."
            });
            return null;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "What's ETH current price?" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me check the current price of ETH for you.",
                    action: "GET_REALTIME_MARKET_DATA"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "What's the market cap of SOL?" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll look up SOL's market cap.",
                    action: "GET_REALTIME_MARKET_DATA"
                }
            }
        ]
    ]
});