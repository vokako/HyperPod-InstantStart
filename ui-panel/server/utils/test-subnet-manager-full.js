#!/usr/bin/env node

/**
 * SubnetManager 完整测试套件
 * 包含创建、验证、清理的完整流程
 */

const SubnetManager = require('./subnetManager');
const { execSync } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// 测试配置
const TEST_CONFIG = {
  vpcId: 'vpc-0bd3eb4aaaeb4d631',
  region: 'us-west-2',
  clusterTag: 'hypd-1031-3706'
};

// 存储测试中创建的资源，用于清理
const createdResources = {
  subnets: []
};

/**
 * 清理测试创建的子网
 */
async function cleanupSubnet(subnetId) {
  try {
    console.log(`🧹 Cleaning up subnet: ${subnetId}`);
    
    // 1. 先解除路由表关联
    const describeCmd = `aws ec2 describe-route-tables \
      --filters "Name=association.subnet-id,Values=${subnetId}" \
      --query "RouteTables[0].Associations[?SubnetId=='${subnetId}'].RouteTableAssociationId" \
      --region ${TEST_CONFIG.region} \
      --output text`;
    
    const associationId = (await exec(describeCmd)).stdout.trim();
    
    if (associationId && associationId !== 'None') {
      const disassociateCmd = `aws ec2 disassociate-route-table \
        --association-id ${associationId} \
        --region ${TEST_CONFIG.region}`;
      await exec(disassociateCmd);
      console.log(`  ✅ Disassociated from route table`);
    }
    
    // 2. 删除子网
    const deleteCmd = `aws ec2 delete-subnet \
      --subnet-id ${subnetId} \
      --region ${TEST_CONFIG.region}`;
    await exec(deleteCmd);
    console.log(`  ✅ Deleted subnet: ${subnetId}\n`);
    
  } catch (error) {
    console.error(`  ❌ Error cleaning up subnet ${subnetId}:`, error.message);
  }
}

/**
 * 清理所有测试资源
 */
async function cleanupAll() {
  console.log('\n🧹 Cleaning up all test resources...\n');
  
  for (const subnetId of createdResources.subnets) {
    await cleanupSubnet(subnetId);
  }
  
  createdResources.subnets = [];
}

/**
 * 测试场景 1: 基础功能测试（只读操作）
 */
async function testBasicFunctions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 Test Suite 1: Basic Functions (Read-Only)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };
  
  try {
    // Test 1.1: 检查已存在的 Public Subnet
    console.log('Test 1.1: Check existing public subnet (us-west-2b)');
    const test1 = await SubnetManager.checkPublicSubnetInAZ(
      TEST_CONFIG.vpcId,
      'us-west-2b',
      TEST_CONFIG.region
    );
    console.log(`  Result: ${test1.exists ? 'Found' : 'Not found'}`);
    if (test1.exists) {
      console.log(`  Subnet ID: ${test1.subnetId}`);
      console.log(`  Subnet Name: ${test1.subnetName}`);
      console.log(`  Route Table: ${test1.routeTableId}`);
    }
    if (test1.exists) {
      console.log('  ✅ PASS\n');
      results.passed++;
    } else {
      console.log('  ❌ FAIL: Should find existing subnet\n');
      results.failed++;
    }
    
    // Test 1.2: 检查不存在 Public Subnet 的 AZ
    console.log('Test 1.2: Check non-existing public subnet (us-west-2a)');
    const test2 = await SubnetManager.checkPublicSubnetInAZ(
      TEST_CONFIG.vpcId,
      'us-west-2a',
      TEST_CONFIG.region
    );
    console.log(`  Result: ${test2.exists ? 'Found' : 'Not found'}`);
    if (!test2.exists) {
      console.log('  ✅ PASS\n');
      results.passed++;
    } else {
      console.log('  ⚠️ WARNING: Subnet exists (may have been created previously)\n');
      results.warnings++;
    }
    
    // Test 1.3: 获取 Public Route Table 和 IGW
    console.log('Test 1.3: Get public route table and IGW');
    const routeTableInfo = await SubnetManager.getPublicRouteTable(
      TEST_CONFIG.vpcId,
      TEST_CONFIG.region
    );
    console.log(`  Route Table: ${routeTableInfo?.routeTableId}`);
    console.log(`  Internet Gateway: ${routeTableInfo?.igwId}`);
    if (routeTableInfo && routeTableInfo.routeTableId && routeTableInfo.igwId) {
      console.log('  ✅ PASS\n');
      results.passed++;
    } else {
      console.log('  ❌ FAIL: Should find public route table with IGW\n');
      results.failed++;
    }
    
    // Test 1.4: 检测 Public Subnet 网段大小
    console.log('Test 1.4: Detect public subnet mask size');
    const maskSize = await SubnetManager.detectPublicSubnetMask(
      TEST_CONFIG.vpcId,
      TEST_CONFIG.region
    );
    console.log(`  Result: /${maskSize}`);
    if ([20, 24].includes(maskSize)) {
      console.log('  ✅ PASS\n');
      results.passed++;
    } else {
      console.log('  ⚠️ WARNING: Unusual subnet mask\n');
      results.warnings++;
    }
    
    // Test 1.5: 获取下一个 Public Subnet 编号
    console.log('Test 1.5: Get next public subnet number');
    const nextNumber = await SubnetManager.getNextPublicSubnetNumber(
      TEST_CONFIG.vpcId,
      TEST_CONFIG.clusterTag,
      TEST_CONFIG.region
    );
    console.log(`  Result: ${nextNumber}`);
    if (nextNumber >= 1) {
      console.log('  ✅ PASS\n');
      results.passed++;
    } else {
      console.log('  ❌ FAIL: Invalid subnet number\n');
      results.failed++;
    }
    
    // Test 1.6: 生成下一个 Public Subnet CIDR
    console.log('Test 1.6: Generate next public subnet CIDR');
    const nextCidr = await SubnetManager.generateNextPublicSubnetCIDR(
      TEST_CONFIG.vpcId,
      TEST_CONFIG.region
    );
    console.log(`  Result: ${nextCidr}`);
    if (nextCidr && nextCidr.includes('/')) {
      console.log('  ✅ PASS\n');
      results.passed++;
    } else {
      console.log('  ❌ FAIL: Should generate valid CIDR\n');
      results.failed++;
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    results.failed++;
  }
  
  return results;
}

/**
 * 测试场景 2: 创建新 Public Subnet（在 us-west-2d）
 */
async function testCreateNewSubnet() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 Test Suite 2: Create New Public Subnet');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };
  
  const testAZ = 'us-west-2d';
  
  try {
    // Test 2.1: 确认目标 AZ 没有 Public Subnet
    console.log(`Test 2.1: Verify ${testAZ} has no public subnet`);
    const checkBefore = await SubnetManager.checkPublicSubnetInAZ(
      TEST_CONFIG.vpcId,
      testAZ,
      TEST_CONFIG.region
    );
    console.log(`  Result: ${checkBefore.exists ? 'Exists' : 'Not exists'}`);
    
    if (checkBefore.exists) {
      console.log(`  ⚠️ WARNING: Public subnet already exists in ${testAZ}`);
      console.log(`  Skipping creation test to avoid conflicts\n`);
      results.warnings++;
      return results;
    } else {
      console.log('  ✅ PASS: Ready for creation test\n');
      results.passed++;
    }
    
    // Test 2.2: 创建 Public Subnet
    console.log(`Test 2.2: Create public subnet in ${testAZ}`);
    const createResult = await SubnetManager.ensurePublicSubnet({
      vpcId: TEST_CONFIG.vpcId,
      availabilityZone: testAZ,
      clusterTag: TEST_CONFIG.clusterTag,
      region: TEST_CONFIG.region
    });
    
    console.log(`  Created: ${createResult.created}`);
    console.log(`  Subnet ID: ${createResult.subnetId}`);
    console.log(`  Subnet Name: ${createResult.subnetName}`);
    console.log(`  CIDR Block: ${createResult.cidrBlock}`);
    console.log(`  Route Table: ${createResult.routeTableId}`);
    console.log(`  Internet Gateway: ${createResult.igwId}`);
    
    if (createResult.created && createResult.subnetId && createResult.igwId) {
      console.log('  ✅ PASS: Subnet created successfully with IGW route\n');
      results.passed++;
      createdResources.subnets.push(createResult.subnetId);
    } else {
      console.log('  ❌ FAIL: Subnet creation failed or missing IGW\n');
      results.failed++;
      return results;
    }
    
    // Test 2.3: 验证子网属性
    console.log('Test 2.3: Verify subnet properties');
    const verifyCmd = `aws ec2 describe-subnets \
      --subnet-ids ${createResult.subnetId} \
      --query "Subnets[0].[SubnetId,CidrBlock,AvailabilityZone,MapPublicIpOnLaunch,Tags[?Key=='Name'].Value|[0]]" \
      --region ${TEST_CONFIG.region} \
      --output json`;
    
    const verifyResult = JSON.parse((await exec(verifyCmd)).stdout);
    const [subnetId, cidrBlock, az, mapPublicIp, name] = verifyResult;
    
    console.log(`  Subnet ID: ${subnetId}`);
    console.log(`  CIDR: ${cidrBlock}`);
    console.log(`  AZ: ${az}`);
    console.log(`  Auto-assign Public IP: ${mapPublicIp}`);
    console.log(`  Name: ${name}`);
    
    const allCorrect = (
      subnetId === createResult.subnetId &&
      cidrBlock === createResult.cidrBlock &&
      az === testAZ &&
      mapPublicIp === true &&
      name === createResult.subnetName
    );
    
    if (allCorrect) {
      console.log('  ✅ PASS: All properties correct\n');
      results.passed++;
    } else {
      console.log('  ❌ FAIL: Some properties incorrect\n');
      results.failed++;
    }
    
    // Test 2.4: 验证路由表关联
    console.log('Test 2.4: Verify route table association');
    const rtCmd = `aws ec2 describe-route-tables \
      --filters "Name=association.subnet-id,Values=${createResult.subnetId}" \
      --query "RouteTables[0].[RouteTableId,Routes[?DestinationCidrBlock=='0.0.0.0/0'].GatewayId|[0]]" \
      --region ${TEST_CONFIG.region} \
      --output json`;
    
    const rtResult = JSON.parse((await exec(rtCmd)).stdout);
    const [rtId, igwId] = rtResult;
    
    console.log(`  Route Table: ${rtId}`);
    console.log(`  Internet Gateway: ${igwId}`);
    
    if (rtId === createResult.routeTableId && igwId && igwId.startsWith('igw-')) {
      console.log('  ✅ PASS: Route table correctly associated\n');
      results.passed++;
    } else {
      console.log('  ❌ FAIL: Route table association incorrect\n');
      results.failed++;
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    results.failed++;
  }
  
  return results;
}

/**
 * 测试场景 3: 幂等性测试（重复调用 ensurePublicSubnet）
 */
async function testIdempotency() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 Test Suite 3: Idempotency Test');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };
  
  const testAZ = 'us-west-2b'; // 已有 Public Subnet 的 AZ
  
  try {
    // Test 3.1: 第一次调用 ensurePublicSubnet
    console.log(`Test 3.1: First call to ensurePublicSubnet (${testAZ})`);
    const result1 = await SubnetManager.ensurePublicSubnet({
      vpcId: TEST_CONFIG.vpcId,
      availabilityZone: testAZ,
      clusterTag: TEST_CONFIG.clusterTag,
      region: TEST_CONFIG.region
    });
    
    console.log(`  Created: ${result1.created}`);
    console.log(`  Subnet ID: ${result1.subnetId}`);
    
    if (!result1.created && result1.subnetId) {
      console.log('  ✅ PASS: Correctly detected existing subnet\n');
      results.passed++;
    } else {
      console.log('  ❌ FAIL: Should not create new subnet\n');
      results.failed++;
    }
    
    // Test 3.2: 第二次调用 ensurePublicSubnet（应该返回相同结果）
    console.log(`Test 3.2: Second call to ensurePublicSubnet (${testAZ})`);
    const result2 = await SubnetManager.ensurePublicSubnet({
      vpcId: TEST_CONFIG.vpcId,
      availabilityZone: testAZ,
      clusterTag: TEST_CONFIG.clusterTag,
      region: TEST_CONFIG.region
    });
    
    console.log(`  Created: ${result2.created}`);
    console.log(`  Subnet ID: ${result2.subnetId}`);
    
    if (!result2.created && result2.subnetId === result1.subnetId) {
      console.log('  ✅ PASS: Idempotent behavior confirmed\n');
      results.passed++;
    } else {
      console.log('  ❌ FAIL: Should return same result\n');
      results.failed++;
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    results.failed++;
  }
  
  return results;
}

/**
 * 主测试流程
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   SubnetManager Complete Test Suite                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\nTest Configuration:');
  console.log(`  VPC ID: ${TEST_CONFIG.vpcId}`);
  console.log(`  Region: ${TEST_CONFIG.region}`);
  console.log(`  Cluster Tag: ${TEST_CONFIG.clusterTag}\n`);
  
  const totalResults = {
    passed: 0,
    failed: 0,
    warnings: 0
  };
  
  try {
    // 运行测试套件 1: 基础功能
    const results1 = await testBasicFunctions();
    totalResults.passed += results1.passed;
    totalResults.failed += results1.failed;
    totalResults.warnings += results1.warnings;
    
    // 运行测试套件 2: 创建新子网
    const results2 = await testCreateNewSubnet();
    totalResults.passed += results2.passed;
    totalResults.failed += results2.failed;
    totalResults.warnings += results2.warnings;
    
    // 清理测试套件 2 创建的资源
    await cleanupAll();
    
    // 运行测试套件 3: 幂等性测试
    const results3 = await testIdempotency();
    totalResults.passed += results3.passed;
    totalResults.failed += results3.failed;
    totalResults.warnings += results3.warnings;
    
    // 打印总结
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Final Test Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Passed:   ${totalResults.passed}`);
    console.log(`❌ Failed:   ${totalResults.failed}`);
    console.log(`⚠️  Warnings: ${totalResults.warnings}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (totalResults.failed === 0) {
      console.log('🎉 All tests passed!\n');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed. Please review the results above.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    await cleanupAll();
    process.exit(1);
  }
}

// 运行测试
runAllTests();
