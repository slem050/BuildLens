export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseAdapter {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  initializeSchema(): Promise<void>;
  close(): Promise<void>;
}

export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
}

