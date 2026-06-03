import XLSX from 'xlsx';

const FIELD_MAP = {
  '数据项': 'data_item',
  '综合等级': 'grade',
  '机密性': 'confidentiality',
  '完整性': 'integrity',
  '可用性': 'availability',
  '合规性': 'compliance'
};

const ORG_LEVEL_KEYS = [
  { cn: '一级分类', key: 'org_level_1' },
  { cn: '二级分类', key: 'org_level_2' },
  { cn: '三级分类', key: 'org_level_3' },
  { cn: '四级分类', key: 'org_level_4' },
  { cn: '五级分类', key: 'org_level_5' }
];

export function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const results = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (jsonData.length === 0) continue;

    const firstRow = jsonData[0];
    const rowKeys = Object.keys(firstRow);
    const hasOrgColumns = ORG_LEVEL_KEYS.some(ol =>
      rowKeys.some(k => k.includes(ol.cn))
    );

    for (const row of jsonData) {
      const record = { source_sheet: sheetName };
      let hasData = false;

      for (const [cnKey, enKey] of Object.entries(FIELD_MAP)) {
        for (const rowKey of rowKeys) {
          if (rowKey.includes(cnKey)) {
            record[enKey] = String(row[rowKey] ?? '').trim();
            if (enKey === 'data_item' && record[enKey]) hasData = true;
            break;
          }
        }
      }

      if (hasOrgColumns) {
        record.org_path = [];
        for (const ol of ORG_LEVEL_KEYS) {
          for (const rowKey of rowKeys) {
            if (rowKey.includes(ol.cn)) {
              const val = String(row[rowKey] ?? '').trim();
              if (val) record.org_path.push(val);
              break;
            }
          }
        }
        if (record.org_path.length === 0) {
          record.org_path = null;
        }
      }

      if (hasData && record.data_item) {
        results.push(record);
      }
    }
  }

  return results;
}

export function validateRange(value) {
  if (!value || !String(value).trim()) return false;
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= 5;
}

export function validateRecordFields(record) {
  const rangeFields = ['grade', 'confidentiality', 'integrity', 'availability', 'compliance'];
  const errors = [];
  const LABELS = { data_item: '数据项', grade: '综合等级', confidentiality: '机密性', integrity: '完整性', availability: '可用性', compliance: '合规性' };

  if (!record.data_item || !String(record.data_item).trim()) {
    errors.push('数据项不能为空');
  }

  for (const f of rangeFields) {
    const val = String(record[f] || '').trim();
    if (!val) {
      errors.push(`${LABELS[f]}不能为空`);
    } else if (!validateRange(val)) {
      errors.push(`${LABELS[f]}必须为1-5的整数（当前值: ${val}）`);
    }
  }

  return errors;
}

export function buildTemplateBuffer() {
  const workbook = XLSX.utils.book_new();

  const headers = ['一级分类', '二级分类', '三级分类', '四级分类', '五级分类', '数据项', '综合等级', '机密性', '完整性', '可用性', '合规性'];

  const exampleRows = [
    ['集团', '技术部', '研发组', '', '', '用户姓名', '3', '4', '3', '3', '4'],
    ['集团', '技术部', '运维组', '', '', '服务器IP', '4', '5', '4', '5', '3'],
    ['集团', '财务部', '', '', '', '员工工资', '5', '5', '5', '4', '5'],
  ];

  const data = [headers, ...exampleRows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
  ];

  const noteSheet = XLSX.utils.aoa_to_sheet([
    ['导入模板说明'],
    [''],
    ['列名说明：'],
    ['一级分类 ~ 五级分类', '组织层级路径，系统会自动创建对应组织（可为空，为空时使用手动选择的组织）'],
    ['数据项', '必填，隐私数据项名称'],
    ['综合等级', '必填，取值范围 1-5'],
    ['机密性', '必填，取值范围 1-5'],
    ['完整性', '必填，取值范围 1-5'],
    ['可用性', '必填，取值范围 1-5'],
    ['合规性', '必填，取值范围 1-5'],
    [''],
    ['注意事项：'],
    ['1. 同一组织下不允许存在重名数据项'],
    ['2. 所有等级字段必须为 1-5 的整数'],
    ['3. 支持多Sheet页导入，每个Sheet页格式一致'],
    ['4. 组织分类列可为空，此时使用上传时选择的组织'],
  ]);

  XLSX.utils.book_append_sheet(workbook, ws, '导入数据');
  XLSX.utils.book_append_sheet(workbook, noteSheet, '说明');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function buildExportBuffer(records, filename = '数据表') {
  const workbook = XLSX.utils.book_new();
  const headers = ['数据项', '综合等级', '机密性', '完整性', '可用性', '合规性'];

  const data = [headers];
  for (const r of records) {
    data.push([
      r.data_item || '',
      r.grade || '',
      r.confidentiality || '',
      r.integrity || '',
      r.availability || '',
      r.compliance || ''
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 30 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(workbook, ws, '隐私数据');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
