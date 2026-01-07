import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
}

export class Database {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    if (config.connectionString) {
      this.pool = new Pool({ connectionString: config.connectionString });
    } else {
      this.pool = new Pool({
        host: config.host || process.env.DB_HOST || 'localhost',
        port: config.port || parseInt(process.env.DB_PORT || '5432'),
        database: config.database || process.env.DB_NAME || 'buildlens',
        user: config.user || process.env.DB_USER || 'postgres',
        password: config.password || process.env.DB_PASSWORD || 'postgres',
      });
    }

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected database error:', err);
    });
  }

  async connect(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async initializeSchema(): Promise<void> {
    // Use require.resolve to find the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = schema
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        await this.query(statement);
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

