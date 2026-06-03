const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * 创建测试用的Excel文件
 */
function createTestExcelFiles() {
  const testDir = path.join(__dirname, 'data');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // IMP-001: 正常导入Excel
  const normalData = [
    ['数据项', '综合等级', '机密性', '完整性', '可用性', '合规性'],
    ['测试数据1', '3', '3', '3', '3', '3'],
    ['测试数据2', '2', '4', '3', '5', '3'],
    ['测试数据3', '4', '2', '4', '3', '4']
  ];
  const wb1 = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(normalData);
  XLSX.utils.book_append_sheet(wb1, ws1, 'Sheet1');
  XLSX.writeFile(wb1, path.join(testDir, 'normal_import.xlsx'));

  // IMP-002: 空文件
  const emptyData = [['数据项', '综合等级', '机密性', '完整性', '可用性', '合规性']];
  const wb2 = XLSX.utils.book_new();
  const ws2 = XLSX.utils.aoa_to_sheet(emptyData);
  XLSX.utils.book_append_sheet(wb2, ws2, 'Sheet1');
  XLSX.writeFile(wb2, path.join(testDir, 'empty_import.xlsx'));

  // IMP-003: 缺少必填字段
  const missingFieldData = [
    ['数据项', '综合等级', '机密性', '完整性', '可用性', '合规性'],
    ['测试数据1', '', '3', '3', '3', '3'],
    ['测试数据2', '2', '', '3', '3', '3'],
    ['测试数据3', '3', '3', '', '3', '3']
  ];
  const wb3 = XLSX.utils.book_new();
  const ws3 = XLSX.utils.aoa_to_sheet(missingFieldData);
  XLSX.utils.book_append_sheet(wb3, ws3, 'Sheet1');
  XLSX.writeFile(wb3, path.join(testDir, 'missing_fields.xlsx'));

  // IMP-004: 重复数据项
  const duplicateData = [
    ['数据项', '综合等级', '机密性', '完整性', '可用性', '合规性'],
    ['重复数据', '3', '3', '3', '3', '3'],
    ['重复数据', '4', '4', '4', '4', '4'],
    ['唯一数据', '2', '2', '2', '2', '2']
  ];
  const wb4 = XLSX.utils.book_new();
  const ws4 = XLSX.utils.aoa_to_sheet(duplicateData);
  XLSX.utils.book_append_sheet(wb4, ws4, 'Sheet1');
  XLSX.writeFile(wb4, path.join(testDir, 'duplicate_items.xlsx'));

  // IMP-005: 包含组织分类列
  const orgClassData = [
    ['一级分类', '二级分类', '数据项', '综合等级', '机密性', '完整性', '可用性', '合规性'],
    ['集团', '技术部', '组织数据1', '3', '3', '3', '3', '3'],
    ['集团', '财务部', '组织数据2', '4', '4', '4', '4', '4'],
    ['子公司', '研发部', '组织数据3', '2', '2', '2', '2', '2']
  ];
  const wb5 = XLSX.utils.book_new();
  const ws5 = XLSX.utils.aoa_to_sheet(orgClassData);
  XLSX.utils.book_append_sheet(wb5, ws5, 'Sheet1');
  XLSX.writeFile(wb5, path.join(testDir, 'with_org_classification.xlsx'));

  console.log('Test Excel files created in:', testDir);
  return testDir;
}

module.exports = { createTestExcelFiles };
