const MetadataUtils = require('./metadataUtils');

/**
 * 环境变量注入器 - 统一管理集群环境变量
 * 从 metadata 动态生成环境变量，不再依赖 init_envs 和 stack_envs 文件
 */
class EnvInjector {
  
  /**
   * 从 ARN 中提取账户 ID
   */
  static extractAccountIdFromArn(arn) {
    if (!arn) return null;
    const parts = arn.split(':');
    return parts.length >= 5 ? parts[4] : null;
  }

  /**
   * 获取账户 ID（从 EKS ARN 提取）
   */
  static getAccountId(clusterInfo) {
    // 从 eksCluster.arn 提取
    if (clusterInfo.eksCluster?.arn) {
      return this.extractAccountIdFromArn(clusterInfo.eksCluster.arn);
    }
    return null;
  }

  /**
   * 获取集群的所有环境变量
   */
  static getClusterEnvs(clusterTag) {
    const clusterInfo = MetadataUtils.getClusterInfo(clusterTag);
    if (!clusterInfo) {
      throw new Error(`Cluster info not found for: ${clusterTag}`);
    }

    const outputs = MetadataUtils.getCloudFormationOutputs(clusterTag);
    const accountId = this.getAccountId(clusterInfo);

    // 基础环境变量（bash 命令使用）
    const envs = {
      CLUSTER_TAG: clusterTag,
      AWS_REGION: clusterInfo.region,
      EKS_CLUSTER_NAME: clusterInfo.eksCluster?.name || outputs.OutputEKSClusterName || clusterTag,
    };

    // S3 和 SageMaker Role（HyperPod 创建相关）
    if (clusterInfo.eksCluster?.s3BucketName) {
      envs.S3_BUCKET_NAME = clusterInfo.eksCluster.s3BucketName;
    } else if (outputs.OutputS3BucketName) {
      envs.S3_BUCKET_NAME = outputs.OutputS3BucketName;
    }

    if (clusterInfo.eksCluster?.sageMakerRoleArn) {
      envs.SAGEMAKER_ROLE_ARN = clusterInfo.eksCluster.sageMakerRoleArn;
    } else if (outputs.OutputSageMakerIAMRoleArn) {
      envs.SAGEMAKER_ROLE_ARN = outputs.OutputSageMakerIAMRoleArn;
    }

    // HyperPod 信息
    if (clusterInfo.hyperPodCluster) {
      envs.HP_CLUSTER_NAME = clusterInfo.hyperPodCluster.ClusterName;
      if (clusterInfo.hyperPodCluster.ClusterArn) {
        envs.HP_CLUSTER_ARN = clusterInfo.hyperPodCluster.ClusterArn;
      }
    } else if (outputs.OutputHyperPodClusterName) {
      envs.HP_CLUSTER_NAME = outputs.OutputHyperPodClusterName;
      if (outputs.OutputHyperPodClusterArn) {
        envs.HP_CLUSTER_ARN = outputs.OutputHyperPodClusterArn;
      }
    }

    return envs;
  }

  /**
   * 将环境变量对象转换为 export 语句字符串
   */
  static buildEnvString(envs) {
    return Object.entries(envs)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join(' && ');
  }

  /**
   * 包装命令，注入环境变量
   * @param {string} clusterTag - 集群标签
   * @param {string} command - 要执行的命令
   * @param {string} workDir - 工作目录（可选）
   * @returns {string} 包装后的完整命令
   */
  static wrapCommand(clusterTag, command, workDir = null) {
    const envs = this.getClusterEnvs(clusterTag);
    const envString = this.buildEnvString(envs);
    
    if (workDir) {
      return `cd ${workDir} && bash -c '${envString} && ${command}'`;
    }
    
    return `bash -c '${envString} && ${command}'`;
  }

  /**
   * 获取单个环境变量的值
   */
  static getEnv(clusterTag, varName) {
    const envs = this.getClusterEnvs(clusterTag);
    return envs[varName] || null;
  }

  /**
   * 生成 shell 脚本格式的环境变量文件内容
   */
  static generateEnvFileContent(clusterTag) {
    const envs = this.getClusterEnvs(clusterTag);
    const clusterInfo = MetadataUtils.getClusterInfo(clusterTag);
    
    let content = '#!/bin/bash\n\n';
    content += '# Auto-generated environment variables from metadata\n';
    content += `# Cluster: ${clusterTag}\n`;
    content += `# Type: ${clusterInfo?.type || 'unknown'}\n`;
    content += `# Generated at: ${new Date().toISOString()}\n\n`;
    
    // 基础信息
    content += '# === Basic Information ===\n';
    ['CLUSTER_TAG', 'AWS_REGION', 'EKS_CLUSTER_NAME'].forEach(key => {
      if (envs[key]) content += `export ${key}="${envs[key]}"\n`;
    });
    
    // S3 和 Role
    if (envs.S3_BUCKET_NAME || envs.SAGEMAKER_ROLE_ARN) {
      content += '\n# === HyperPod Resources ===\n';
      if (envs.S3_BUCKET_NAME) {
        content += `export S3_BUCKET_NAME="${envs.S3_BUCKET_NAME}"\n`;
      }
      if (envs.SAGEMAKER_ROLE_ARN) {
        content += `export SAGEMAKER_ROLE_ARN="${envs.SAGEMAKER_ROLE_ARN}"\n`;
      }
    }
    
    // HyperPod 集群
    if (envs.HP_CLUSTER_NAME) {
      content += '\n# === HyperPod Cluster ===\n';
      content += `export HP_CLUSTER_NAME="${envs.HP_CLUSTER_NAME}"\n`;
      if (envs.HP_CLUSTER_ARN) {
        content += `export HP_CLUSTER_ARN="${envs.HP_CLUSTER_ARN}"\n`;
      }
    }
    
    return content;
  }

  /**
   * 更新集群的 cluster_envs 文件
   */
  static updateClusterEnvFile(clusterTag) {
    const path = require('path');
    const fs = require('fs');
    
    const configDir = path.join(__dirname, '../../managed_clusters_info', clusterTag, 'config');
    
    // 确保目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const envFilePath = path.join(configDir, 'cluster_envs');
    const envContent = this.generateEnvFileContent(clusterTag);
    
    fs.writeFileSync(envFilePath, envContent);
    console.log(`✅ Updated cluster_envs for ${clusterTag}`);
    
    return envFilePath;
  }

  /**
   * 验证必需的环境变量是否存在
   */
  static validateRequiredEnvs(clusterTag, requiredVars = []) {
    const envs = this.getClusterEnvs(clusterTag);
    const missing = requiredVars.filter(varName => !envs[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables for ${clusterTag}: ${missing.join(', ')}`);
    }
    
    return true;
  }
}

module.exports = EnvInjector;
