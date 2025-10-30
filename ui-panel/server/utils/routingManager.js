const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const EKSServiceHelper = require('./eksServiceHelper');

class RoutingManager {
  static generateRouterYaml(config) {
    const {
      deploymentName = 'sglang-router',
      routingPolicy = 'cache_aware',
      routerPort = 30000,
      metricsPort = 29000,
      serviceType = 'external'
    } = config;

    // Generate timestamp for unique naming
    const timestamp = Date.now();
    const resourceName = `${deploymentName}-${timestamp}`;

    // 生成 Deployment 和相关 RBAC 资源
    const deploymentYaml = this.generateRouterDeploymentYaml(config, resourceName);

    // 使用 EKSServiceHelper 生成 Service
    const portConfig = {
      http: routerPort,
      metrics: metricsPort
    };

    const serviceYaml = EKSServiceHelper.generateServiceYaml(
      serviceType,
      'sglrouter', // 固定的服务引擎类别
      resourceName,    // 完整的资源名称作为modelTag
      portConfig
    );

    return `${deploymentYaml}\n${serviceYaml}`;
  }

  /**
   * 生成 Router Deployment 及相关 RBAC 资源的 YAML
   * @param {Object} config - 配置对象
   * @param {string} resourceName - 资源名称 (包含时间戳)
   * @returns {string} Deployment YAML 字符串
   */
  static generateRouterDeploymentYaml(config, resourceName) {
    const {
      deploymentName = 'sglang-router',
      routingPolicy = 'cache_aware',
      routerPort = 30000,
      metricsPort = 29000
    } = config;

    return `---
# ServiceAccount for Router
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${resourceName}
  namespace: default

---
# ClusterRole for Pod discovery
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ${resourceName}
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]

---
# ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ${resourceName}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ${resourceName}
subjects:
- kind: ServiceAccount
  name: ${resourceName}
  namespace: default

---
# Router Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${resourceName}
  labels:
    app: ${resourceName}
    deployment-name: "${resourceName}"
    service-type: "router"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${resourceName}
  template:
    metadata:
      labels:
        app: ${resourceName}
        deployment-name: "${resourceName}"
        service-type: "router"
    spec:
      serviceAccountName: ${resourceName}
      containers:
        - name: sglang-router
          image: lmsysorg/sglang:latest
          resources:
            requests:
              cpu: "2"
              memory: 4Gi
            limits:
              cpu: "4"
              memory: 8Gi
          command: ["python3", "-m", "sglang_router.launch_router"]
          args:
            - "--service-discovery"
            - "--selector"
            - "deployment-name=${deploymentName}"
            - "--service-discovery-port"
            - "8000"
            - "--policy"
            - "${routingPolicy}"
            - "--host"
            - "0.0.0.0"
            - "--port"
            - "${routerPort}"
            - "--prometheus-port"
            - "${metricsPort}"
          ports:
            - containerPort: ${routerPort}
              name: http
            - containerPort: ${metricsPort}
              name: metrics
          env:
            - name: RUST_LOG
              value: "info"`;
  }

  static async applyRouterConfiguration(config) {
    try {
      const yaml = this.generateRouterYaml(config);

      // Create deployments/inference directory if it doesn't exist
      const deploymentDir = path.join(__dirname, '../../deployments/inference');
      if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
      }

      // Save YAML file with timestamp
      const timestamp = new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14);
      const yamlPath = path.join(deploymentDir, `sglang-router-${timestamp}.yaml`);

      fs.writeFileSync(yamlPath, yaml);
      console.log(`SGLang Router YAML saved to: ${yamlPath}`);

      // Apply to Kubernetes
      const applyCommand = `kubectl apply -f ${yamlPath}`;
      const result = execSync(applyCommand, { encoding: 'utf8' });

      return {
        success: true,
        message: 'SGLang Router deployed successfully',
        yamlPath: yamlPath,
        kubectlOutput: result,
        generatedYaml: yaml
      };

    } catch (error) {
      console.error('Error applying SGLang Router configuration:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to deploy SGLang Router'
      };
    }
  }

  static async getRouterStatus() {
    try {
      // Check SGLang Router deployment
      const deploymentCmd = 'kubectl get deployment sglang-router -o json';
      const deploymentResult = execSync(deploymentCmd, { encoding: 'utf8' });
      const deployment = JSON.parse(deploymentResult);

      // Check SGLang Router service
      const serviceCmd = 'kubectl get service sglang-router-service -o json';
      const serviceResult = execSync(serviceCmd, { encoding: 'utf8' });
      const service = JSON.parse(serviceResult);

      // Check pods
      const podsCmd = 'kubectl get pods -l app=sglang-router -o json';
      const podsResult = execSync(podsCmd, { encoding: 'utf8' });
      const pods = JSON.parse(podsResult);

      return {
        success: true,
        deployment: {
          name: deployment.metadata.name,
          replicas: deployment.status.replicas || 0,
          readyReplicas: deployment.status.readyReplicas || 0,
          creationTime: deployment.metadata.creationTimestamp
        },
        service: {
          name: service.metadata.name,
          type: service.spec.type,
          clusterIP: service.spec.clusterIP,
          externalIP: service.status?.loadBalancer?.ingress?.[0]?.ip || 'Pending',
          ports: service.spec.ports
        },
        pods: pods.items.map(pod => ({
          name: pod.metadata.name,
          status: pod.status.phase,
          ready: pod.status.containerStatuses?.[0]?.ready || false,
          restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
          creationTime: pod.metadata.creationTimestamp
        }))
      };

    } catch (error) {
      console.error('Error getting SGLang Router status:', error);
      return {
        success: false,
        error: error.message,
        routerInstalled: false
      };
    }
  }

  /**
   * 获取所有Router部署列表
   * @returns {Array} Router部署列表
   */
  static async getRouterDeployments() {
    try {
      // 查找所有Router类型的Deployment
      const cmd = 'kubectl get deployments -l service-type=router -o json';
      const result = execSync(cmd, { encoding: 'utf8' });
      const deployments = JSON.parse(result);

      return deployments.items.map(deployment => ({
        resourceName: deployment.metadata.name,           // sglang-router-1761786858801
        deploymentName: deployment.metadata.labels['deployment-name'] || 'unknown', // sglang-router
        namespace: deployment.metadata.namespace || 'default',
        creationTime: deployment.metadata.creationTimestamp,
        replicas: deployment.status.replicas || 0,
        readyReplicas: deployment.status.readyReplicas || 0,
        labels: deployment.metadata.labels,
        status: (deployment.status.replicas === deployment.status.readyReplicas &&
                deployment.status.readyReplicas > 0) ? 'Ready' : 'NotReady'
      }));

    } catch (error) {
      console.error('Error getting Router deployments:', error);
      return [];
    }
  }

  /**
   * 删除指定的Router部署实例
   * @param {string} deploymentName - 部署名称（如 'sglang-router'）
   * @returns {Object} 删除结果
   */
  static async deleteRouter(deploymentName) {
    try {
      console.log(`Deleting Router deployment: ${deploymentName}`);

      // 步骤1: 智能查找Router Deployment
      // 现在labels使用完整resourceName，支持直接按resourceName查询
      const cmd = `kubectl get deployment -l deployment-name=${deploymentName},service-type=router -o json`;
      const result = execSync(cmd, { encoding: 'utf8' });
      const deployments = JSON.parse(result).items;

      if (deployments.length === 0) {
        return {
          success: false,
          message: `Router deployment '${deploymentName}' not found`
        };
      }

      const results = [];
      let totalDeleted = 0;

      for (const deployment of deployments) {
        const resourceName = deployment.metadata.name; // 获取实际名称: sglang-router-1761786858801
        const timestamp = resourceName.split('-').pop(); // 提取时间戳: 1761786858801

        console.log(`Processing Router instance: ${resourceName}`);

        // 步骤2: 删除各类资源 - 按照创建时的命名规律
        const deleteOperations = [
          // Deployment - 直接删除
          {
            type: 'deployment',
            cmd: `kubectl delete deployment ${resourceName}`,
            name: resourceName
          },

          // Service - 基于EKSServiceHelper的命名规律
          // EKSServiceHelper.generateServiceYaml 调用参数:
          // serviceType='external', servEngine='sglrouter', modelTag=resourceName, portConfig
          // 生成的Service名称: sglrouter-{resourceName}-nlb
          {
            type: 'service-nlb',
            cmd: `kubectl delete service sglrouter-${resourceName}-nlb --ignore-not-found=true`,
            name: `sglrouter-${resourceName}-nlb`
          },
          {
            type: 'service-clusterip',
            cmd: `kubectl delete service sglrouter-${resourceName}-service --ignore-not-found=true`,
            name: `sglrouter-${resourceName}-service`
          },

          // RBAC资源 - 基于resourceName（命名规则确定）
          {
            type: 'serviceaccount',
            cmd: `kubectl delete serviceaccount ${resourceName} --ignore-not-found=true`,
            name: resourceName
          },
          {
            type: 'clusterrole',
            cmd: `kubectl delete clusterrole ${resourceName} --ignore-not-found=true`,
            name: resourceName
          },
          {
            type: 'clusterrolebinding',
            cmd: `kubectl delete clusterrolebinding ${resourceName} --ignore-not-found=true`,
            name: resourceName
          }
        ];

        // 执行删除操作
        for (const operation of deleteOperations) {
          try {
            console.log(`Executing: ${operation.cmd}`);
            const output = execSync(operation.cmd, { encoding: 'utf8' });
            const cleanOutput = output.trim();

            if (cleanOutput && !cleanOutput.includes('not found') && !cleanOutput.includes('No resources found')) {
              totalDeleted++;
              results.push({
                resource: operation.type,
                name: operation.name,
                success: true,
                output: cleanOutput
              });
            } else {
              results.push({
                resource: operation.type,
                name: operation.name,
                success: true,
                output: 'Resource not found (already deleted or never existed)'
              });
            }
          } catch (error) {
            console.warn(`Failed to delete ${operation.type} ${operation.name}:`, error.message);
            results.push({
              resource: operation.type,
              name: operation.name,
              success: false,
              error: error.message
            });
          }
        }
      }

      return {
        success: true,
        message: `Router deployment '${deploymentName}' deleted successfully`,
        processedInstances: deployments.length,
        totalDeleted: totalDeleted,
        results: results
      };

    } catch (error) {
      console.error('Error deleting Router:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to delete Router deployment '${deploymentName}'`
      };
    }
  }

  /**
   * 删除所有Router部署（危险操作，仅限管理使用）
   * @returns {Object} 删除结果
   */
  static async deleteAllRouters() {
    try {
      const routers = await this.getRouterDeployments();

      if (routers.length === 0) {
        return {
          success: true,
          message: 'No Router deployments found',
          results: []
        };
      }

      const results = [];
      for (const router of routers) {
        const result = await this.deleteRouter(router.deploymentName);
        results.push(result);
      }

      return {
        success: true,
        message: `Deleted ${routers.length} Router deployment(s)`,
        results: results
      };

    } catch (error) {
      console.error('Error deleting all Routers:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete all Router deployments'
      };
    }
  }

  static validateConfig(config) {
    const errors = [];

    if (!config) {
      errors.push('Configuration is required');
      return { valid: false, errors };
    }

    if (!config.deploymentName || config.deploymentName.trim() === '') {
      errors.push('Deployment name is required');
    } else if (!/^[a-z0-9-]+$/.test(config.deploymentName)) {
      errors.push('Deployment name must contain only lowercase letters, numbers and hyphens');
    }

    if (config.routerPort && (config.routerPort < 1000 || config.routerPort > 65535)) {
      errors.push('Router port must be between 1000 and 65535');
    }

    if (config.metricsPort && (config.metricsPort < 1000 || config.metricsPort > 65535)) {
      errors.push('Metrics port must be between 1000 and 65535');
    }

    if (config.routerPort && config.metricsPort && config.routerPort === config.metricsPort) {
      errors.push('Router port and metrics port cannot be the same');
    }

    if (config.serviceType && !['external', 'clusterip'].includes(config.serviceType)) {
      errors.push('Service type must be either "external" or "clusterip"');
    }

    if (config.routingPolicy && !['cache_aware', 'round_robin', 'least_loaded'].includes(config.routingPolicy)) {
      errors.push('Routing policy must be one of: cache_aware, round_robin, least_loaded');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static getDefaultConfig() {
    return {
      deploymentName: 'sglang-router',
      routingPolicy: 'cache_aware',
      routerPort: 30000,
      metricsPort: 29000,
      serviceType: 'external'
    };
  }

  static async previewYaml(config) {
    try {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Invalid configuration',
          errors: validation.errors
        };
      }

      const yaml = this.generateRouterYaml(config);

      return {
        success: true,
        yaml: yaml,
        config: config
      };
    } catch (error) {
      console.error('Error generating preview:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = RoutingManager;