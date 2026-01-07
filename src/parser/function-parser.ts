import { Project, SourceFile, FunctionDeclaration, MethodDeclaration, ArrowFunction, FunctionExpression } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

export interface ParsedFunction {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  isAsync: boolean;
}

export class FunctionParser {
  private project: Project;

  constructor(tsConfigPath?: string) {
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: false,
    });
  }

  /**
   * Add source files to the project
   */
  addSourceFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      if (fs.existsSync(filePath) && (filePath.endsWith('.ts') || filePath.endsWith('.tsx'))) {
        try {
          this.project.addSourceFileAtPath(filePath);
        } catch (error) {
          // Skip files that can't be parsed
          console.warn(`Warning: Could not parse ${filePath}: ${error}`);
        }
      }
    }
  }

  /**
   * Parse functions from a source file
   */
  parseFunctions(filePath: string): ParsedFunction[] {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) {
      return [];
    }

    const functions: ParsedFunction[] = [];

    // Parse function declarations
    sourceFile.getFunctions().forEach((func) => {
      functions.push(this.extractFunctionInfo(func, filePath));
    });

    // Parse method declarations (class methods)
    sourceFile.getClasses().forEach((classDecl) => {
      classDecl.getMethods().forEach((method) => {
        functions.push(this.extractMethodInfo(method, filePath));
      });
    });

    // Parse arrow functions assigned to variables
    sourceFile.getVariableDeclarations().forEach((varDecl) => {
      const initializer = varDecl.getInitializer();
      if (initializer) {
        if (initializer.getKindName() === 'ArrowFunction') {
          const arrowFunc = initializer as ArrowFunction;
          const name = varDecl.getName();
          const startLine = varDecl.getStartLineNumber();
          const endLine = varDecl.getEndLineNumber();
          
          functions.push({
            name: name || '<anonymous>',
            filePath: this.normalizePath(filePath),
            startLine,
            endLine,
            isExported: varDecl.isExported(),
            isAsync: arrowFunc.isAsync(),
          });
        } else if (initializer.getKindName() === 'FunctionExpression') {
          const funcExpr = initializer as FunctionExpression;
          const name = varDecl.getName();
          const startLine = varDecl.getStartLineNumber();
          const endLine = varDecl.getEndLineNumber();
          
          functions.push({
            name: name || '<anonymous>',
            filePath: this.normalizePath(filePath),
            startLine,
            endLine,
            isExported: varDecl.isExported(),
            isAsync: funcExpr.isAsync(),
          });
        }
      }
    });

    return functions;
  }

  /**
   * Extract function information from a function declaration
   */
  private extractFunctionInfo(func: FunctionDeclaration, filePath: string): ParsedFunction {
    const name = func.getName() || '<anonymous>';
    const startLine = func.getStartLineNumber();
    const endLine = func.getEndLineNumber();

    return {
      name,
      filePath: this.normalizePath(filePath),
      startLine,
      endLine,
      isExported: func.isExported(),
      isAsync: func.isAsync(),
    };
  }

  /**
   * Extract method information from a method declaration
   */
  private extractMethodInfo(method: MethodDeclaration, filePath: string): ParsedFunction {
    const className = method.getParent()?.getKindName() === 'ClassDeclaration'
      ? (method.getParent() as any).getName() || 'Class'
      : 'Class';
    const methodName = method.getName();
    const name = `${className}.${methodName}`;
    const startLine = method.getStartLineNumber();
    const endLine = method.getEndLineNumber();

    return {
      name,
      filePath: this.normalizePath(filePath),
      startLine,
      endLine,
      isExported: method.getParent()?.getKindName() === 'ClassDeclaration'
        ? (method.getParent() as any).isExported() || false
        : false,
      isAsync: method.isAsync(),
    };
  }

  /**
   * Get functions that overlap with a line range (for git diff analysis)
   */
  getFunctionsInRange(filePath: string, startLine: number, endLine: number): ParsedFunction[] {
    const allFunctions = this.parseFunctions(filePath);
    return allFunctions.filter((func) => {
      // Check if function overlaps with the changed range
      return (
        (func.startLine <= endLine && func.endLine >= startLine) ||
        (startLine <= func.endLine && endLine >= func.startLine)
      );
    });
  }

  /**
   * Normalize file paths
   */
  private normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/^\.\//, '');
  }
}

