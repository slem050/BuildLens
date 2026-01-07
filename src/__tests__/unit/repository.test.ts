import { withTestDb } from '../utils/test-db';
import { Repository } from '../../db/repository';

describe('Repository', () => {
  describe('Test operations', () => {
    it('should upsert a test', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        const test = await repo.upsertTest('test/file.spec.ts', 'should test something');
        
        expect(test).toBeDefined();
        expect(test.file_path).toBe('test/file.spec.ts');
        expect(test.test_name).toBe('should test something');
        expect(test.id).toBeGreaterThan(0);
      });
    });

    it('should get a test by file path and name', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        await repo.upsertTest('test/file.spec.ts', 'should test something');
        const test = await repo.getTest('test/file.spec.ts', 'should test something');
        
        expect(test).toBeDefined();
        expect(test?.file_path).toBe('test/file.spec.ts');
        expect(test?.test_name).toBe('should test something');
      });
    });

    it('should return null for non-existent test', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        const test = await repo.getTest('nonexistent.spec.ts', 'nonexistent test');
        
        expect(test).toBeNull();
      });
    });

    it('should get all tests', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        await repo.upsertTest('test/file1.spec.ts', 'test 1');
        await repo.upsertTest('test/file2.spec.ts', 'test 2');
        
        const tests = await repo.getAllTests();
        
        expect(tests.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Function operations', () => {
    it('should upsert a function', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        const func = await repo.upsertFunction(
          'src/file.ts',
          'myFunction',
          10,
          20,
          'abc123'
        );
        
        expect(func).toBeDefined();
        expect(func.file_path).toBe('src/file.ts');
        expect(func.function_name).toBe('myFunction');
        expect(func.start_line).toBe(10);
        expect(func.end_line).toBe(20);
        expect(func.commit_hash).toBe('abc123');
      });
    });

    it('should get a function by file path, name, and lines', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        await repo.upsertFunction('src/file.ts', 'myFunction', 10, 20);
        const func = await repo.getFunction('src/file.ts', 'myFunction', 10, 20);
        
        expect(func).toBeDefined();
        expect(func?.file_path).toBe('src/file.ts');
        expect(func?.function_name).toBe('myFunction');
      });
    });

    it('should get functions by file path', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        await repo.upsertFunction('src/file.ts', 'func1', 10, 20);
        await repo.upsertFunction('src/file.ts', 'func2', 30, 40);
        
        const functions = await repo.getFunctionsByFilePath('src/file.ts');
        
        expect(functions.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should get functions by multiple file paths', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        await repo.upsertFunction('src/file1.ts', 'func1', 10, 20);
        await repo.upsertFunction('src/file2.ts', 'func2', 10, 20);
        
        const functions = await repo.getFunctionsByFilePaths(['src/file1.ts', 'src/file2.ts']);
        
        expect(functions.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Link operations', () => {
    it('should create a link between test and function', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        const test = await repo.upsertTest('test/file.spec.ts', 'test name');
        const func = await repo.upsertFunction('src/file.ts', 'myFunction', 10, 20);
        
        const link = await repo.createLink(test.id, func.id);
        
        expect(link).toBeDefined();
        expect(link.test_id).toBe(test.id);
        expect(link.function_id).toBe(func.id);
      });
    });

    it('should get tests for functions', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        const test1 = await repo.upsertTest('test/file1.spec.ts', 'test 1');
        const test2 = await repo.upsertTest('test/file2.spec.ts', 'test 2');
        const func = await repo.upsertFunction('src/file.ts', 'myFunction', 10, 20);
        
        await repo.createLink(test1.id, func.id);
        await repo.createLink(test2.id, func.id);
        
        const tests = await repo.getTestsForFunctions([func.id]);
        
        expect(tests.length).toBe(2);
        expect(tests.map(t => t.id)).toContain(test1.id);
        expect(tests.map(t => t.id)).toContain(test2.id);
      });
    });

    it('should get functions for a test', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        const test = await repo.upsertTest('test/file.spec.ts', 'test name');
        const func1 = await repo.upsertFunction('src/file1.ts', 'func1', 10, 20);
        const func2 = await repo.upsertFunction('src/file2.ts', 'func2', 10, 20);
        
        await repo.createLink(test.id, func1.id);
        await repo.createLink(test.id, func2.id);
        
        const functions = await repo.getFunctionsForTest(test.id);
        
        expect(functions.length).toBe(2);
        expect(functions.map(f => f.id)).toContain(func1.id);
        expect(functions.map(f => f.id)).toContain(func2.id);
      });
    });

    it('should clear test links', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        const test = await repo.upsertTest('test/file.spec.ts', 'test name');
        const func = await repo.upsertFunction('src/file.ts', 'myFunction', 10, 20);
        
        await repo.createLink(test.id, func.id);
        
        let functions = await repo.getFunctionsForTest(test.id);
        expect(functions.length).toBe(1);
        
        await repo.clearTestLinks(test.id);
        
        functions = await repo.getFunctionsForTest(test.id);
        expect(functions.length).toBe(0);
      });
    });

    it('should return empty array for no function IDs', async () => {
      await withTestDb(async (testDb) => {
        const repo = testDb.getRepository();
        
        const tests = await repo.getTestsForFunctions([]);
        
        expect(tests).toEqual([]);
      });
    });
  });
});

