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

  async getChangedFiles(baseBranch: string = 'main'): Promise<ChangedFile[]> {
    try {
      await this.ensureBaseBranchFetched(baseBranch);

      const currentRef = await this.getCurrentRef();
      const baseRef = await this.resolveBaseRef(baseBranch);

      const diffSummary = await this.git.diffSummary([baseRef, currentRef]);
      
      const changedFiles: ChangedFile[] = [];

      for (const file of diffSummary.files) {
        if (file.binary) continue;
        if (!this.isSourceFile(file.file)) continue;

        const diff = await this.git.diff([baseRef, currentRef, '--', file.file]);
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

  async getCurrentCommitHash(): Promise<string> {
    try {
      return await this.git.revparse(['HEAD']);
    } catch (error) {
      throw new Error(`Failed to get current commit hash: ${error}`);
    }
  }

  private async getCurrentRef(): Promise<string> {
    if (process.env.GITHUB_SHA) {
      return process.env.GITHUB_SHA;
    }

    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      if (branch && branch !== 'HEAD') {
        return branch.trim();
      }
    } catch (error) {
    }

    try {
      return await this.git.revparse(['HEAD']);
    } catch (error) {
      throw new Error('Could not determine current git reference');
    }
  }

  private async resolveBaseRef(baseBranch: string): Promise<string> {
    if (process.env.GITHUB_BASE_REF) {
      return process.env.GITHUB_BASE_REF;
    }

    try {
      const branches = await this.git.branchLocal();
      if (branches.all.includes(baseBranch) || branches.all.includes(`origin/${baseBranch}`)) {
        return baseBranch;
      }
    } catch (error) {
    }

    try {
      const remoteBranches = await this.git.branch(['-r']);
      if (remoteBranches.all.includes(`origin/${baseBranch}`)) {
        return `origin/${baseBranch}`;
      }
    } catch (error) {
    }

    return baseBranch;
  }

  private async ensureBaseBranchFetched(baseBranch: string): Promise<void> {
    if (process.env.GITHUB_ACTIONS === 'true') {
      try {
        await this.git.fetch(['origin', baseBranch]);
      } catch (error) {
      }
    }
  }

  private parseDiffLines(diff: string, filePath: string): ChangedFile['changes'] {
    const changes: ChangedFile['changes'] = [];
    const lines = diff.split('\n');

    let currentStart = 0;
    let currentEnd = 0;
    let inHunk = false;
    let hunkStartLine = 0;
    let currentType: 'added' | 'deleted' | 'modified' = 'modified';

    for (const line of lines) {
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
        hunkStartLine = parseInt(hunkMatch[3], 10);
        currentStart = hunkStartLine;
        currentEnd = hunkStartLine;
        currentType = 'modified';
      } else if (inHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          if (currentType === 'deleted') {
            currentType = 'modified';
          } else if (currentType !== 'added') {
            currentType = 'added';
            currentStart = hunkStartLine;
          }
          currentEnd = hunkStartLine;
          hunkStartLine++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          if (currentType === 'added') {
            currentType = 'modified';
          } else if (currentType !== 'deleted') {
            currentType = 'deleted';
            currentStart = hunkStartLine;
          }
          currentEnd = hunkStartLine;
        } else if (line.startsWith(' ')) {
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

    if (inHunk && currentStart > 0 && currentEnd >= currentStart) {
      changes.push({
        startLine: currentStart,
        endLine: currentEnd,
        type: currentType,
      });
    }

    return changes;
  }

  private isSourceFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
  }

  private normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/^\.\//, '');
  }
}
