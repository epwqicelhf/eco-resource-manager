const CURRENT_VERSION = 1

const migrations = [
  {
    version: 1,
    description: '初始数据库结构',
    up: (db) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS organizations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_id INTEGER DEFAULT NULL,
          name TEXT NOT NULL,
          level INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      db.run(`
        CREATE TABLE IF NOT EXISTS privacy (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          org_id INTEGER DEFAULT NULL,
          data_item TEXT NOT NULL,
          grade TEXT DEFAULT '',
          confidentiality TEXT DEFAULT '',
          integrity TEXT DEFAULT '',
          availability TEXT DEFAULT '',
          compliance TEXT DEFAULT '',
          source_sheet TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      db.run(`
        CREATE TABLE IF NOT EXISTS privacy_global (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data_item TEXT NOT NULL UNIQUE,
          grade TEXT DEFAULT '',
          confidentiality TEXT DEFAULT '',
          integrity TEXT DEFAULT '',
          availability TEXT DEFAULT '',
          compliance TEXT DEFAULT '',
          source TEXT DEFAULT 'manual',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      db.run(`
        CREATE TABLE IF NOT EXISTS pending_imports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT NOT NULL,
          org_id INTEGER DEFAULT NULL,
          data_item TEXT NOT NULL,
          grade TEXT DEFAULT '',
          confidentiality TEXT DEFAULT '',
          integrity TEXT DEFAULT '',
          availability TEXT DEFAULT '',
          compliance TEXT DEFAULT '',
          source_sheet TEXT DEFAULT '',
          type TEXT NOT NULL DEFAULT 'new',
          status TEXT NOT NULL DEFAULT 'pending',
          existing_grade TEXT DEFAULT '',
          existing_confidentiality TEXT DEFAULT '',
          existing_integrity TEXT DEFAULT '',
          existing_availability TEXT DEFAULT '',
          existing_compliance TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          source TEXT DEFAULT 'import',
          privacy_id INTEGER DEFAULT NULL
        )
      `)
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          privacy_id INTEGER DEFAULT NULL,
          org_id INTEGER DEFAULT NULL,
          action TEXT NOT NULL,
          data_item TEXT NOT NULL,
          old_values TEXT DEFAULT '{}',
          new_values TEXT DEFAULT '{}',
          batch_id TEXT DEFAULT '',
          source TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      db.run(`
        CREATE TABLE IF NOT EXISTS rectification_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          privacy_id INTEGER NOT NULL,
          org_id INTEGER DEFAULT NULL,
          data_item TEXT NOT NULL,
          global_grade TEXT DEFAULT '',
          global_confidentiality TEXT DEFAULT '',
          global_integrity TEXT DEFAULT '',
          global_availability TEXT DEFAULT '',
          global_compliance TEXT DEFAULT '',
          org_grade TEXT DEFAULT '',
          org_confidentiality TEXT DEFAULT '',
          org_integrity TEXT DEFAULT '',
          org_availability TEXT DEFAULT '',
          org_compliance TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          confirmed_at DATETIME DEFAULT NULL
        )
      `)
      db.run(`CREATE INDEX IF NOT EXISTS idx_org_parent ON organizations(parent_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_privacy_org ON privacy(org_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_pending_org ON pending_imports(org_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_imports(status)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_pending_privacy ON pending_imports(privacy_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_privacy ON audit_log(privacy_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_batch ON audit_log(batch_id)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)`)
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at)`)
    }
  }
]

export { CURRENT_VERSION, migrations }
