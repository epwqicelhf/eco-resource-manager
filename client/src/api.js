const API_BASE = '/api';

export async function fetchOrgTree() {
  const res = await fetch(`${API_BASE}/orgs/tree`);
  return res.json();
}

export async function fetchOrgs() {
  const res = await fetch(`${API_BASE}/orgs`);
  return res.json();
}

export async function createOrg(data) {
  const res = await fetch(`${API_BASE}/orgs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function updateOrg(id, data) {
  const res = await fetch(`${API_BASE}/orgs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteOrg(id) {
  const res = await fetch(`${API_BASE}/orgs/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchPrivacy(orgId, search = '') {
  const params = new URLSearchParams();
  if (orgId) params.set('org_id', orgId);
  if (search) params.set('q', search);
  const res = await fetch(`${API_BASE}/privacy?${params}`);
  return res.json();
}

export async function createPrivacy(data) {
  const res = await fetch(`${API_BASE}/privacy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function updatePrivacy(id, data) {
  const res = await fetch(`${API_BASE}/privacy/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deletePrivacy(id) {
  const res = await fetch(`${API_BASE}/privacy/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchPrivacyGlobal() {
  const res = await fetch(`${API_BASE}/privacy-global`);
  return res.json();
}

export async function createPrivacyGlobal(data) {
  const res = await fetch(`${API_BASE}/privacy-global`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function updatePrivacyGlobal(id, data) {
  const res = await fetch(`${API_BASE}/privacy-global/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deletePrivacyGlobal(id) {
  const res = await fetch(`${API_BASE}/privacy-global/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function searchPrivacyGlobal(q) {
  const res = await fetch(`${API_BASE}/privacy-global/search?q=${encodeURIComponent(q)}`);
  return res.json();
}

export async function matchPrivacyGlobal(dataItem) {
  const res = await fetch(`${API_BASE}/privacy-global/match?data_item=${encodeURIComponent(dataItem)}`);
  return res.json();
}

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/summary`);
  return res.json();
}

export async function uploadImport(file, orgId, acceptGlobalConflicts = false) {
  const formData = new FormData();
  formData.append('file', file);
  if (orgId) formData.append('org_id', orgId);
  if (acceptGlobalConflicts) formData.append('accept_global_conflicts', 'true');
  const res = await fetch(`${API_BASE}/upload/import`, { method: 'POST', body: formData });
  return res.json();
}

export function downloadImportTemplate() {
  window.open(`${API_BASE}/upload/template`, '_blank');
}

export async function fetchPending(orgId, type) {
  const params = new URLSearchParams();
  if (orgId) params.set('org_id', orgId);
  if (type) params.set('type', type);
  const res = await fetch(`${API_BASE}/pending?${params}`);
  return res.json();
}

export async function fetchPendingByPrivacy(privacyId) {
  const res = await fetch(`${API_BASE}/pending/by-privacy/${privacyId}`);
  return res.json();
}

export async function fetchGuiPending(orgId, type) {
  const params = new URLSearchParams();
  if (orgId) params.set('org_id', orgId);
  if (type) params.set('type', type);
  const res = await fetch(`${API_BASE}/pending/gui?${params}`);
  return res.json();
}

export async function cancelPending(id) {
  const res = await fetch(`${API_BASE}/pending/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function reviewPending(id, action) {
  const res = await fetch(`${API_BASE}/pending/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action })
  });
  return res.json();
}

export async function batchReview(ids, action) {
  const res = await fetch(`${API_BASE}/pending/batch-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, action })
  });
  return res.json();
}

export async function approveByType(orgId, type, action) {
  const res = await fetch(`${API_BASE}/pending/approve-by-type`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_id: orgId, type, action })
  });
  return res.json();
}

export async function fetchAuditLog(filters = {}) {
  const params = new URLSearchParams();
  if (filters.privacy_id) params.set('privacy_id', filters.privacy_id);
  if (filters.org_id) params.set('org_id', filters.org_id);
  if (filters.action) params.set('action', filters.action);
  if (filters.batch_id) params.set('batch_id', filters.batch_id);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', filters.page);
  if (filters.limit) params.set('limit', filters.limit);
  const res = await fetch(`${API_BASE}/audit-log?${params}`);
  return res.json();
}

export async function previewRollback(auditId) {
  const res = await fetch(`${API_BASE}/audit-log/rollback/${auditId}?preview=1`);
  return res.json();
}

export async function applyRollback(auditId) {
  const res = await fetch(`${API_BASE}/audit-log/rollback/${auditId}`, { method: 'POST' });
  return res.json();
}

export function exportPrivacy(orgId) {
  const params = new URLSearchParams();
  if (orgId) params.set('org_id', orgId);
  const qs = params.toString();
  window.open(`${API_BASE}/export${qs ? '?' + qs : ''}`, '_blank');
}

export async function fetchRectificationTasks(orgId) {
  const params = new URLSearchParams();
  if (orgId) params.set('org_id', orgId);
  const res = await fetch(`${API_BASE}/rectification-tasks?${params}`);
  return res.json();
}

export async function confirmRectificationTask(id) {
  const res = await fetch(`${API_BASE}/rectification-tasks/${id}/confirm`, { method: 'POST' });
  return res.json();
}

export async function batchConfirmRectificationTasks(ids) {
  const res = await fetch(`${API_BASE}/rectification-tasks/batch-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  return res.json();
}

export async function dismissRectificationTask(id) {
  const res = await fetch(`${API_BASE}/rectification-tasks/${id}/dismiss`, { method: 'POST' });
  return res.json();
}

export async function distributeGlobal(globalId, orgIds) {
  const res = await fetch(`${API_BASE}/privacy-global/${globalId}/distribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_ids: orgIds })
  });
  return res.json();
}

export async function conflictCheckGlobal(apply = false) {
  const res = await fetch(`${API_BASE}/privacy-global/conflict-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply })
  });
  return res.json();
}
