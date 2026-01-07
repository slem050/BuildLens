-- BuildLens Database Schema

-- Tests table: stores test identifiers
CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    file_path VARCHAR(1000) NOT NULL,
    test_name VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_path, test_name)
);

-- Functions table: stores function identifiers
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
);

-- Test-Function links: maps tests to functions they execute
CREATE TABLE IF NOT EXISTS test_function_links (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    function_id INTEGER NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_id, function_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tests_file_path ON tests(file_path);
CREATE INDEX IF NOT EXISTS idx_functions_file_path ON functions(file_path);
CREATE INDEX IF NOT EXISTS idx_functions_commit_hash ON functions(commit_hash);
CREATE INDEX IF NOT EXISTS idx_links_test_id ON test_function_links(test_id);
CREATE INDEX IF NOT EXISTS idx_links_function_id ON test_function_links(function_id);

