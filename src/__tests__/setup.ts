import { TestDatabase } from './utils/test-db';

beforeAll(async () => {
  try {
    const testDb = new TestDatabase();
    await testDb.setup();
  } catch (error) {
    console.warn('Test database setup failed, tests may fail:', error);
    console.warn('Make sure PostgreSQL is running or Docker is available');
  }
});

afterAll(async () => {
  try {
    const testDb = new TestDatabase();
    await testDb.teardown();
  } catch (error) {
    console.warn('Test database teardown failed:', error);
  }
});

