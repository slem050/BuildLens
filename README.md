# BuildLens
BuildLens is a Test Impact Analysis (TIA) engine for Node.js / NestJS projects using Jest. It tracks which tests execute which functions using coverage data, stores this mapping in PostgreSQL, and on each build or commit it runs only the tests affected by code changes — dramatically reducing execution time without compromising safety.
