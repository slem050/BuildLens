import { Database, DatabaseConfig } from '../../db/database';
import { Repository } from '../../db/repository';
import { Pool } from 'pg';

export class TestDatabase {
  private db: Database;
  private repo: Repository;

  constructor(config?: DatabaseConfig) {
    const dbConfig: DatabaseConfig = config || this.getDefaultConfig();
    this.db = new Database(dbConfig);
    this.repo = new Repository(this.db.getAdapter());
  }

  private getDefaultConfig(): DatabaseConfig {
    if (process.env.TEST_DATABASE_URL) {
      return { connectionString: process.env.TEST_DATABASE_URL };
    }

    const defaultPort = process.env.TEST_DB_PORT || '5433';
    
    return {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(defaultPort),
      database: process.env.TEST_DB_NAME || 'buildlens_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres',
    };
  }

  async setup(): Promise<void> {
    try {
      await this.db.initializeSchema();
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        await this.createDatabaseIfNeeded();
        await this.db.initializeSchema();
      } else {
        throw error;
      }
    }
  }

  private async createDatabaseIfNeeded(): Promise<void> {
    const config = this.getDefaultConfig();
    
    if (config.connectionString) {
      const url = new URL(config.connectionString);
      const dbName = url.pathname.slice(1);
      const adminUrl = config.connectionString.replace(`/${dbName}`, '/postgres');
      
      const pool = new Pool({ connectionString: adminUrl });
      try {
        await pool.query(`CREATE DATABASE ${dbName}`);
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          throw error;
        }
      } finally {
        await pool.end();
      }
    } else {
      const adminConfig = {
        host: config.host || 'localhost',
        port: config.port || 5432,
        database: 'postgres',
        user: config.user || 'postgres',
        password: config.password || 'postgres',
      };
      
      const pool = new Pool(adminConfig);
      try {
        await pool.query(`CREATE DATABASE ${config.database || 'buildlens_test'}`);
      } catch (error: any) {
        if (!error.message?.includes('already exists')) {
          throw error;
        }
      } finally {
        await pool.end();
      }
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.repo.clearAllLinks();
      
      const tests = await this.repo.getAllTests();
      for (const test of tests) {
        await this.repo.clearTestLinks(test.id);
      }
    } catch (error) {
    }
  }

  async teardown(): Promise<void> {
    try {
      await this.cleanup();
    } catch (error) {
    }
    try {
      await this.db.close();
    } catch (error) {
    }
  }

  getRepository(): Repository {
    return this.repo;
  }

  getDatabase(): Database {
    return this.db;
  }
}

export async function withTestDb<T>(
  testFn: (db: TestDatabase) => Promise<T>,
  config?: DatabaseConfig
): Promise<T> {
  const testDb = new TestDatabase(config);
  
  try {
    await testDb.setup();
    return await testFn(testDb);
  } finally {
    await testDb.teardown();
  }
}
