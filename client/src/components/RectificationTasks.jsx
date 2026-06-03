import { useState, useEffect, useCallback } from 'react'
import { fetchRectificationTasks, confirmRectificationTask, batchConfirmRectificationTasks, dismissRectificationTask, fetchOrgs } from '../api'
import TreeSelect from './TreeSelect'
import { fetchOrgTree } from '../api'

const COMPARE_FIELDS = [
  { key: 'grade', label: '综合等级' },
  { key: 'confidentiality', label: '机密性' },
  { key: 'integrity', label: '完整性' },
  { key: 'availability', label: '可用性' },
  { key: 'compliance', label: '合规性' }
]

function RectificationTasks({ selectedOrg, onSelectOrg }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [tree, setTree] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => { fetchOrgTree().then(setTree).catch(console.error) }, [])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchRectificationTasks(selectedOrg?.id)
      setTasks(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [selectedOrg])

  useEffect(() => { loadTasks() }, [loadTasks])

  const handleConfirm = async (id) => {
    if (!confirm('确认按总表数据整改该记录？')) return
    await confirmRectificationTask(id)
    loadTasks()
  }

  const handleDismiss = async (id) => {
    if (!confirm('确认忽略该整改任务？组织数据将保持不变。')) return
    await dismissRectificationTask(id)
    loadTasks()
  }

  const handleBatchConfirm = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确认按总表数据批量整改选中的 ${selectedIds.size} 条记录？`)) return
    await batchConfirmRectificationTasks([...selectedIds])
    setSelectedIds(new Set())
    loadTasks()
  }

  const toggleId = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    const ids = tasks.map(t => t.id)
    const allSelected = ids.every(id => selectedIds.has(id))
    const next = new Set(selectedIds)
    if (allSelected) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))
    setSelectedIds(next)
  }

  return (
    <div>
      <div className="stats">
        <div className="stat-box"><div className="stat-value">{tasks.length}</div><div className="stat-label">待整改任务</div></div>
      </div>

      <div className="card">
        <div className="card-title">整改任务清单</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
          当总表数据变更时，系统自动检测各组织下与总表不一致的业务数据，生成整改任务。确认整改后，组织数据将同步为总表值。
        </p>

        <div className="search-box" style={{ marginBottom: '16px' }}>
          <TreeSelect tree={tree} selectedOrg={selectedOrg} onSelect={onSelectOrg} onlyLeaf={false} placeholder="全部组织" />
          <button className="btn btn-primary" onClick={loadTasks}>刷新</button>
        </div>

        {tasks.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button className="btn btn-success" onClick={handleBatchConfirm} disabled={selectedIds.size === 0}>
              批量确认整改 ({selectedIds.size})
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state"><p>暂无待整改任务</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={tasks.length > 0 && tasks.every(t => selectedIds.has(t.id))} onChange={toggleAll} />
                  </th>
                  <th>数据项</th>
                  <th>所属组织</th>
                  {COMPARE_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id}>
                    <td><input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleId(task.id)} /></td>
                    <td><strong>{task.data_item}</strong></td>
                    <td>{task.org_name}</td>
                    {COMPARE_FIELDS.map(f => {
                      const globalVal = task[`global_${f.key}`]
                      const orgVal = task[`org_${f.key}`]
                      const diff = globalVal !== orgVal
                      return (
                        <td key={f.key}>
                          {diff ? (
                            <span>
                              <span style={{ textDecoration: 'line-through', color: 'var(--danger)', fontSize: '0.8rem' }}>{orgVal || '-'}</span>
                              <br />
                              <span style={{ color: 'var(--success)', fontWeight: '600' }}>{globalVal || '-'}</span>
                            </span>
                          ) : (
                            <span>{orgVal || '-'}</span>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{task.created_at}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.8rem', marginRight: '4px' }} onClick={() => handleConfirm(task.id)}>确认整改</button>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleDismiss(task.id)}>忽略</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default RectificationTasks
