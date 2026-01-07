import { DatabaseAdapter } from './interface';
import { SqlQueries } from './queries';

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
  constructor(private db: DatabaseAdapter) {}

  async upsertTest(filePath: string, testName: string): Promise<Test> {
    const result = await this.db.query<Test>(
      SqlQueries.UPSERT_TEST,
      [filePath, testName]
    );
    return result.rows[0];
  }

  async getTest(filePath: string, testName: string): Promise<Test | null> {
    const result = await this.db.query<Test>(
      SqlQueries.GET_TEST,
      [filePath, testName]
    );
    return result.rows[0] || null;
  }

  async getAllTests(): Promise<Test[]> {
    const result = await this.db.query<Test>(SqlQueries.GET_ALL_TESTS);
    return result.rows;
  }

  async upsertFunction(
    filePath: string,
    functionName: string,
    startLine: number,
    endLine: number,
    commitHash?: string
  ): Promise<Function> {
    const result = await this.db.query<Function>(
      SqlQueries.UPSERT_FUNCTION,
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
      SqlQueries.GET_FUNCTION,
      [filePath, functionName, startLine, endLine]
    );
    return result.rows[0] || null;
  }

  async getFunctionsByFilePath(filePath: string): Promise<Function[]> {
    const result = await this.db.query<Function>(
      SqlQueries.GET_FUNCTIONS_BY_FILE_PATH,
      [filePath]
    );
    return result.rows;
  }

  async getFunctionsByFilePaths(filePaths: string[]): Promise<Function[]> {
    if (filePaths.length === 0) return [];
    const result = await this.db.query<Function>(
      SqlQueries.GET_FUNCTIONS_BY_FILE_PATHS,
      [filePaths]
    );
    return result.rows;
  }

  async createLink(testId: number, functionId: number): Promise<TestFunctionLink> {
    const result = await this.db.query<TestFunctionLink>(
      SqlQueries.CREATE_LINK,
      [testId, functionId]
    );
    return result.rows[0];
  }

  async getTestsForFunctions(functionIds: number[]): Promise<Test[]> {
    if (functionIds.length === 0) return [];
    const result = await this.db.query<Test>(
      SqlQueries.GET_TESTS_FOR_FUNCTIONS,
      [functionIds]
    );
    return result.rows;
  }

  async getFunctionsForTest(testId: number): Promise<Function[]> {
    const result = await this.db.query<Function>(
      SqlQueries.GET_FUNCTIONS_FOR_TEST,
      [testId]
    );
    return result.rows;
  }

  async clearTestLinks(testId: number): Promise<void> {
    await this.db.query(SqlQueries.CLEAR_TEST_LINKS, [testId]);
  }

  async clearAllLinks(): Promise<void> {
    await this.db.query(SqlQueries.CLEAR_ALL_LINKS);
  }
}
