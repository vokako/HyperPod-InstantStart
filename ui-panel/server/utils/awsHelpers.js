const { execSync } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// 模块级缓存
let _cachedAccountId = null;
let _cachedRegion = null;

function getCurrentAccountId() {
  if (_cachedAccountId) return _cachedAccountId;
  
  const command = 'aws sts get-caller-identity --query Account --output text';
  _cachedAccountId = execSync(command, { encoding: 'utf8' }).trim();
  console.log(`Account ID cached: ${_cachedAccountId}`);
  return _cachedAccountId;
}

function getCurrentRegion() {
  if (_cachedRegion) return _cachedRegion;
  
  const command = 'aws configure get region';
  const region = execSync(command, { encoding: 'utf8' }).trim();
  if (!region) {
    throw new Error('AWS region not configured');
  }
  _cachedRegion = region;
  console.log(`Region cached: ${_cachedRegion}`);
  return _cachedRegion;
}

async function describeHyperPodCluster(clusterName, region) {
  const command = `aws sagemaker describe-cluster --cluster-name ${clusterName} --region ${region} --output json`;
  const result = await exec(command);
  return JSON.parse(result.stdout);
}

/**
 * 获取 Subnet 的 Availability Zone 信息
 * @param {string[]} subnetIds - Subnet ID 数组
 * @param {string} region - AWS 区域
 * @returns {Object} { subnetId: az } 的映射
 */
async function getSubnetAZs(subnetIds, region) {
  if (!subnetIds || subnetIds.length === 0) return {};
  
  try {
    const command = `aws ec2 describe-subnets --subnet-ids ${subnetIds.join(' ')} --region ${region} --query 'Subnets[*].[SubnetId,AvailabilityZone]' --output json`;
    const result = await exec(command);
    const data = JSON.parse(result.stdout);
    
    // 转换为 { subnetId: az } 的映射
    const azMap = {};
    data.forEach(([subnetId, az]) => {
      azMap[subnetId] = az;
    });
    return azMap;
  } catch (error) {
    console.error('Error getting subnet AZs:', error);
    return {};
  }
}

/**
 * 通过 ENI 获取 Security Groups
 * @param {string[]} eniIds - ENI ID 数组
 * @param {string} region - AWS 区域
 * @returns {string[]} Security Group ID 数组
 */
async function getSecurityGroupsFromENIs(eniIds, region) {
  if (!eniIds || eniIds.length === 0) return [];
  
  try {
    const command = `aws ec2 describe-network-interfaces --network-interface-ids ${eniIds.join(' ')} --region ${region} --query 'NetworkInterfaces[0].Groups[*].GroupId' --output json`;
    const result = await exec(command);
    return JSON.parse(result.stdout) || [];
  } catch (error) {
    console.error('Error getting security groups from ENIs:', error);
    return [];
  }
}

module.exports = {
  getCurrentAccountId,
  getCurrentRegion,
  describeHyperPodCluster,
  getSubnetAZs,
  getSecurityGroupsFromENIs
};
