import { withTestDb } from '../utils/test-db';
import { LearnCommand } from '../../commands/learn';
import { Database } from '../../db/database';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../utils/jest-runner');
jest.mock('../../git/diff-analyzer');

describe('LearnCommand', () => {
  const mockJestOutput = {
    success: true,
    output: JSON.stringify({
      testResults: [
        {
          name: 'test/user.service.spec.ts',
          assertionResults: [
            {
              title: 'should create a user',
              ancestors: ['UserService'],
            },
          ],
        },
      ],
    }),
  };

  const mockCoverageData = {
    'src/user.service.ts': {
      path: 'src/user.service.ts',
      statementMap: {},
      fnMap: {
        '0': {
          name: 'createUser',
          decl: { start: { line: 10, column: 0 }, end: { line: 20, column: 0 } },
          loc: { start: { line: 10, column: 0 }, end: { line: 20, column: 0 } },
        },
      },
      s: {},
      f: { '0': 1 },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should store test-to-function mappings', async () => {
    await withTestDb(async (testDb) => {
      const db = testDb.getDatabase();
      const repo = testDb.getRepository();

      const { JestRunner } = require('../../utils/jest-runner');
      const { DiffAnalyzer } = require('../../git/diff-analyzer');

      JestRunner.prototype.runTests = jest.fn().mockResolvedValue(mockJestOutput);
      JestRunner.prototype.getCoverageFilePath = jest.fn().mockReturnValue('/tmp/coverage.json');
      JestRunner.prototype.parseTestNamesFromJson = jest.fn().mockReturnValue([
        { file: 'test/user.service.spec.ts', name: 'UserService > should create a user' },
      ]);

      DiffAnalyzer.prototype.getCurrentCommitHash = jest.fn().mockResolvedValue('abc123');

      const coveragePath = '/tmp/coverage.json';
      const coverageDir = path.dirname(coveragePath);
      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }
      fs.writeFileSync(coveragePath, JSON.stringify(mockCoverageData));

      const learnCommand = new LearnCommand(db);
      await learnCommand.execute({ coveragePath });

      const tests = await repo.getAllTests();
      expect(tests.length).toBeGreaterThan(0);

      const functionsResult = await testDb.getDatabase().query('SELECT * FROM functions');
      expect(functionsResult.rows.length).toBeGreaterThan(0);

      const linksResult = await testDb.getDatabase().query('SELECT * FROM test_function_links');
      expect(linksResult.rows.length).toBeGreaterThan(0);

      if (fs.existsSync(coveragePath)) {
        fs.unlinkSync(coveragePath);
      }
    });
  });
});

