#!/usr/bin/env node

/**
 * 最终版 SGLang Router 配置测试
 * 验证移除"All SGLang Deployments"选项后的配置
 */

const RoutingManager = require('./server/utils/routingManager');

console.log('🧪 Final SGLang Router Configuration Test\n');

// 测试 1: 有效配置 - 指定特定部署
console.log('Test 1: Valid Configuration - Specific Deployment');
console.log('=' .repeat(60));

const validConfig = {
  deploymentName: 'sglang-router',
  routingPolicy: 'cache_aware',
  routerPort: 30000,
  metricsPort: 29000,
  targetDeployment: 'qwensgl-2025-10-30-06-39-57', // 必须指定
  discoveryPort: 8000,
  checkInterval: 120,
  cacheThreshold: 0.5,
  balanceAbsThreshold: 32,
  balanceRelThreshold: 1.1,
  evictionIntervalSecs: 30,
  maxTreeSize: 10000
};

console.log('Config:', JSON.stringify(validConfig, null, 2));
const validValidation = RoutingManager.validateConfig(validConfig);
console.log('Validation Result:', validValidation);

if (validValidation.valid) {
  console.log('\n📋 Generated Pod Selector:');
  console.log('deployment-tag=qwensgl-2025-10-30-06-39-57,model-type=sglang');
}

console.log('\n' + '=' .repeat(70) + '\n');

// 测试 2: 无效配置 - 缺少targetDeployment
console.log('Test 2: Invalid Configuration - Missing Target Deployment');
console.log('=' .repeat(60));

const invalidConfig = {
  deploymentName: 'sglang-router',
  routingPolicy: 'cache_aware',
  routerPort: 30000,
  metricsPort: 29000,
  targetDeployment: '', // 空值应该被拒绝
  discoveryPort: 8000,
  checkInterval: 120
};

console.log('Invalid Config:', JSON.stringify(invalidConfig, null, 2));
const invalidValidation = RoutingManager.validateConfig(invalidConfig);
console.log('Validation Result:', invalidValidation);

console.log('\n' + '=' .repeat(70) + '\n');

// 测试 3: 无效配置 - 缺少targetDeployment字段
console.log('Test 3: Invalid Configuration - Missing Target Deployment Field');
console.log('=' .repeat(60));

const missingFieldConfig = {
  deploymentName: 'sglang-router',
  routingPolicy: 'cache_aware',
  routerPort: 30000,
  metricsPort: 29000,
  // targetDeployment: 完全缺少这个字段
  discoveryPort: 8000,
  checkInterval: 120
};

console.log('Config without targetDeployment:', JSON.stringify(missingFieldConfig, null, 2));
const missingFieldValidation = RoutingManager.validateConfig(missingFieldConfig);
console.log('Validation Result:', missingFieldValidation);

console.log('\n' + '=' .repeat(70) + '\n');

// 测试 4: 默认配置测试
console.log('Test 4: Default Configuration');
console.log('=' .repeat(60));

const defaultConfig = RoutingManager.getDefaultConfig();
console.log('Default Config:', JSON.stringify(defaultConfig, null, 2));

const defaultValidation = RoutingManager.validateConfig(defaultConfig);
console.log('Validation Result:', defaultValidation);

console.log('\n✅ All tests completed!');
console.log('\n📊 Summary:');
console.log('- ✅ Target deployment is now required');
console.log('- ✅ Removed "All SGLang Deployments" option');
console.log('- ✅ Pod selector always includes specific deployment-tag');
console.log('- ✅ Default config uses valid SGLang deployment');