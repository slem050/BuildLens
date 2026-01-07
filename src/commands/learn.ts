import { Database } from '../db/database';
import { Repository } from '../db/repository';
import { CoverageParser } from '../coverage/parser';
import { FunctionParser } from '../parser/function-parser';
import { JestRunner } from '../utils/jest-runner';
import { Logger } from '../utils/logger';
import { DiffAnalyzer } from '../git/diff-analyzer';
import * as path from 'path';
import * as fs from 'fs';

export interface LearnOptions {
  coveragePath?: string;
  testPattern?: string;
  baseBranch?: string;
}

export class LearnCommand {
  private db: Database;
  private repo: Repository;
  private coverageParser: CoverageParser;
  private functionParser: FunctionParser;
  private jestRunner: JestRunner;
  private diffAnalyzer: DiffAnalyzer;

  constructor(db: Database) {
    this.db = db;
    this.repo = new Repository(db.getAdapter());
    this.coverageParser = new CoverageParser();
    this.functionParser = new FunctionParser();
    this.jestRunner = new JestRunner();
    this.diffAnalyzer = new DiffAnalyzer();
  }

  async execute(options: LearnOptions = {}): Promise<void> {
    Logger.section('BuildLens Learn Mode');
    Logger.info('Running full test suite with coverage...');

    try {
      const jestResult = await this.jestRunner.runTests({
        coverage: true,
        jsonOutput: true,
      });

      if (!jestResult.success) {
        Logger.warn('Some tests failed, but continuing with coverage analysis...');
      }

      const coveragePath = options.coveragePath || this.jestRunner.getCoverageFilePath();
      
      if (!fs.existsSync(coveragePath)) {
        throw new Error(`Coverage file not found: ${coveragePath}`);
      }

      Logger.success(`Coverage file found: ${coveragePath}`);

      Logger.info('Parsing coverage data...');
      const coverageData = this.coverageParser.parseCoverageFile(coveragePath);
      const coveredFiles = this.coverageParser.getCoveredFiles(coverageData);
      
      Logger.info(`Found ${coveredFiles.length} covered source files`);

      let testNames: Array<{ file: string; name: string }> = [];
      try {
        const jsonMatch = jestResult.output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonOutput = JSON.parse(jsonMatch[0]);
          testNames = this.jestRunner.parseTestNamesFromJson(jsonOutput);
        } else {
          testNames = this.coverageParser.parseTestNames(jestResult.output);
        }
      } catch (error) {
        Logger.warn('Could not parse test names from Jest output, using file-based mapping');
      }

      Logger.info(`Found ${testNames.length} test cases`);

      let commitHash: string | undefined;
      try {
        commitHash = await this.diffAnalyzer.getCurrentCommitHash();
        Logger.info(`Current commit: ${commitHash.substring(0, 8)}`);
      } catch (error) {
        Logger.warn('Could not get commit hash');
      }

      Logger.info('Parsing functions from source files...');
      this.functionParser.addSourceFiles(coveredFiles);
      
      const allFunctions = new Map<string, any>();
      for (const filePath of coveredFiles) {
        const functions = this.functionParser.parseFunctions(filePath);
        for (const func of functions) {
          const key = `${func.filePath}::${func.name}::${func.startLine}::${func.endLine}`;
          allFunctions.set(key, func);
        }
      }

      Logger.info(`Found ${allFunctions.size} functions in source files`);

      Logger.info('Mapping tests to functions...');
      
      let mappingsCreated = 0;
      let linksCreated = 0;

      const testFileMap = new Map<string, Array<{ file: string; name: string }>>();
      for (const test of testNames) {
        if (!testFileMap.has(test.file)) {
          testFileMap.set(test.file, []);
        }
        testFileMap.get(test.file)!.push(test);
      }

      for (const [testFile, tests] of testFileMap.entries()) {
        const testBaseName = path.basename(testFile, path.extname(testFile));
        
        for (const [filePath, fileCoverage] of Object.entries(coverageData)) {
          if (filePath.includes('.spec.') || filePath.includes('.test.')) {
            continue;
          }

          if (fileCoverage.f && Object.keys(fileCoverage.f).length > 0) {
            const coveredFunctionIds = new Set<string>();
            
            for (const [fnId, fnCoverage] of Object.entries(fileCoverage.fnMap)) {
              const coverageCount = fileCoverage.f[fnId];
              if (coverageCount && coverageCount > 0) {
                coveredFunctionIds.add(fnId);
              }
            }

            for (const fnId of coveredFunctionIds) {
              const fnCoverage = fileCoverage.fnMap[fnId];
              const functionName = fnCoverage.name || '<anonymous>';
              const startLine = fnCoverage.decl.start.line;
              const endLine = fnCoverage.decl.end.line;

              const func = await this.repo.upsertFunction(
                this.coverageParser.normalizePath(filePath),
                functionName,
                startLine,
                endLine,
                commitHash
              );

              for (const test of tests) {
                const testRecord = await this.repo.upsertTest(
                  this.coverageParser.normalizePath(test.file),
                  test.name
                );

                await this.repo.createLink(testRecord.id, func.id);
                linksCreated++;
              }
            }
          }
        }

        mappingsCreated += tests.length;
      }

      Logger.success(`Created ${mappingsCreated} test mappings`);
      Logger.success(`Created ${linksCreated} test-function links`);

      Logger.section('Learn Mode Complete');
      Logger.info('Test-to-function mappings have been stored in the database.');

    } catch (error: any) {
      Logger.error(`Learn mode failed: ${error.message}`);
      throw error;
    }
  }
}
