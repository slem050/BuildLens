import { DatabaseAdapter, DatabaseConfig } from './interface';
import { PostgresDatabase } from './postgres-database';

export { DatabaseAdapter, DatabaseConfig, QueryResult } from './interface';

export class DatabaseFactory {
  static create(config: DatabaseConfig): DatabaseAdapter {
    if (config.connectionString?.startsWith('postgresql://') || 
        config.connectionString?.startsWith('postgres://') ||
        !config.connectionString) {
      return new PostgresDatabase(config);
    }
    
    throw new Error(`Unsupported database connection string: ${config.connectionString}`);
  }
}

export class Database {
  private adapter: DatabaseAdapter;

  constructor(config: DatabaseConfig) {
    this.adapter = DatabaseFactory.create(config);
  }

  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    return this.adapter.query<T>(text, params);
  }

  async initializeSchema(): Promise<void> {
    return this.adapter.initializeSchema();
  }

  async close(): Promise<void> {
    return this.adapter.close();
  }
}
