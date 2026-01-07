import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';

export interface ChangedFile {
  filePath: string;
  insertions: number;
  deletions: number;
  changes: Array<{
    startLine: number;
    endLine: number;
    type: 'added' | 'deleted' | 'modified';
  }>;
}

export interface ChangedFunction {
  filePath: string;
  functionName: string;
  startLine: number;
  endLine: number;
  changeType: 'added' | 'deleted' | 'modified';
}

export class DiffAnalyzer {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Get changed files between current HEAD and base branch
   */
  async getChangedFiles(baseBranch: string = 'main'): Promise<ChangedFile[]> {
    try {
      // Get current branch
      const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      
      // Get diff summary
      const diffSummary = await this.git.diffSummary([baseBranch, currentBranch.trim()]);
      
      const changedFiles: ChangedFile[] = [];

      for (const file of diffSummary.files) {
        if (file.binary) continue;
        
        // Only track TypeScript/JavaScript files
        if (!this.isSourceFile(file.file)) continue;

        // Get detailed diff
        const diff = await this.git.diff([baseBranch, currentBranch.trim(), '--', file.file]);
        const changes = this.parseDiffLines(diff, file.file);

        changedFiles.push({
          filePath: this.normalizePath(file.file),
          insertions: file.insertions,
          deletions: file.deletions,
          changes,
        });
      }

      return changedFiles;
    } catch (error) {
      console.error(`Error analyzing git diff: ${error}`);
      throw error;
    }
  }

  /**
   * Get changed files between two commits
   */
  async getChangedFilesBetweenCommits(fromCommit: string, toCommit: string): Promise<ChangedFile[]> {
    try {
      const diffSummary = await this.git.diffSummary([fromCommit, toCommit]);
      
      const changedFiles: ChangedFile[] = [];

      for (const file of diffSummary.files) {
        if (file.binary) continue;
        if (!this.isSourceFile(file.file)) continue;

        const diff = await this.git.diff([fromCommit, toCommit, '--', file.file]);
        const changes = this.parseDiffLines(diff, file.file);

        changedFiles.push({
          filePath: this.normalizePath(file.file),
          insertions: file.insertions,
          deletions: file.deletions,
          changes,
        });
      }

      return changedFiles;
    } catch (error) {
      console.error(`Error analyzing git diff: ${error}`);
      throw error;
    }
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommitHash(): Promise<string> {
    try {
      return await this.git.revparse(['HEAD']);
    } catch (error) {
      throw new Error(`Failed to get current commit hash: ${error}`);
    }
  }

  /**
   * Parse diff output to extract line ranges
   */
  private parseDiffLines(diff: string, filePath: string): ChangedFile['changes'] {
    const changes: ChangedFile['changes'] = [];
    const lines = diff.split('\n');

    let currentStart = 0;
    let currentEnd = 0;
    let inHunk = false;
    let hunkStartLine = 0;
    let currentType: 'added' | 'deleted' | 'modified' = 'modified';

    for (const line of lines) {
      // Match hunk header: @@ -start,count +start,count @@
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        if (inHunk && currentStart > 0) {
          changes.push({
            startLine: currentStart,
            endLine: currentEnd,
            type: currentType,
          });
        }
        
        inHunk = true;
        hunkStartLine = parseInt(hunkMatch[3], 10); // New file line number
        currentStart = hunkStartLine;
        currentEnd = hunkStartLine;
        currentType = 'modified';
      } else if (inHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          // Added line
          if (currentType === 'deleted') {
            currentType = 'modified';
          } else if (currentType !== 'added') {
            currentType = 'added';
            currentStart = hunkStartLine;
          }
          currentEnd = hunkStartLine;
          hunkStartLine++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          // Deleted line
          if (currentType === 'added') {
            currentType = 'modified';
          } else if (currentType !== 'deleted') {
            currentType = 'deleted';
            currentStart = hunkStartLine;
          }
          currentEnd = hunkStartLine;
        } else if (line.startsWith(' ')) {
          // Context line - end current change range
          if (currentStart > 0 && currentEnd >= currentStart) {
            changes.push({
              startLine: currentStart,
              endLine: currentEnd,
              type: currentType,
            });
            currentStart = 0;
            currentEnd = 0;
          }
          hunkStartLine++;
        }
      }
    }

    // Add final change if in hunk
    if (inHunk && currentStart > 0 && currentEnd >= currentStart) {
      changes.push({
        startLine: currentStart,
        endLine: currentEnd,
        type: currentType,
      });
    }

    return changes;
  }

  /**
   * Check if file is a source file we care about
   */
  private isSourceFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
  }

  /**
   * Normalize file paths
   */
  private normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/^\.\//, '');
  }
}

