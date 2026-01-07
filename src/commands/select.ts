import { Database } from '../db/database';
import { Repository } from '../db/repository';
import { FunctionParser } from '../parser/function-parser';
import { DiffAnalyzer } from '../git/diff-analyzer';
import { JestRunner } from '../utils/jest-runner';
import { Logger } from '../utils/logger';

export interface SelectOptions {
  baseBranch?: string;
  fallbackToAll?: boolean;
  dryRun?: boolean;
}

export class SelectCommand {
  private db: Database;
  private repo: Repository;
  private functionParser: FunctionParser;
  private diffAnalyzer: DiffAnalyzer;
  private jestRunner: JestRunner;

  constructor(db: Database) {
    this.db = db;
    this.repo = new Repository(db.getAdapter());
    this.functionParser = new FunctionParser();
    this.diffAnalyzer = new DiffAnalyzer();
    this.jestRunner = new JestRunner();
  }

  async execute(options: SelectOptions = {}): Promise<void> {
    Logger.section('BuildLens Select Mode');
    
    const baseBranch = options.baseBranch || 
                       process.env.GITHUB_BASE_REF || 
                       process.env.BASE_BRANCH || 
                       'main';
    Logger.info(`Comparing against base branch: ${baseBranch}`);

    try {
      Logger.info('Analyzing git diff...');
      const changedFiles = await this.diffAnalyzer.getChangedFiles(baseBranch);
      
      if (changedFiles.length === 0) {
        Logger.info('No files changed. Running all tests for safety.');
        if (!options.dryRun) {
          await this.runAllTests();
        }
        return;
      }

      Logger.info(`Found ${changedFiles.length} changed files`);

      Logger.info('Detecting changed functions...');
      const changedFunctions: Array<{
        filePath: string;
        functionName: string;
        startLine: number;
        endLine: number;
      }> = [];

      for (const changedFile of changedFiles) {
        Logger.debug(`Analyzing ${changedFile.filePath}`);
        
        this.functionParser.addSourceFiles([changedFile.filePath]);
        const allFunctions = this.functionParser.parseFunctions(changedFile.filePath);

        const fileOverlappingFunctions = new Set<string>();

        for (const change of changedFile.changes) {
          const overlappingFunctions = allFunctions.filter((func) => {
            return (
              (func.startLine <= change.endLine && func.endLine >= change.startLine) ||
              (change.startLine <= func.endLine && change.endLine >= func.startLine)
            );
          });

          for (const func of overlappingFunctions) {
            const key = `${func.filePath}::${func.name}::${func.startLine}::${func.endLine}`;
            fileOverlappingFunctions.add(key);
            
            if (!changedFunctions.find(f => 
              f.filePath === func.filePath &&
              f.functionName === func.name &&
              f.startLine === func.startLine &&
              f.endLine === func.endLine
            )) {
              changedFunctions.push({
                filePath: func.filePath,
                functionName: func.name,
                startLine: func.startLine,
                endLine: func.endLine,
              });
            }
          }
        }

        if (fileOverlappingFunctions.size === 0 && allFunctions.length > 0) {
          Logger.debug(`No specific functions matched, including all functions in ${changedFile.filePath}`);
          for (const func of allFunctions) {
            if (!changedFunctions.find(f => 
              f.filePath === func.filePath &&
              f.functionName === func.name &&
              f.startLine === func.startLine &&
              f.endLine === func.endLine
            )) {
              changedFunctions.push({
                filePath: func.filePath,
                functionName: func.name,
                startLine: func.startLine,
                endLine: func.endLine,
              });
            }
          }
        }
      }

      Logger.info(`Found ${changedFunctions.length} changed functions`);

      for (const func of changedFunctions) {
        Logger.debug(`  - ${func.filePath}::${func.functionName} (${func.startLine}-${func.endLine})`);
      }

      Logger.info('Querying database for impacted tests...');
      
      const functionIds: number[] = [];
      for (const func of changedFunctions) {
        const funcRecord = await this.repo.getFunction(
          func.filePath,
          func.functionName,
          func.startLine,
          func.endLine
        );
        
        if (funcRecord) {
          functionIds.push(funcRecord.id);
        } else {
          Logger.debug(`Function not found in DB: ${func.filePath}::${func.functionName}`);
        }
      }

      const filePaths = [...new Set(changedFunctions.map(f => f.filePath))];
      const functionsByFile = await this.repo.getFunctionsByFilePaths(filePaths);
      for (const funcRecord of functionsByFile) {
        if (!functionIds.includes(funcRecord.id)) {
          functionIds.push(funcRecord.id);
        }
      }

      Logger.info(`Found ${functionIds.length} functions in database`);

      const impactedTests = await this.repo.getTestsForFunctions(functionIds);

      Logger.info(`Found ${impactedTests.length} impacted tests`);

      Logger.section('Test Selection Summary');
      Logger.info(`Changed files: ${changedFiles.length}`);
      Logger.info(`Changed functions: ${changedFunctions.length}`);
      Logger.info(`Impacted tests: ${impactedTests.length}`);

      if (impactedTests.length === 0) {
        Logger.warn('No tests found in database for changed functions.');
        
        if (options.fallbackToAll !== false) {
          Logger.info('Falling back to running all tests for safety.');
          if (!options.dryRun) {
            await this.runAllTests();
          }
        } else {
          Logger.info('Dry run: Would run all tests (fallback mode)');
        }
        return;
      }

      Logger.section('Selected Tests');
      const testFiles = new Set<string>();
      for (const test of impactedTests) {
        Logger.info(`  - ${test.file_path}::${test.test_name}`);
        testFiles.add(test.file_path);
      }

      if (options.dryRun) {
        Logger.section('Dry Run Complete');
        Logger.info(`Would run ${impactedTests.length} tests from ${testFiles.size} test files`);
      } else {
        Logger.section('Running Selected Tests');
        const testFileArray = Array.from(testFiles);
        const result = await this.jestRunner.runTests({
          testFiles: testFileArray,
        });

        if (result.success) {
          Logger.success('All selected tests passed!');
        } else {
          Logger.warn('Some tests failed. Review the output above.');
        }
      }

    } catch (error: any) {
      Logger.error(`Select mode failed: ${error.message}`);
      Logger.warn('Falling back to running all tests for safety.');
      
      if (!options.dryRun) {
        await this.runAllTests();
      }
      throw error;
    }
  }

  private async runAllTests(): Promise<void> {
    Logger.info('Running full test suite...');
    const result = await this.jestRunner.runTests({});
    
    if (result.success) {
      Logger.success('All tests passed!');
    } else {
      Logger.warn('Some tests failed. Review the output above.');
    }
  }
}
