#!/usr/bin/env node

import { Command } from 'commander';
import { Database, DatabaseConfig } from './db/database';
import { LearnCommand } from './commands/learn';
import { SelectCommand } from './commands/select';
import { Logger } from './utils/logger';

const program = new Command();

program
  .name('buildlens')
  .description('Function-Level Test Impact Analysis for Jest')
  .version('1.0.0');

// Helper to get database connection
function getDatabase(): Database {
  const config: DatabaseConfig = {};

  // Try connection string first
  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
  } else {
    // Fall back to individual config
    config.host = process.env.DB_HOST;
    config.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined;
    config.database = process.env.DB_NAME;
    config.user = process.env.DB_USER;
    config.password = process.env.DB_PASSWORD;
  }

  return new Database(config);
}

// Learn command
program
  .command('learn')
  .description('Run full test suite, parse coverage, and store test-to-function mappings')
  .option('-c, --coverage-path <path>', 'Path to coverage JSON file')
  .option('-b, --base-branch <branch>', 'Base branch for comparison', 'main')
  .action(async (options) => {
    try {
      const db = getDatabase();
      
      // Initialize schema if needed
      Logger.info('Initializing database schema...');
      await db.initializeSchema();
      
      const learnCommand = new LearnCommand(db);
      await learnCommand.execute({
        coveragePath: options.coveragePath,
        baseBranch: options.baseBranch,
      });
      
      await db.close();
      process.exit(0);
    } catch (error: any) {
      Logger.error(`Failed: ${error.message}`);
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Select command
program
  .command('select')
  .description('Detect changed functions and run only impacted tests')
  .option('-b, --base-branch <branch>', 'Base branch for comparison', 'main')
  .option('--no-fallback', 'Do not fallback to all tests if no matches found')
  .option('--dry-run', 'Show what tests would be run without executing them')
  .action(async (options) => {
    try {
      const db = getDatabase();
      
      // Initialize schema if needed
      Logger.info('Initializing database schema...');
      await db.initializeSchema();
      
      const selectCommand = new SelectCommand(db);
      await selectCommand.execute({
        baseBranch: options.baseBranch,
        fallbackToAll: options.fallback !== false,
        dryRun: options.dryRun || false,
      });
      
      await db.close();
      process.exit(0);
    } catch (error: any) {
      Logger.error(`Failed: ${error.message}`);
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Initialize command (optional helper)
program
  .command('init')
  .description('Initialize the database schema')
  .action(async () => {
    try {
      const db = getDatabase();
      Logger.info('Initializing database schema...');
      await db.initializeSchema();
      Logger.success('Database schema initialized successfully!');
      await db.close();
      process.exit(0);
    } catch (error: any) {
      Logger.error(`Failed: ${error.message}`);
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

