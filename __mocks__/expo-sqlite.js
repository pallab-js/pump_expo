/**
 * Test mock for `expo-sqlite` backed by better-sqlite3.
 *
 * Implements the subset of the async API used by the app:
 *   openDatabaseAsync, execAsync, runAsync, getAllAsync, getFirstAsync,
 *   withTransactionAsync, prepareAsync (+ statement.executeAsync), closeAsync.
 *
 * This runs real SQL in-process so migrations and repositories are genuinely
 * exercised in unit tests (no hand-rolled SQL fake).
 */
const Database = require('better-sqlite3');

function normalizeParams(params) {
  if (params === undefined || params === null) return [];
  return Array.isArray(params) ? params : [params];
}

class SQLiteStatement {
  constructor(db, source) {
    this._stmt = db.prepare(source);
  }

  async executeAsync(params) {
    const p = normalizeParams(params);
    const isSelect = this._stmt.reader;
    if (isSelect) {
      const rows = this._stmt.all(...p);
      return {
        getAllAsync: async () => rows,
        getFirstAsync: async () => (rows.length ? rows[0] : null),
        [Symbol.asyncIterator]: async function* () {
          for (const r of rows) yield r;
        },
      };
    }
    const info = this._stmt.run(...p);
    return {
      lastInsertRowId: Number(info.lastInsertRowid),
      changes: info.changes,
      getAllAsync: async () => [],
      getFirstAsync: async () => null,
    };
  }

  async finalizeAsync() {
    /* better-sqlite3 statements are GC-managed; nothing to finalize. */
  }
}

class SQLiteDatabase {
  constructor(name) {
    this._db = new Database(name === ':memory:' ? ':memory:' : name);
  }

  async execAsync(sql) {
    this._db.exec(sql);
  }

  async runAsync(sql, params) {
    const info = this._db.prepare(sql).run(...normalizeParams(params));
    return {
      lastInsertRowId: Number(info.lastInsertRowid),
      changes: info.changes,
    };
  }

  async getAllAsync(sql, params) {
    return this._db.prepare(sql).all(...normalizeParams(params));
  }

  async getFirstAsync(sql, params) {
    const row = this._db.prepare(sql).get(...normalizeParams(params));
    return row === undefined ? null : row;
  }

  async prepareAsync(sql) {
    return new SQLiteStatement(this._db, sql);
  }

  async withTransactionAsync(task) {
    this._db.exec('BEGIN');
    try {
      await task();
      this._db.exec('COMMIT');
    } catch (e) {
      this._db.exec('ROLLBACK');
      throw e;
    }
  }

  async closeAsync() {
    this._db.close();
  }
}

async function openDatabaseAsync(name) {
  return new SQLiteDatabase(name);
}

function openDatabaseSync(name) {
  return new SQLiteDatabase(name);
}

module.exports = {
  openDatabaseAsync,
  openDatabaseSync,
  SQLiteDatabase,
  SQLiteStatement,
};
