import { useState, useEffect, useCallback } from 'react'
import { fetchPrivacyGlobal, createPrivacyGlobal, updatePrivacyGlobal, deletePrivacyGlobal, distributeGlobal, conflictCheckGlobal, fetchOrgTree } from '../api'
import DataTable from './DataTable'

const FIELDS = [
  { key: 'data_item', label: '数据项' },
  { key: 'grade', label: '综合等级' },
  { key: 'confidentiality', label: '机密性' },
  { key: 'integrity', label: '完整性' },
  { key: 'availability', label: '可用性' },
  { key: 'compliance', label: '合规性' }
]

const DATA_FIELDS = FIELDS.filter(f => f.key !== 'data_item')

function EmptyForm() {
  return { data_item: '', grade: '', confidentiality: '', integrity: '', availability: '', compliance: '' }
}

function OrgCheckItem({ node, selectedIds, onToggle, depth = 0 }) {
  const hasChildren = node.children && node.children.length > 0
  const isLeaf = !hasChildren
  const isSelected = selectedIds.has(node.id)

  return (
    <div>
      <div
        className={`org-check-item ${!isLeaf ? 'org-check-disabled' : ''}`}
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
        onClick={() => isLeaf && onToggle(node.id)}
      >
        <input type="checkbox" checked={isSelected} disabled={!isLeaf} readOnly style={{ marginRight: '8px' }} />
        <span>{node.name}</span>
        {isLeaf && <span className="ts-leaf-badge" style={{ marginLeft: '6px' }}>叶子</span>}
        {!isLeaf && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>(非叶子,不可选)</span>}
      </div>
      {hasChildren && node.children.map(child => (
        <OrgCheckItem key={child.id} node={child} selectedIds={selectedIds} onToggle={onToggle} depth={depth + 1} />
      ))}
    </div>
  )
}

function DistributeModal({ globalRecord, onClose }) {
  const [tree, setTree] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => { fetchOrgTree().then(setTree).catch(console.error) }, [])

  const toggle = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    const leafIds = getLeafIds(tree)
    const allSelected = leafIds.every(id => selectedIds.has(id))
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(leafIds))
  }

  const handleDistribute = async () => {
    if (selectedIds.size === 0) return
    setLoading(true)
    const res = await distributeGlobal(globalRecord.id, [...selectedIds])
    setResult(res)
    setLoading(false)
  }

  return (
    <div className="rollback-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rollback-content" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--primary)' }}>下发至组织 - {globalRecord.data_item}</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '4px 12px' }}>关闭</button>
        </div>

        <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(0,168,255,0.08)', borderRadius: '6px', fontSize: '0.85rem' }}>
          将按总表值下发为待审核数据，审核通过后入库到对应组织。仅叶子节点可选。
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', marginBottom: '12px' }}>
          <div className="org-check-item" onClick={toggleAll} style={{ fontWeight: '600', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '4px' }}>
            <input type="checkbox" checked={selectedIds.size > 0 && getLeafIds(tree).every(id => selectedIds.has(id))} readOnly style={{ marginRight: '8px' }} />
            全选叶子节点 ({selectedIds.size}/{getLeafIds(tree).length})
          </div>
          {tree.map(node => (
            <OrgCheckItem key={node.id} node={node} selectedIds={selectedIds} onToggle={toggle} />
          ))}
        </div>

        {result && (
          <div className={result.error ? 'alert alert-error' : 'alert alert-success'}>
            {result.error || `成功下发 ${result.distributed} 条，跳过 ${result.skipped} 条（已存在或非叶子节点）`}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-success" onClick={handleDistribute} disabled={loading || selectedIds.size === 0}>
            {loading ? '下发中...' : `确认下发 (${selectedIds.size})`}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}

function ConflictCheckModal({ onClose }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    conflictCheckGlobal(false).then(r => { setResult(r); setLoading(false) }).catch(e => { setResult({ error: e.message }); setLoading(false) })
  }, [])

  const handleApply = async () => {
    if (!confirm(`确认将总表数据应用到 ${result.conflicts} 条冲突记录？组织数据将被覆盖为总表值。`)) return
    setApplying(true)
    const r = await conflictCheckGlobal(true)
    setApplied(true)
    setResult(r)
    setApplying(false)
  }

  if (loading) return <div className="rollback-modal" onClick={e => e.target === e.currentTarget && onClose()}><div className="rollback-content"><div className="loading">检查冲突中...</div></div></div>

  return (
    <div className="rollback-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rollback-content" style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--primary)' }}>冲突检查结果</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '4px 12px' }}>关闭</button>
        </div>

        {result.error && <div className="alert alert-error">{result.error}</div>}

        {!result.error && result.conflicts === 0 && (
          <div className="alert alert-success">所有组织数据与总表一致，无冲突。</div>
        )}

        {!result.error && result.conflicts > 0 && (
          <>
            <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(255,193,7,0.1)', borderRadius: '6px', fontSize: '0.9rem' }}>
              发现 <strong style={{ color: 'var(--warning)' }}>{result.conflicts}</strong> 条组织数据与总表不一致
              {applied && <span style={{ color: 'var(--success)', marginLeft: '12px' }}>已应用 {result.applied} 条，审计日志已记录</span>}
            </div>

            {!applied && (
              <div style={{ marginBottom: '12px' }}>
                <button className="btn btn-success" onClick={handleApply} disabled={applying}>
                  {applying ? '应用中...' : '应用总表数据到所有冲突'}
                </button>
              </div>
            )}

            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>数据项</th>
                    <th>组织</th>
                    {DATA_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.details.map((c, idx) => (
                    <tr key={idx}>
                      <td><strong>{c.data_item}</strong></td>
                      <td>{c.org_name}</td>
                      {DATA_FIELDS.map(f => {
                        const diff = c.diffs.find(d => d.field === f.label)
                        return (
                          <td key={f.key}>
                            {diff ? (
                              <span>
                                <span style={{ textDecoration: 'line-through', color: 'var(--danger)', fontSize: '0.8rem' }}>{diff.org_val || '-'}</span>
                                <br />
                                <span style={{ color: 'var(--success)', fontWeight: '600' }}>{diff.global_val || '-'}</span>
                              </span>
                            ) : (
                              <span>{c.org_values[f.key] || '-'}</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function getLeafIds(nodes) {
  const ids = []
  for (const node of nodes) {
    if (!node.children || node.children.length === 0) {
      ids.push(node.id)
    } else {
      ids.push(...getLeafIds(node.children))
    }
  }
  return ids
}

function GlobalTable({ onViewAudit }) {
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EmptyForm())
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(EmptyForm())
  const [error, setError] = useState(null)
  const [distributeRecord, setDistributeRecord] = useState(null)
  const [showConflictCheck, setShowConflictCheck] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchPrivacyGlobal()
      setData(rows)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = search
    ? data.filter(r => r.data_item.toLowerCase().includes(search.toLowerCase()))
    : data

  const handleAdd = async () => {
    if (!addForm.data_item.trim()) { setError('数据项名称不能为空'); return }
    if (!addForm.grade.trim()) { setError('综合等级不能为空'); return }
    if (!addForm.confidentiality.trim()) { setError('机密性不能为空'); return }
    if (!addForm.integrity.trim()) { setError('完整性不能为空'); return }
    if (!addForm.availability.trim()) { setError('可用性不能为空'); return }
    if (!addForm.compliance.trim()) { setError('合规性不能为空'); return }
    const rangeFields = ['grade', 'confidentiality', 'integrity', 'availability', 'compliance']
    const rangeLabels = { grade: '综合等级', confidentiality: '机密性', integrity: '完整性', availability: '可用性', compliance: '合规性' }
    for (const f of rangeFields) {
      const num = Number(addForm[f])
      if (!Number.isInteger(num) || num < 1 || num > 5) {
        setError(`${rangeLabels[f]}必须为1-5的整数（当前值: ${addForm[f]}）`); return
      }
    }
    const res = await createPrivacyGlobal(addForm)
    if (res.error) { setError(res.error); return }
    setAddForm(EmptyForm())
    setShowAdd(false)
    setError(null)
    loadData()
  }

  const handleEdit = async () => {
    if (!editForm.data_item.trim()) { setError('数据项名称不能为空'); return }
    if (!editForm.grade.trim()) { setError('综合等级不能为空'); return }
    if (!editForm.confidentiality.trim()) { setError('机密性不能为空'); return }
    if (!editForm.integrity.trim()) { setError('完整性不能为空'); return }
    if (!editForm.availability.trim()) { setError('可用性不能为空'); return }
    if (!editForm.compliance.trim()) { setError('合规性不能为空'); return }
    const rangeFields = ['grade', 'confidentiality', 'integrity', 'availability', 'compliance']
    const rangeLabels = { grade: '综合等级', confidentiality: '机密性', integrity: '完整性', availability: '可用性', compliance: '合规性' }
    for (const f of rangeFields) {
      const num = Number(editForm[f])
      if (!Number.isInteger(num) || num < 1 || num > 5) {
        setError(`${rangeLabels[f]}必须为1-5的整数（当前值: ${editForm[f]}）`); return
      }
    }
    const res = await updatePrivacyGlobal(editId, editForm)
    if (res.error) { setError(res.error); return }
    setEditId(null)
    setEditForm(EmptyForm())
    setError(null)
    loadData()
  }

  const handleDelete = async (id) => {
    if (!confirm('确认从总表中删除该记录？\n注意：仅删除总表记录，不影响各组织下的隐私数据。')) return
    await deletePrivacyGlobal(id)
    loadData()
  }

  const startEdit = (row) => {
    setEditId(row.id)
    setEditForm({
      data_item: row.data_item || '',
      grade: row.grade || '',
      confidentiality: row.confidentiality || '',
      integrity: row.integrity || '',
      availability: row.availability || '',
      compliance: row.compliance || ''
    })
    setError(null)
  }

  return (
    <div>
      <div className="stats">
        <div className="stat-box"><div className="stat-value">{data.length}</div><div className="stat-label">总表数据项</div></div>
      </div>

      <div className="card">
        <div className="card-title">隐私数据总表</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
          总表独立管理，不归属任何组织。可将总表数据下发到指定组织，也可一键检查并修复所有组织数据与总表的冲突。
        </p>

        <div className="search-box">
          <input type="text" placeholder="搜索数据项..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={loadData}>刷新</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}

        <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => { setShowAdd(!showAdd); setAddForm(EmptyForm()); setError(null) }}>
            {showAdd ? '取消新增' : '+ 新增总表数据项'}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowConflictCheck(true)}>
            冲突检查
          </button>
        </div>

        {showAdd && (
          <div className="inline-form">
            <div className="inline-form-title">新增总表数据项</div>
            <div className="form-grid">
              {FIELDS.map(f => (
                <div key={f.key} className="form-field">
                  <label>{f.label} *</label>
                  <input value={addForm[f.key]} onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })} placeholder={f.label} required />
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px' }}>
              <button className="btn btn-success" onClick={handleAdd}>保存</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'ID', render: row => row.id },
              { key: 'data_item', label: '数据项', render: row => row.data_item },
              { key: 'grade', label: '综合等级', render: row => row.grade },
              { key: 'confidentiality', label: '机密性', render: row => row.confidentiality },
              { key: 'integrity', label: '完整性', render: row => row.integrity },
              { key: 'availability', label: '可用性', render: row => row.availability },
              { key: 'compliance', label: '合规性', render: row => row.compliance },
              { key: 'source', label: '来源', render: row => row.source === 'manual' ? '手动' : '汇总' },
              {
                key: 'actions',
                label: '操作',
                sortable: false,
                render: row => editId === row.id ? (
                  <>
                    <td colSpan={9}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {FIELDS.map(f => (
                          <input key={f.key} className="table-edit-input" style={{ flex: '1', minWidth: '100px' }} required value={editForm[f.key]} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} placeholder={f.label} />
                        ))}
                        <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={handleEdit}>保存</button>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { setEditId(null); setError(null) }}>取消</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                    <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => startEdit(row)}>编辑</button>
                    <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleDelete(row.id)}>删除</button>
                    <button className="btn btn-success" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setDistributeRecord(row)}>下发</button>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => onViewAudit(null)}>日志</button>
                  </div>
                )
              }
            ]}
            data={filtered}
            pageSize={20}
            emptyMessage={search ? '无匹配结果' : '总表暂无数据'}
          />
        )}
      </div>

      {distributeRecord && <DistributeModal globalRecord={distributeRecord} onClose={() => setDistributeRecord(null)} />}
      {showConflictCheck && <ConflictCheckModal onClose={() => setShowConflictCheck(false)} />}
    </div>
  )
}

export default GlobalTable
