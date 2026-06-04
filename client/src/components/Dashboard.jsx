import { useState, useEffect } from 'react'
import { fetchSummary, systemReset } from '../api'

function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState(null)

  useEffect(() => {
    setLoading(true)
    fetchSummary().then(d => { setData(d); setLoading(false) }).catch(e => { console.error(e); setLoading(false) })
  }, [])

  const handleReset = async () => {
    if (!confirm('确认要恢复出厂设置吗？此操作将清空所有数据，包括组织、总表、组织数据、审计日志等。此操作不可撤销！')) return
    if (!confirm('再次确认：所有数据将被永久删除，确定继续？')) return
    setResetting(true)
    setResetMessage(null)
    try {
      const res = await systemReset()
      if (res.error) {
        setResetMessage({ type: 'error', text: res.error })
      } else {
        setResetMessage({ type: 'success', text: res.message || '系统已恢复出厂设置' })
        fetchSummary().then(d => setData(d))
      }
    } catch (e) {
      setResetMessage({ type: 'error', text: '恢复出厂设置失败: ' + e.message })
    }
    setResetting(false)
  }

  if (loading) return <div className="loading">加载中...</div>
  if (!data) return <div className="empty-state"><p>无法加载汇总数据</p></div>

  return (
    <div>
      <div className="stats">
        <div className="stat-box">
          <div className="stat-value">{data.global_count}</div>
          <div className="stat-label">总表数据项</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data.org_data_count}</div>
          <div className="stat-label">组织业务数据</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data.global_count + data.org_data_count}</div>
          <div className="stat-label">数据总计</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data.total_conflicts_resolved}</div>
          <div className="stat-label">已解决冲突</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat-box">
          <div className="stat-value">{data.org_count}</div>
          <div className="stat-label">组织总数</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data.leaf_org_count}</div>
          <div className="stat-label">叶子组织</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data.total_pending}</div>
          <div className="stat-label">待审核</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data.total_approved}</div>
          <div className="stat-label">已审核通过</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat-box">
          <div className="stat-value" style={{ color: data.rectification_pending > 0 ? 'var(--warning)' : 'var(--primary)' }}>{data.rectification_pending || 0}</div>
          <div className="stat-label">待整改任务</div>
        </div>
        <div className="stat-box">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{data.rectification_confirmed || 0}</div>
          <div className="stat-label">已完成整改</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{(data.rectification_pending || 0) + (data.rectification_confirmed || 0)}</div>
          <div className="stat-label">整改任务总计</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">&nbsp;</div>
          <div className="stat-label">&nbsp;</div>
        </div>
      </div>

      {data.org_details.length > 0 && (
        <div className="card">
          <div className="card-title">各组织数据分布</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>组织名称</th>
                  <th>层级</th>
                  <th>已发布数据</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                {data.org_details.map(org => (
                  <tr key={org.org_id}>
                    <td><strong>{org.org_name}</strong></td>
                    <td>L{org.level}</td>
                    <td>{org.data_count}</td>
                    <td>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${data.org_data_count > 0 ? (org.data_count / data.org_data_count * 100) : 0}%` }}
                        />
                        <span className="progress-text">
                          {data.org_data_count > 0 ? (org.data_count / data.org_data_count * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ borderColor: 'rgba(255, 82, 82, 0.3)' }}>
        <div className="card-title" style={{ color: 'var(--danger)' }}>系统维护</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
          恢复出厂设置将清空系统中所有数据，包括：组织结构、总表数据、组织隐私数据、待审核数据、整改任务、审计日志。此操作不可撤销。
        </p>
        {resetMessage && (
          <div className={`alert ${resetMessage.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '12px' }}>
            {resetMessage.text}
          </div>
        )}
        <button
          className="btn btn-danger"
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? '正在恢复...' : '恢复出厂设置'}
        </button>
      </div>
    </div>
  )
}

export default Dashboard
