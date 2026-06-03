function Workflow() {
  return (
    <div className="card">
      <div className="card-title">工作流程说明</div>
      
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>角色定义</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(0,168,255,0.05)', borderRadius: '8px' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>系统管理员</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              负责组织架构管理、总表数据维护、用户权限管理。可以创建/编辑/删除组织结构和总表数据，下发数据到各组织，执行冲突检查和整改。
            </p>
          </div>
          
          <div style={{ padding: '16px', background: 'rgba(0,168,255,0.05)', borderRadius: '8px' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>数据录入员</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              负责在指定组织下录入隐私数据。可以通过 GUI 表单或 Excel 导入方式提交数据，所有提交的数据需经审核后才能正式发布。
            </p>
          </div>
          
          <div style={{ padding: '16px', background: 'rgba(0,168,255,0.05)', borderRadius: '8px' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>数据审核员</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              负责审核待发布的数据变更（新增/修改/删除），确认数据符合规范后批准发布，或驳回不符合要求的数据。同时处理整改任务。
            </p>
          </div>
          
          <div style={{ padding: '16px', background: 'rgba(0,168,255,0.05)', borderRadius: '8px' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>审计员</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              负责查看审计日志，监控所有数据变更历史，必要时执行回退操作恢复到历史状态。
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>数据录入流程</h3>
        <div style={{ padding: '16px', background: 'rgba(139,195,74,0.08)', borderRadius: '8px' }}>
          <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>选择组织</strong>：在数据总表或上传导入页面选择目标组织（仅叶子节点可添加数据）</li>
            <li><strong>录入数据</strong>：
              <ul>
                <li>GUI 方式：点击"新增数据项"按钮，填写表单（支持总表搜索和自动填充）</li>
                <li>Excel 导入：下载模板，填写数据后上传（支持多 Sheet 页，自动识别组织分类列）</li>
              </ul>
            </li>
            <li><strong>冲突检查</strong>：系统自动检查是否与总表数据冲突，如有冲突需确认使用总表数据或修改输入</li>
            <li><strong>提交审核</strong>：数据进入待审核状态，等待审核员处理</li>
            <li><strong>审核发布</strong>：审核员批准后数据正式发布到对应组织</li>
          </ol>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>数据审核流程</h3>
        <div style={{ padding: '16px', background: 'rgba(255,152,0,0.08)', borderRadius: '8px' }}>
          <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>查看待审核</strong>：进入"数据审核"页面，查看各类型的待审核数据（GUI新增/修改/删除、导入新增/冲突）</li>
            <li><strong>逐条或批量审核</strong>：
              <ul>
                <li>单条审核：点击"批准"或"驳回"按钮</li>
                <li>批量审核：勾选多条记录后点击"批量批准"或"批量驳回"</li>
                <li>按类型审核：点击"全部批准"或"全部驳回"处理某一类型的所有数据</li>
              </ul>
            </li>
            <li><strong>发布生效</strong>：批准的数据立即生效，同步更新到对应组织和总表</li>
            <li><strong>驳回处理</strong>：驳回的数据不会发布，录入员可修改后重新提交</li>
          </ol>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>总表管理流程</h3>
        <div style={{ padding: '16px', background: 'rgba(156,39,176,0.08)', borderRadius: '8px' }}>
          <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>维护总表</strong>：在"总表管理"页面添加/编辑/删除总表数据项</li>
            <li><strong>下发到组织</strong>：选择总表数据项，点击"下发"按钮，选择目标组织（可多选），数据将以待审核状态添加到各组织</li>
            <li><strong>冲突检查</strong>：点击"冲突检查"按钮，系统扫描所有组织数据与总表的差异</li>
            <li><strong>应用修复</strong>：确认冲突列表后，点击"应用总表数据到所有冲突"，系统将组织数据同步为总表值</li>
          </ol>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>整改任务流程</h3>
        <div style={{ padding: '16px', background: 'rgba(0,188,212,0.08)', borderRadius: '8px' }}>
          <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>自动生成</strong>：当总表数据变更时，系统自动检测各组织是否存在不一致数据，生成整改任务</li>
            <li><strong>查看任务</strong>：在"整改任务"页面查看待整改列表，显示总表值与组织值的差异</li>
            <li><strong>确认整改</strong>：点击"确认整改"按钮，组织数据将同步为总表值</li>
            <li><strong>批量处理</strong>：勾选多条任务后点击"批量确认整改"，一次性处理多个整改任务</li>
            <li><strong>忽略任务</strong>：如确认组织数据无需同步，可点击"忽略"保留原值</li>
          </ol>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>审计与回退流程</h3>
        <div style={{ padding: '16px', background: 'rgba(255,87,34,0.08)', borderRadius: '8px' }}>
          <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>查看日志</strong>：在"审计日志"页面查看所有数据变更历史，支持按组织、操作类型、时间范围筛选</li>
            <li><strong>回退预览</strong>：点击某条日志的"回退预览"按钮，查看操作前的值、操作后的值、当前值</li>
            <li><strong>执行回退</strong>：确认无误后点击"执行回退"，系统将数据恢复到操作前的状态</li>
            <li><strong>回退记录</strong>：回退操作本身也会记录审计日志，支持多次回退</li>
          </ol>
        </div>
      </div>

      <div>
        <h3 style={{ color: 'var(--primary)', marginBottom: '16px' }}>数据验证规则</h3>
        <div style={{ padding: '16px', background: 'rgba(244,67,54,0.08)', borderRadius: '8px' }}>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>必填字段</strong>：数据项名称、综合等级、机密性、完整性、可用性、合规性均为必填</li>
            <li><strong>取值范围</strong>：综合等级、机密性、完整性、可用性、合规性必须为 1-5 的整数</li>
            <li><strong>唯一性约束</strong>：同一组织下不允许存在重名数据项</li>
            <li><strong>组织约束</strong>：仅叶子节点组织可添加数据，有数据的组织不能添加子组织</li>
            <li><strong>总表冲突</strong>：组织数据与总表数据冲突时，系统会提示并建议以总表为准</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Workflow
