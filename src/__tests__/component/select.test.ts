import { withTestDb } from '../utils/test-db';
import { SelectCommand } from '../../commands/select';
import { Database } from '../../db/database';
import { Repository } from '../../db/repository';

jest.mock('../../utils/jest-runner');
jest.mock('../../git/diff-analyzer');
jest.mock('../../parser/function-parser');

describe('SelectCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should find and return impacted tests', async () => {
    await withTestDb(async (testDb) => {
      const db = testDb.getDatabase();
      const repo = testDb.getRepository();

      const test = await repo.upsertTest('test/user.service.spec.ts', 'should create a user');
      const func = await repo.upsertFunction('src/user.service.ts', 'createUser', 10, 20);
      await repo.createLink(test.id, func.id);

      const { DiffAnalyzer } = require('../../git/diff-analyzer');
      const { FunctionParser } = require('../../parser/function-parser');
      const { JestRunner } = require('../../utils/jest-runner');

      DiffAnalyzer.prototype.getChangedFiles = jest.fn().mockResolvedValue([
        {
          filePath: 'src/user.service.ts',
          insertions: 5,
          deletions: 2,
          changes: [{ startLine: 10, endLine: 20, type: 'modified' as const }],
        },
      ]);

      FunctionParser.prototype.addSourceFiles = jest.fn();
      FunctionParser.prototype.parseFunctions = jest.fn().mockReturnValue([
        {
          name: 'createUser',
          filePath: 'src/user.service.ts',
          startLine: 10,
          endLine: 20,
        },
      ]);

      JestRunner.prototype.runTests = jest.fn().mockResolvedValue({ success: true, output: '' });

      const selectCommand = new SelectCommand(db);
      await selectCommand.execute({ baseBranch: 'main', dryRun: true });

      expect(DiffAnalyzer.prototype.getChangedFiles).toHaveBeenCalled();
      expect(FunctionParser.prototype.parseFunctions).toHaveBeenCalled();
    });
  });

  it('should fallback to all tests when no matches found', async () => {
    await withTestDb(async (testDb) => {
      const db = testDb.getDatabase();

      const { DiffAnalyzer } = require('../../git/diff-analyzer');
      const { JestRunner } = require('../../utils/jest-runner');

      DiffAnalyzer.prototype.getChangedFiles = jest.fn().mockResolvedValue([
        {
          filePath: 'src/new-file.ts',
          insertions: 5,
          deletions: 2,
          changes: [{ startLine: 10, endLine: 20, type: 'modified' as const }],
        },
      ]);

      const { FunctionParser } = require('../../parser/function-parser');
      FunctionParser.prototype.addSourceFiles = jest.fn();
      FunctionParser.prototype.parseFunctions = jest.fn().mockReturnValue([
        {
          name: 'newFunction',
          filePath: 'src/new-file.ts',
          startLine: 10,
          endLine: 20,
        },
      ]);

      JestRunner.prototype.runTests = jest.fn().mockResolvedValue({ success: true, output: '' });

      const selectCommand = new SelectCommand(db);
      await selectCommand.execute({ baseBranch: 'main', fallbackToAll: true });

      expect(JestRunner.prototype.runTests).toHaveBeenCalled();
    });
  });

  it('should handle empty changed files', async () => {
    await withTestDb(async (testDb) => {
      const db = testDb.getDatabase();

      const { DiffAnalyzer } = require('../../git/diff-analyzer');
      const { JestRunner } = require('../../utils/jest-runner');

      DiffAnalyzer.prototype.getChangedFiles = jest.fn().mockResolvedValue([]);
      JestRunner.prototype.runTests = jest.fn().mockResolvedValue({ success: true, output: '' });

      const selectCommand = new SelectCommand(db);
      await selectCommand.execute({ baseBranch: 'main' });

      expect(JestRunner.prototype.runTests).toHaveBeenCalled();
    });
  });
});

