import { Pool, PoolClient, QueryResult as PgQueryResult, QueryResultRow } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseAdapter, DatabaseConfig, QueryResult } from './interface';
import { SqlQueries } from './queries';

export class PostgresDatabase implements DatabaseAdapter {
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

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const result: PgQueryResult<T & QueryResultRow> = await this.pool.query<T & QueryResultRow>(text, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  }

  async initializeSchema(): Promise<void> {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const statements = schema
        .split(';')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.query(statement);
          } catch (error: any) {
            if (error.code !== '42P07' && error.code !== '23505') {
              throw error;
            }
          }
        }
      }
    } else {
      await this.initializeSchemaFromQueries();
    }
  }

  private async initializeSchemaFromQueries(): Promise<void> {
    try {
      await this.query(SqlQueries.CREATE_TESTS_TABLE);
    } catch (error: any) {
      if (error.code !== '42P07' && error.code !== '23505') {
        throw error;
      }
    }

    try {
      await this.query(SqlQueries.CREATE_FUNCTIONS_TABLE);
    } catch (error: any) {
      if (error.code !== '42P07' && error.code !== '23505') {
        throw error;
      }
    }

    try {
      await this.query(SqlQueries.CREATE_LINKS_TABLE);
    } catch (error: any) {
      if (error.code !== '42P07' && error.code !== '23505') {
        throw error;
      }
    }
    
    for (const indexQuery of SqlQueries.CREATE_INDEXES) {
      try {
        await this.query(indexQuery);
      } catch (error: any) {
        if (error.code !== '42P07' && error.code !== '23505') {
          throw error;
        }
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

