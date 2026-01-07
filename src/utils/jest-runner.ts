import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface JestRunOptions {
  testFiles?: string[];
  coverage?: boolean;
  coveragePath?: string;
  jsonOutput?: boolean;
}

export class JestRunner {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Run Jest with specified options
   */
  async runTests(options: JestRunOptions = {}): Promise<{ success: boolean; output: string }> {
    const args: string[] = [];

    if (options.coverage) {
      args.push('--coverage');
      args.push('--coverageReporters=json');
      args.push('--coverageReporters=text');
      
      if (options.coveragePath) {
        // Jest will write to coverage/coverage-final.json by default
        // We'll handle the path separately
      }
    }

    if (options.jsonOutput) {
      args.push('--json');
    }

    if (options.testFiles && options.testFiles.length > 0) {
      // Filter to only test files
      const validTestFiles = options.testFiles.filter(file => 
        file.includes('.spec.') || file.includes('.test.')
      );
      args.push(...validTestFiles);
    }

    try {
      const command = `npx jest ${args.join(' ')}`;
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      return { success: true, output };
    } catch (error: any) {
      // Jest returns non-zero exit code on test failures, but we still want the output
      const output = error.stdout?.toString() || error.message || '';
      return { success: false, output };
    }
  }

  /**
   * Get coverage file path
   */
  getCoverageFilePath(): string {
    const coveragePath = path.join(this.projectRoot, 'coverage', 'coverage-final.json');
    return coveragePath;
  }

  /**
   * Check if coverage file exists
   */
  coverageFileExists(): boolean {
    return fs.existsSync(this.getCoverageFilePath());
  }

  /**
   * Get test files from Jest output
   */
  parseTestFilesFromOutput(output: string): string[] {
    const testFiles: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match test file patterns
      const match = line.match(/(\S+\.(spec|test)\.\w+)/);
      if (match) {
        const testFile = match[1];
        if (!testFiles.includes(testFile)) {
          testFiles.push(testFile);
        }
      }
    }

    return testFiles;
  }

  /**
   * Parse test names from Jest JSON output
   */
  parseTestNamesFromJson(jsonOutput: any): Array<{ file: string; name: string }> {
    const tests: Array<{ file: string; name: string }> = [];

    if (jsonOutput.testResults) {
      for (const result of jsonOutput.testResults) {
        const file = result.name;
        
        if (result.assertionResults) {
          for (const assertion of result.assertionResults) {
            const fullName = assertion.ancestors
              ? [...assertion.ancestors, assertion.title].join(' > ')
              : assertion.title;
            
            tests.push({
              file,
              name: fullName,
            });
          }
        }
      }
    }

    return tests;
  }
}

