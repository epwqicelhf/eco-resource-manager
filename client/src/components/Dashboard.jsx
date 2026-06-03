import { useState, useEffect } from 'react'
import { fetchSummary } from '../api'

function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchSummary().then(d => { setData(d); setLoading(false) }).catch(e => { console.error(e); setLoading(false) })
  }, [])

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
    </div>
  )
}

export default Dashboard
