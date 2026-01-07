import { Database } from './database';

export interface Test {
  id: number;
  file_path: string;
  test_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Function {
  id: number;
  file_path: string;
  function_name: string;
  start_line: number;
  end_line: number;
  commit_hash: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TestFunctionLink {
  id: number;
  test_id: number;
  function_id: number;
  created_at: Date;
}

export class Repository {
  constructor(private db: Database) {}

  // Test operations
  async upsertTest(filePath: string, testName: string): Promise<Test> {
    const result = await this.db.query<Test>(
      `INSERT INTO tests (file_path, test_name, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (file_path, test_name)
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [filePath, testName]
    );
    return result.rows[0];
  }

  async getTest(filePath: string, testName: string): Promise<Test | null> {
    const result = await this.db.query<Test>(
      `SELECT * FROM tests WHERE file_path = $1 AND test_name = $2`,
      [filePath, testName]
    );
    return result.rows[0] || null;
  }

  async getAllTests(): Promise<Test[]> {
    const result = await this.db.query<Test>(`SELECT * FROM tests`);
    return result.rows;
  }

  // Function operations
  async upsertFunction(
    filePath: string,
    functionName: string,
    startLine: number,
    endLine: number,
    commitHash?: string
  ): Promise<Function> {
    const result = await this.db.query<Function>(
      `INSERT INTO functions (file_path, function_name, start_line, end_line, commit_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (file_path, function_name, start_line, end_line)
       DO UPDATE SET commit_hash = COALESCE($5, functions.commit_hash), updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [filePath, functionName, startLine, endLine, commitHash || null]
    );
    return result.rows[0];
  }

  async getFunction(
    filePath: string,
    functionName: string,
    startLine: number,
    endLine: number
  ): Promise<Function | null> {
    const result = await this.db.query<Function>(
      `SELECT * FROM functions 
       WHERE file_path = $1 AND function_name = $2 AND start_line = $3 AND end_line = $4`,
      [filePath, functionName, startLine, endLine]
    );
    return result.rows[0] || null;
  }

  async getFunctionsByFilePath(filePath: string): Promise<Function[]> {
    const result = await this.db.query<Function>(
      `SELECT * FROM functions WHERE file_path = $1`,
      [filePath]
    );
    return result.rows;
  }

  async getFunctionsByFilePaths(filePaths: string[]): Promise<Function[]> {
    if (filePaths.length === 0) return [];
    const result = await this.db.query<Function>(
      `SELECT * FROM functions WHERE file_path = ANY($1::text[])`,
      [filePaths]
    );
    return result.rows;
  }

  // Link operations
  async createLink(testId: number, functionId: number): Promise<TestFunctionLink> {
    const result = await this.db.query<TestFunctionLink>(
      `INSERT INTO test_function_links (test_id, function_id)
       VALUES ($1, $2)
       ON CONFLICT (test_id, function_id) DO NOTHING
       RETURNING *`,
      [testId, functionId]
    );
    return result.rows[0];
  }

  async getTestsForFunctions(functionIds: number[]): Promise<Test[]> {
    if (functionIds.length === 0) return [];
    const result = await this.db.query<Test>(
      `SELECT DISTINCT t.* FROM tests t
       INNER JOIN test_function_links tfl ON t.id = tfl.test_id
       WHERE tfl.function_id = ANY($1::int[])`,
      [functionIds]
    );
    return result.rows;
  }

  async getFunctionsForTest(testId: number): Promise<Function[]> {
    const result = await this.db.query<Function>(
      `SELECT f.* FROM functions f
       INNER JOIN test_function_links tfl ON f.id = tfl.function_id
       WHERE tfl.test_id = $1`,
      [testId]
    );
    return result.rows;
  }

  async clearTestLinks(testId: number): Promise<void> {
    await this.db.query(
      `DELETE FROM test_function_links WHERE test_id = $1`,
      [testId]
    );
  }

  async clearAllLinks(): Promise<void> {
    await this.db.query(`DELETE FROM test_function_links`);
  }
}

