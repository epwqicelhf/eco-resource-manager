import { useState, useEffect, useRef } from 'react'
import { uploadImport, downloadImportTemplate, fetchOrgTree } from '../api'
import TreeSelect from './TreeSelect'

const DATA_FIELDS = [
  { key: 'grade', label: '综合等级' },
  { key: 'confidentiality', label: '机密性' },
  { key: 'integrity', label: '完整性' },
  { key: 'availability', label: '可用性' },
  { key: 'compliance', label: '合规性' }
]

function UploadImport({ selectedOrg, onSelectOrg }) {
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tree, setTree] = useState([])
  const [lastFile, setLastFile] = useState(null)
  const fileRef = useRef()

  useEffect(() => { fetchOrgTree().then(setTree).catch(console.error) }, [])

  const handleFile = async (file, acceptGlobalConflicts = false) => {
    if (!file) return
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) { setError('请上传 Excel 文件 (.xlsx / .xls)'); return }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await uploadImport(file, selectedOrg?.id || null, acceptGlobalConflicts)
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res)
        if (res.global_conflict > 0 && !acceptGlobalConflicts) {
          setLastFile(file)
        } else {
          setLastFile(null)
        }
      }
    } catch (e) {
      setError('上传失败: ' + e.message)
    }

    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleAcceptGlobalConflicts = async () => {
    if (!lastFile) return
    await handleFile(lastFile, true)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">上传导入</div>

        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(0,168,255,0.06)', borderRadius: '8px', fontSize: '0.9rem' }}>
          <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '8px' }}>Excel 必需列：</div>
          <div style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
            <strong style={{ color: 'var(--text)' }}>数据项</strong>（必填）、
            <strong style={{ color: 'var(--text)' }}>综合等级</strong>（1-5）、
            <strong style={{ color: 'var(--text)' }}>机密性</strong>（1-5）、
            <strong style={{ color: 'var(--text)' }}>完整性</strong>（1-5）、
            <strong style={{ color: 'var(--text)' }}>可用性</strong>（1-5）、
            <strong style={{ color: 'var(--text)' }}>合规性</strong>（1-5）
          </div>
          <div style={{ color: 'var(--text-muted)', lineHeight: '1.8', marginTop: '4px' }}>
            <strong style={{ color: 'var(--text)' }}>可选组织列：</strong>
            一级分类、二级分类、三级分类、四级分类、五级分类（系统将自动创建组织并将数据归入对应叶子节点）
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            支持多 Sheet 页导入，所有 Sheet 页的数据将合并处理。同一组织下不允许重名数据项。
          </div>
        </div>

        <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={downloadImportTemplate}>
            下载导入模板
          </button>
        </div>

        <div className="search-box" style={{ marginBottom: '16px' }}>
          <TreeSelect tree={tree} selectedOrg={selectedOrg} onSelect={onSelectOrg} onlyLeaf={true} placeholder="选择目标组织（含组织列时可不选）" />
          {selectedOrg && (
            <span style={{ color: 'var(--primary)', alignSelf: 'center' }}>当前: {selectedOrg.name}</span>
          )}
          {!selectedOrg && (
            <span style={{ color: 'var(--text-muted)', alignSelf: 'center', fontSize: '0.85rem' }}>未选组织时需Excel包含分类列</span>
          )}
        </div>

        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className="upload-icon">📁</div>
          <p>拖拽 Excel 文件到此处，或点击选择文件</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>支持 .xlsx / .xls 格式，支持多Sheet页</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>

        {loading && <div className="loading">正在处理文件...</div>}
        {error && <div className="alert alert-error" style={{ marginTop: '16px' }}>{error}</div>}

        {result && (
          <div style={{ marginTop: '16px' }}>
            <div className="alert alert-warning">
              文件解析完成！共 <strong>{result.total}</strong> 条数据：
            </div>

            {result.orgs_created && result.orgs_created.length > 0 && (
              <div className="alert alert-success" style={{ marginBottom: '8px' }}>
                自动创建了 <strong>{result.orgs_created.length}</strong> 个组织：
                <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
                  {result.orgs_created.map((o, i) => (
                    <span key={i} style={{ display: 'inline-block', marginRight: '8px', padding: '2px 8px', background: 'rgba(0,168,255,0.1)', borderRadius: '4px' }}>
                      L{o.level} {o.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.new > 0 && (
              <div className="alert alert-success">
                <strong>{result.new}</strong> 条新增数据 → 待审核
              </div>
            )}
            {result.conflict > 0 && (
              <div className="alert alert-error">
                <strong>{result.conflict}</strong> 条与组织已有数据冲突 → 待审核
              </div>
            )}
            {result.duplicate > 0 && (
              <div className="alert alert-error" style={{ marginTop: '8px' }}>
                <strong>{result.duplicate}</strong> 条重名数据项被跳过（同一组织不允许重名）：
                <div className="table-container" style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '6px' }}>
                  <table>
                    <thead><tr><th>数据项</th><th>来源Sheet</th></tr></thead>
                    <tbody>
                      {result.duplicate_items.map((item, idx) => (
                        <tr key={idx}><td>{item.data_item}</td><td>{item.source_sheet}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {result.global_conflict && result.global_conflicts.length > 0 && (
              <div className="conflict-alert" style={{ marginTop: '12px' }}>
                <div className="conflict-alert-title">
                  发现 <strong>{result.global_conflict}</strong> 条数据与总表冲突
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '0.9rem' }}>
                  以下数据项的值与总表不一致，可以使用总表数据快速添加：
                </p>
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>数据项</th>
                        <th>来源Sheet</th>
                        {DATA_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.global_conflicts.map((gc, idx) => (
                        <tr key={idx}>
                          <td><strong>{gc.data_item}</strong></td>
                          <td>{gc.source_sheet}</td>
                          {DATA_FIELDS.map(f => (
                            <td key={f.key}>
                              {gc.input_values[f.key] !== gc.global_values[f.key] ? (
                                <span>
                                  <span style={{ textDecoration: 'line-through', color: 'var(--danger)' }}>{gc.input_values[f.key] || '-'}</span>
                                  {' → '}
                                  <span style={{ color: 'var(--success)' }}>{gc.global_values[f.key] || '-'}</span>
                                </span>
                              ) : (
                                <span>{gc.input_values[f.key] || '-'}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                  <button className="btn btn-success" onClick={handleAcceptGlobalConflicts}>
                    使用总表数据重新导入
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setLastFile(null); setResult(null) }}>
                    放弃冲突数据
                  </button>
                </div>
              </div>
            )}
            {result.skipped > 0 && (
              <div className="alert alert-error" style={{ marginTop: '12px' }}>
                <strong>{result.skipped}</strong> 条数据因校验不通过被跳过：
                <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
                  <table>
                    <thead>
                      <tr><th>数据项</th><th>来源Sheet</th><th>错误原因</th></tr>
                    </thead>
                    <tbody>
                      {result.skipped_items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.data_item}</td>
                          <td>{item.source_sheet}</td>
                          <td style={{ color: 'var(--danger)' }}>
                            {(item.errors || item.missing || []).join('；')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {result.new === 0 && result.conflict === 0 && (!result.global_conflict || result.global_conflict === 0) && result.skipped === 0 && result.duplicate === 0 && (
              <div className="alert alert-success">所有数据与现有记录一致，无需审核。</div>
            )}
            {(result.new > 0 || result.conflict > 0) && (
              <div style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '0.9rem' }}>
                请前往"数据审核"页签进行审核处理。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UploadImport
