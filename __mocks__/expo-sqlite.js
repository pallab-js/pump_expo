/**
 * Test mock for `expo-sqlite` backed by sql.js (SQLite compiled to WebAssembly).
 *
 * Why sql.js and not a native engine: native SQLite addons (e.g. better-sqlite3)
 * segfault under some CI Node/glibc combinations. sql.js is pure WASM — identical
 * behavior on every machine and CI runner, with no native build step.
 *
 * Implements the subset of the async API the app uses:
 *   openDatabaseAsync, execAsync, runAsync, getAllAsync, getFirstAsync,
 *   withTransactionAsync, prepareAsync (+ statement.executeAsync), closeAsync.
 *
 * NOTE: sql.js initialization is async, so this module exposes async open
 * functions; `openDatabaseSync` throws (unused by the app at test time).
 */
const path = require('path');
const initSqlJs = require('sql.js');

let sqlModulePromise = null;
function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({
      locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
    });
  }
  return sqlModulePromise;
}

function normalizeParams(params) {
  if (params === undefined || params === null) return [];
  return Array.isArray(params) ? params : [params];
}

function isSelect(sql) {
  return /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql);
}

class SQLiteStatement {
  constructor(rawDb, source) {
    this._rawDb = rawDb;
    this._source = source;
  }

  async executeAsync(params) {
    const p = normalizeParams(params);
    if (isSelect(this._source)) {
      const stmt = this._rawDb.prepare(this._source);
      if (p.length) stmt.bind(p);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return {
        getAllAsync: async () => rows,
        getFirstAsync: async () => (rows.length ? rows[0] : null),
        [Symbol.asyncIterator]: async function* () {
          for (const r of rows) yield r;
        },
      };
    }
    this._rawDb.run(this._source, p);
    return {
      lastInsertRowId: lastInsertRowId(this._rawDb),
      changes: this._rawDb.getRowsModified(),
      getAllAsync: async () => [],
      getFirstAsync: async () => null,
    };
  }

  async finalizeAsync() {
    /* statements are freed immediately after execution above */
  }
}

function lastInsertRowId(rawDb) {
  const res = rawDb.exec('SELECT last_insert_rowid() AS id');
  return res.length ? Number(res[0].values[0][0]) : 0;
}

function selectAll(rawDb, sql, params) {
  const stmt = rawDb.prepare(sql);
  const p = normalizeParams(params);
  if (p.length) stmt.bind(p);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

class SQLiteDatabase {
  constructor(rawDb) {
    this._db = rawDb;
  }

  async execAsync(sql) {
    this._db.run(sql);
  }

  async runAsync(sql, params) {
    this._db.run(sql, normalizeParams(params));
    return {
      lastInsertRowId: lastInsertRowId(this._db),
      changes: this._db.getRowsModified(),
    };
  }

  async getAllAsync(sql, params) {
    return selectAll(this._db, sql, params);
  }

  async getFirstAsync(sql, params) {
    const rows = selectAll(this._db, sql, params);
    return rows.length ? rows[0] : null;
  }

  async prepareAsync(sql) {
    return new SQLiteStatement(this._db, sql);
  }

  async withTransactionAsync(task) {
    this._db.run('BEGIN');
    try {
      await task();
      this._db.run('COMMIT');
    } catch (e) {
      this._db.run('ROLLBACK');
      throw e;
    }
  }

  async closeAsync() {
    this._db.close();
  }
}

async function openDatabaseAsync(_name) {
  const SQL = await getSqlModule();
  // Every open gets its own in-memory database (tests pass ':memory:').
  return new SQLiteDatabase(new SQL.Database());
}

function openDatabaseSync() {
  throw new Error('openDatabaseSync is not supported in the sql.js test mock; use openDatabaseAsync.');
}

module.exports = {
  openDatabaseAsync,
  openDatabaseSync,
  SQLiteDatabase,
  SQLiteStatement,
};
