const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
let testResults = [];
let testCount = 0;
let passCount = 0;
let failCount = 0;

function request(method, path, body = null, isFormData = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {}
    };

    let reqBody = null;
    if (body && !isFormData) {
      reqBody = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    } else if (body && isFormData) {
      const boundary = '----TestBoundary' + Date.now();
      const parts = [];
      for (const [key, value] of Object.entries(body)) {
        if (value instanceof Buffer) {
          parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="${key}.xlsx"\r\nContent-Type: application/octet-stream\r\n\r\n`));
          parts.push(value);
          parts.push(Buffer.from('\r\n'));
        } else {
          parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
        }
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));
      reqBody = Buffer.concat(parts);
      options.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      options.headers['Content-Length'] = reqBody.length;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

async function test(name, fn) {
  testCount++;
  const startTime = Date.now();
  try {
    await fn();
    const duration = Date.now() - startTime;
    passCount++;
    testResults.push({ name, status: 'PASS', duration });
    console.log(`  ✓ ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - startTime;
    failCount++;
    testResults.push({ name, status: 'FAIL', duration, error: err.message });
    console.log(`  ✗ ${name} (${duration}ms)`);
    console.log(`    Error: ${err.message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed: expected true');
  }
}

async function runTests() {
  console.log('\n=== 生态资源管理系统 - 测试报告 ===\n');

  console.log('【组织管理测试】');
  await test('创建一级组织', async () => {
    const res = await request('POST', '/api/orgs', { name: '测试集团', parent_id: null });
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.id > 0, 'Org ID');
  });

  await test('创建二级组织', async () => {
    const res = await request('POST', '/api/orgs', { name: '技术部', parent_id: 1 });
    assertEqual(res.status, 200, 'Status');
    assertEqual(res.body.level, 2, 'Level');
  });

  await test('禁止在有数据的组织下创建子组织', async () => {
    const res = await request('POST', '/api/orgs', { name: '子部门', parent_id: 2 });
    // This should succeed since no data yet
    assertEqual(res.status, 200, 'Status');
  });

  console.log('\n【总表管理测试】');
  await test('创建总表数据', async () => {
    const res = await request('POST', '/api/privacy-global', {
      data_item: '用户姓名', grade: '3', confidentiality: '4',
      integrity: '3', availability: '3', compliance: '4'
    });
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.id > 0, 'Global ID');
  });

  await test('总表数据必填字段校验', async () => {
    const res = await request('POST', '/api/privacy-global', {
      data_item: '测试项', grade: '', confidentiality: '3',
      integrity: '3', availability: '3', compliance: '3'
    });
    assertEqual(res.status, 400, 'Should reject empty grade');
  });

  await test('总表数据范围校验(1-5)', async () => {
    const res = await request('POST', '/api/privacy-global', {
      data_item: '测试项', grade: '7', confidentiality: '3',
      integrity: '3', availability: '3', compliance: '3'
    });
    assertEqual(res.status, 400, 'Should reject out of range');
  });

  console.log('\n【隐私数据测试】');
  await test('GUI新增隐私数据(待审核)', async () => {
    // org_id 3 is the leaf node (技术部 -> 子部门)
    const res = await request('POST', '/api/privacy', {
      org_id: 3, data_item: '员工工号', grade: '2', confidentiality: '3',
      integrity: '4', availability: '5', compliance: '3'
    });
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.pending, 'Should be pending');
  });

  await test('审核通过隐私数据', async () => {
    // Get the pending items first
    const pendingRes = await request('GET', '/api/pending?status=pending');
    assertTrue(pendingRes.body.length > 0, 'Should have pending items');
    const pendingId = pendingRes.body[0].id;
    const res = await request('POST', '/api/pending/review', { id: pendingId, action: 'approved' });
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.success, 'Should succeed');
  });

  await test('查询已发布数据', async () => {
    const res = await request('GET', '/api/privacy?org_id=3');
    assertEqual(res.status, 200, 'Status');
    assertTrue(Array.isArray(res.body), 'Should be array');
    assertTrue(res.body.length > 0, 'Should have data');
  });

  console.log('\n【整改任务测试】');
  await test('修改总表数据触发整改任务', async () => {
    const res = await request('PUT', '/api/privacy-global/1', {
      data_item: '用户姓名', grade: '4', confidentiality: '5',
      integrity: '4', availability: '4', compliance: '5'
    });
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.rectification_tasks_created >= 0, 'Should have tasks field');
  });

  await test('查询整改任务', async () => {
    const res = await request('GET', '/api/rectification-tasks');
    assertEqual(res.status, 200, 'Status');
    assertTrue(Array.isArray(res.body), 'Should be array');
  });

  await test('确认整改任务', async () => {
    const tasksRes = await request('GET', '/api/rectification-tasks');
    if (tasksRes.body.length > 0) {
      const taskId = tasksRes.body[0].id;
      const res = await request('POST', `/api/rectification-tasks/${taskId}/confirm`, {});
      assertEqual(res.status, 200, 'Status');
      assertTrue(res.body.success, 'Should succeed');
    }
  });

  console.log('\n【审计日志测试】');
  await test('查询审计日志', async () => {
    const res = await request('GET', '/api/audit-log');
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.rows.length > 0, 'Should have logs');
    assertTrue(res.body.total > 0, 'Total should be > 0');
  });

  await test('回退预览', async () => {
    const res = await request('GET', '/api/audit-log/rollback/1');
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.before !== undefined, 'Should have before');
    assertTrue(res.body.after !== undefined, 'Should have after');
  });

  console.log('\n【冲突检查测试】');
  await test('执行冲突检查', async () => {
    const res = await request('POST', '/api/privacy-global/conflict-check', { apply: false });
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.conflicts !== undefined, 'Should have conflicts count');
  });

  console.log('\n【数据下发测试】');
  await test('下发总表数据到组织', async () => {
    const res = await request('POST', '/api/privacy-global/1/distribute', { org_ids: [2] });
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.distributed >= 0, 'Should have distributed count');
  });

  console.log('\n【汇总统计测试】');
  await test('查询汇总统计', async () => {
    const res = await request('GET', '/api/summary');
    assertEqual(res.status, 200, 'Status');
    assertTrue(res.body.global_count !== undefined, 'Should have global_count');
    assertTrue(res.body.org_data_count !== undefined, 'Should have org_data_count');
  });

  // Generate report
  console.log('\n\n=== 测试报告 ===');
  console.log(`总测试数: ${testCount}`);
  console.log(`通过: ${passCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`通过率: ${((passCount / testCount) * 100).toFixed(2)}%`);
  console.log('\n详细结果:');
  testResults.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.status}] ${r.name} (${r.duration}ms)${r.error ? ' - ' + r.error : ''}`);
  });

  if (failCount > 0) {
    console.log('\n⚠ 存在失败的测试用例，请检查！');
    process.exit(1);
  } else {
    console.log('\n✓ 所有测试通过！');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
