import { useState, useEffect, useCallback } from 'react'
import { fetchPending, fetchGuiPending, reviewPending, batchReview, approveByType, fetchOrgTree, cancelPending } from '../api'
import TreeSelect from './TreeSelect'

function DataReview({ selectedOrg, onSelectOrg }) {
  const [importNew, setImportNew] = useState([])
  const [importConflict, setImportConflict] = useState([])
  const [guiNew, setGuiNew] = useState([])
  const [guiUpdate, setGuiUpdate] = useState([])
  const [guiDelete, setGuiDelete] = useState([])
  const [loading, setLoading] = useState(true)
  const [tree, setTree] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [tab, setTab] = useState('gui_new')

  useEffect(() => { fetchOrgTree().then(setTree).catch(console.error) }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const orgId = selectedOrg?.id
      const [inN, inC, gn, gu, gd] = await Promise.all([
        fetchPending(orgId, 'new'),
        fetchPending(orgId, 'conflict'),
        fetchGuiPending(orgId, 'new'),
        fetchGuiPending(orgId, 'update'),
        fetchGuiPending(orgId, 'delete')
      ])
      setImportNew(inN.filter(i => i.source === 'import'))
      setImportConflict(inC)
      setGuiNew(gn)
      setGuiUpdate(gu)
      setGuiDelete(gd)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [selectedOrg])

  useEffect(() => { loadData() }, [loadData])

  const handleReview = async (id, action) => {
    await reviewPending(id, action)
    loadData()
  }

  const handleCancel = async (id) => {
    if (!confirm('确认撤销此待审核记录？')) return
    await cancelPending(id)
    loadData()
  }

  const handleBatch = async (action) => {
    if (selectedIds.size === 0) return
    await batchReview([...selectedIds], action)
    setSelectedIds(new Set())
    loadData()
  }

  const handleTypeAction = async (type, action, source) => {
    const label = source === 'gui' ? 'GUI' : '导入'
    const typeLabel = type === 'new' ? '新增' : type === 'conflict' ? '冲突' : type === 'update' ? '修改' : '删除'
    if (!confirm(`确认${action === 'approved' ? '通过' : '驳回'}所有${label}${typeLabel}数据？`)) return
    await approveByType(selectedOrg?.id, type, action)
    loadData()
  }

  const toggleId = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = (items) => {
    const ids = items.map(i => i.id)
    const allSelected = ids.every(id => selectedIds.has(id))
    const next = new Set(selectedIds)
    if (allSelected) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))
    setSelectedIds(next)
  }

  const tabData = {
    gui_new: guiNew, gui_update: guiUpdate, gui_delete: guiDelete,
    import_new: importNew, import_conflict: importConflict
  }
  const currentItems = tabData[tab] || []
  const totalPending = guiNew.length + guiUpdate.length + guiDelete.length + importNew.length + importConflict.length

  return (
    <div>
      <div className="stats">
        <div className="stat-box"><div className="stat-value">{guiNew.length + guiUpdate.length + guiDelete.length}</div><div className="stat-label">GUI待审核</div></div>
        <div className="stat-box"><div className="stat-value">{importNew.length + importConflict.length}</div><div className="stat-label">导入待审核</div></div>
        <div className="stat-box"><div className="stat-value">{totalPending}</div><div className="stat-label">待审核总计</div></div>
      </div>

      <div className="card">
        <div className="card-title">数据审核</div>

        <div className="search-box" style={{ marginBottom: '16px' }}>
          <TreeSelect tree={tree} selectedOrg={selectedOrg} onSelect={onSelectOrg} onlyLeaf={false} placeholder="全部组织" />
          <button className="btn btn-primary" onClick={loadData}>刷新</button>
        </div>

        <div className="review-tabs">
          <button className={`review-tab ${tab === 'gui_new' ? 'active' : ''}`} onClick={() => { setTab('gui_new'); setSelectedIds(new Set()) }}>GUI新增 <span className="tab-count">{guiNew.length}</span></button>
          <button className={`review-tab ${tab === 'gui_update' ? 'active' : ''}`} onClick={() => { setTab('gui_update'); setSelectedIds(new Set()) }}>GUI修改 <span className="tab-count">{guiUpdate.length}</span></button>
          <button className={`review-tab ${tab === 'gui_delete' ? 'active' : ''}`} onClick={() => { setTab('gui_delete'); setSelectedIds(new Set()) }}>GUI删除 <span className="tab-count">{guiDelete.length}</span></button>
          <button className={`review-tab ${tab === 'import_new' ? 'active' : ''}`} onClick={() => { setTab('import_new'); setSelectedIds(new Set()) }}>导入新增 <span className="tab-count">{importNew.length}</span></button>
          <button className={`review-tab ${tab === 'import_conflict' ? 'active' : ''}`} onClick={() => { setTab('import_conflict'); setSelectedIds(new Set()) }}>导入冲突 <span className="tab-count">{importConflict.length}</span></button>
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <>
            {currentItems.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button className="btn btn-success" onClick={() => handleBatch('approved')} disabled={selectedIds.size === 0}>批量通过 ({selectedIds.size})</button>
                <button className="btn btn-danger" onClick={() => handleBatch('rejected')} disabled={selectedIds.size === 0}>批量驳回 ({selectedIds.size})</button>
                <div style={{ flex: 1 }} />
                <button className="btn btn-secondary" onClick={() => {
                  const tm = { gui_new: 'new', gui_update: 'update', gui_delete: 'delete', import_new: 'new', import_conflict: 'conflict' }
                  const sm = { gui_new: 'gui', gui_update: 'gui', gui_delete: 'gui', import_new: 'import', import_conflict: 'import' }
                  handleTypeAction(tm[tab], 'approved', sm[tab])
                }}>全部通过</button>
                <button className="btn btn-secondary" onClick={() => {
                  const tm = { gui_new: 'new', gui_update: 'update', gui_delete: 'delete', import_new: 'new', import_conflict: 'conflict' }
                  const sm = { gui_new: 'gui', gui_update: 'gui', gui_delete: 'gui', import_new: 'import', import_conflict: 'import' }
                  handleTypeAction(tm[tab], 'rejected', sm[tab])
                }}>全部驳回</button>
              </div>
            )}

            {currentItems.length === 0 ? (
              <div className="empty-state"><p>暂无待审核数据</p></div>
            ) : tab === 'gui_new' || tab === 'import_new' ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th><input type="checkbox" checked={currentItems.every(i => selectedIds.has(i.id))} onChange={() => toggleAll(currentItems)} /></th>
                      <th>ID</th><th>数据项</th><th>综合等级</th><th>机密性</th><th>完整性</th><th>可用性</th><th>合规性</th><th>来源</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map(item => (
                      <tr key={item.id}>
                        <td><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleId(item.id)} /></td>
                        <td>{item.id}</td>
                        <td>{item.data_item}</td>
                        <td>{item.grade}</td>
                        <td>{item.confidentiality}</td>
                        <td>{item.integrity}</td>
                        <td>{item.availability}</td>
                        <td>{item.compliance}</td>
                        <td>{item.source === 'gui' ? 'GUI' : item.source_sheet || 'Excel'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.8rem', marginRight: '6px' }} onClick={() => handleReview(item.id, 'approved')}>通过</button>
                          <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleReview(item.id, 'rejected')}>驳回</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : tab === 'gui_update' || tab === 'import_conflict' ? (
              <div>
                {currentItems.map(item => (
                  <div key={item.id} className="conflict-item">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleId(item.id)} style={{ marginTop: '4px' }} />
                      <div style={{ flex: 1 }}>
                        <div className="conflict-header">
                          <span className="conflict-data-item">{item.data_item}</span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {item.source === 'gui' ? 'GUI修改' : 'Excel导入冲突'} | 批次: {item.batch_id?.substring(0, 8)}
                          </span>
                        </div>
                        <div className="conflict-compare">
                          <div className="conflict-old">
                            <strong>当前值（已发布）</strong>
                            <div>综合等级: {item.existing_grade || '-'}</div>
                            <div>机密性: {item.existing_confidentiality || '-'}</div>
                            <div>完整性: {item.existing_integrity || '-'}</div>
                            <div>可用性: {item.existing_availability || '-'}</div>
                            <div>合规性: {item.existing_compliance || '-'}</div>
                          </div>
                          <div className="conflict-new">
                            <strong>变更值（待审核）</strong>
                            <div>综合等级: {item.grade || '-'}</div>
                            <div>机密性: {item.confidentiality || '-'}</div>
                            <div>完整性: {item.integrity || '-'}</div>
                            <div>可用性: {item.availability || '-'}</div>
                            <div>合规性: {item.compliance || '-'}</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button className="btn btn-success" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleReview(item.id, 'approved')}>通过</button>
                        <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleReview(item.id, 'rejected')}>驳回</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tab === 'gui_delete' ? (
              <div>
                {currentItems.map(item => (
                  <div key={item.id} className="conflict-item" style={{ borderColor: 'rgba(255, 82, 82, 0.3)', background: 'rgba(255, 82, 82, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleId(item.id)} style={{ marginTop: '4px' }} />
                      <div style={{ flex: 1 }}>
                        <div className="conflict-header">
                          <span className="conflict-data-item">{item.data_item}</span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>GUI删除请求 | 批次: {item.batch_id?.substring(0, 8)}</span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', padding: '8px' }}>
                          <strong>待删除记录当前值：</strong>
                          <div>综合等级: {item.grade || '-'} | 机密性: {item.confidentiality || '-'} | 完整性: {item.integrity || '-'}</div>
                          <div>可用性: {item.availability || '-'} | 合规性: {item.compliance || '-'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleReview(item.id, 'approved')}>确认删除</button>
                        <button className="btn btn-success" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleReview(item.id, 'rejected')}>驳回(保留)</button>
                        <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleCancel(item.id)}>撤销</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default DataReview
