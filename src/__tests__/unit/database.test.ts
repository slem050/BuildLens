import { Database, DatabaseFactory } from '../../db/database';
import { PostgresDatabase } from '../../db/postgres-database';
import { DatabaseConfig } from '../../db/interface';

describe('Database', () => {
  describe('DatabaseFactory', () => {
    it('should create PostgresDatabase for PostgreSQL connection string', () => {
      const config: DatabaseConfig = {
        connectionString: 'postgresql://user:pass@localhost:5432/db',
      };

      const db = DatabaseFactory.create(config);
      expect(db).toBeInstanceOf(PostgresDatabase);
    });

    it('should create PostgresDatabase for postgres connection string', () => {
      const config: DatabaseConfig = {
        connectionString: 'postgres://user:pass@localhost:5432/db',
      };

      const db = DatabaseFactory.create(config);
      expect(db).toBeInstanceOf(PostgresDatabase);
    });

    it('should create PostgresDatabase when no connection string provided', () => {
      const config: DatabaseConfig = {};

      const db = DatabaseFactory.create(config);
      expect(db).toBeInstanceOf(PostgresDatabase);
    });

    it('should throw error for unsupported connection string', () => {
      const config: DatabaseConfig = {
        connectionString: 'mysql://user:pass@localhost:3306/db',
      };

      expect(() => DatabaseFactory.create(config)).toThrow();
    });
  });

  describe('Database wrapper', () => {
    it('should initialize schema', async () => {
      const config: DatabaseConfig = {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5432'),
        database: process.env.TEST_DB_NAME || 'buildlens_test',
        user: process.env.TEST_DB_USER || 'postgres',
        password: process.env.TEST_DB_PASSWORD || 'postgres',
      };

      const db = new Database(config);
      
      try {
        await db.initializeSchema();
        
        const result = await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
        const tableNames = result.rows.map((row: any) => row.table_name);
        
        expect(tableNames).toContain('tests');
        expect(tableNames).toContain('functions');
        expect(tableNames).toContain('test_function_links');
      } finally {
        await db.close();
      }
    });

    it('should execute queries', async () => {
      const config: DatabaseConfig = {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: parseInt(process.env.TEST_DB_PORT || '5432'),
        database: process.env.TEST_DB_NAME || 'buildlens_test',
        user: process.env.TEST_DB_USER || 'postgres',
        password: process.env.TEST_DB_PASSWORD || 'postgres',
      };

      const db = new Database(config);
      
      try {
        await db.initializeSchema();
        
        const result = await db.query('SELECT 1 as value');
        
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].value).toBe(1);
      } finally {
        await db.close();
      }
    });
  });
});

