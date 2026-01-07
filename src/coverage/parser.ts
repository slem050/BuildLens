import * as fs from 'fs';
import * as path from 'path';

export interface CoverageStatement {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface CoverageFunction {
  name: string;
  decl: { start: { line: number; column: number }; end: { line: number; column: number } };
  loc: { start: { line: number; column: number }; end: { line: number; column: number } };
}

export interface FileCoverage {
  path: string;
  statementMap: Record<string, CoverageStatement>;
  fnMap: Record<string, CoverageFunction>;
  s: Record<string, number>; // statement coverage counts
  f: Record<string, number>; // function coverage counts
  b?: Record<string, number[]>; // branch coverage counts
}

export interface CoverageData {
  [filePath: string]: FileCoverage;
}

export interface TestCoverageMapping {
  testFile: string;
  testName: string;
  coveredFunctions: Array<{
    filePath: string;
    functionName: string;
    startLine: number;
    endLine: number;
  }>;
}

export class CoverageParser {
  /**
   * Parse Jest coverage JSON file
   */
  parseCoverageFile(coveragePath: string): CoverageData {
    if (!fs.existsSync(coveragePath)) {
      throw new Error(`Coverage file not found: ${coveragePath}`);
    }

    const content = fs.readFileSync(coveragePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Extract function mappings from coverage data
   * Note: Jest coverage doesn't directly map tests to functions,
   * so we need to infer from test file patterns and coverage
   */
  extractFunctionMappings(
    coverageData: CoverageData,
    testFiles: string[]
  ): Map<string, TestCoverageMapping> {
    const mappings = new Map<string, TestCoverageMapping>();

    // Group coverage by test file
    for (const testFile of testFiles) {
      const testBaseName = path.basename(testFile, path.extname(testFile));
      
      // Find source files that might be tested by this test file
      for (const [filePath, fileCoverage] of Object.entries(coverageData)) {
        // Skip test files themselves
        if (filePath.includes('.spec.') || filePath.includes('.test.')) {
          continue;
        }

        // Check if this file has coverage (was executed)
        if (fileCoverage.f && Object.keys(fileCoverage.f).length > 0) {
          const coveredFunctions: TestCoverageMapping['coveredFunctions'] = [];

          // Extract functions that were covered
          for (const [fnId, fnCoverage] of Object.entries(fileCoverage.fnMap)) {
            const coverageCount = fileCoverage.f[fnId];
            
            // If function was executed (coverage count > 0)
            if (coverageCount && coverageCount > 0) {
              const functionName = fnCoverage.name || '<anonymous>';
              const startLine = fnCoverage.decl.start.line;
              const endLine = fnCoverage.decl.end.line;

              coveredFunctions.push({
                filePath: this.normalizePath(filePath),
                functionName,
                startLine,
                endLine,
              });
            }
          }

          if (coveredFunctions.length > 0) {
            // Create a mapping key from test file
            // Note: We'll need to parse actual test names from Jest output separately
            const mappingKey = `${testFile}::*`;
            if (!mappings.has(mappingKey)) {
              mappings.set(mappingKey, {
                testFile,
                testName: '*', // Will be refined when parsing test output
                coveredFunctions,
              });
            } else {
              // Merge functions
              const existing = mappings.get(mappingKey)!;
              existing.coveredFunctions.push(...coveredFunctions);
            }
          }
        }
      }
    }

    return mappings;
  }

  /**
   * Parse Jest test output to extract test names
   * This is a simplified parser - in practice, you might want to use Jest's JSON reporter
   */
  parseTestNames(testOutput: string): Array<{ file: string; name: string }> {
    const tests: Array<{ file: string; name: string }> = [];
    const lines = testOutput.split('\n');

    let currentFile = '';
    let currentDescribe = '';

    for (const line of lines) {
      // Match test file
      const fileMatch = line.match(/Test Suites:.*?(\S+\.(spec|test)\.\w+)/);
      if (fileMatch) {
        currentFile = fileMatch[1];
      }

      // Match describe blocks
      const describeMatch = line.match(/describe\(['"](.+?)['"]/);
      if (describeMatch) {
        currentDescribe = describeMatch[1];
      }

      // Match it/test blocks
      const itMatch = line.match(/(?:it|test)\(['"](.+?)['"]/);
      if (itMatch && currentFile) {
        const testName = currentDescribe 
          ? `${currentDescribe} > ${itMatch[1]}`
          : itMatch[1];
        tests.push({ file: currentFile, name: testName });
      }
    }

    return tests;
  }

  /**
   * Normalize file paths for consistent storage
   */
  normalizePath(filePath: string): string {
    // Remove leading ./ and normalize separators
    return path.normalize(filePath).replace(/^\.\//, '');
  }

  /**
   * Get all covered files from coverage data
   */
  getCoveredFiles(coverageData: CoverageData): string[] {
    return Object.keys(coverageData).filter(
      (filePath) => !filePath.includes('.spec.') && !filePath.includes('.test.')
    );
  }
}

