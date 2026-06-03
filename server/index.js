import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { initDb, queryAll, queryOne, runSql, saveDb, getDb, writeAudit, privacyToValues } from './db.js';
import { parseExcel, buildExportBuffer, buildTemplateBuffer, validateRecordFields } from './excel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/orgs', (req, res) => {
  const rows = queryAll('SELECT * FROM organizations ORDER BY sort_order, id');
  const enriched = rows.map(org => {
    const privacyCount = queryOne('SELECT COUNT(*) as cnt FROM privacy WHERE org_id = ?', [org.id])?.cnt || 0;
    const pendingCount = queryOne("SELECT COUNT(*) as cnt FROM pending_imports WHERE org_id = ? AND status = 'pending'", [org.id])?.cnt || 0;
    const childCount = queryOne('SELECT COUNT(*) as cnt FROM organizations WHERE parent_id = ?', [org.id])?.cnt || 0;
    return { ...org, privacy_count: privacyCount, pending_count: pendingCount, has_data: privacyCount > 0 || pendingCount > 0, is_leaf: childCount === 0, child_count: childCount };
  });
  res.json(enriched);
});

app.get('/api/orgs/tree', (req, res) => {
  const rows = queryAll('SELECT * FROM organizations ORDER BY sort_order, id');
  const map = {};
  const roots = [];
  for (const r of rows) {
    const pc = queryOne('SELECT COUNT(*) as cnt FROM privacy WHERE org_id = ?', [r.id])?.cnt || 0;
    const pnc = queryOne("SELECT COUNT(*) as cnt FROM pending_imports WHERE org_id = ? AND status = 'pending'", [r.id])?.cnt || 0;
    map[r.id] = { ...r, privacy_count: pc, pending_count: pnc, has_data: pc > 0 || pnc > 0, is_leaf: true, child_count: 0, children: [] };
  }
  for (const r of rows) {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id]);
      map[r.parent_id].is_leaf = false;
      map[r.parent_id].child_count++;
    } else if (!r.parent_id) {
      roots.push(map[r.id]);
    }
  }
  res.json(roots);
});

app.post('/api/orgs', (req, res) => {
  const { name, parent_id, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: '组织名称不能为空' });
  let level = 1;
  if (parent_id) {
    const parent = queryOne('SELECT level FROM organizations WHERE id = ?', [parent_id]);
    if (!parent) return res.status(404).json({ error: '父组织不存在' });
    level = parent.level + 1;
    const pp = queryOne('SELECT COUNT(*) as cnt FROM privacy WHERE org_id = ?', [parent_id])?.cnt || 0;
    const pnp = queryOne("SELECT COUNT(*) as cnt FROM pending_imports WHERE org_id = ? AND status = 'pending'", [parent_id])?.cnt || 0;
    if (pp > 0 || pnp > 0) return res.status(400).json({ error: '该组织下已有数据，不能添加子组织' });
  }
  const db = getDb();
  db.run('INSERT INTO organizations (name, parent_id, level, sort_order) VALUES (?, ?, ?, ?)', [name, parent_id || null, level, sort_order || 0]);
  saveDb();
  res.json(queryOne('SELECT * FROM organizations ORDER BY id DESC LIMIT 1'));
});

app.put('/api/orgs/:id', (req, res) => {
  const { id } = req.params;
  const { name, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: '组织名称不能为空' });
  runSql('UPDATE organizations SET name = ?, sort_order = ? WHERE id = ?', [name, sort_order || 0, Number(id)]);
  res.json({ success: true });
});

app.delete('/api/orgs/:id', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const cc = queryOne('SELECT COUNT(*) as cnt FROM organizations WHERE parent_id = ?', [numId]);
  if (cc && cc.cnt > 0) return res.status(400).json({ error: '该组织下有子组织，请先删除子组织' });
  const pc = queryOne('SELECT COUNT(*) as cnt FROM privacy WHERE org_id = ?', [numId])?.cnt || 0;
  const pnc = queryOne("SELECT COUNT(*) as cnt FROM pending_imports WHERE org_id = ? AND status = 'pending'", [numId])?.cnt || 0;
  const db = getDb();
  if (pc > 0 || pnc > 0) {
    db.run('DELETE FROM privacy WHERE org_id = ?', [numId]);
    db.run("DELETE FROM pending_imports WHERE org_id = ? AND status = 'pending'", [numId]);
  }
  db.run('DELETE FROM organizations WHERE id = ?', [numId]);
  saveDb();
  res.json({ success: true, deleted_data: pc, deleted_pending: pnc });
});

const REQUIRED_FIELDS = ['data_item', 'grade', 'confidentiality', 'integrity', 'availability', 'compliance'];
const FIELD_LABELS = { data_item: '数据项', grade: '综合等级', confidentiality: '机密性', integrity: '完整性', availability: '可用性', compliance: '合规性' };
const RANGE_FIELDS = ['grade', 'confidentiality', 'integrity', 'availability', 'compliance'];

function validateRequiredFields(body) {
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || !String(body[field]).trim()) {
      return `${FIELD_LABELS[field]}不能为空`;
    }
  }
  for (const field of RANGE_FIELDS) {
    const val = String(body[field] || '').trim();
    const num = Number(val);
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      return `${FIELD_LABELS[field]}必须为1-5的整数（当前值: ${val}）`;
    }
  }
  return null;
}

app.get('/api/privacy', (req, res) => {
  const { org_id, q } = req.query;
  if (org_id) {
    res.json(q
      ? queryAll('SELECT * FROM privacy WHERE org_id = ? AND data_item LIKE ? ORDER BY id DESC', [Number(org_id), `%${q}%`])
      : queryAll('SELECT * FROM privacy WHERE org_id = ? ORDER BY id DESC', [Number(org_id)]));
  } else {
    res.json(q
      ? queryAll('SELECT * FROM privacy WHERE data_item LIKE ? ORDER BY id DESC', [`%${q}%`])
      : queryAll('SELECT * FROM privacy ORDER BY id DESC'));
  }
});

app.post('/api/privacy', (req, res) => {
  const { org_id, data_item, grade, confidentiality, integrity, availability, compliance, accept_global } = req.body;
  const validationError = validateRequiredFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!org_id) return res.status(400).json({ error: '新增数据必须归属于某个组织，请先选择目标组织' });

  const orgId = Number(org_id);
  const org = queryOne('SELECT * FROM organizations WHERE id = ?', [orgId]);
  if (!org) return res.status(404).json({ error: '组织不存在' });
  const cc = queryOne('SELECT COUNT(*) as cnt FROM organizations WHERE parent_id = ?', [orgId])?.cnt || 0;
  if (cc > 0) return res.status(400).json({ error: '非叶子节点组织不能添加数据' });

  const existingWhere = queryOne('SELECT * FROM privacy WHERE org_id = ? AND data_item = ?', [orgId, data_item]);
  if (existingWhere) return res.status(400).json({ error: '该组织下已存在同名数据项' });

  const existingPending = queryOne("SELECT * FROM pending_imports WHERE org_id = ? AND data_item = ? AND status = 'pending' AND type = 'new'", [orgId, data_item]);
  if (existingPending) return res.status(400).json({ error: '该数据项已有待审核的新增记录' });

  const globalRecord = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [data_item]);
  if (globalRecord && !accept_global) {
    const inputVals = { grade: grade || '', confidentiality: confidentiality || '', integrity: integrity || '', availability: availability || '', compliance: compliance || '' };
    const globalVals = { grade: globalRecord.grade, confidentiality: globalRecord.confidentiality, integrity: globalRecord.integrity, availability: globalRecord.availability, compliance: globalRecord.compliance };
    const hasConflict =
      (inputVals.grade && inputVals.grade !== globalVals.grade) ||
      (inputVals.confidentiality && inputVals.confidentiality !== globalVals.confidentiality) ||
      (inputVals.integrity && inputVals.integrity !== globalVals.integrity) ||
      (inputVals.availability && inputVals.availability !== globalVals.availability) ||
      (inputVals.compliance && inputVals.compliance !== globalVals.compliance);

    if (hasConflict) {
      return res.status(409).json({
        error: '提交的数据与总表数据存在冲突',
        conflict: true,
        global_record: globalRecord,
        input_values: inputVals,
        global_values: globalVals
      });
    }
  }

  let finalGrade = grade || '';
  let finalConfidentiality = confidentiality || '';
  let finalIntegrity = integrity || '';
  let finalAvailability = availability || '';
  let finalCompliance = compliance || '';

  if (globalRecord && accept_global) {
    finalGrade = globalRecord.grade;
    finalConfidentiality = globalRecord.confidentiality;
    finalIntegrity = globalRecord.integrity;
    finalAvailability = globalRecord.availability;
    finalCompliance = globalRecord.compliance;
  }

  const batchId = crypto.randomUUID();
  const db = getDb();
  db.run(`
    INSERT INTO pending_imports (batch_id, org_id, data_item, grade, confidentiality, integrity, availability, compliance, type, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending', 'gui')
  `, [batchId, orgId, data_item, finalGrade, finalConfidentiality, finalIntegrity, finalAvailability, finalCompliance]);
  saveDb();

  const created = queryOne("SELECT * FROM pending_imports WHERE batch_id = ? AND data_item = ?", [batchId, data_item]);

  writeAudit({
    privacy_id: null,
    org_id: orgId,
    action: 'gui_create',
    data_item,
    old_values: {},
    new_values: { data_item, grade: finalGrade, confidentiality: finalConfidentiality, integrity: finalIntegrity, availability: finalAvailability, compliance: finalCompliance },
    batch_id: batchId,
    source: accept_global ? 'gui_accept_global' : 'gui',
    metadata: {
      target_org_name: org?.name || '',
      target_org_id: orgId
    }
  });

  res.json({ pending: true, pending_id: created.id, accepted_global: !!accept_global, ...created });
});

app.put('/api/privacy/:id', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const existing = queryOne('SELECT * FROM privacy WHERE id = ?', [numId]);
  if (!existing) return res.status(404).json({ error: '记录不存在' });

  const existingPendingUpdate = queryOne("SELECT * FROM pending_imports WHERE privacy_id = ? AND type = 'update' AND status = 'pending'", [numId]);
  const existingPendingDelete = queryOne("SELECT * FROM pending_imports WHERE privacy_id = ? AND type = 'delete' AND status = 'pending'", [numId]);
  if (existingPendingDelete) return res.status(400).json({ error: '该记录有待审核的删除操作，无法编辑' });
  if (existingPendingUpdate) return res.status(400).json({ error: '该记录已有待审核的修改，请先审核或撤销后再编辑' });

  const { data_item, grade, confidentiality, integrity, availability, compliance } = req.body;
  const validationError = validateRequiredFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const oldValues = privacyToValues(existing);
  const newVals = {
    data_item: data_item || existing.data_item,
    grade: grade !== undefined ? grade : existing.grade,
    confidentiality: confidentiality !== undefined ? confidentiality : existing.confidentiality,
    integrity: integrity !== undefined ? integrity : existing.integrity,
    availability: availability !== undefined ? availability : existing.availability,
    compliance: compliance !== undefined ? compliance : existing.compliance
  };

  const changed = {};
  for (const key of ['data_item', 'grade', 'confidentiality', 'integrity', 'availability', 'compliance']) {
    if (oldValues[key] !== newVals[key]) changed[key] = true;
  }

  if (Object.keys(changed).length === 0) {
    return res.json({ pending: false, message: '无变更' });
  }

  const batchId = crypto.randomUUID();
  const db = getDb();
  db.run(`
    INSERT INTO pending_imports (batch_id, org_id, privacy_id, data_item, grade, confidentiality, integrity, availability, compliance,
      existing_grade, existing_confidentiality, existing_integrity, existing_availability, existing_compliance,
      type, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'update', 'pending', 'gui')
  `, [
    batchId, existing.org_id, numId, newVals.data_item, newVals.grade, newVals.confidentiality, newVals.integrity, newVals.availability, newVals.compliance,
    oldValues.grade, oldValues.confidentiality, oldValues.integrity, oldValues.availability, oldValues.compliance
  ]);
  saveDb();

  const pendingRecord = queryOne("SELECT * FROM pending_imports WHERE batch_id = ? AND privacy_id = ?", [batchId, numId]);

  const updateOrg = queryOne('SELECT name FROM organizations WHERE id = ?', [existing.org_id]);
  writeAudit({
    privacy_id: numId,
    org_id: existing.org_id,
    action: 'gui_update',
    data_item: newVals.data_item,
    old_values: oldValues,
    new_values: newVals,
    batch_id: batchId,
    source: 'gui',
    metadata: {
      target_org_name: updateOrg?.name || '',
      target_org_id: existing.org_id
    }
  });

  res.json({ pending: true, pending_id: pendingRecord.id, ...pendingRecord });
});

app.delete('/api/privacy/:id', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const existing = queryOne('SELECT * FROM privacy WHERE id = ?', [numId]);
  if (!existing) return res.status(404).json({ error: '记录不存在' });

  const existingPendingUpdate = queryOne("SELECT * FROM pending_imports WHERE privacy_id = ? AND type = 'update' AND status = 'pending'", [numId]);
  const existingPendingDelete = queryOne("SELECT * FROM pending_imports WHERE privacy_id = ? AND type = 'delete' AND status = 'pending'", [numId]);
  if (existingPendingDelete) return res.status(400).json({ error: '该记录已有待审核的删除操作' });
  if (existingPendingUpdate) return res.status(400).json({ error: '该记录有待审核的修改，请先审核或撤销后再删除' });

  const batchId = crypto.randomUUID();
  const db = getDb();
  db.run(`
    INSERT INTO pending_imports (batch_id, org_id, privacy_id, data_item, grade, confidentiality, integrity, availability, compliance, type, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'delete', 'pending', 'gui')
  `, [batchId, existing.org_id, numId, existing.data_item, existing.grade, existing.confidentiality, existing.integrity, existing.availability, existing.compliance]);
  saveDb();

  const pendingRecord = queryOne("SELECT * FROM pending_imports WHERE batch_id = ? AND privacy_id = ?", [batchId, numId]);

  const deleteOrg = queryOne('SELECT name FROM organizations WHERE id = ?', [existing.org_id]);
  writeAudit({
    privacy_id: numId,
    org_id: existing.org_id,
    action: 'gui_delete',
    data_item: existing.data_item,
    old_values: privacyToValues(existing),
    new_values: {},
    batch_id: batchId,
    source: 'gui',
    metadata: {
      source_org_name: deleteOrg?.name || '',
      source_org_id: existing.org_id
    }
  });

  res.json({ pending: true, pending_id: pendingRecord.id, ...pendingRecord });
});

app.get('/api/privacy-global/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const rows = queryAll('SELECT * FROM privacy_global WHERE data_item LIKE ? ORDER BY data_item LIMIT 20', [`%${q}%`]);
  res.json(rows);
});

app.get('/api/privacy-global/match', (req, res) => {
  const { data_item } = req.query;
  if (!data_item) return res.json(null);
  const row = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [data_item]);
  res.json(row);
});

app.get('/api/privacy-global', (req, res) => {
  const rows = queryAll('SELECT * FROM privacy_global ORDER BY id DESC');
  res.json(rows);
});

app.post('/api/privacy-global', (req, res) => {
  const { data_item, grade, confidentiality, integrity, availability, compliance } = req.body;
  const validationError = validateRequiredFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const existing = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [data_item]);
  if (existing) return res.status(400).json({ error: '该数据项已存在于总表中' });

  const db = getDb();
  db.run(`
    INSERT INTO privacy_global (data_item, grade, confidentiality, integrity, availability, compliance, source)
    VALUES (?, ?, ?, ?, ?, ?, 'manual')
  `, [data_item, grade || '', confidentiality || '', integrity || '', availability || '', compliance || '']);
  saveDb();

  const created = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [data_item]);

  writeAudit({
    privacy_id: created.id,
    org_id: null,
    action: 'create_global',
    data_item,
    old_values: {},
    new_values: { data_item, grade: grade || '', confidentiality: confidentiality || '', integrity: integrity || '', availability: availability || '', compliance: compliance || '' },
    batch_id: '',
    source: 'manual'
  });

  res.json(created);
});

app.put('/api/privacy-global/:id', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const existing = queryOne('SELECT * FROM privacy_global WHERE id = ?', [numId]);
  if (!existing) return res.status(404).json({ error: '记录不存在' });

  const { data_item, grade, confidentiality, integrity, availability, compliance } = req.body;
  
  // Use existing values if not provided
  const finalData = {
    data_item: data_item !== undefined ? data_item : existing.data_item,
    grade: grade !== undefined ? grade : existing.grade,
    confidentiality: confidentiality !== undefined ? confidentiality : existing.confidentiality,
    integrity: integrity !== undefined ? integrity : existing.integrity,
    availability: availability !== undefined ? availability : existing.availability,
    compliance: compliance !== undefined ? compliance : existing.compliance
  };
  
  const validationError = validateRequiredFields(finalData);
  if (validationError) return res.status(400).json({ error: validationError });

  if (finalData.data_item !== existing.data_item) {
    const dup = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [finalData.data_item]);
    if (dup) return res.status(400).json({ error: '该数据项名称已存在' });
  }

  const oldValues = { data_item: existing.data_item, grade: existing.grade, confidentiality: existing.confidentiality, integrity: existing.integrity, availability: existing.availability, compliance: existing.compliance };

  const db = getDb();
  db.run(`
    UPDATE privacy_global SET
      data_item = ?, grade = ?, confidentiality = ?, integrity = ?,
      availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [finalData.data_item, finalData.grade || '', finalData.confidentiality || '', finalData.integrity || '', finalData.availability || '', finalData.compliance || '', numId]);
  saveDb();

  const updated = queryOne('SELECT * FROM privacy_global WHERE id = ?', [numId]);
  const newValues = { data_item: finalData.data_item, grade: finalData.grade || '', confidentiality: finalData.confidentiality || '', integrity: finalData.integrity || '', availability: finalData.availability || '', compliance: finalData.compliance || '' };

  writeAudit({
    privacy_id: numId,
    org_id: null,
    action: 'update_global',
    data_item: finalData.data_item,
    old_values: oldValues,
    new_values: newValues,
    batch_id: '',
    source: 'manual'
  });

  const orgRecords = queryAll('SELECT * FROM privacy WHERE data_item = ?', [finalData.data_item]);
  let tasksCreated = 0;
  const db2 = getDb();
  for (const orgRec of orgRecords) {
    const diffs = [];
    if (orgRec.grade !== (finalData.grade || '')) diffs.push('grade');
    if (orgRec.confidentiality !== (finalData.confidentiality || '')) diffs.push('confidentiality');
    if (orgRec.integrity !== (finalData.integrity || '')) diffs.push('integrity');
    if (orgRec.availability !== (finalData.availability || '')) diffs.push('availability');
    if (orgRec.compliance !== (finalData.compliance || '')) diffs.push('compliance');

    if (diffs.length > 0) {
      const existingTask = queryOne("SELECT * FROM rectification_tasks WHERE privacy_id = ? AND status = 'pending'", [orgRec.id]);
      if (!existingTask) {
        db2.run(`
          INSERT INTO rectification_tasks (privacy_id, org_id, data_item, global_grade, global_confidentiality, global_integrity, global_availability, global_compliance, org_grade, org_confidentiality, org_integrity, org_availability, org_compliance)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orgRec.id, orgRec.org_id, finalData.data_item,
          finalData.grade || '', finalData.confidentiality || '', finalData.integrity || '', finalData.availability || '', finalData.compliance || '',
          orgRec.grade, orgRec.confidentiality, orgRec.integrity, orgRec.availability, orgRec.compliance
        ]);
        tasksCreated++;
      }
    }
  }
  if (tasksCreated > 0) saveDb();

  res.json({ ...updated, rectification_tasks_created: tasksCreated });
});

app.delete('/api/privacy-global/:id', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const existing = queryOne('SELECT * FROM privacy_global WHERE id = ?', [numId]);
  if (!existing) return res.status(404).json({ error: '记录不存在' });

  const oldValues = { data_item: existing.data_item, grade: existing.grade, confidentiality: existing.confidentiality, integrity: existing.integrity, availability: existing.availability, compliance: existing.compliance };

  const db = getDb();
  db.run('DELETE FROM privacy_global WHERE id = ?', [numId]);
  saveDb();

  writeAudit({
    privacy_id: numId,
    org_id: null,
    action: 'delete_global',
    data_item: existing.data_item,
    old_values: oldValues,
    new_values: {},
    batch_id: '',
    source: 'manual'
  });

  res.json({ success: true });
});

app.post('/api/privacy-global/:id/distribute', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const globalRecord = queryOne('SELECT * FROM privacy_global WHERE id = ?', [numId]);
  if (!globalRecord) return res.status(404).json({ error: '总表记录不存在' });

  const { org_ids } = req.body;
  if (!org_ids || !Array.isArray(org_ids) || org_ids.length === 0) {
    return res.status(400).json({ error: '请选择目标组织' });
  }

  const db = getDb();
  const batchId = crypto.randomUUID();
  let distributed = 0;
  let skipped = 0;

  db.run('BEGIN TRANSACTION');
  try {
    for (const orgId of org_ids) {
      const org = queryOne('SELECT * FROM organizations WHERE id = ?', [Number(orgId)]);
      if (!org) { skipped++; continue; }
      const childCount = queryOne('SELECT COUNT(*) as cnt FROM organizations WHERE parent_id = ?', [Number(orgId)])?.cnt || 0;
      if (childCount > 0) { skipped++; continue; }

      const existingOrg = queryOne('SELECT * FROM privacy WHERE org_id = ? AND data_item = ?', [Number(orgId), globalRecord.data_item]);
      if (existingOrg) { skipped++; continue; }

      const existingPending = queryOne("SELECT * FROM pending_imports WHERE org_id = ? AND data_item = ? AND status = 'pending' AND type = 'new'", [Number(orgId), globalRecord.data_item]);
      if (existingPending) { skipped++; continue; }

      db.run(`
        INSERT INTO pending_imports (batch_id, org_id, data_item, grade, confidentiality, integrity, availability, compliance, type, status, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending', 'gui')
      `, [batchId, Number(orgId), globalRecord.data_item, globalRecord.grade, globalRecord.confidentiality, globalRecord.integrity, globalRecord.availability, globalRecord.compliance]);
      distributed++;
    }
    db.run('COMMIT');
    saveDb();

    writeAudit({
      privacy_id: numId, org_id: null,
      action: 'distribute_global',
      data_item: globalRecord.data_item,
      old_values: {},
      new_values: { distributed, skipped, org_ids },
      batch_id: batchId,
      source: 'manual'
    });

    res.json({ success: true, distributed, skipped });
  } catch (err) {
    db.run('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/privacy-global/conflict-check', (req, res) => {
  const { apply } = req.body;
  const globalRecords = queryAll('SELECT * FROM privacy_global');
  const orgRecords = queryAll('SELECT * FROM privacy WHERE org_id IS NOT NULL');
  const conflicts = [];

  for (const orgRec of orgRecords) {
    const globalRec = globalRecords.find(g => g.data_item === orgRec.data_item);
    if (!globalRec) continue;

    const diffs = [];
    if (orgRec.grade !== globalRec.grade) diffs.push({ field: '综合等级', org_val: orgRec.grade, global_val: globalRec.grade });
    if (orgRec.confidentiality !== globalRec.confidentiality) diffs.push({ field: '机密性', org_val: orgRec.confidentiality, global_val: globalRec.confidentiality });
    if (orgRec.integrity !== globalRec.integrity) diffs.push({ field: '完整性', org_val: orgRec.integrity, global_val: globalRec.integrity });
    if (orgRec.availability !== globalRec.availability) diffs.push({ field: '可用性', org_val: orgRec.availability, global_val: globalRec.availability });
    if (orgRec.compliance !== globalRec.compliance) diffs.push({ field: '合规性', org_val: orgRec.compliance, global_val: globalRec.compliance });

    if (diffs.length > 0) {
      const org = queryOne('SELECT name FROM organizations WHERE id = ?', [orgRec.org_id]);
      conflicts.push({
        privacy_id: orgRec.id,
        org_id: orgRec.org_id,
        org_name: org?.name || '未知',
        data_item: orgRec.data_item,
        diffs,
        org_values: { grade: orgRec.grade, confidentiality: orgRec.confidentiality, integrity: orgRec.integrity, availability: orgRec.availability, compliance: orgRec.compliance },
        global_values: { grade: globalRec.grade, confidentiality: globalRec.confidentiality, integrity: globalRec.integrity, availability: globalRec.availability, compliance: globalRec.compliance }
      });
    }
  }

  let applied = 0;
  if (apply && conflicts.length > 0) {
    const db = getDb();
    const auditEntries = [];
    db.run('BEGIN TRANSACTION');
    try {
      for (const c of conflicts) {
        const oldValues = { ...c.org_values };
        db.run(`
          UPDATE privacy SET
            grade = ?, confidentiality = ?, integrity = ?,
            availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [c.global_values.grade, c.global_values.confidentiality, c.global_values.integrity, c.global_values.availability, c.global_values.compliance, c.privacy_id]);

        auditEntries.push({
          privacy_id: c.privacy_id,
          org_id: c.org_id,
          action: 'global_sync_apply',
          data_item: c.data_item,
          old_values: oldValues,
          new_values: { ...c.global_values },
          source: 'conflict_check'
        });
        applied++;
      }
      db.run('COMMIT');
      for (const entry of auditEntries) {
        writeAudit(entry);
      }
    } catch (err) {
      try { db.run('ROLLBACK'); } catch (e) {}
      return res.status(500).json({ error: err.message });
    }
  }

  res.json({ conflicts: conflicts.length, applied, details: conflicts });
});

app.get('/api/pending/by-privacy/:id', (req, res) => {
  const { id } = req.params;
  const rows = queryAll("SELECT * FROM pending_imports WHERE privacy_id = ? AND status = 'pending'", [Number(id)]);
  res.json(rows);
});

app.get('/api/pending/gui', (req, res) => {
  const { org_id, type } = req.query;
  let sql = "SELECT * FROM pending_imports WHERE source = 'gui' AND status = 'pending'";
  const params = [];
  if (org_id) { sql += ' AND org_id = ?'; params.push(Number(org_id)); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += ' ORDER BY id DESC';
  res.json(queryAll(sql, params));
});

app.delete('/api/pending/:id', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const pending = queryOne("SELECT * FROM pending_imports WHERE id = ? AND status = 'pending'", [numId]);
  if (!pending) return res.status(404).json({ error: '记录不存在或已处理' });

  writeAudit({
    privacy_id: pending.privacy_id,
    org_id: pending.org_id,
    action: 'cancel_pending',
    data_item: pending.data_item,
    old_values: privacyToValues(pending),
    new_values: {},
    batch_id: pending.batch_id,
    source: pending.source
  });

  runSql("UPDATE pending_imports SET status = 'cancelled' WHERE id = ?", [numId]);
  res.json({ success: true });
});

app.get('/api/upload/template', (req, res) => {
  const buffer = buildTemplateBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=import_template.xlsx');
  res.send(buffer);
});

function findOrCreateOrgPath(db, pathArray) {
  let parentId = null;
  let currentId = null;
  let level = 1;
  const created = [];

  for (const name of pathArray) {
    if (!name || !name.trim()) break;
    const trimmed = name.trim();

    let org = parentId
      ? queryOne('SELECT * FROM organizations WHERE parent_id = ? AND name = ?', [parentId, trimmed])
      : queryOne('SELECT * FROM organizations WHERE parent_id IS NULL AND name = ?', [trimmed]);

    if (!org) {
      db.run(
        'INSERT INTO organizations (name, parent_id, level, sort_order) VALUES (?, ?, ?, ?)',
        [trimmed, parentId, level, 0]
      );
      org = parentId
        ? queryOne('SELECT * FROM organizations WHERE parent_id = ? AND name = ?', [parentId, trimmed])
        : queryOne('SELECT * FROM organizations WHERE parent_id IS NULL AND name = ?', [trimmed]);
      created.push({ id: org.id, name: trimmed, level });
    }

    parentId = org.id;
    currentId = org.id;
    level++;
  }

  return { orgId: currentId, created };
}

app.post('/api/upload/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传文件' });
  const { org_id, accept_global_conflicts } = req.body;

  try {
    const records = parseExcel(req.file.buffer);
    if (records.length === 0) return res.status(400).json({ error: '文件中未找到有效数据行' });

    const hasOrgPath = records.some(r => r.org_path && r.org_path.length > 0);
    const useAutoOrg = hasOrgPath;

    let defaultOrgId = null;
    if (!useAutoOrg) {
      if (!org_id) return res.status(400).json({ error: 'Excel中不包含组织分类列，请先选择目标组织' });
      defaultOrgId = Number(org_id);
      const org = queryOne('SELECT * FROM organizations WHERE id = ?', [defaultOrgId]);
      if (!org) return res.status(404).json({ error: '组织不存在' });
      const cc = queryOne('SELECT COUNT(*) as cnt FROM organizations WHERE parent_id = ?', [defaultOrgId])?.cnt || 0;
      if (cc > 0) return res.status(400).json({ error: '非叶子节点组织不能导入数据' });
    }

    const batchId = crypto.randomUUID();
    const db = getDb();
    let newCount = 0;
    let conflictCount = 0;
    let globalConflictCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    const skippedItems = [];
    const duplicateItems = [];
    const globalConflicts = [];
    const orgsCreated = [];
    const batchPendingItems = {};

    db.run('BEGIN TRANSACTION');
    try {
      for (const record of records) {
        const validationErrors = validateRecordFields(record);
        if (validationErrors.length > 0) {
          skippedItems.push({ data_item: record.data_item || '(空)', errors: validationErrors, source_sheet: record.source_sheet || '' });
          skippedCount++;
          continue;
        }

        let targetOrgId = defaultOrgId;
        if (record.org_path && record.org_path.length > 0) {
          const result = findOrCreateOrgPath(db, record.org_path);
          if (!result.orgId) {
            skippedItems.push({ data_item: record.data_item, errors: ['无法创建组织路径'], source_sheet: record.source_sheet || '' });
            skippedCount++;
            continue;
          }
          targetOrgId = result.orgId;
          for (const c of result.created) {
            if (!orgsCreated.find(o => o.id === c.id)) {
              orgsCreated.push(c);
            }
          }
        }

        if (!targetOrgId) {
          skippedItems.push({ data_item: record.data_item, errors: ['无法确定目标组织'], source_sheet: record.source_sheet || '' });
          skippedCount++;
          continue;
        }

        const leafCheck = queryOne('SELECT COUNT(*) as cnt FROM organizations WHERE parent_id = ?', [targetOrgId])?.cnt || 0;
        if (leafCheck > 0) {
          skippedItems.push({ data_item: record.data_item, errors: ['目标组织不是叶子节点'], source_sheet: record.source_sheet || '' });
          skippedCount++;
          continue;
        }

        if (!batchPendingItems[targetOrgId]) batchPendingItems[targetOrgId] = new Set();
        if (batchPendingItems[targetOrgId].has(record.data_item)) {
          duplicateItems.push({ data_item: record.data_item, source_sheet: record.source_sheet || '' });
          duplicateCount++;
          continue;
        }
        batchPendingItems[targetOrgId].add(record.data_item);

        const existingOrg = queryOne('SELECT * FROM privacy WHERE org_id = ? AND data_item = ?', [targetOrgId, record.data_item]);
        if (existingOrg) {
          const hasConflict =
            (record.grade !== existingOrg.grade) ||
            (record.confidentiality !== existingOrg.confidentiality) ||
            (record.integrity !== existingOrg.integrity) ||
            (record.availability !== existingOrg.availability) ||
            (record.compliance !== existingOrg.compliance);
          if (hasConflict) {
            db.run(`
              INSERT INTO pending_imports (batch_id, org_id, data_item, grade, confidentiality, integrity, availability, compliance, source_sheet, type, status, existing_grade, existing_confidentiality, existing_integrity, existing_availability, existing_compliance)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'conflict', 'pending', ?, ?, ?, ?, ?)
            `, [
              batchId, targetOrgId, record.data_item,
              record.grade, record.confidentiality, record.integrity, record.availability, record.compliance,
              record.source_sheet || '',
              existingOrg.grade, existingOrg.confidentiality, existingOrg.integrity, existingOrg.availability, existingOrg.compliance
            ]);
            conflictCount++;
            continue;
          } else {
            continue;
          }
        }

        const existingPending = queryOne("SELECT * FROM pending_imports WHERE org_id = ? AND data_item = ? AND status = 'pending' AND type = 'new'", [targetOrgId, record.data_item]);
        if (existingPending) {
          duplicateItems.push({ data_item: record.data_item, source_sheet: record.source_sheet || '' });
          duplicateCount++;
          continue;
        }

        const globalRecord = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [record.data_item]);
        if (globalRecord) {
          const inputVals = { grade: record.grade, confidentiality: record.confidentiality, integrity: record.integrity, availability: record.availability, compliance: record.compliance };
          const globalVals = { grade: globalRecord.grade, confidentiality: globalRecord.confidentiality, integrity: globalRecord.integrity, availability: globalRecord.availability, compliance: globalRecord.compliance };
          const hasGlobalConflict =
            inputVals.grade !== globalVals.grade ||
            inputVals.confidentiality !== globalVals.confidentiality ||
            inputVals.integrity !== globalVals.integrity ||
            inputVals.availability !== globalVals.availability ||
            inputVals.compliance !== globalVals.compliance;

          if (hasGlobalConflict && !accept_global_conflicts) {
            globalConflicts.push({
              data_item: record.data_item,
              input_values: inputVals,
              global_values: globalVals,
              global_record: globalRecord,
              source_sheet: record.source_sheet || ''
            });
            globalConflictCount++;
            continue;
          }

          if (hasGlobalConflict && accept_global_conflicts) {
            db.run(`
              INSERT INTO pending_imports (batch_id, org_id, data_item, grade, confidentiality, integrity, availability, compliance, source_sheet, type, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending')
            `, [
              batchId, targetOrgId, record.data_item,
              globalVals.grade, globalVals.confidentiality, globalVals.integrity, globalVals.availability, globalVals.compliance,
              record.source_sheet || ''
            ]);
            newCount++;
            continue;
          }
        }

        db.run(`
          INSERT INTO pending_imports (batch_id, org_id, data_item, grade, confidentiality, integrity, availability, compliance, source_sheet, type, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending')
        `, [
          batchId, targetOrgId, record.data_item,
          record.grade, record.confidentiality, record.integrity, record.availability, record.compliance,
          record.source_sheet || ''
        ]);
        newCount++;
      }
      db.run('COMMIT');
      saveDb();

      writeAudit({
        privacy_id: null, org_id: defaultOrgId, action: 'import',
        data_item: `[batch] ${newCount + conflictCount + globalConflictCount + skippedCount + duplicateCount} items`,
        old_values: {},
        new_values: { total: records.length, new: newCount, conflict: conflictCount, global_conflict: globalConflictCount, skipped: skippedCount, duplicate: duplicateCount, orgs_created: orgsCreated.length },
        batch_id: batchId,
        source: 'excel_import'
      });

      res.json({
        batch_id: batchId,
        new: newCount,
        conflict: conflictCount,
        global_conflict: globalConflictCount,
        global_conflicts: globalConflicts,
        skipped: skippedCount,
        skipped_items: skippedItems,
        duplicate: duplicateCount,
        duplicate_items: duplicateItems,
        orgs_created: orgsCreated,
        total: records.length
      });
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: '导入失败: ' + err.message });
  }
});

app.get('/api/pending', (req, res) => {
  const { org_id, type, status } = req.query;
  let sql = 'SELECT * FROM pending_imports WHERE 1=1';
  const params = [];
  if (org_id) { sql += ' AND org_id = ?'; params.push(Number(org_id)); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += status ? ` AND status = ?` : " AND status = 'pending'";
  if (status) params.push(status);
  sql += ' ORDER BY id DESC';
  res.json(queryAll(sql, params));
});

function approveSingle(db, pending) {
  if (pending.type === 'new') {
    db.run(`
      INSERT INTO privacy (org_id, data_item, grade, confidentiality, integrity, availability, compliance, source_sheet)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [pending.org_id, pending.data_item, pending.grade, pending.confidentiality, pending.integrity, pending.availability, pending.compliance, pending.source_sheet || '']);

    const created = pending.org_id
      ? queryOne('SELECT * FROM privacy WHERE org_id = ? AND data_item = ?', [pending.org_id, pending.data_item])
      : queryOne('SELECT * FROM privacy WHERE org_id IS NULL AND data_item = ?', [pending.data_item]);

    const existingGlobal = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [pending.data_item]);
    if (!existingGlobal) {
      db.run(`
        INSERT INTO privacy_global (data_item, grade, confidentiality, integrity, availability, compliance, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [pending.data_item, pending.grade, pending.confidentiality, pending.integrity, pending.availability, pending.compliance, pending.source || 'import']);
    }

    writeAudit({
      privacy_id: created?.id || null,
      org_id: pending.org_id,
      action: 'approve_new',
      data_item: pending.data_item,
      old_values: {},
      new_values: privacyToValues(created),
      batch_id: pending.batch_id,
      source: 'review'
    });
  } else if (pending.type === 'update') {
    const existing = pending.privacy_id
      ? queryOne('SELECT * FROM privacy WHERE id = ?', [pending.privacy_id])
      : queryOne('SELECT * FROM privacy WHERE org_id = ? AND data_item = ?', [pending.org_id, pending.data_item]);

    if (!existing) {
      writeAudit({
        privacy_id: pending.privacy_id,
        org_id: pending.org_id,
        action: 'approve_update',
        data_item: pending.data_item,
        old_values: {},
        new_values: {},
        batch_id: pending.batch_id,
        source: 'review'
      });
      return;
    }

    const oldValues = privacyToValues(existing);

    db.run(`
      UPDATE privacy SET
        grade = ?, confidentiality = ?, integrity = ?,
        availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [pending.grade, pending.confidentiality, pending.integrity, pending.availability, pending.compliance, existing.id]);

    const updated = queryOne('SELECT * FROM privacy WHERE id = ?', [existing.id]);

    const existingGlobal = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [pending.data_item]);
    if (existingGlobal) {
      db.run(`
        UPDATE privacy_global SET
          grade = ?, confidentiality = ?, integrity = ?,
          availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE data_item = ?
      `, [pending.grade, pending.confidentiality, pending.integrity, pending.availability, pending.compliance, pending.data_item]);
    }

    writeAudit({
      privacy_id: existing.id,
      org_id: pending.org_id,
      action: 'approve_update',
      data_item: pending.data_item,
      old_values: oldValues,
      new_values: privacyToValues(updated),
      batch_id: pending.batch_id,
      source: 'review'
    });
  } else if (pending.type === 'delete') {
    const existing = pending.privacy_id
      ? queryOne('SELECT * FROM privacy WHERE id = ?', [pending.privacy_id])
      : queryOne('SELECT * FROM privacy WHERE org_id = ? AND data_item = ?', [pending.org_id, pending.data_item]);

    if (!existing) {
      writeAudit({
        privacy_id: pending.privacy_id,
        org_id: pending.org_id,
        action: 'approve_delete',
        data_item: pending.data_item,
        old_values: {},
        new_values: {},
        batch_id: pending.batch_id,
        source: 'review'
      });
      return;
    }

    const oldValues = privacyToValues(existing);

    db.run('DELETE FROM privacy WHERE id = ?', [existing.id]);

    writeAudit({
      privacy_id: existing.id,
      org_id: pending.org_id,
      action: 'approve_delete',
      data_item: pending.data_item,
      old_values: oldValues,
      new_values: {},
      batch_id: pending.batch_id,
      source: 'review'
    });
  } else if (pending.type === 'conflict') {
    const existing = pending.privacy_id
      ? queryOne('SELECT * FROM privacy WHERE id = ?', [pending.privacy_id])
      : queryOne('SELECT * FROM privacy WHERE org_id = ? AND data_item = ?', [pending.org_id, pending.data_item]);

    if (!existing) {
      writeAudit({
        privacy_id: pending.privacy_id,
        org_id: pending.org_id,
        action: 'approve_conflict',
        data_item: pending.data_item,
        old_values: {},
        new_values: {},
        batch_id: pending.batch_id,
        source: 'review'
      });
      return;
    }

    const oldValues = privacyToValues(existing);

    db.run(`
      UPDATE privacy SET
        grade = ?, confidentiality = ?, integrity = ?,
        availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [pending.grade, pending.confidentiality, pending.integrity, pending.availability, pending.compliance, existing.id]);

    const updated = queryOne('SELECT * FROM privacy WHERE id = ?', [existing.id]);

    const existingGlobal = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [pending.data_item]);
    if (existingGlobal) {
      db.run(`
        UPDATE privacy_global SET
          grade = ?, confidentiality = ?, integrity = ?,
          availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE data_item = ?
      `, [pending.grade, pending.confidentiality, pending.integrity, pending.availability, pending.compliance, pending.data_item]);
    }

    writeAudit({
      privacy_id: existing.id,
      org_id: pending.org_id,
      action: 'approve_conflict',
      data_item: pending.data_item,
      old_values: oldValues,
      new_values: privacyToValues(updated),
      batch_id: pending.batch_id,
      source: 'review'
    });
  }
}

app.post('/api/pending/review', (req, res) => {
  const { id, action } = req.body;
  if (!id || !action) return res.status(400).json({ error: '参数不完整' });
  if (!['approved', 'rejected'].includes(action)) return res.status(400).json({ error: '无效操作' });
  const pending = queryOne('SELECT * FROM pending_imports WHERE id = ? AND status = ?', [id, 'pending']);
  if (!pending) return res.status(404).json({ error: '记录不存在或已处理' });

  const db = getDb();
  db.run("UPDATE pending_imports SET status = ? WHERE id = ?", [action, id]);

  if (action === 'approved') {
    approveSingle(db, pending);
  } else {
    writeAudit({
      privacy_id: null, org_id: pending.org_id, action: 'reject',
      data_item: pending.data_item,
      old_values: privacyToValues(pending),
      new_values: {},
      batch_id: pending.batch_id,
      source: 'review'
    });
  }

  saveDb();
  res.json({ success: true });
});

app.post('/api/pending/batch-review', (req, res) => {
  const { ids, action } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '请选择记录' });
  if (!['approved', 'rejected'].includes(action)) return res.status(400).json({ error: '无效操作' });
  
  let count = 0;
  for (const id of ids) {
    const pending = queryOne("SELECT * FROM pending_imports WHERE id = ? AND status = 'pending'", [id]);
    if (!pending) continue;
    
    const db = getDb();
    db.run("UPDATE pending_imports SET status = ? WHERE id = ?", [action, id]);
    
    if (action === 'approved') {
      approveSingle(db, pending);
    } else {
      writeAudit({
        privacy_id: null, org_id: pending.org_id, action: 'reject',
        data_item: pending.data_item,
        old_values: privacyToValues(pending),
        new_values: {},
        batch_id: pending.batch_id,
        source: 'review'
      });
    }
    count++;
  }
  
  res.json({ success: true, processed: count });
});

app.post('/api/pending/approve-by-type', (req, res) => {
  const { org_id, type, action } = req.body;
  if (!['approved', 'rejected'].includes(action)) return res.status(400).json({ error: '无效操作' });
  let sql = "SELECT * FROM pending_imports WHERE status = 'pending'";
  const params = [];
  if (org_id) { sql += ' AND org_id = ?'; params.push(Number(org_id)); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  const items = queryAll(sql, params);
  const db = getDb();
  db.run('BEGIN TRANSACTION');
  try {
    for (const pending of items) {
      db.run("UPDATE pending_imports SET status = ? WHERE id = ?", [action, pending.id]);
      if (action === 'approved') {
        approveSingle(db, pending);
      } else {
        writeAudit({
          privacy_id: null, org_id: pending.org_id, action: 'reject',
          data_item: pending.data_item,
          old_values: privacyToValues(pending),
          new_values: {},
          batch_id: pending.batch_id,
          source: 'review'
        });
      }
    }
    db.run('COMMIT');
    saveDb();
    res.json({ success: true, processed: items.length });
  } catch (err) {
    db.run('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit-log', (req, res) => {
  const { privacy_id, org_id, action, batch_id, from, to, page = 1, limit = 50 } = req.query;
  let sql = 'SELECT a.*, o.name as org_name FROM audit_log a LEFT JOIN organizations o ON a.org_id = o.id WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as cnt FROM audit_log a WHERE 1=1';
  const params = [];
  const countParams = [];

  if (privacy_id) { sql += ' AND a.privacy_id = ?'; countSql += ' AND a.privacy_id = ?'; params.push(Number(privacy_id)); countParams.push(Number(privacy_id)); }
  if (org_id) { sql += ' AND a.org_id = ?'; countSql += ' AND a.org_id = ?'; params.push(Number(org_id)); countParams.push(Number(org_id)); }
  if (action) { sql += ' AND a.action = ?'; countSql += ' AND a.action = ?'; params.push(action); countParams.push(action); }
  if (batch_id) { sql += ' AND a.batch_id = ?'; countSql += ' AND a.batch_id = ?'; params.push(batch_id); countParams.push(batch_id); }
  if (from) { sql += ' AND a.created_at >= ?'; countSql += ' AND a.created_at >= ?'; params.push(from); countParams.push(from); }
  if (to) { sql += ' AND a.created_at <= ?'; countSql += ' AND a.created_at <= ?'; params.push(to); countParams.push(to); }

  const total = queryOne(countSql, countParams)?.cnt || 0;
  sql += ' ORDER BY a.id DESC';

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(200, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * pageSize;
  sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

  const rows = queryAll(sql, params);

  const parsed = rows.map(r => {
    let oldValues = {};
    let newValues = {};
    try { oldValues = JSON.parse(r.old_values); } catch {}
    try { newValues = JSON.parse(r.new_values); } catch {}
    
    // 解析额外的元数据
    let metadata = {};
    if (oldValues._metadata) {
      metadata = { ...oldValues._metadata };
      delete oldValues._metadata;
    }
    if (newValues._metadata) {
      metadata = { ...metadata, ...newValues._metadata };
      delete newValues._metadata;
    }
    
    return {
      ...r,
      old_values: oldValues,
      new_values: newValues,
      metadata: metadata
    };
  });

  res.json({ rows: parsed, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) });
});

app.get('/api/audit-log/rollback/:id', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const audit = queryOne('SELECT * FROM audit_log WHERE id = ?', [numId]);
  if (!audit) return res.status(404).json({ error: '审计记录不存在' });

  let oldValues, newValues;
  try { oldValues = JSON.parse(audit.old_values); } catch { oldValues = {}; }
  try { newValues = JSON.parse(audit.new_values); } catch { newValues = {}; }

  let currentValues = {};
  let currentRow = null;
  let currentGlobalRow = null;

  const isGlobalAction = ['create_global', 'update_global', 'delete_global'].includes(audit.action);

  if (isGlobalAction && audit.privacy_id) {
    currentGlobalRow = queryOne('SELECT * FROM privacy_global WHERE id = ?', [audit.privacy_id]);
    if (currentGlobalRow) {
      currentValues = {
        data_item: currentGlobalRow.data_item || '',
        grade: currentGlobalRow.grade || '',
        confidentiality: currentGlobalRow.confidentiality || '',
        integrity: currentGlobalRow.integrity || '',
        availability: currentGlobalRow.availability || '',
        compliance: currentGlobalRow.compliance || ''
      };
    }
  } else if (audit.privacy_id) {
    currentRow = queryOne('SELECT * FROM privacy WHERE id = ?', [audit.privacy_id]);
    if (currentRow) currentValues = privacyToValues(currentRow);
  }

  res.json({
    audit_id: numId,
    action: audit.action,
    data_item: audit.data_item,
    before: oldValues,
    after: newValues,
    current: currentValues,
    current_exists: !!(currentRow || currentGlobalRow)
  });
});

app.post('/api/audit-log/rollback/:id', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const audit = queryOne('SELECT * FROM audit_log WHERE id = ?', [numId]);
  if (!audit) return res.status(404).json({ error: '审计记录不存在' });

  let oldValues, newValues;
  try { oldValues = JSON.parse(audit.old_values); } catch { oldValues = {}; }
  try { newValues = JSON.parse(audit.new_values); } catch { newValues = {}; }

  let currentValues = {};
  let currentRow = null;
  let currentGlobalRow = null;

  const isGlobalAction = ['create_global', 'update_global', 'delete_global'].includes(audit.action);

  if (isGlobalAction && audit.privacy_id) {
    currentGlobalRow = queryOne('SELECT * FROM privacy_global WHERE id = ?', [audit.privacy_id]);
    if (currentGlobalRow) {
      currentValues = {
        data_item: currentGlobalRow.data_item || '',
        grade: currentGlobalRow.grade || '',
        confidentiality: currentGlobalRow.confidentiality || '',
        integrity: currentGlobalRow.integrity || '',
        availability: currentGlobalRow.availability || '',
        compliance: currentGlobalRow.compliance || ''
      };
    }
  } else if (audit.privacy_id) {
    currentRow = queryOne('SELECT * FROM privacy WHERE id = ?', [audit.privacy_id]);
    if (currentRow) currentValues = privacyToValues(currentRow);
  }

  const result = {
    audit_id: numId,
    action: audit.action,
    data_item: audit.data_item,
    before: oldValues,
    after: newValues,
    current: currentValues,
    current_exists: !!(currentRow || currentGlobalRow)
  };

  const db = getDb();

  const rollbackActions = [
    'approve_new', 'approve_update', 'approve_conflict', 'approve_delete',
    'rollback_delete', 'rollback_create', 'rollback_update',
    'create_global', 'update_global', 'delete_global'
  ];

  if (!rollbackActions.includes(audit.action)) {
    result.applied = false;
    result.error = '该操作类型不支持回退（仅已生效的操作可回退，待审核操作请使用撤销功能）';
    return res.json(result);
  }

  try {
    if (audit.action === 'approve_new') {
      if (currentRow) {
        writeAudit({
          privacy_id: audit.privacy_id, org_id: audit.org_id,
          action: 'rollback_delete', data_item: audit.data_item,
          old_values: currentValues, new_values: {},
          source: 'rollback'
        });
        db.run('DELETE FROM privacy WHERE id = ?', [audit.privacy_id]);
        saveDb();
        result.applied = true;
      } else {
        result.applied = false;
        result.error = '原始记录已不存在，无法回退';
      }
    }

    else if (audit.action === 'approve_update' || audit.action === 'approve_conflict') {
      if (currentRow) {
        const restoreVals = oldValues;
        db.run(`
          UPDATE privacy SET
            data_item = ?, grade = ?, confidentiality = ?, integrity = ?,
            availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          restoreVals.data_item || audit.data_item,
          restoreVals.grade || '',
          restoreVals.confidentiality || '',
          restoreVals.integrity || '',
          restoreVals.availability || '',
          restoreVals.compliance || '',
          audit.privacy_id
        ]);
        saveDb();

        const restored = queryOne('SELECT * FROM privacy WHERE id = ?', [audit.privacy_id]);

        writeAudit({
          privacy_id: audit.privacy_id, org_id: audit.org_id,
          action: 'rollback_update', data_item: audit.data_item,
          old_values: currentValues,
          new_values: privacyToValues(restored),
          source: 'rollback'
        });

        const globalRow = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [audit.data_item]);
        if (globalRow) {
          db.run(`
            UPDATE privacy_global SET
              grade = ?, confidentiality = ?, integrity = ?,
              availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
            WHERE data_item = ?
          `, [
            restoreVals.grade || '',
            restoreVals.confidentiality || '',
            restoreVals.integrity || '',
            restoreVals.availability || '',
            restoreVals.compliance || '',
            audit.data_item
          ]);
          saveDb();
        }

        result.applied = true;
        result.restored_values = privacyToValues(restored);
      } else {
        result.applied = false;
        result.error = '原始记录已不存在，无法回退';
      }
    }

    else if (audit.action === 'approve_delete') {
      const restoreVals = oldValues;
      const dataItem = restoreVals.data_item || audit.data_item;
      const existingCheck = queryOne('SELECT * FROM privacy WHERE org_id IS ? AND data_item = ?',
        [audit.org_id || null, dataItem]);

      if (existingCheck) {
        result.applied = false;
        result.error = '该组织下已存在同名数据项，无法恢复';
      } else {
        db.run(`
          INSERT INTO privacy (org_id, data_item, grade, confidentiality, integrity, availability, compliance)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          audit.org_id || null,
          dataItem,
          restoreVals.grade || '',
          restoreVals.confidentiality || '',
          restoreVals.integrity || '',
          restoreVals.availability || '',
          restoreVals.compliance || ''
        ]);
        saveDb();

        const restored = queryOne('SELECT * FROM privacy ORDER BY id DESC LIMIT 1');
        writeAudit({
          privacy_id: restored?.id || null, org_id: audit.org_id,
          action: 'rollback_create', data_item: audit.data_item,
          old_values: {},
          new_values: restoreVals,
          source: 'rollback'
        });

        result.applied = true;
        result.restored_id = restored?.id;
      }
    }

    else if (audit.action === 'rollback_delete') {
      const restoreVals = oldValues;
      const dataItem = restoreVals.data_item || audit.data_item;
      const existingCheck = queryOne('SELECT * FROM privacy WHERE org_id IS ? AND data_item = ?',
        [audit.org_id || null, dataItem]);

      if (existingCheck) {
        result.applied = false;
        result.error = '该组织下已存在同名数据项，无法恢复';
      } else {
        db.run(`
          INSERT INTO privacy (org_id, data_item, grade, confidentiality, integrity, availability, compliance)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          audit.org_id || null,
          dataItem,
          restoreVals.grade || '',
          restoreVals.confidentiality || '',
          restoreVals.integrity || '',
          restoreVals.availability || '',
          restoreVals.compliance || ''
        ]);
        saveDb();

        const restored = queryOne('SELECT * FROM privacy ORDER BY id DESC LIMIT 1');
        writeAudit({
          privacy_id: restored?.id || null, org_id: audit.org_id,
          action: 'rollback_create', data_item: audit.data_item,
          old_values: {},
          new_values: restoreVals,
          source: 'rollback'
        });

        result.applied = true;
        result.restored_id = restored?.id;
      }
    }

    else if (audit.action === 'rollback_create') {
      if (audit.privacy_id) {
        const row = queryOne('SELECT * FROM privacy WHERE id = ?', [audit.privacy_id]);
        if (row) {
          writeAudit({
            privacy_id: audit.privacy_id, org_id: audit.org_id,
            action: 'rollback_delete', data_item: audit.data_item,
            old_values: privacyToValues(row), new_values: {},
            source: 'rollback'
          });
          db.run('DELETE FROM privacy WHERE id = ?', [audit.privacy_id]);
          saveDb();
          result.applied = true;
        } else {
          result.applied = false;
          result.error = '记录已不存在';
        }
      }
    }

    else if (audit.action === 'rollback_update') {
      if (currentRow) {
        const restoreVals = oldValues;
        db.run(`
          UPDATE privacy SET
            data_item = ?, grade = ?, confidentiality = ?, integrity = ?,
            availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          restoreVals.data_item || audit.data_item,
          restoreVals.grade || '',
          restoreVals.confidentiality || '',
          restoreVals.integrity || '',
          restoreVals.availability || '',
          restoreVals.compliance || '',
          audit.privacy_id
        ]);
        saveDb();

        const restored = queryOne('SELECT * FROM privacy WHERE id = ?', [audit.privacy_id]);
        writeAudit({
          privacy_id: audit.privacy_id, org_id: audit.org_id,
          action: 'rollback_update', data_item: audit.data_item,
          old_values: currentValues,
          new_values: privacyToValues(restored),
          source: 'rollback'
        });
        result.applied = true;
        result.restored_values = privacyToValues(restored);
      } else {
        result.applied = false;
        result.error = '记录已不存在';
      }
    }

    else if (audit.action === 'create_global') {
      if (currentGlobalRow) {
        writeAudit({
          privacy_id: audit.privacy_id, org_id: null,
          action: 'delete_global', data_item: audit.data_item,
          old_values: currentValues, new_values: {},
          source: 'rollback'
        });
        db.run('DELETE FROM privacy_global WHERE id = ?', [audit.privacy_id]);
        saveDb();
        result.applied = true;
      } else {
        result.applied = false;
        result.error = '总表记录已不存在';
      }
    }

    else if (audit.action === 'update_global') {
      if (currentGlobalRow) {
        const restoreVals = oldValues;
        db.run(`
          UPDATE privacy_global SET
            data_item = ?, grade = ?, confidentiality = ?, integrity = ?,
            availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          restoreVals.data_item || audit.data_item,
          restoreVals.grade || '',
          restoreVals.confidentiality || '',
          restoreVals.integrity || '',
          restoreVals.availability || '',
          restoreVals.compliance || '',
          audit.privacy_id
        ]);
        saveDb();

        const restored = queryOne('SELECT * FROM privacy_global WHERE id = ?', [audit.privacy_id]);
        writeAudit({
          privacy_id: audit.privacy_id, org_id: null,
          action: 'rollback_update', data_item: audit.data_item,
          old_values: currentValues,
          new_values: {
            data_item: restored.data_item || '',
            grade: restored.grade || '',
            confidentiality: restored.confidentiality || '',
            integrity: restored.integrity || '',
            availability: restored.availability || '',
            compliance: restored.compliance || ''
          },
          source: 'rollback'
        });
        result.applied = true;
      } else {
        result.applied = false;
        result.error = '总表记录已不存在';
      }
    }

    else if (audit.action === 'delete_global') {
      const restoreVals = oldValues;
      const dataItem = restoreVals.data_item || audit.data_item;
      const dup = queryOne('SELECT * FROM privacy_global WHERE data_item = ?', [dataItem]);
      if (dup) {
        result.applied = false;
        result.error = '总表中已存在同名数据项，无法恢复';
      } else {
        db.run(`
          INSERT INTO privacy_global (data_item, grade, confidentiality, integrity, availability, compliance, source)
          VALUES (?, ?, ?, ?, ?, ?, 'rollback')
        `, [
          dataItem,
          restoreVals.grade || '',
          restoreVals.confidentiality || '',
          restoreVals.integrity || '',
          restoreVals.availability || '',
          restoreVals.compliance || ''
        ]);
        saveDb();

        const restored = queryOne('SELECT * FROM privacy_global ORDER BY id DESC LIMIT 1');
        writeAudit({
          privacy_id: restored?.id || null, org_id: null,
          action: 'rollback_create', data_item: audit.data_item,
          old_values: {},
          new_values: restoreVals,
          source: 'rollback'
        });
        result.applied = true;
        result.restored_id = restored?.id;
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '回退执行失败: ' + err.message });
  }
});

app.get('/api/export', (req, res) => {
  const { org_id } = req.query;
  let rows;
  if (org_id) rows = queryAll('SELECT * FROM privacy WHERE org_id = ? ORDER BY id', [Number(org_id)]);
  else rows = queryAll('SELECT * FROM privacy ORDER BY id');
  const buffer = buildExportBuffer(rows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=export.xlsx');
  res.send(buffer);
});

app.get('/api/summary', (req, res) => {
  const globalCount = queryOne('SELECT COUNT(*) as cnt FROM privacy_global')?.cnt || 0;
  const orgDataCount = queryOne('SELECT COUNT(*) as cnt FROM privacy WHERE org_id IS NOT NULL')?.cnt || 0;
  const totalPending = queryOne("SELECT COUNT(*) as cnt FROM pending_imports WHERE status = 'pending'")?.cnt || 0;
  const totalApproved = queryOne("SELECT COUNT(*) as cnt FROM audit_log WHERE action IN ('approve_new', 'approve_update', 'approve_conflict', 'approve_delete')")?.cnt || 0;
  const totalConflictsResolved = queryOne("SELECT COUNT(*) as cnt FROM audit_log WHERE action IN ('approve_conflict')")?.cnt || 0;
  const totalGlobalConflictsResolved = queryOne("SELECT COUNT(*) as cnt FROM audit_log WHERE source = 'gui_accept_global' OR (action = 'import' AND new_values LIKE '%global_conflict%')")?.cnt || 0;
  const orgCount = queryOne('SELECT COUNT(*) as cnt FROM organizations')?.cnt || 0;
  const leafOrgCount = queryAll('SELECT * FROM organizations').filter(o => {
    const children = queryOne('SELECT COUNT(*) as cnt FROM organizations WHERE parent_id = ?', [o.id])?.cnt || 0;
    return children === 0;
  }).length;

  const rectificationPending = queryOne("SELECT COUNT(*) as cnt FROM rectification_tasks WHERE status = 'pending'")?.cnt || 0;
  const rectificationConfirmed = queryOne("SELECT COUNT(*) as cnt FROM rectification_tasks WHERE status = 'confirmed'")?.cnt || 0;

  const perOrg = queryAll('SELECT org_id, COUNT(*) as cnt FROM privacy WHERE org_id IS NOT NULL GROUP BY org_id ORDER BY cnt DESC');
  const orgDetails = perOrg.map(p => {
    const org = queryOne('SELECT * FROM organizations WHERE id = ?', [p.org_id]);
    return { org_id: p.org_id, org_name: org?.name || '未知', level: org?.level || 0, data_count: p.cnt };
  });

  res.json({
    global_count: globalCount,
    org_data_count: orgDataCount,
    org_count: orgCount,
    leaf_org_count: leafOrgCount,
    total_pending: totalPending,
    total_approved: totalApproved,
    total_conflicts_resolved: totalConflictsResolved + totalGlobalConflictsResolved,
    rectification_pending: rectificationPending,
    rectification_confirmed: rectificationConfirmed,
    org_details: orgDetails
  });
});

app.get('/api/rectification-tasks', (req, res) => {
  const { org_id, status } = req.query;
  let sql = "SELECT * FROM rectification_tasks WHERE status = 'pending'";
  const params = [];
  if (org_id) { sql += ' AND org_id = ?'; params.push(Number(org_id)); }
  sql += ' ORDER BY id DESC';
  const rows = queryAll(sql, params);
  const orgNames = {};
  for (const row of rows) {
    if (row.org_id && !orgNames[row.org_id]) {
      const org = queryOne('SELECT name FROM organizations WHERE id = ?', [row.org_id]);
      orgNames[row.org_id] = org?.name || '未知';
    }
  }
  res.json(rows.map(r => ({ ...r, org_name: orgNames[r.org_id] || '-' })));
});

app.post('/api/rectification-tasks/:id/confirm', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const task = queryOne("SELECT * FROM rectification_tasks WHERE id = ? AND status = 'pending'", [numId]);
  if (!task) return res.status(404).json({ error: '整改任务不存在或已处理' });

  const db = getDb();
  db.run(`
    UPDATE privacy SET
      grade = ?, confidentiality = ?, integrity = ?,
      availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [task.global_grade, task.global_confidentiality, task.global_integrity, task.global_availability, task.global_compliance, task.privacy_id]);

  db.run("UPDATE rectification_tasks SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?", [numId]);
  saveDb();

  writeAudit({
    privacy_id: task.privacy_id,
    org_id: task.org_id,
    action: 'rectification_confirm',
    data_item: task.data_item,
    old_values: { grade: task.org_grade, confidentiality: task.org_confidentiality, integrity: task.org_integrity, availability: task.org_availability, compliance: task.org_compliance },
    new_values: { grade: task.global_grade, confidentiality: task.global_confidentiality, integrity: task.global_integrity, availability: task.global_availability, compliance: task.global_compliance },
    source: 'rectification'
  });

  res.json({ success: true });
});

app.post('/api/rectification-tasks/batch-confirm', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '请选择任务' });

  let count = 0;
  for (const tid of ids) {
    const task = queryOne("SELECT * FROM rectification_tasks WHERE id = ? AND status = 'pending'", [Number(tid)]);
    if (!task) continue;
    
    const db = getDb();
    db.run(`
      UPDATE privacy SET
        grade = ?, confidentiality = ?, integrity = ?,
        availability = ?, compliance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [task.global_grade, task.global_confidentiality, task.global_integrity, task.global_availability, task.global_compliance, task.privacy_id]);
    db.run("UPDATE rectification_tasks SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?", [Number(tid)]);
    writeAudit({
      privacy_id: task.privacy_id,
      org_id: task.org_id,
      action: 'rectification_confirm',
      data_item: task.data_item,
      old_values: { grade: task.org_grade, confidentiality: task.org_confidentiality, integrity: task.org_integrity, availability: task.org_availability, compliance: task.org_compliance },
      new_values: { grade: task.global_grade, confidentiality: task.global_confidentiality, integrity: task.global_integrity, availability: task.global_availability, compliance: task.global_compliance },
      source: 'rectification'
    });
    count++;
  }
  
  res.json({ success: true, confirmed: count });
});

app.post('/api/rectification-tasks/:id/dismiss', (req, res) => {
  const { id } = req.params;
  const numId = Number(id);
  const task = queryOne("SELECT * FROM rectification_tasks WHERE id = ? AND status = 'pending'", [numId]);
  if (!task) return res.status(404).json({ error: '整改任务不存在或已处理' });

  runSql("UPDATE rectification_tasks SET status = 'dismissed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?", [numId]);
  res.json({ success: true });
});

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => { console.error('Failed to init database:', err); process.exit(1); });
