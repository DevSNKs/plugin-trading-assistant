import { Action, IAgentRuntime, Memory, State, HandlerCallback, ModelClass, Content, messageCompletionFooter } from "@ai16z/eliza";
import { composeContext, generateMessageResponse } from "@ai16z/eliza";
import { TradingDataService } from "../services/tradingDataProvider";

const tradeHistoryTemplate = `
# Task: Generate a response analyzing trading history for {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

Current Message:
{{currentMessage}}

Recent Conversation:
{{recentMessages}}

The response should:
- Be in {{agentName}}'s professional trading analyst style
- Address the specific timeframe or trades the user asked about (if he asked about a specific trade, provide details about it)
- Analyze patterns and performance trends
- Directly answer the user's specific question or concern
- Highlight notable wins and learning opportunities

Extracted Data from Database:
{{trades}}

# Instructions: Write a response addressing the user's question about trading history. Use the extracted data from the database to answer the question.
` + messageCompletionFooter;

export const getTradeHistoryAction = (tradingService: TradingDataService): Action => ({
    name: "GET_TRADE_HISTORY",
    similes: ["SHOW_HISTORY", "PAST_TRADES", "TRADING_HISTORY"],
    description: "Retrieve and analyze historical trading activity from the database",

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
            // Get trade history
            const trades = await tradingService.getTradeHistory(runtime.character.settings.secrets.TRADING_DB_URL, 10);

            // Create or update state
            if (!state) {
                state = await runtime.composeState(message);
            }

            // Add trades data to state
            state = {
                ...state,
                trades: trades.length > 0
                    ? trades.map(t =>
                        `${t.execution_date.toLocaleDateString()}: ${t.side} ${t.symbol} @ ${t.entry_price} | PnL: ${t.realized_pnl}`
                    ).join('\n')
                    : "No trading history found.",
                currentMessage: message.content.text
            };

            // Compose context for response generation
            const context = composeContext({
                state,
                template: tradeHistoryTemplate
            });

            // Generate response using the agent's personality
            const response = await generateMessageResponse({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            // Create properly formatted Content object
            // Commented out because we are using the generatedResponse directly
            //const response: Content = {
                //text: generatedResponse.text,
                //action: "GET_TRADE_HISTORY",
                //source: message.content.source,
                //attachments: [],
                //inReplyTo: message.id
            //};

            // Log the interaction
            runtime.databaseAdapter.log({
                body: { message, context, response },
                userId: message.userId,
                roomId: message.roomId,
                type: "get_history"
            });

            await callback(response);
            return response;

        } catch (error) {
            console.error("Error in getTradeHistory action:", error);
            const errorResponse: Content = {
                text: "I apologize, but I encountered an error while fetching the trading history. Please try again later.",
                action: "GET_TRADE_HISTORY",
                source: message.content.source,
                attachments: []
            };
            await callback(errorResponse);
            return errorResponse;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "How have my recent trades performed?" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me check that for you.",
                    action: "GET_TRADE_HISTORY"
                }
            }
        ]
    ]
});
