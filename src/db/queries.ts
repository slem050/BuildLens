export class SqlQueries {
  static readonly CREATE_TESTS_TABLE = `
    CREATE TABLE IF NOT EXISTS tests (
      id SERIAL PRIMARY KEY,
      file_path VARCHAR(1000) NOT NULL,
      test_name VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(file_path, test_name)
    )
  `;

  static readonly CREATE_FUNCTIONS_TABLE = `
    CREATE TABLE IF NOT EXISTS functions (
      id SERIAL PRIMARY KEY,
      file_path VARCHAR(1000) NOT NULL,
      function_name VARCHAR(500) NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      commit_hash VARCHAR(40),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(file_path, function_name, start_line, end_line)
    )
  `;

  static readonly CREATE_LINKS_TABLE = `
    CREATE TABLE IF NOT EXISTS test_function_links (
      id SERIAL PRIMARY KEY,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      function_id INTEGER NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(test_id, function_id)
    )
  `;

  static readonly CREATE_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_tests_file_path ON tests(file_path)`,
    `CREATE INDEX IF NOT EXISTS idx_functions_file_path ON functions(file_path)`,
    `CREATE INDEX IF NOT EXISTS idx_functions_commit_hash ON functions(commit_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_links_test_id ON test_function_links(test_id)`,
    `CREATE INDEX IF NOT EXISTS idx_links_function_id ON test_function_links(function_id)`,
  ];

  static readonly UPSERT_TEST = `
    INSERT INTO tests (file_path, test_name, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (file_path, test_name)
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  static readonly GET_TEST = `
    SELECT * FROM tests WHERE file_path = $1 AND test_name = $2
  `;

  static readonly GET_ALL_TESTS = `SELECT * FROM tests`;

  static readonly UPSERT_FUNCTION = `
    INSERT INTO functions (file_path, function_name, start_line, end_line, commit_hash, updated_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    ON CONFLICT (file_path, function_name, start_line, end_line)
    DO UPDATE SET commit_hash = COALESCE($5, functions.commit_hash), updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  static readonly GET_FUNCTION = `
    SELECT * FROM functions 
    WHERE file_path = $1 AND function_name = $2 AND start_line = $3 AND end_line = $4
  `;

  static readonly GET_FUNCTIONS_BY_FILE_PATH = `
    SELECT * FROM functions WHERE file_path = $1
  `;

  static readonly GET_FUNCTIONS_BY_FILE_PATHS = `
    SELECT * FROM functions WHERE file_path = ANY($1::text[])
  `;

  static readonly CREATE_LINK = `
    INSERT INTO test_function_links (test_id, function_id)
    VALUES ($1, $2)
    ON CONFLICT (test_id, function_id) DO NOTHING
    RETURNING *
  `;

  static readonly GET_TESTS_FOR_FUNCTIONS = `
    SELECT DISTINCT t.* FROM tests t
    INNER JOIN test_function_links tfl ON t.id = tfl.test_id
    WHERE tfl.function_id = ANY($1::int[])
  `;

  static readonly GET_FUNCTIONS_FOR_TEST = `
    SELECT f.* FROM functions f
    INNER JOIN test_function_links tfl ON f.id = tfl.function_id
    WHERE tfl.test_id = $1
  `;

  static readonly CLEAR_TEST_LINKS = `
    DELETE FROM test_function_links WHERE test_id = $1
  `;

  static readonly CLEAR_ALL_LINKS = `DELETE FROM test_function_links`;
}

