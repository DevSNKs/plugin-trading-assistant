import pkg from 'pg';
const { Pool } = pkg;
import { getCurrentPrice } from '../utils/marketData';

interface Position {
    id: number;
    status: number;
    symbol: string;
    direction: string;
    timestampin: string;
    strategy: string;
    pricein: string;
    timestampfill: string;
    pricefill: number;
    timestampout: string;
    priceout: number;
}

export class TradingDataService {
    private db: pkg.Pool;

    constructor() {
        this.db = null;
    }

    async getCurrentPositions(connectionString: string) {
        try {
            if (!this.db) {
                this.db = new pkg.Pool({
                    connectionString: connectionString,
                    ssl: {
                        rejectUnauthorized: false
                    }
                });
            }

            const result = await this.db.query<Position>(`
                SELECT *
                FROM positions_1d
                WHERE status = 2
                ORDER BY timestampin DESC
            `);

            // Map positions with real-time PnL calculation
            const positionsWithPnL = await Promise.all(result.rows.map(async position => {
                const currentPrice = await getCurrentPrice(position.symbol);
                const entryPrice = position.pricefill || position.pricein;

                const unrealized_pnl = currentPrice ?
                    ((position.direction === 'longonly' ? 1 : -1) *
                    (currentPrice - Number(entryPrice)) /
                    Number(entryPrice) * 100).toFixed(2) + '%'
                    : 'N/A';

                return {
                    symbol: position.symbol,
                    direction: position.direction,
                    entry_price: entryPrice,
                    current_price: currentPrice,
                    entry_time: position.timestampfill || position.timestampin,
                    strategy: position.strategy,
                    unrealized_pnl
                };
            }));

            return positionsWithPnL;
        } catch (error) {
            console.error('Error fetching positions:', error);
            return [];
        }
    }

    async getTradeHistory(connectionString: string, limit: number = 10) {
        try {
            if (!this.db) {
                this.db = new pkg.Pool({
                    connectionString: connectionString,
                    ssl: {
                        rejectUnauthorized: false
                    }
                });
            }

            const result = await this.db.query<Position>(`
                SELECT *
                FROM positions_1d
                WHERE status != 2
                ORDER BY timestampout DESC
                LIMIT $1
            `, [limit]);

            return result.rows.map(trade => ({
                symbol: trade.symbol,
                side: trade.direction,
                entry_price: trade.pricefill || trade.pricein,
                exit_price: trade.priceout,
                strategy: trade.strategy,
                execution_date: new Date(trade.timestampout),
                realized_pnl: trade.priceout ?
                    ((trade.direction === 'longonly' ? 1 : -1) *
                    (trade.priceout - Number(trade.pricein)) /
                    Number(trade.pricein) * 100).toFixed(2) + '%'
                    : 'N/A'
            }));
        } catch (error) {
            console.error('Error fetching trade history:', error);
            return [];
        }
    }

    async getMarketAnalysisData(connectionString: string, query: string, params: any[] = []): Promise<any[]> {
        try {
            if (!this.db) {
                this.db = new pkg.Pool({
                    connectionString: connectionString,
                    ssl: {
                        rejectUnauthorized: false
                    }
                });
            }

            // Block unwanted SQL operations
            const normalizedQuery = query.trim().toUpperCase();

            // List of forbidden SQL operations
            const forbiddenOperations = [
                'DELETE',
                'INSERT',
                'UPDATE',
                'DROP',
                'TRUNCATE',
                'ALTER',
                'CREATE',
                'REPLACE',
                'MERGE',
                'UPSERT',
                'GRANT',
                'REVOKE',
                'SET'
            ];

            // Check if query contains any forbidden operations
            const containsForbiddenOperation = forbiddenOperations.some(operation => {
                // Match whole words only to avoid false positives
                const regex = new RegExp(`\\b${operation}\\b`);
                return regex.test(normalizedQuery);
            });

            if (containsForbiddenOperation) {
                throw new Error('Query contains forbidden operations. Only SELECT statements are allowed.');
            }

            // Ensure query starts with SELECT
            if (!normalizedQuery.startsWith('SELECT')) {
                throw new Error('Only SELECT queries are allowed.');
            }

            // Additional security check for multiple statements
            //  if (query.includes(';')) {
            //      throw new Error('Multiple SQL statements are not allowed.');
            //  }

            // Protect against SQL injection
            //const sanitizedQuery = query.replace(/'/g, "''");
            const result = await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Error executing market analysis query:', error);
            throw error; // Let the action handle the error
        }
    }
}
