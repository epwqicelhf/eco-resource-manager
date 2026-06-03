import { useState } from 'react'
import Dashboard from './components/Dashboard'
import OrgTree from './components/OrgTree'
import GlobalTable from './components/GlobalTable'
import PrivacyTable from './components/PrivacyTable'
import UploadImport from './components/UploadImport'
import DataReview from './components/DataReview'
import AuditLog from './components/AuditLog'
import RectificationTasks from './components/RectificationTasks'
import Workflow from './components/Workflow'
import './App.css'

function App() {
  const [module, setModule] = useState('privacy')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [auditFilterId, setAuditFilterId] = useState(null)

  const handleViewAudit = (privacyId) => {
    setAuditFilterId(privacyId)
    setActiveTab('audit')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>生态资源管理</h1>
        <p>Ecological Resource Management System</p>
      </header>

      <div className="module-switcher">
        <button className={`module-btn ${module === 'org' ? 'active' : ''}`} onClick={() => setModule('org')}>
          组织管理
        </button>
        <button className={`module-btn ${module === 'privacy' ? 'active' : ''}`} onClick={() => { setModule('privacy'); setActiveTab('dashboard') }}>
          隐私数据
        </button>
        <button className={`module-btn ${module === 'sod' ? 'active' : ''}`} onClick={() => setModule('sod')}>
          SOD资源
        </button>
      </div>

      {module === 'org' && (
        <OrgTree onSelect={setSelectedOrg} selectedOrg={selectedOrg} />
      )}

      {module === 'privacy' && (
        <>
          <div className="tabs">
            <button className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setAuditFilterId(null) }}>汇总概览</button>
            <button className={`tab ${activeTab === 'global' ? 'active' : ''}`} onClick={() => { setActiveTab('global'); setAuditFilterId(null) }}>总表管理</button>
            <button className={`tab ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => { setActiveTab('privacy'); setAuditFilterId(null) }}>数据总表</button>
            <button className={`tab ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>上传导入</button>
            <button className={`tab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>数据审核</button>
            <button className={`tab ${activeTab === 'rectification' ? 'active' : ''}`} onClick={() => setActiveTab('rectification')}>整改任务</button>
            <button className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => { setActiveTab('audit'); setAuditFilterId(null) }}>审计日志</button>
            <button className={`tab ${activeTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTab('workflow')}>流程说明</button>
          </div>

          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'global' && <GlobalTable onViewAudit={handleViewAudit} />}
          {activeTab === 'privacy' && <PrivacyTable selectedOrg={selectedOrg} onSelectOrg={setSelectedOrg} onViewAudit={handleViewAudit} />}
          {activeTab === 'import' && <UploadImport selectedOrg={selectedOrg} onSelectOrg={setSelectedOrg} />}
          {activeTab === 'review' && <DataReview selectedOrg={selectedOrg} onSelectOrg={setSelectedOrg} />}
          {activeTab === 'rectification' && <RectificationTasks selectedOrg={selectedOrg} onSelectOrg={setSelectedOrg} />}
          {activeTab === 'audit' && <AuditLog filterPrivacyId={auditFilterId} onSelectOrg={setSelectedOrg} onClearFilter={() => setAuditFilterId(null)} />}
          {activeTab === 'workflow' && <Workflow />}
        </>
      )}

      {module === 'sod' && (
        <div className="card">
          <div className="empty-state" style={{ padding: '120px 20px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.3 }}>📦</div>
            <p style={{ fontSize: '1.25rem', marginBottom: '10px' }}>SOD 资源管理</p>
            <p>功能开发中，敬请期待...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
