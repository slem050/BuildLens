import * as core from '@actions/core';
import * as github from '@actions/github';
import { Database } from './db/database';
import { LearnCommand } from './commands/learn';
import { SelectCommand } from './commands/select';
import { Logger } from './utils/logger';

async function run(): Promise<void> {
  try {
    const mode = core.getInput('mode', { required: true });
    const databaseUrl = core.getInput('database-url') || process.env.DATABASE_URL;
    const baseRef = core.getInput('base-ref') || process.env.GITHUB_BASE_REF || 'main';
    const coveragePath = core.getInput('coverage-path');
    const jestArgs = core.getInput('jest-args');

    if (!databaseUrl) {
      const defaultUrl = 'postgresql://postgres:postgres@localhost:5432/buildlens';
      core.info(`No database URL provided, using default: ${defaultUrl}`);
      process.env.DATABASE_URL = defaultUrl;
    } else {
      process.env.DATABASE_URL = databaseUrl;
    }

    if (process.env.GITHUB_BASE_REF) {
      process.env.GITHUB_BASE_REF = baseRef;
    }
    if (process.env.GITHUB_SHA) {
      process.env.GITHUB_SHA = github.context.sha;
    }

    const db = new Database({
      connectionString: process.env.DATABASE_URL,
    });

    await db.initializeSchema();

    if (mode === 'learn') {
      core.info('Running BuildLens in LEARN mode...');
      const learnCommand = new LearnCommand(db);
      await learnCommand.execute({ coveragePath: coveragePath || undefined });
      core.setOutput('coverage-file', coveragePath || 'coverage/coverage-final.json');
      core.info('✓ Learn mode completed successfully');
    } else if (mode === 'select') {
      core.info('Running BuildLens in SELECT mode...');
      const selectCommand = new SelectCommand(db);
      await selectCommand.execute({
        baseBranch: baseRef,
        dryRun: false,
      });
      
      core.setOutput('tests-selected', '0');
      core.setOutput('tests-run', '0');
      core.info('✓ Select mode completed successfully');
    } else {
      core.setFailed(`Invalid mode: ${mode}. Must be 'learn' or 'select'`);
      return;
    }

    await db.close();
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

run();

