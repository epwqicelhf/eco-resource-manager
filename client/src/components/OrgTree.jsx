import { useState, useEffect, useCallback } from 'react'
import { fetchOrgTree, createOrg, updateOrg, deleteOrg } from '../api'

function TreeNode({ node, level, onSelect, selected, onRefresh }) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(node.name)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const handleSave = async () => {
    if (!editName.trim()) return
    await updateOrg(node.id, { name: editName.trim(), sort_order: node.sort_order })
    setEditing(false)
    onRefresh()
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    const res = await createOrg({ name: newName.trim(), parent_id: node.id })
    if (res.error) {
      alert(res.error)
      return
    }
    setNewName('')
    setAdding(false)
    setExpanded(true)
    onRefresh()
  }

  const handleDelete = async () => {
    const hasData = node.privacy_count > 0 || node.pending_count > 0
    let msg = `确认删除组织"${node.name}"？`
    if (hasData) {
      msg += `\n\n该组织下有 ${node.privacy_count} 条已发布数据和 ${node.pending_count} 条待审核数据。\n删除后这些数据将同步删除（总表数据不受影响）。`
    }
    if (!confirm(msg)) return
    const res = await deleteOrg(node.id)
    if (res.error) {
      alert(res.error)
    } else {
      onRefresh()
    }
  }

  const isLeaf = node.is_leaf !== false && (!node.children || node.children.length === 0)
  const hasData = node.has_data

  return (
    <div className="tree-node" style={{ paddingLeft: `${level * 20}px` }}>
      <div className={`tree-item ${selected?.id === node.id ? 'selected' : ''}`} onClick={() => onSelect(node)}>
        {!isLeaf ? (
          <span className="tree-toggle" onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}>
            {expanded ? '▼' : '▶'}
          </span>
        ) : (
          <span className="tree-toggle-spacer" />
        )}

        {editing ? (
          <span className="tree-edit" onClick={e => e.stopPropagation()}>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button className="tree-btn tree-btn-save" onClick={handleSave}>保存</button>
            <button className="tree-btn tree-btn-cancel" onClick={() => setEditing(false)}>取消</button>
          </span>
        ) : (
          <>
            <span className="tree-name">
              <span className="tree-level-badge">L{node.level}</span>
              {node.name}
              {hasData && <span className="tree-data-badge">数据:{node.privacy_count}</span>}
              {isLeaf && !hasData && <span className="tree-leaf-badge">叶子</span>}
            </span>
            <span className="tree-actions" onClick={e => e.stopPropagation()}>
              {!hasData && (
                <button className="tree-btn tree-btn-add" onClick={() => setAdding(true)} title="添加子组织">+</button>
              )}
              <button className="tree-btn tree-btn-edit" onClick={() => { setEditName(node.name); setEditing(true) }} title="编辑">✎</button>
              <button className="tree-btn tree-btn-delete" onClick={handleDelete} title="删除">×</button>
            </span>
          </>
        )}
      </div>

      {expanded && !isLeaf && node.children && node.children.map(child => (
        <TreeNode key={child.id} node={child} level={level + 1} onSelect={onSelect} selected={selected} onRefresh={onRefresh} />
      ))}

      {adding && expanded && (
        <div className="tree-add-child" style={{ paddingLeft: `${(level + 1) * 20}px` }}>
          <input
            placeholder="子组织名称..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button className="tree-btn tree-btn-save" onClick={handleAdd}>添加</button>
          <button className="tree-btn tree-btn-cancel" onClick={() => { setAdding(false); setNewName('') }}>取消</button>
        </div>
      )}
    </div>
  )
}

function OrgTree({ onSelect, selectedOrg }) {
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)
  const [newRootName, setNewRootName] = useState('')

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchOrgTree()
      setTree(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadTree()
  }, [loadTree])

  const handleAddRoot = async () => {
    if (!newRootName.trim()) return
    const res = await createOrg({ name: newRootName.trim(), parent_id: null })
    if (res.error) {
      alert(res.error)
      return
    }
    setNewRootName('')
    loadTree()
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">组织架构</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
          维护多层级组织架构树。仅有叶子节点且无数据的组织可添加子组织。删除有数据的叶子节点，数据将转为离散数据管理。
        </p>

        <div className="search-box" style={{ marginBottom: '16px' }}>
          <input
            placeholder="新增一级组织..."
            value={newRootName}
            onChange={e => setNewRootName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddRoot()}
          />
          <button className="btn btn-primary" onClick={handleAddRoot}>添加</button>
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : tree.length === 0 ? (
          <div className="empty-state">
            <p>暂无组织数据，请添加一级组织</p>
          </div>
        ) : (
          <div className="tree-container">
            {tree.map(node => (
              <TreeNode key={node.id} node={node} level={0} onSelect={onSelect} selected={selectedOrg} onRefresh={loadTree} />
            ))}
          </div>
        )}
      </div>

      {selectedOrg && (
        <div className="card">
          <div className="card-title">当前选中组织</div>
          <div className="org-detail">
            <div><strong>名称：</strong>{selectedOrg.name}</div>
            <div><strong>层级：</strong>第 {selectedOrg.level} 层</div>
            <div><strong>ID：</strong>{selectedOrg.id}</div>
            <div><strong>类型：</strong>{selectedOrg.has_data ? '数据节点（不可添加子组织）' : selectedOrg.is_leaf !== false && (!selectedOrg.children || selectedOrg.children.length === 0) ? '叶子节点（可导入数据）' : '分支节点'}</div>
            {selectedOrg.privacy_count > 0 && <div><strong>已审核数据：</strong>{selectedOrg.privacy_count} 条</div>}
            {selectedOrg.pending_count > 0 && <div><strong>待审核数据：</strong>{selectedOrg.pending_count} 条</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default OrgTree
