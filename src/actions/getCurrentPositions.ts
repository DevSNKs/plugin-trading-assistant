import { Action, IAgentRuntime, Memory, State, HandlerCallback, ModelClass, Content, messageCompletionFooter } from "@ai16z/eliza";
import { composeContext, generateMessageResponse } from "@ai16z/eliza";
import { TradingDataService } from "../services/tradingDataProvider";

const positionsTemplate = `
# Task: Generate a response about trading positions for {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{recentMessages}}

{{messageDirections}}

The response should:
- Be in {{agentName}}'s voice and style
- Directly answer the user's specific question or concern
- Be professional but conversational

{{providers}}

# Extracted Data from Database:
{{positions}}

# Instructions: Write a response addressing the user's question about trading positions. Use the extracted data from the database to answer the question.
` + messageCompletionFooter;

export const getCurrentPositionsAction = (tradingService: TradingDataService): Action => ({
    name: "GET_CURRENT_POSITIONS",
    similes: ["CHECK_POSITIONS", "SHOW_POSITIONS", "VIEW_TRADES"],
    description: "Retrieve and analyze current open trading positions from the database",

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
            const positions = await tradingService.getCurrentPositions(runtime.character.settings.secrets.TRADING_DB_URL);

            if (!state) {
                state = await runtime.composeState(message);
            }

            state = {
                ...state,
                positions: positions.length > 0
                    ? positions.map(p =>
                        `${p.symbol}: Entry at ${p.entry_price}, Current PnL: ${p.unrealized_pnl}`
                    ).join('\n')
                    : "No open positions found.",
                currentMessage: message.content.text
            };

            const context = composeContext({
                state,
                template: positionsTemplate
            });


            const response = await generateMessageResponse({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            // Log the interaction
            runtime.databaseAdapter.log({
                body: { message, context, response },
                userId: message.userId,
                roomId: message.roomId,
                type: "get_positions"
            });

            await callback(response);
            return response;
        } catch (error) {
            console.error("Error in getCurrentPositions action:", error);
            const errorResponse: Content = {
                text: "I apologize, but I encountered an error while fetching the positions data. Please try again later.",
                action: "GET_CURRENT_POSITIONS",
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
                content: { text: "What are my current positions?" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me check that for you.",
                    action: "GET_CURRENT_POSITIONS"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Do i have any open position in SOL?" }
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me check that for you.",
                    action: "GET_CURRENT_POSITIONS"
                }
            }
        ]
    ]
});
