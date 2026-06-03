import { useState, useRef, useEffect } from 'react'

function TreeSelectNode({ node, selectedId, onSelect, onlyLeaf, depth = 0 }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const isLeaf = !hasChildren
  const disabled = onlyLeaf && !isLeaf
  const isSelected = selectedId === node.id

  return (
    <div className="ts-node">
      <div
        className={`ts-item ${isSelected ? 'ts-selected' : ''} ${disabled ? 'ts-disabled' : ''}`}
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
        onClick={() => {
          if (!disabled) onSelect(node)
        }}
      >
        {hasChildren && (
          <span className="ts-toggle" onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}>
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span className="ts-toggle-spacer" />}
        <span className="ts-label">{node.name}</span>
        {isLeaf && <span className="ts-leaf-badge">叶子</span>}
        {node.privacy_count > 0 && <span className="ts-count">{node.privacy_count}</span>}
      </div>
      {expanded && hasChildren && node.children.map(child => (
        <TreeSelectNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} onlyLeaf={onlyLeaf} depth={depth + 1} />
      ))}
    </div>
  )
}

function TreeSelect({ tree, selectedOrg, onSelect, onlyLeaf = true, placeholder = '请选择组织...' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayPath = selectedOrg ? getPath(tree, selectedOrg.id) : ''

  return (
    <div className="tree-select" ref={ref}>
      <div className={`ts-trigger ${open ? 'ts-open' : ''}`} onClick={() => setOpen(!open)}>
        <span className={selectedOrg ? 'ts-value' : 'ts-placeholder'}>
          {displayPath || placeholder}
        </span>
        <span className="ts-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="ts-dropdown">
          <div className="ts-list">
            {tree.length === 0 ? (
              <div className="ts-empty">暂无组织数据</div>
            ) : (
              tree.map(node => (
                <TreeSelectNode
                  key={node.id}
                  node={node}
                  selectedId={selectedOrg?.id}
                  onSelect={n => { onSelect(n); setOpen(false) }}
                  onlyLeaf={onlyLeaf}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function getPath(tree, id, path = []) {
  for (const node of tree) {
    const current = [...path, node.name]
    if (node.id === id) return current.join(' / ')
    if (node.children && node.children.length > 0) {
      const found = getPath(node.children, id, current)
      if (found) return found
    }
  }
  return ''
}

export default TreeSelect
