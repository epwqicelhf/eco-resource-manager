import { useState, useEffect, useCallback } from 'react'
import { fetchPrivacy, createPrivacy, updatePrivacy, deletePrivacy, exportPrivacy, fetchOrgTree, fetchGuiPending, cancelPending, matchPrivacyGlobal, searchPrivacyGlobal } from '../api'
import TreeSelect from './TreeSelect'

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

function PrivacyTable({ selectedOrg, onSelectOrg, onViewAudit }) {
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [tree, setTree] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EmptyForm())
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(EmptyForm())
  const [error, setError] = useState(null)
  const [pendingMap, setPendingMap] = useState({})
  const [guiPendingNew, setGuiPendingNew] = useState([])
  const [globalMatch, setGlobalMatch] = useState(null)
  const [globalConflict, setGlobalConflict] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => { fetchOrgTree().then(setTree).catch(console.error) }, [])

  const loadPendingMap = useCallback(async () => {
    try {
      const items = await fetchGuiPending(selectedOrg?.id)
      const map = {}
      for (const item of items) {
        if (item.privacy_id) {
          if (!map[item.privacy_id]) map[item.privacy_id] = []
          map[item.privacy_id].push(item)
        }
      }
      setPendingMap(map)
      setGuiPendingNew(items.filter(i => !i.privacy_id && i.type === 'new'))
    } catch (e) { console.error(e) }
  }, [selectedOrg])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchPrivacy(selectedOrg?.id, search))
      await loadPendingMap()
      await fetchOrgTree().then(setTree)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [selectedOrg, search, loadPendingMap])

  useEffect(() => { loadData() }, [loadData])

  const handleDataItemChange = async (value) => {
    setAddForm(prev => ({ ...prev, data_item: value }))
    setGlobalMatch(null)
    setGlobalConflict(null)

    if (value.trim().length >= 2) {
      try {
        const results = await searchPrivacyGlobal(value)
        setSearchResults(results)
        setShowSuggestions(results.length > 0)
      } catch (e) { setSearchResults([]) }
    } else {
      setSearchResults([])
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (item) => {
    setAddForm({
      data_item: item.data_item,
      grade: item.grade || '',
      confidentiality: item.confidentiality || '',
      integrity: item.integrity || '',
      availability: item.availability || '',
      compliance: item.compliance || ''
    })
    setGlobalMatch(item)
    setGlobalConflict(null)
    setShowSuggestions(false)
    setSearchResults([])
  }

  const handleFillFromGlobal = () => {
    if (globalMatch) {
      setAddForm(prev => ({
        ...prev,
        grade: globalMatch.grade || '',
        confidentiality: globalMatch.confidentiality || '',
        integrity: globalMatch.integrity || '',
        availability: globalMatch.availability || '',
        compliance: globalMatch.compliance || ''
      }))
    }
  }

  const handleCheckConflict = async () => {
    if (!addForm.data_item.trim()) return
    const match = await matchPrivacyGlobal(addForm.data_item)
    if (match) {
      setGlobalMatch(match)
      const inputVals = { grade: addForm.grade, confidentiality: addForm.confidentiality, integrity: addForm.integrity, availability: addForm.availability, compliance: addForm.compliance }
      const hasConflict = DATA_FIELDS.some(f => inputVals[f.key] && inputVals[f.key] !== match[f.key])
      if (hasConflict) {
        setGlobalConflict({ global: match, input: inputVals })
      } else {
        setGlobalConflict(null)
      }
    } else {
      setGlobalMatch(null)
      setGlobalConflict(null)
    }
  }

  const handleAdd = async (acceptGlobal = false) => {
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
    if (!selectedOrg) { setError('请先选择目标组织'); return }
    const res = await createPrivacy({ ...addForm, org_id: selectedOrg.id, accept_global: acceptGlobal })
    if (res.conflict) {
      setGlobalConflict({ global: res.global_record, input: res.input_values })
      setGlobalMatch(res.global_record)
      setError(null)
      return
    }
    if (res.error) { setError(res.error); return }
    setAddForm(EmptyForm())
    setShowAdd(false)
    setError(null)
    setGlobalMatch(null)
    setGlobalConflict(null)
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
    const res = await updatePrivacy(editId, editForm)
    if (res.error) { setError(res.error); return }
    setEditId(null)
    setEditForm(EmptyForm())
    setError(null)
    loadData()
  }

  const handleDelete = async (id) => {
    if (!confirm('确认提交删除？删除需审核后生效。')) return
    const res = await deletePrivacy(id)
    if (res.error) { alert(res.error); return }
    loadData()
  }

  const handleCancelPending = async (pendingId) => {
    if (!confirm('确认撤销此待审核操作？')) return
    await cancelPending(pendingId)
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

  const getPendingFor = (id) => pendingMap[id] || []
  const getPendingType = (id) => {
    const p = getPendingFor(id)
    if (p.some(i => i.type === 'delete')) return 'delete'
    if (p.some(i => i.type === 'update')) return 'update'
    return null
  }

  const titleSuffix = selectedOrg ? ` - ${selectedOrg.name}` : ''
  const totalPending = guiPendingNew.length + Object.keys(pendingMap).length

  return (
    <div>
      <div className="stats">
        <div className="stat-box"><div className="stat-value">{data.length}</div><div className="stat-label">已发布{titleSuffix}</div></div>
        <div className="stat-box"><div className="stat-value">{totalPending}</div><div className="stat-label">待审核</div></div>
      </div>

      <div className="card">
        <div className="card-title">数据总表（已发布）{titleSuffix}</div>

        <div className="search-box">
          <TreeSelect tree={tree} selectedOrg={selectedOrg} onSelect={onSelectOrg} onlyLeaf={true} placeholder="全部组织（仅叶子可选）" />
          <input type="text" placeholder="搜索数据项..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={loadData}>搜索</button>
          <button className="btn btn-success" onClick={() => exportPrivacy(selectedOrg?.id)}>导出</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}

        {selectedOrg && selectedOrg.is_leaf && (
          <div style={{ marginBottom: '16px' }}>
            <button className="btn btn-primary" onClick={() => { setShowAdd(!showAdd); setAddForm(EmptyForm()); setError(null); setGlobalMatch(null); setGlobalConflict(null) }}>
              {showAdd ? '取消新增' : '+ 新增数据项'}
            </button>
          </div>
        )}

        {selectedOrg && !selectedOrg.is_leaf && (
          <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
            当前选中的是非叶子节点，不能添加隐私数据。请选择叶子节点组织。
          </div>
        )}

        {!selectedOrg && (
          <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
            请选择具体的叶子组织后，才能新增数据项。
          </div>
        )}

        {showAdd && selectedOrg && (
          <div className="inline-form">
            <div className="inline-form-title">新增数据项（提交后待审核）→ {selectedOrg.name}</div>

            <div className="form-grid">
              <div className="form-field" style={{ position: 'relative' }}>
                <label>数据项 *</label>
                <input
                  value={addForm.data_item}
                  onChange={e => handleDataItemChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
                  placeholder="输入数据项名称（支持从总表搜索）"
                />
                {showSuggestions && (
                  <div className="suggestions-dropdown">
                    <div className="suggestions-title">总表匹配结果（点击快速添加）</div>
                    {searchResults.map(item => (
                      <div key={item.id} className="suggestion-item" onClick={() => handleSelectSuggestion(item)}>
                        <span className="suggestion-name">{item.data_item}</span>
                        <span className="suggestion-meta">
                          {item.grade && <span>等级:{item.grade}</span>}
                          {item.confidentiality && <span>机密:{item.confidentiality}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {DATA_FIELDS.map(f => (
                <div key={f.key} className="form-field">
                  <label>{f.label} *</label>
                  <input value={addForm[f.key]} onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.label} required />
                </div>
              ))}
            </div>

            {globalMatch && !globalConflict && (
              <div className="alert alert-success" style={{ marginTop: '12px' }}>
                总表中已存在该数据项。
                <button className="btn btn-secondary" style={{ marginLeft: '10px', padding: '4px 12px', fontSize: '0.85rem' }} onClick={handleFillFromGlobal}>
                  使用总表数据填充
                </button>
              </div>
            )}

            {globalConflict && (
              <div className="conflict-alert" style={{ marginTop: '12px' }}>
                <div className="conflict-alert-title">与总表数据冲突，禁止提交</div>
                <div className="conflict-compare">
                  <div className="conflict-old">
                    <strong>你的输入</strong>
                    {DATA_FIELDS.map(f => (
                      <div key={f.key}>{f.label}: {globalConflict.input[f.key] || '-'}
                        {globalConflict.input[f.key] && globalConflict.input[f.key] !== globalConflict.global[f.key] && <span className="conflict-diff-tag">冲突</span>}
                      </div>
                    ))}
                  </div>
                  <div className="conflict-new">
                    <strong>总表数据</strong>
                    {DATA_FIELDS.map(f => (
                      <div key={f.key}>{f.label}: {globalConflict.global[f.key] || '-'}</div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                  <button className="btn btn-success" onClick={() => handleAdd(true)}>
                    使用总表数据添加
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setGlobalConflict(null); setGlobalMatch(null) }}>
                    修改输入
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
              <button className="btn btn-success" onClick={() => handleAdd(false)}>提交审核</button>
              {addForm.data_item && <button className="btn btn-secondary" onClick={handleCheckConflict}>检查总表</button>}
            </div>
          </div>
        )}

        {guiPendingNew.length > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
            有 <strong>{guiPendingNew.length}</strong> 条新增数据待审核，审核通过后将显示在此表中。前往"数据审核"页签处理。
          </div>
        )}

        {loading ? (
          <div className="loading">加载中...</div>
        ) : data.length === 0 ? (
          <div className="empty-state"><p>{selectedOrg ? '该组织下暂无已发布数据' : '暂无已发布数据'}</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>数据项</th><th>综合等级</th><th>机密性</th><th>完整性</th><th>可用性</th><th>合规性</th><th>来源</th><th>状态</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => {
                  const pendingType = getPendingType(row.id)
                  const pendingItems = getPendingFor(row.id)
                  return (
                    <tr key={row.id} className={pendingType === 'delete' ? 'row-pending-delete' : pendingType === 'update' ? 'row-pending-update' : ''}>
                      {editId === row.id ? (
                        <>
                          <td>{row.id}</td>
                          {FIELDS.map(f => (
                            <td key={f.key}><input className="table-edit-input" required value={editForm[f.key]} onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))} /></td>
                          ))}
                          <td>{row.source_sheet}</td>
                          <td></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.8rem', marginRight: '4px' }} onClick={handleEdit}>提交审核</button>
                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => { setEditId(null); setError(null) }}>取消</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{row.id}</td>
                          <td>{row.data_item}</td>
                          <td>{row.grade}</td>
                          <td>{row.confidentiality}</td>
                          <td>{row.integrity}</td>
                          <td>{row.availability}</td>
                          <td>{row.compliance}</td>
                          <td>{row.source_sheet}</td>
                          <td>
                            {pendingType === 'delete' && <span className="status-badge status-pending-delete">待删除</span>}
                            {pendingType === 'update' && <span className="status-badge status-pending-update">待修改</span>}
                            {!pendingType && <span className="status-badge status-published">已发布</span>}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {!pendingType && (
                              <>
                                <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem', marginRight: '4px' }} onClick={() => startEdit(row)}>编辑</button>
                                <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem', marginRight: '4px' }} onClick={() => handleDelete(row.id)}>删除</button>
                              </>
                            )}
                            {pendingType && pendingItems.map(p => (
                              <button key={p.id} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', marginRight: '4px' }} onClick={() => handleCancelPending(p.id)}>撤销{pendingType === 'delete' ? '删除' : '修改'}</button>
                            ))}
                            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => onViewAudit(row.id)}>日志</button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default PrivacyTable
