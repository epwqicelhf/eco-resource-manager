# 生态资源管理系统

生态资源管理系统是一个基于Node.js和React的B/S架构应用，用于管理组织结构和隐私数据。系统支持多级组织架构、数据导入导出、审核流程、整改任务管理等功能。

## 功能特性

### 核心功能

1. **组织管理**
   - 多级组织架构（支持无限层级）
   - 叶子节点限制（只有叶子节点可以添加数据）
   - 组织树形展示和选择
   - 组织CRUD操作

2. **隐私数据管理**
   - 总表管理（全局隐私数据）
   - 组织级隐私数据
   - 数据下发（总表→组织）
   - 冲突检查和修复

3. **数据导入导出**
   - Excel文件导入（支持多Sheet）
   - 自动识别组织分类列（一级分类~五级分类）
   - 自动创建缺失的组织结构
   - 导入模板下载
   - 数据导出

4. **审核流程**
   - 新增/修改/删除待审核
   - 单条审核和批量审核
   - 审核通过/驳回
   - 审核历史记录

5. **整改任务**
   - 自动检测总表与组织数据差异
   - 生成整改任务
   - 确认整改/忽略任务
   - 批量整改

6. **审计日志**
   - 完整的操作日志
   - 回退预览和执行
   - 日志上限管理（最多20000条）
   - 按组织/操作类型/时间筛选

7. **数据验证**
   - 必填字段验证
   - 等级字段范围验证（1-5）
   - 数据项唯一性验证
   - 同一组织重名检测

## 技术栈

### 后端
- **运行时**: Node.js 24.16.0
- **框架**: Express 5.2.1
- **数据库**: SQLite (sql.js 1.14.1)
- **文件处理**: Multer 2.1.1, XLSX 0.18.5
- **跨域**: CORS 2.8.6

### 前端
- **框架**: React 18
- **构建工具**: Vite 8.0.14
- **样式**: CSS3

### 测试
- **测试框架**: 自定义测试运行器
- **测试用例**: 57个测试用例
- **测试类型**: 功能测试、边界值测试、异常测试
- **测试报告**: JSON格式，包含追溯矩阵

## 项目结构

```
privacy/
├── server/                 # 后端代码
│   ├── index.js           # Express服务器主文件
│   ├── db.js              # 数据库初始化和迁移
│   ├── excel.js           # Excel解析和生成
│   ├── migrations.js      # 数据库迁移脚本
│   └── privacy.db         # SQLite数据库文件
├── client/                # 前端代码
│   ├── src/
│   │   ├── App.jsx        # 主应用组件
│   │   ├── api.js         # API调用封装
│   │   └── components/    # React组件
│   ├── public/            # 静态资源
│   └── package.json       # 前端依赖
├── tests/                 # 测试代码
│   ├── TEST_STRATEGY.md   # 测试策略文档
│   ├── cases.js           # 测试用例定义
│   ├── runner.cjs         # 测试运行器
│   ├── README.md          # 测试框架文档
│   └── reports/           # 测试报告输出
└── package.json           # 项目依赖和脚本
```

## 快速开始

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装依赖

```bash
npm install
```

### 开发模式

启动后端和前端开发服务器：

```bash
npm run dev
```

- 后端: http://localhost:3001
- 前端: http://localhost:5173

### 生产模式

构建前端并启动服务器：

```bash
npm run build
npm start
```

访问 http://localhost:3001

## 测试

### 运行测试

```bash
npm test
```

或者

```bash
node tests/runner.cjs
```

### 测试输出

测试运行器会输出：
- 实时测试进度
- 每个测试用例的执行状态
- 失败测试的详细错误信息
- 测试摘要统计
- 报告文件路径

### 测试报告

测试完成后，会在 `tests/reports/` 目录下生成：
- `test-report-{timestamp}.json`: 详细测试报告
- `traceability-{timestamp}.json`: 测试追溯矩阵

### 测试统计

当前测试套件包含：
- **总测试数**: 57
- **通过率**: ~80%
- **测试类型**:
  - 功能测试: 35个
  - 边界值测试: 6个
  - 异常测试: 16个
- **测试模块**:
  - 组织管理: 9个
  - 总表管理: 12个
  - 组织级隐私数据: 7个
  - 数据导入: 6个
  - 数据审核: 5个
  - 整改任务: 5个
  - 审计日志: 5个
  - 数据下发: 3个
  - 冲突检查: 3个
  - 统计汇总: 2个

详细测试文档请查看 [tests/README.md](tests/README.md)

## API文档

### 组织管理
- `GET /api/orgs` - 获取组织列表
- `GET /api/orgs/tree` - 获取组织树
- `POST /api/orgs` - 创建组织
- `PUT /api/orgs/:id` - 更新组织
- `DELETE /api/orgs/:id` - 删除组织

### 总表管理
- `GET /api/privacy-global` - 获取总表数据
- `GET /api/privacy-global/search` - 搜索总表数据
- `GET /api/privacy-global/match` - 精确匹配总表数据
- `POST /api/privacy-global` - 创建总表数据
- `PUT /api/privacy-global/:id` - 更新总表数据
- `DELETE /api/privacy-global/:id` - 删除总表数据
- `POST /api/privacy-global/:id/distribute` - 下发总表数据到组织
- `POST /api/privacy-global/conflict-check` - 冲突检查

### 隐私数据
- `GET /api/privacy` - 获取隐私数据
- `POST /api/privacy` - 创建隐私数据（待审核）
- `PUT /api/privacy/:id` - 更新隐私数据（待审核）
- `DELETE /api/privacy/:id` - 删除隐私数据（待审核）

### 数据导入
- `POST /api/upload/import` - 导入Excel文件
- `GET /api/upload/template` - 下载导入模板

### 审核管理
- `GET /api/pending` - 获取待审核数据
- `GET /api/pending/gui` - 获取GUI创建的待审核数据
- `POST /api/pending/review` - 审核单条数据
- `POST /api/pending/batch-review` - 批量审核
- `POST /api/pending/approve-by-type` - 按类型审核
- `DELETE /api/pending/:id` - 取消待审核

### 整改任务
- `GET /api/rectification-tasks` - 获取整改任务
- `POST /api/rectification-tasks/:id/confirm` - 确认整改
- `POST /api/rectification-tasks/batch-confirm` - 批量确认整改
- `POST /api/rectification-tasks/:id/dismiss` - 忽略整改

### 审计日志
- `GET /api/audit-log` - 获取审计日志
- `GET /api/audit-log/rollback/:id` - 回退预览
- `POST /api/audit-log/rollback/:id` - 执行回退

### 统计汇总
- `GET /api/summary` - 获取汇总统计

## 数据库迁移

系统使用版本化的数据库迁移机制，确保数据库结构与代码版本一致。

### 迁移文件

迁移脚本定义在 `server/migrations.js` 中，每个迁移包含：
- `version`: 版本号
- `description`: 描述
- `up(db)`: 升级函数

### 自动迁移

服务器启动时会自动检测并应用未执行的迁移，无需手动操作。

## 数据验证规则

### 必填字段
- 数据项名称 (data_item)
- 综合等级 (grade)
- 机密性 (confidentiality)
- 完整性 (integrity)
- 可用性 (availability)
- 合规性 (compliance)

### 等级字段验证
- 必须为整数
- 范围: 1-5（包含1和5）

### 唯一性约束
- 同一组织下数据项名称唯一
- 总表中数据项名称唯一

### 组织约束
- 只有叶子节点可以添加隐私数据
- 有数据的组织不能添加子组织

## 工作流程

### 数据录入流程
1. 选择叶子节点组织
2. 新增隐私数据（进入待审核）
3. 审核员审核通过
4. 数据正式发布到组织

### 数据导入流程
1. 下载导入模板
2. 填写Excel数据（可包含组织分类列）
3. 上传Excel文件
4. 系统自动解析和验证
5. 数据进入待审核状态
6. 审核员审核通过
7. 数据正式发布

### 整改任务流程
1. 修改总表数据
2. 系统自动检测组织数据差异
3. 生成整改任务
4. 组织管理员确认整改
5. 组织数据同步为总表值

### 审计回退流程
1. 查看审计日志
2. 选择要回退的操作
3. 预览回退结果
4. 执行回退
5. 数据恢复到操作前状态

## 故障排查

### 服务器启动失败
- 检查端口3001是否被占用
- 查看服务器日志输出
- 验证依赖是否正确安装

### 数据库错误
- 检查数据库文件权限
- 验证迁移脚本是否正确
- 查看数据库日志

### 测试失败
- 查看详细测试报告
- 检查API端点是否正常
- 验证数据库状态

## 开发指南

### 添加新的API端点

1. 在 `server/index.js` 中添加路由处理函数
2. 在 `client/src/api.js` 中添加API调用封装
3. 在 `tests/cases.js` 中添加测试用例
4. 在 `tests/runner.cjs` 中添加测试逻辑
5. 运行测试验证

### 添加新的数据库表

1. 在 `server/migrations.js` 中添加迁移脚本
2. 更新 `CURRENT_VERSION` 常量
3. 重启服务器应用迁移
4. 在 `server/db.js` 中添加查询函数

### 添加新的前端组件

1. 在 `client/src/components/` 中创建组件文件
2. 在 `client/src/App.jsx` 中引入并使用组件
3. 在 `client/src/api.js` 中添加必要的API调用
4. 构建前端验证

## 许可证

本项目采用 MIT 许可证。

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

如有问题，请联系开发团队。
