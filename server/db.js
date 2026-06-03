import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CURRENT_VERSION, migrations } from './migrations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'privacy.db')

let db

function getVersion() {
  try {
    const result = db.exec("SELECT version FROM db_version ORDER BY version DESC LIMIT 1")
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0]
    }
  } catch (e) {
    // table doesn't exist yet
  }
  return 0
}

function setVersion(version) {
  db.run("CREATE TABLE IF NOT EXISTS db_version (version INTEGER NOT NULL, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)")
  db.run("INSERT INTO db_version (version) VALUES (?)", [version])
}

export async function initDb() {
  const SQL = await initSqlJs()

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  const currentVersion = getVersion()
  console.log(`[DB] Current version: ${currentVersion}, target: ${CURRENT_VERSION}`)

  if (currentVersion < CURRENT_VERSION) {
    const pendingMigrations = migrations.filter(m => m.version > currentVersion)
    console.log(`[DB] Applying ${pendingMigrations.length} migration(s)...`)

    db.run('BEGIN TRANSACTION')
    try {
      for (const migration of pendingMigrations) {
        console.log(`[DB] Applying migration ${migration.version}: ${migration.description}`)
        migration.up(db)
        setVersion(migration.version)
      }
      db.run('COMMIT')
      saveDb()
      console.log(`[DB] Migrations complete. Database now at version ${CURRENT_VERSION}`)
    } catch (err) {
      db.run('ROLLBACK')
      console.error('[DB] Migration failed, rolled back:', err.message)
      throw err
    }
  }

  return db
}

export function getDb() {
  return db
}

export function saveDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

export function queryOne(sql, params = []) {
  const rows = queryAll(sql, params)
  return rows.length > 0 ? rows[0] : null
}

export function runSql(sql, params = []) {
  db.run(sql, params)
  saveDb()
}

const AUDIT_LOG_MAX = 20000

export function writeAudit({ privacy_id, org_id, action, data_item, old_values = {}, new_values = {}, batch_id = '', source = '', metadata = {} }) {
  // 如果有metadata，将其嵌入到old_values或new_values中
  if (Object.keys(metadata).length > 0) {
    if (Object.keys(old_values).length > 0) {
      old_values._metadata = metadata;
    } else if (Object.keys(new_values).length > 0) {
      new_values._metadata = metadata;
    } else {
      // 如果old_values和new_values都为空，创建一个包含metadata的对象
      old_values = { _metadata: metadata };
    }
  }
  
  db.run(`
    INSERT INTO audit_log (privacy_id, org_id, action, data_item, old_values, new_values, batch_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    privacy_id, org_id, action, data_item,
    JSON.stringify(old_values), JSON.stringify(new_values),
    batch_id, source
  ])
  trimAuditLog()
  saveDb()
}

function trimAuditLog() {
  const count = db.exec("SELECT COUNT(*) FROM audit_log")
  const total = count[0]?.values[0][0] || 0
  if (total > AUDIT_LOG_MAX) {
    const toDelete = total - AUDIT_LOG_MAX
    db.run("DELETE FROM audit_log WHERE id IN (SELECT id FROM audit_log ORDER BY id ASC LIMIT ?)", [toDelete])
  }
}

export function privacyToValues(row) {
  if (!row) return {}
  return {
    data_item: row.data_item || '',
    grade: row.grade || '',
    confidentiality: row.confidentiality || '',
    integrity: row.integrity || '',
    availability: row.availability || '',
    compliance: row.compliance || ''
  }
}
