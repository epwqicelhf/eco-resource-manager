/**
 * 生态资源管理系统 - 测试用例目录
 * 
 * 测试用例分类：
 * - ORG: 组织管理
 * - GLB: 总表管理
 * - PRIV: 组织级隐私数据
 * - IMP: 数据导入
 * - REV: 数据审核
 * - REC: 整改任务
 * - AUD: 审计日志
 * - DST: 数据下发
 * - CNF: 冲突检查
 * - SUM: 统计汇总
 */

const testCases = {
  // ============================================================================
  // 组织管理模块 (ORG)
  // ============================================================================
  ORG: {
    module: '组织管理',
    cases: [
      {
        id: 'ORG-001',
        name: '创建一级组织',
        type: 'functional',
        priority: 'high',
        description: '验证可以成功创建一级组织',
        precondition: '系统已启动，数据库为空',
        steps: [
          'POST /api/orgs',
          '请求体: { name: "测试集团", parent_id: null }'
        ],
        expected: {
          status: 200,
          body: { id: 'positive_integer', name: '测试集团', level: 1, parent_id: null }
        }
      },
      {
        id: 'ORG-002',
        name: '创建二级组织',
        type: 'functional',
        priority: 'high',
        description: '验证可以在一级组织下创建二级组织',
        precondition: '已存在一级组织(id=1)',
        steps: [
          'POST /api/orgs',
          '请求体: { name: "技术部", parent_id: 1 }'
        ],
        expected: {
          status: 200,
          body: { id: 'positive_integer', name: '技术部', level: 2, parent_id: 1 }
        }
      },
      {
        id: 'ORG-003',
        name: '创建三级组织',
        type: 'functional',
        priority: 'medium',
        description: '验证可以创建多层级组织',
        precondition: '已存在二级组织(id=2)',
        steps: [
          'POST /api/orgs',
          '请求体: { name: "研发组", parent_id: 2 }'
        ],
        expected: {
          status: 200,
          body: { level: 3, parent_id: 2 }
        }
      },
      {
        id: 'ORG-004',
        name: '组织名称为空',
        type: 'exception',
        priority: 'high',
        description: '验证组织名称不能为空',
        precondition: '无',
        steps: [
          'POST /api/orgs',
          '请求体: { name: "", parent_id: null }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:名称' }
        }
      },
      {
        id: 'ORG-005',
        name: '父组织不存在',
        type: 'exception',
        priority: 'high',
        description: '验证引用不存在的父组织时返回错误',
        precondition: '数据库中无组织数据',
        steps: [
          'POST /api/orgs',
          '请求体: { name: "测试", parent_id: 999 }'
        ],
        expected: {
          status: 404,
          body: { error: 'string_contains:不存在' }
        }
      },
      {
        id: 'ORG-006',
        name: '在有数据的组织下创建子组织',
        type: 'exception',
        priority: 'high',
        description: '验证有隐私数据的组织不能添加子组织',
        precondition: '组织(id=2)下存在隐私数据',
        steps: [
          'POST /api/orgs',
          '请求体: { name: "子部门", parent_id: 2 }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:数据' }
        }
      },
      {
        id: 'ORG-007',
        name: '查询组织树',
        type: 'functional',
        priority: 'high',
        description: '验证可以正确查询组织树结构',
        precondition: '已创建多层级组织',
        steps: ['GET /api/orgs/tree'],
        expected: {
          status: 200,
          body: 'array_with_children'
        }
      },
      {
        id: 'ORG-008',
        name: '删除叶子组织',
        type: 'functional',
        priority: 'high',
        description: '验证可以删除无子组织的叶子节点',
        precondition: '存在叶子组织(id=3)',
        steps: ['DELETE /api/orgs/3'],
        expected: {
          status: 200,
          body: { success: true }
        }
      },
      {
        id: 'ORG-009',
        name: '删除有子组织的组织',
        type: 'exception',
        priority: 'high',
        description: '验证不能删除有子组织的节点',
        precondition: '组织(id=1)下有子组织',
        steps: ['DELETE /api/orgs/1'],
        expected: {
          status: 400,
          body: { error: 'string_contains:子组织' }
        }
      }
    ]
  },

  // ============================================================================
  // 总表管理模块 (GLB)
  // ============================================================================
  GLB: {
    module: '总表管理',
    cases: [
      {
        id: 'GLB-001',
        name: '创建总表数据',
        type: 'functional',
        priority: 'high',
        description: '验证可以成功创建总表数据项',
        precondition: '总表为空',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "用户姓名", grade: "3", confidentiality: "4", integrity: "3", availability: "3", compliance: "4" }'
        ],
        expected: {
          status: 200,
          body: { id: 'positive_integer', data_item: '用户姓名', grade: '3' }
        }
      },
      {
        id: 'GLB-002',
        name: '总表数据项名称为空',
        type: 'exception',
        priority: 'high',
        description: '验证数据项名称不能为空',
        precondition: '无',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "", grade: "3", ... }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:数据项' }
        }
      },
      {
        id: 'GLB-003',
        name: '等级字段为空',
        type: 'exception',
        priority: 'high',
        description: '验证等级字段不能为空',
        precondition: '无',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "测试", grade: "", ... }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:等级' }
        }
      },
      {
        id: 'GLB-004',
        name: '等级字段边界值-最小值',
        type: 'boundary',
        priority: 'high',
        description: '验证等级字段可以接受最小值1',
        precondition: '无',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "测试1", grade: "1", ... }'
        ],
        expected: {
          status: 200,
          body: { grade: '1' }
        }
      },
      {
        id: 'GLB-005',
        name: '等级字段边界值-最大值',
        type: 'boundary',
        priority: 'high',
        description: '验证等级字段可以接受最大值5',
        precondition: '无',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "测试5", grade: "5", ... }'
        ],
        expected: {
          status: 200,
          body: { grade: '5' }
        }
      },
      {
        id: 'GLB-006',
        name: '等级字段边界值-超出最小值',
        type: 'boundary',
        priority: 'high',
        description: '验证等级字段拒绝小于1的值',
        precondition: '无',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "测试0", grade: "0", ... }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:1-5' }
        }
      },
      {
        id: 'GLB-007',
        name: '等级字段边界值-超出最大值',
        type: 'boundary',
        priority: 'high',
        description: '验证等级字段拒绝大于5的值',
        precondition: '无',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "测试6", grade: "6", ... }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:1-5' }
        }
      },
      {
        id: 'GLB-008',
        name: '等级字段非整数',
        type: 'boundary',
        priority: 'medium',
        description: '验证等级字段必须是整数',
        precondition: '无',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "测试小数", grade: "3.5", ... }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:整数' }
        }
      },
      {
        id: 'GLB-009',
        name: '重复数据项名称',
        type: 'exception',
        priority: 'high',
        description: '验证总表中数据项名称唯一',
        precondition: '已存在 data_item="用户姓名"',
        steps: [
          'POST /api/privacy-global',
          '请求体: { data_item: "用户姓名", ... }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:已存在' }
        }
      },
      {
        id: 'GLB-010',
        name: '更新总表数据',
        type: 'functional',
        priority: 'high',
        description: '验证可以更新总表数据',
        precondition: '已存在总表数据(id=1)',
        steps: [
          'PUT /api/privacy-global/1',
          '请求体: { data_item: "用户姓名", grade: "4", confidentiality: "4", integrity: "3", availability: "3", compliance: "4" }'
        ],
        expected: {
          status: 200,
          body: { grade: '4' }
        }
      },
      {
        id: 'GLB-011',
        name: '删除总表数据',
        type: 'functional',
        priority: 'medium',
        description: '验证可以删除总表数据',
        precondition: '已存在总表数据',
        steps: ['DELETE /api/privacy-global/1'],
        expected: {
          status: 200,
          body: { success: true }
        }
      },
      {
        id: 'GLB-012',
        name: '查询总表数据',
        type: 'functional',
        priority: 'high',
        description: '验证可以查询总表数据列表',
        precondition: '总表中有数据',
        steps: ['GET /api/privacy-global'],
        expected: {
          status: 200,
          body: 'array'
        }
      }
    ]
  },

  // ============================================================================
  // 组织级隐私数据模块 (PRIV)
  // ============================================================================
  PRIV: {
    module: '组织级隐私数据',
    cases: [
      {
        id: 'PRIV-001',
        name: 'GUI新增隐私数据',
        type: 'functional',
        priority: 'high',
        description: '验证通过GUI新增隐私数据进入待审核状态',
        precondition: '已存在叶子组织(id=2)',
        steps: [
          'POST /api/privacy',
          '请求体: { org_id: 2, data_item: "员工工号", grade: "2", ... }'
        ],
        expected: {
          status: 200,
          body: { pending: true, pending_id: 'positive_integer' }
        }
      },
      {
        id: 'PRIV-002',
        name: '非叶子组织不能添加数据',
        type: 'exception',
        priority: 'high',
        description: '验证非叶子组织不能添加隐私数据',
        precondition: '组织(id=1)有子组织',
        steps: [
          'POST /api/privacy',
          '请求体: { org_id: 1, data_item: "测试", ... }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:叶子' }
        }
      },
      {
        id: 'PRIV-003',
        name: '组织不存在',
        type: 'exception',
        priority: 'high',
        description: '验证引用不存在的组织时返回错误',
        precondition: '无',
        steps: [
          'POST /api/privacy',
          '请求体: { org_id: 999, data_item: "测试", ... }'
        ],
        expected: {
          status: 404,
          body: { error: 'string_contains:不存在' }
        }
      },
      {
        id: 'PRIV-004',
        name: '同一组织重复数据项',
        type: 'exception',
        priority: 'high',
        description: '验证同一组织下数据项名称唯一',
        precondition: '组织(id=2)下已存在 data_item="员工工号"',
        steps: [
          'POST /api/privacy',
          '请求体: { org_id: 2, data_item: "员工工号", ... }'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:待审核' }
        }
      },
      {
        id: 'PRIV-005',
        name: '查询组织隐私数据',
        type: 'functional',
        priority: 'high',
        description: '验证可以查询指定组织的隐私数据',
        precondition: '组织(id=2)下有已发布数据',
        steps: ['GET /api/privacy?org_id=2'],
        expected: {
          status: 200,
          body: 'array'
        }
      },
      {
        id: 'PRIV-006',
        name: '更新隐私数据',
        type: 'functional',
        priority: 'high',
        description: '验证更新隐私数据进入待审核状态',
        precondition: '已存在隐私数据(id=1)',
        steps: [
          'PUT /api/privacy/1',
          '请求体: { grade: "3", ... }'
        ],
        expected: {
          status: 200,
          body: { pending: true }
        }
      },
      {
        id: 'PRIV-007',
        name: '删除隐私数据',
        type: 'functional',
        priority: 'medium',
        description: '验证删除隐私数据进入待审核状态',
        precondition: '已存在隐私数据',
        steps: ['DELETE /api/privacy/1'],
        expected: {
          status: 200,
          body: { pending: true }
        }
      }
    ]
  },

  // ============================================================================
  // 数据导入模块 (IMP)
  // ============================================================================
  IMP: {
    module: '数据导入',
    cases: [
      {
        id: 'IMP-001',
        name: '正常导入Excel',
        type: 'functional',
        priority: 'high',
        description: '验证可以正常导入Excel文件',
        precondition: '已存在叶子组织，准备好测试Excel',
        steps: [
          'POST /api/upload/import',
          '上传包含有效数据的Excel文件'
        ],
        expected: {
          status: 200,
          body: { new: 'positive_integer' }
        }
      },
      {
        id: 'IMP-002',
        name: '导入空文件',
        type: 'exception',
        priority: 'high',
        description: '验证导入空Excel文件时返回错误',
        precondition: '无',
        steps: [
          'POST /api/upload/import',
          '上传空的Excel文件'
        ],
        expected: {
          status: 400,
          body: { error: 'string_contains:未找到' }
        }
      },
      {
        id: 'IMP-003',
        name: '导入缺少必填字段',
        type: 'exception',
        priority: 'high',
        description: '验证导入缺少必填字段的数据时被跳过',
        precondition: '准备好缺少grade字段的Excel',
        steps: [
          'POST /api/upload/import',
          '上传缺少必填字段的Excel'
        ],
        expected: {
          status: 200,
          body: { skipped: 'positive_integer' }
        }
      },
      {
        id: 'IMP-004',
        name: '导入重复数据项',
        type: 'exception',
        priority: 'high',
        description: '验证导入重复数据项时只保留第一条',
        precondition: '准备好包含重复数据项的Excel',
        steps: [
          'POST /api/upload/import',
          '上传包含重复数据项的Excel'
        ],
        expected: {
          status: 200,
          body: { duplicate: 'positive_integer' }
        }
      },
      {
        id: 'IMP-005',
        name: '导入包含组织分类列',
        type: 'functional',
        priority: 'high',
        description: '验证导入时自动创建组织结构',
        precondition: '准备好包含一级分类、二级分类列的Excel',
        steps: [
          'POST /api/upload/import',
          '上传包含组织分类列的Excel'
        ],
        expected: {
          status: 200,
          body: { orgs_created: 'array' }
        }
      },
      {
        id: 'IMP-006',
        name: '下载导入模板',
        type: 'functional',
        priority: 'medium',
        description: '验证可以下载导入模板',
        precondition: '无',
        steps: ['GET /api/upload/template'],
        expected: {
          status: 200,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      }
    ]
  },

  // ============================================================================
  // 数据审核模块 (REV)
  // ============================================================================
  REV: {
    module: '数据审核',
    cases: [
      {
        id: 'REV-001',
        name: '查询待审核数据',
        type: 'functional',
        priority: 'high',
        description: '验证可以查询待审核数据列表',
        precondition: '存在待审核数据',
        steps: ['GET /api/pending?status=pending'],
        expected: {
          status: 200,
          body: 'array'
        }
      },
      {
        id: 'REV-002',
        name: '审核通过',
        type: 'functional',
        priority: 'high',
        description: '验证审核通过后数据正式发布',
        precondition: '存在待审核数据(id=1)',
        steps: [
          'POST /api/pending/review',
          '请求体: { id: 1, action: "approved" }'
        ],
        expected: {
          status: 200,
          body: { success: true }
        }
      },
      {
        id: 'REV-003',
        name: '审核驳回',
        type: 'functional',
        priority: 'high',
        description: '验证审核驳回后数据不发布',
        precondition: '存在待审核数据',
        steps: [
          'POST /api/pending/review',
          '请求体: { id: 2, action: "rejected" }'
        ],
        expected: {
          status: 200,
          body: { success: true }
        }
      },
      {
        id: 'REV-004',
        name: '批量审核',
        type: 'functional',
        priority: 'medium',
        description: '验证可以批量审核多条数据',
        precondition: '存在多条待审核数据',
        steps: [
          'POST /api/pending/batch-review',
          '请求体: { ids: [1,2,3], action: "approved" }'
        ],
        expected: {
          status: 200,
          body: { processed: 'positive_integer' }
        }
      },
      {
        id: 'REV-005',
        name: '审核不存在的数据',
        type: 'exception',
        priority: 'medium',
        description: '验证审核不存在的待审核数据时返回错误',
        precondition: '无',
        steps: [
          'POST /api/pending/review',
          '请求体: { id: 999, action: "approved" }'
        ],
        expected: {
          status: 404,
          body: { error: 'string_contains:不存在' }
        }
      }
    ]
  },

  // ============================================================================
  // 整改任务模块 (REC)
  // ============================================================================
  REC: {
    module: '整改任务',
    cases: [
      {
        id: 'REC-001',
        name: '修改总表触发整改任务',
        type: 'functional',
        priority: 'high',
        description: '验证修改总表数据时自动生成整改任务',
        precondition: '总表和组织数据存在差异',
        steps: [
          'PUT /api/privacy-global/1',
          '修改总表数据'
        ],
        expected: {
          status: 200,
          body: { rectification_tasks_created: 'positive_integer' }
        }
      },
      {
        id: 'REC-002',
        name: '查询整改任务',
        type: 'functional',
        priority: 'high',
        description: '验证可以查询整改任务列表',
        precondition: '存在整改任务',
        steps: ['GET /api/rectification-tasks'],
        expected: {
          status: 200,
          body: 'array'
        }
      },
      {
        id: 'REC-003',
        name: '确认整改任务',
        type: 'functional',
        priority: 'high',
        description: '验证确认整改任务后组织数据同步',
        precondition: '存在整改任务(id=1)',
        steps: ['POST /api/rectification-tasks/1/confirm'],
        expected: {
          status: 200,
          body: { success: true }
        }
      },
      {
        id: 'REC-004',
        name: '批量确认整改',
        type: 'functional',
        priority: 'medium',
        description: '验证可以批量确认多条整改任务',
        precondition: '存在多条整改任务',
        steps: [
          'POST /api/rectification-tasks/batch-confirm',
          '请求体: { ids: [1,2,3] }'
        ],
        expected: {
          status: 200,
          body: { confirmed: 'positive_integer' }
        }
      },
      {
        id: 'REC-005',
        name: '忽略整改任务',
        type: 'functional',
        priority: 'medium',
        description: '验证可以忽略整改任务',
        precondition: '存在整改任务',
        steps: ['POST /api/rectification-tasks/1/dismiss'],
        expected: {
          status: 200,
          body: { success: true }
        }
      }
    ]
  },

  // ============================================================================
  // 审计日志模块 (AUD)
  // ============================================================================
  AUD: {
    module: '审计日志',
    cases: [
      {
        id: 'AUD-001',
        name: '查询审计日志',
        type: 'functional',
        priority: 'high',
        description: '验证可以查询审计日志列表',
        precondition: '系统中有操作记录',
        steps: ['GET /api/audit-log'],
        expected: {
          status: 200,
          body: { rows: 'array', total: 'positive_integer' }
        }
      },
      {
        id: 'AUD-002',
        name: '按组织筛选日志',
        type: 'functional',
        priority: 'medium',
        description: '验证可以按组织筛选审计日志',
        precondition: '无',
        steps: ['GET /api/audit-log?org_id=1'],
        expected: {
          status: 200,
          body: { rows: 'array' }
        }
      },
      {
        id: 'AUD-003',
        name: '回退预览',
        type: 'functional',
        priority: 'high',
        description: '验证可以预览回退操作的影响',
        precondition: '存在可回退的审计记录',
        steps: ['GET /api/audit-log/rollback/1'],
        expected: {
          status: 200,
          body: { before: 'object', after: 'object', current: 'object' }
        }
      },
      {
        id: 'AUD-004',
        name: '执行回退',
        type: 'functional',
        priority: 'high',
        description: '验证可以执行回退操作',
        precondition: '存在可回退的审计记录',
        steps: ['POST /api/audit-log/rollback/1'],
        expected: {
          status: 200,
          body: { applied: true }
        }
      },
      {
        id: 'AUD-005',
        name: '审计日志上限',
        type: 'boundary',
        priority: 'medium',
        description: '验证审计日志超过20000条时自动清理',
        precondition: '无',
        steps: ['创建超过20000条审计记录'],
        expected: {
          database: 'audit_log_count <= 20000'
        }
      }
    ]
  },

  // ============================================================================
  // 数据下发模块 (DST)
  // ============================================================================
  DST: {
    module: '数据下发',
    cases: [
      {
        id: 'DST-001',
        name: '下发总表数据到组织',
        type: 'functional',
        priority: 'high',
        description: '验证可以将总表数据下发到指定组织',
        precondition: '总表和组织都存在',
        steps: [
          'POST /api/privacy-global/1/distribute',
          '请求体: { org_ids: [2, 3] }'
        ],
        expected: {
          status: 200,
          body: { distributed: 'positive_integer' }
        }
      },
      {
        id: 'DST-002',
        name: '下发到非叶子组织',
        type: 'exception',
        priority: 'high',
        description: '验证不能下发到非叶子组织',
        precondition: '组织(id=1)有子组织',
        steps: [
          'POST /api/privacy-global/1/distribute',
          '请求体: { org_ids: [1] }'
        ],
        expected: {
          status: 200,
          body: { skipped: 'positive_integer' }
        }
      },
      {
        id: 'DST-003',
        name: '下发已存在的数据',
        type: 'exception',
        priority: 'medium',
        description: '验证下发已存在的数据时被跳过',
        precondition: '组织下已存在相同数据项',
        steps: [
          'POST /api/privacy-global/1/distribute',
          '请求体: { org_ids: [2] }'
        ],
        expected: {
          status: 200,
          body: { skipped: 'positive_integer' }
        }
      }
    ]
  },

  // ============================================================================
  // 冲突检查模块 (CNF)
  // ============================================================================
  CNF: {
    module: '冲突检查',
    cases: [
      {
        id: 'CNF-001',
        name: '执行冲突检查',
        type: 'functional',
        priority: 'high',
        description: '验证可以检查总表与组织数据的冲突',
        precondition: '总表和组织数据存在差异',
        steps: [
          'POST /api/privacy-global/conflict-check',
          '请求体: { apply: false }'
        ],
        expected: {
          status: 200,
          body: { conflicts: 'positive_integer', details: 'array' }
        }
      },
      {
        id: 'CNF-002',
        name: '应用冲突修复',
        type: 'functional',
        priority: 'high',
        description: '验证应用冲突修复后组织数据同步',
        precondition: '存在冲突数据',
        steps: [
          'POST /api/privacy-global/conflict-check',
          '请求体: { apply: true }'
        ],
        expected: {
          status: 200,
          body: { applied: 'positive_integer' }
        }
      },
      {
        id: 'CNF-003',
        name: '无冲突时检查',
        type: 'functional',
        priority: 'medium',
        description: '验证无冲突时返回空列表',
        precondition: '总表和组织数据一致',
        steps: [
          'POST /api/privacy-global/conflict-check',
          '请求体: { apply: false }'
        ],
        expected: {
          status: 200,
          body: { conflicts: 0 }
        }
      }
    ]
  },

  // ============================================================================
  // 统计汇总模块 (SUM)
  // ============================================================================
  SUM: {
    module: '统计汇总',
    cases: [
      {
        id: 'SUM-001',
        name: '查询汇总统计',
        type: 'functional',
        priority: 'high',
        description: '验证可以查询系统汇总统计数据',
        precondition: '系统中有数据',
        steps: ['GET /api/summary'],
        expected: {
          status: 200,
          body: {
            global_count: 'non_negative_integer',
            org_data_count: 'non_negative_integer',
            org_count: 'non_negative_integer'
          }
        }
      },
      {
        id: 'SUM-002',
        name: '统计整改任务',
        type: 'functional',
        priority: 'medium',
        description: '验证统计数据包含整改任务统计',
        precondition: '存在整改任务',
        steps: ['GET /api/summary'],
        expected: {
          status: 200,
          body: {
            rectification_pending: 'non_negative_integer',
            rectification_confirmed: 'non_negative_integer'
          }
        }
      }
    ]
  }
};

// 导出测试用例
module.exports = testCases;
