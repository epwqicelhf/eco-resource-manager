import { useState, useEffect, useCallback } from 'react'
import { fetchAuditLog, previewRollback, applyRollback, fetchOrgs } from '../api'

const ACTION_LABELS = {
  gui_create: 'GUI新增(待审核)',
  gui_update: 'GUI修改(待审核)',
  gui_delete: 'GUI删除(待审核)',
  import: '批量导入',
  approve_new: '审核通过(新增)',
  approve_update: '审核通过(修改)',
  approve_delete: '审核通过(删除)',
  approve_conflict: '审核通过(冲突)',
  reject: '审核驳回',
  cancel_pending: '撤销待审核',
  rollback_delete: '回退(删除)',
  rollback_create: '回退(恢复)',
  rollback_update: '回退(修改)',
  create_global: '总表新增',
  update_global: '总表修改',
  delete_global: '总表删除',
  rectification_confirm: '整改确认',
  distribute_global: '下发至组织',
  global_sync_apply: '总表同步应用',
}

const ACTION_COLORS = {
  gui_create: '#8bc34a',
  gui_update: '#03a9f4',
  gui_delete: '#f44336',
  import: 'var(--warning)',
  approve_new: 'var(--success)',
  approve_update: 'var(--success)',
  approve_delete: 'var(--danger)',
  approve_conflict: 'var(--success)',
  reject: 'var(--danger)',
  cancel_pending: 'var(--text-muted)',
  rollback_delete: '#ff9800',
  rollback_create: '#ff9800',
  rollback_update: '#ff9800',
  create_global: '#9c27b0',
  update_global: '#9c27b0',
  delete_global: '#9c27b0',
  rectification_confirm: '#00bcd4',
  distribute_global: '#e91e63',
  global_sync_apply: '#795548',
}

const ROLLBACKABLE_ACTIONS = [
  'approve_new', 'approve_update', 'approve_conflict', 'approve_delete',
  'rollback_delete', 'rollback_create', 'rollback_update',
  'create_global', 'update_global', 'delete_global',
  'global_sync_apply'
]

const FIELDS = ['data_item', 'grade', 'confidentiality', 'integrity', 'availability', 'compliance']
const FIELD_LABELS = { data_item: '数据项', grade: '综合等级', confidentiality: '机密性', integrity: '完整性', availability: '可用性', compliance: '合规性' }

function AuditLogDetail({ log, onClose }) {
  const oldValues = log.old_values || {}
  const newValues = log.new_values || {}
  const metadata = log.metadata || {}
  
  // 判断哪些字段发生了变化
  const changedFields = FIELDS.filter(f => oldValues[f] !== newValues[f])
  
  return (
    <div className="rollback-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rollback-content" style={{ maxWidth: '1000px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--primary)' }}>审计日志详情 #{log.id}</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '4px 12px' }}>关闭</button>
        </div>

        {/* 基本信息 */}
        <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(0,168,255,0.05)', borderRadius: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <strong>操作类型：</strong>
              <span className="action-badge" style={{ color: ACTION_COLORS[log.action] || 'var(--text)', borderColor: ACTION_COLORS[log.action] || 'var(--border)', marginLeft: '8px' }}>
                {ACTION_LABELS[log.action] || log.action}
              </span>
            </div>
            <div><strong>数据项：</strong>{log.data_item}</div>
            <div><strong>组织：</strong>{log.org_name || (log.org_id ? `ID: ${log.org_id}` : '-')}</div>
            <div><strong>操作时间：</strong>{log.created_at}</div>
            <div><strong>操作来源：</strong>{log.source || '-'}</div>
            {log.batch_id && <div><strong>批次ID：</strong>{log.batch_id.substring(0, 12)}...</div>}
          </div>
          
          {/* 元数据信息 */}
          {Object.keys(metadata).length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,168,255,0.2)' }}>
              <strong>组织上下文：</strong>
              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.9rem' }}>
                {metadata.source_org_name && (
                  <div><span style={{ color: 'var(--text-muted)' }}>来源组织：</span>{metadata.source_org_name}</div>
                )}
                {metadata.target_org_name && (
                  <div><span style={{ color: 'var(--text-muted)' }}>目标组织：</span>{metadata.target_org_name}</div>
                )}
                {metadata.source_org_id && (
                  <div><span style={{ color: 'var(--text-muted)' }}>来源组织ID：</span>{metadata.source_org_id}</div>
                )}
                {metadata.target_org_id && (
                  <div><span style={{ color: 'var(--text-muted)' }}>目标组织ID：</span>{metadata.target_org_id}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 数据变更对比 */}
        {(Object.keys(oldValues).length > 0 || Object.keys(newValues).length > 0) && (
          <div>
            <h4 style={{ marginBottom: '12px', color: 'var(--primary)' }}>数据变更详情</h4>
            
            {changedFields.length > 0 && (
              <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(255,193,7,0.1)', borderRadius: '4px', fontSize: '0.9rem' }}>
                <strong>变更字段：</strong>{changedFields.map(f => FIELD_LABELS[f]).join('、')}
              </div>
            )}

            <div className="rollback-table">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>字段</th>
                    <th style={{ width: '35%', color: 'var(--danger)' }}>修改前的值</th>
                    <th style={{ width: '35%', color: 'var(--success)' }}>修改后的值</th>
                    <th style={{ width: '10%' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map(f => {
                    const oldVal = oldValues[f] || ''
                    const newVal = newValues[f] || ''
                    const hasChange = oldVal !== newVal
                    const isEmpty = !oldVal && !newVal
                    
                    if (isEmpty) return null
                    
                    return (
                      <tr key={f} className={hasChange ? 'cell-changed' : ''}>
                        <td><strong>{FIELD_LABELS[f]}</strong></td>
                        <td style={{ color: hasChange ? 'var(--danger)' : 'inherit' }}>
                          {oldVal || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(空)</span>}
                        </td>
                        <td style={{ color: hasChange ? 'var(--success)' : 'inherit' }}>
                          {newVal || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(空)</span>}
                        </td>
                        <td>
                          {hasChange ? (
                            <span style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>● 已变更</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>● 未变更</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 操作类型说明 */}
        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(0,168,255,0.05)', borderRadius: '6px', fontSize: '0.9rem' }}>
          <strong>操作说明：</strong>
          <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
            {log.action === 'gui_create' && '通过界面新增隐私数据，数据进入待审核状态'}
            {log.action === 'gui_update' && '通过界面修改隐私数据，修改进入待审核状态'}
            {log.action === 'gui_delete' && '通过界面删除隐私数据，删除进入待审核状态'}
            {log.action === 'import' && '通过Excel批量导入数据'}
            {log.action === 'approve_new' && '审核通过新增操作，数据正式入库'}
            {log.action === 'approve_update' && '审核通过修改操作，更新正式数据'}
            {log.action === 'approve_delete' && '审核通过删除操作，删除正式数据'}
            {log.action === 'approve_conflict' && '审核通过冲突数据，使用新值更新'}
            {log.action === 'reject' && '审核驳回，数据变更被撤销'}
            {log.action === 'cancel_pending' && '撤销待审核操作'}
            {log.action === 'rollback_delete' && '回退操作：删除记录'}
            {log.action === 'rollback_create' && '回退操作：恢复已删除的记录'}
            {log.action === 'rollback_update' && '回退操作：恢复到修改前的值'}
            {log.action === 'create_global' && '在总表中新增数据项'}
            {log.action === 'update_global' && '修改总表中的数据项'}
            {log.action === 'delete_global' && '删除总表中的数据项'}
            {log.action === 'rectification_confirm' && '确认整改任务，应用总表数据到组织'}
            {log.action === 'distribute_global' && '将总表数据下发到指定组织'}
            {log.action === 'global_sync_apply' && '应用总表同步，更新组织数据'}
          </div>
        </div>
      </div>
    </div>
  )
}

function RollbackPreview({ auditId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    previewRollback(auditId).then(d => { setData(d); setLoading(false) }).catch(e => { setError(e.message); setLoading(false) })
  }, [auditId])

  const handleRollback = async () => {
    if (!confirm('确认执行回退操作？此操作将恢复数据并记录审计日志。')) return
    try {
      const res = await applyRollback(auditId)
      if (res.error) { setError(res.error); return }
      if (res.applied) {
        setApplied(true)
      } else {
        setError(res.error || '回退未执行')
      }
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="loading">加载中...</div>
  if (!data) return null

  const isDeleteAction = ['approve_new', 'rollback_delete'].includes(data.action) || data.action === 'create_global'
  const isRestoreAction = ['approve_delete', 'rollback_create'].includes(data.action) || data.action === 'delete_global'

  return (
    <div className="rollback-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rollback-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--primary)' }}>回退预览 - {data.data_item}</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '4px 12px' }}>关闭</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {applied ? (
          <div className="alert alert-success">
            回退操作已成功执行，审计日志已记录。
            {data.restored_id && <span>（恢复记录ID: {data.restored_id}）</span>}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(0,168,255,0.08)', borderRadius: '6px', fontSize: '0.9rem' }}>
              操作类型：<strong>{ACTION_LABELS[data.action] || data.action}</strong>
              {isDeleteAction && <span style={{ color: 'var(--danger)', marginLeft: '8px' }}>→ 回退将删除该记录</span>}
              {isRestoreAction && <span style={{ color: 'var(--success)', marginLeft: '8px' }}>→ 回退将恢复该记录</span>}
              {!isDeleteAction && !isRestoreAction && <span style={{ color: 'var(--primary)', marginLeft: '8px' }}>→ 回退将恢复修改前的值</span>}
            </div>

            <div className="rollback-table">
              <table>
                <thead>
                  <tr>
                    <th>字段</th>
                    <th style={{ color: 'var(--danger)' }}>操作前的值</th>
                    <th style={{ color: 'var(--success)' }}>操作后的值</th>
                    <th style={{ color: 'var(--warning)' }}>当前值</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map(f => {
                    const before = data.before?.[f] || ''
                    const after = data.after?.[f] || ''
                    const current = data.current?.[f] || ''
                    const hasDiff = before !== current
                    return (
                      <tr key={f}>
                        <td><strong>{FIELD_LABELS[f]}</strong></td>
                        <td>{before || '-'}</td>
                        <td>{after || '-'}</td>
                        <td className={hasDiff ? 'cell-changed' : ''}>
                          {data.current_exists ? (current || '-') : '(记录已删除)'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {!error && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={handleRollback}>
                  执行回退
                </button>
                <button className="btn btn-secondary" onClick={onClose}>取消</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AuditLog({ filterPrivacyId, onSelectOrg, onClearFilter }) {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState([])
  const [filters, setFilters] = useState({
    org_id: '', action: '', from: '', to: ''
  })
  const [rollbackId, setRollbackId] = useState(null)
  const [detailLog, setDetailLog] = useState(null)

  useEffect(() => { fetchOrgs().then(setOrgs).catch(console.error) }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const f = { ...filters, page, limit: 30 }
      if (filterPrivacyId) f.privacy_id = filterPrivacyId
      const res = await fetchAuditLog(f)
      setLogs(res.rows)
      setTotal(res.total)
      setPages(res.pages)
      setPage(res.page)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [filters, page, filterPrivacyId])

  useEffect(() => { loadLogs() }, [loadLogs])

  const handleFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  return (
    <div>
      <div className="stats">
        <div className="stat-box"><div className="stat-value">{total}</div><div className="stat-label">审计记录总数（上限2万条）</div></div>
      </div>

      <div className="card">
        <div className="card-title">审计日志 {filterPrivacyId ? `- 数据项 #${filterPrivacyId}` : ''}</div>

        <div className="search-box" style={{ flexWrap: 'wrap' }}>
          <select value={filters.org_id} onChange={e => handleFilter('org_id', e.target.value)} style={{ flex: '0 0 180px' }}>
            <option value="">全部组织</option>
            {orgs.map(o => (<option key={o.id} value={o.id}>{' '.repeat(o.level - 1)}{o.name}</option>))}
          </select>

          <select value={filters.action} onChange={e => handleFilter('action', e.target.value)} style={{ flex: '0 0 180px' }}>
            <option value="">全部操作</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>

          <input type="date" value={filters.from} onChange={e => handleFilter('from', e.target.value)} style={{ flex: '0 0 160px' }} />
          <input type="date" value={filters.to} onChange={e => handleFilter('to', e.target.value)} style={{ flex: '0 0 160px' }} />

          <button className="btn btn-primary" onClick={loadLogs}>查询</button>
          {filterPrivacyId && onClearFilter && (
            <button className="btn btn-secondary" onClick={onClearFilter}>查看全部日志</button>
          )}
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><p>暂无审计记录</p></div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>操作</th>
                    <th>数据项</th>
                    <th>组织</th>
                    <th>来源</th>
                    <th>批次</th>
                    <th>时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const canRollback = ROLLBACKABLE_ACTIONS.includes(log.action)
                    return (
                      <tr key={log.id}>
                        <td>{log.id}</td>
                        <td>
                          <span className="action-badge" style={{ color: ACTION_COLORS[log.action] || 'var(--text)', borderColor: ACTION_COLORS[log.action] || 'var(--border)' }}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td>{log.data_item}</td>
                        <td>{log.org_name || (log.org_id ? `ID: ${log.org_id}` : '-')}</td>
                        <td>{log.source}</td>
                        <td>{log.batch_id ? log.batch_id.substring(0, 8) : '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{log.created_at}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.8rem', marginRight: '4px' }}
                            onClick={() => setDetailLog(log)}
                          >
                            详情
                          </button>
                          {canRollback && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                              onClick={() => setRollbackId(log.id)}
                            >
                              回退
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pagination">
                <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
                <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>第 {page} / {pages} 页，共 {total} 条</span>
                <button className="btn btn-secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>下一页</button>
              </div>
            )}
          </>
        )}
      </div>

      {rollbackId && <RollbackPreview auditId={rollbackId} onClose={() => setRollbackId(null)} />}
      {detailLog && <AuditLogDetail log={detailLog} onClose={() => setDetailLog(null)} />}
    </div>
  )
}

export default AuditLog
