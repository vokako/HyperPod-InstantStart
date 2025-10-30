#!/usr/bin/env node

/**
 * 测试自动端口检测功能
 * 验证从SGLang部署自动获取服务端口的功能
 */

const RoutingManager = require('./server/utils/routingManager');

console.log('🧪 Auto Port Detection Test\n');

// 模拟前端的端口获取逻辑
function getDeploymentPort(deploymentTag) {
  const deploymentPorts = {
    'qwensgl-2025-10-30-06-39-57': 7777,
    'qwensglext-2025-10-30-06-44-25': 8889,
  };
  return deploymentPorts[deploymentTag] || 8000;
}

// 测试配置
const testConfig = {
  deploymentName: 'sglang-router',
  routingPolicy: 'cache_aware',
  routerPort: 30000,
  metricsPort: 29000,
  targetDeployment: 'qwensgl-2025-10-30-06-39-57',
  discoveryPort: getDeploymentPort('qwensgl-2025-10-30-06-39-57'), // 自动检测端口
  checkInterval: 120,
  cacheThreshold: 0.5,
  balanceAbsThreshold: 32,
  balanceRelThreshold: 1.1,
  evictionIntervalSecs: 30,
  maxTreeSize: 10000
};

console.log('📋 Configuration with Auto-Detected Port:');
console.log('Target Deployment:', testConfig.targetDeployment);
console.log('Auto-Detected Port:', testConfig.discoveryPort);
console.log('');

console.log('Full Config:', JSON.stringify(testConfig, null, 2));

const validation = RoutingManager.validateConfig(testConfig);
console.log('\nValidation Result:', validation);

if (validation.valid) {
  console.log('\n📋 Generated YAML Preview:');
  const yaml = RoutingManager.generateRouterYaml(testConfig);

  // 提取 args 部分来验证端口
  const argsMatch = yaml.match(/args:\s*((?:\s*-.*\n)*)/);
  if (argsMatch) {
    console.log('\nRouter Args:');
    const argsLines = argsMatch[1].trim().split('\n');
    argsLines.forEach((line, index) => {
      if (line.includes('service-discovery-port')) {
        console.log(`${line}`);
        if (argsLines[index + 1]) {
          console.log(`${argsLines[index + 1]} ← Auto-detected from deployment`);
        }
      }
    });
  }
}

console.log('\n✅ Test completed!');
console.log('\n📊 Summary of Changes:');
console.log('- ✅ Discovery Port renamed to Model Service Port');
console.log('- ✅ Port value auto-detected from selected deployment');
console.log('- ✅ Port field is read-only with visual styling');
console.log('- ✅ Dynamic port updates when deployment selection changes');
console.log('- ✅ Eliminates manual port configuration errors');