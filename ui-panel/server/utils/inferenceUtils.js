/**
 * Inference Utils - 推理服务公共工具函数
 *
 * 提供推理服务部署、配置相关的公共函数：
 * - generateNLBAnnotations: 生成 AWS NLB 注解
 * - parseInferenceCommand: 解析推理服务启动命令 (vLLM/SGLang/Custom)
 * - makeHttpRequest: HTTP 请求代理函数
 * - generateDeploymentTag: 生成带时间戳的部署标签
 * - generateHybridNodeSelectorTerms: 生成混合调度节点选择器
 * - generateResourcesSection: 生成 Container 部署的 resources 配置
 *
 * 创建日期: 2025-01-07
 * 从 index.js 和 routingManager.js 提取公共代码
 */

const https = require('https');
const http = require('http');
const { parse } = require('shell-quote');

/**
 * 生成 AWS NLB (Network Load Balancer) Service 注解
 *
 * @param {boolean} isExternal - true: internet-facing, false: internal
 * @returns {string} YAML 格式的注解字符串
 *
 * @example
 * const annotations = generateNLBAnnotations(true);
 * // 返回:
 * //     service.beta.kubernetes.io/aws-load-balancer-type: "external"
 * //     service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: "ip"
 * //     service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
 * //     ...
 */
function generateNLBAnnotations(isExternal) {
  if (isExternal) {
    return `
    service.beta.kubernetes.io/aws-load-balancer-type: "external"
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: "ip"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"`;
  } else {
    return `
    service.beta.kubernetes.io/aws-load-balancer-type: "external"
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: "ip"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internal"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"`;
  }
}

/**
 * 解析推理服务启动命令 (vLLM/SGLang/Custom)
 *
 * 支持的命令格式:
 * - vLLM (python module): python3 -m vllm.entrypoints.openai.api_server --model xxx
 * - vLLM (serve): vllm serve model-name --tensor-parallel-size 4
 * - SGLang: python3 -m sglang.launch_server --model xxx
 * - Custom: 任意命令
 *
 * @param {string} commandString - 启动命令字符串
 * @returns {Object} 解析结果
 * @returns {string[]} returns.fullCommand - 完整命令数组
 * @returns {string[]} returns.args - 参数部分（排除入口点）
 * @returns {string} returns.commandType - 命令类型: 'vllm' | 'sglang' | 'custom'
 *
 * @example
 * const result = parseInferenceCommand('vllm serve meta-llama/Llama-3-8b --tensor-parallel-size 4');
 * // result = {
 * //   fullCommand: ['vllm', 'serve', 'meta-llama/Llama-3-8b', '--tensor-parallel-size', '4'],
 * //   args: ['meta-llama/Llama-3-8b', '--tensor-parallel-size', '4'],
 * //   commandType: 'vllm'
 * // }
 */
function parseInferenceCommand(commandString) {
  // 移除换行符和多余空格，处理反斜杠换行
  const cleanCommand = commandString
    .replace(/\\\s*\n/g, ' ')  // 处理反斜杠换行
    .replace(/\s+/g, ' ')      // 合并多个空格
    .trim();

  // 使用 shell-quote 进行健壮的命令解析，正确处理引号内的 JSON 参数
  const parsed = parse(cleanCommand);
  const parts = parsed.map(token => {
    // shell-quote 可能返回对象，我们需要转换为字符串
    if (typeof token === 'string') {
      return token;
    } else if (token.op) {
      // 处理操作符 (如重定向)
      return token.op;
    } else {
      return String(token);
    }
  }).filter(part => part.trim());

  // 检查命令是否为空
  if (parts.length === 0) {
    throw new Error('Command cannot be empty');
  }

  // 检查是否为已知的命令格式（用于框架识别）
  const isVllmCommand = parts.includes('python3') && parts.includes('-m') && parts.includes('vllm.entrypoints.openai.api_server');
  const isVllmServeCommand = parts.includes('vllm') && parts.includes('serve');
  const isSglangCommand = parts.includes('python3') && parts.includes('-m') && parts.includes('sglang.launch_server');

  let entrypointIndex = -1;

  if (isVllmCommand) {
    entrypointIndex = parts.findIndex(part => part === 'vllm.entrypoints.openai.api_server');
  } else if (isVllmServeCommand) {
    entrypointIndex = parts.findIndex(part => part === 'serve');
  } else if (isSglangCommand) {
    entrypointIndex = parts.findIndex(part => part === 'sglang.launch_server');
  }

  const args = entrypointIndex >= 0 ? parts.slice(entrypointIndex + 1) : parts.slice(1);

  return {
    fullCommand: parts,
    args: args,
    commandType: (isVllmCommand || isVllmServeCommand) ? 'vllm' : (isSglangCommand ? 'sglang' : 'custom')
  };
}


/**
 * HTTP 请求代理函数
 *
 * 用于向推理服务发送测试请求，支持 GET/POST 方法
 *
 * @param {string} url - 请求 URL
 * @param {Object} payload - 请求体 (POST 时使用)
 * @param {string} [method='POST'] - 请求方法
 * @returns {Promise<Object>} 响应结果
 * @returns {boolean} returns.success - 是否成功
 * @returns {number} returns.status - HTTP 状态码
 * @returns {Object|string} returns.data - 响应数据
 * @returns {string} [returns.error] - 错误信息 (失败时)
 * @returns {boolean} [returns.isText] - 是否为文本响应 (非 JSON)
 *
 * @example
 * const result = await makeHttpRequest('http://localhost:8000/v1/chat/completions', {
 *   model: 'llama-3-8b',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 */
function makeHttpRequest(url, payload, method = 'POST') {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const isGetRequest = method.toUpperCase() === 'GET';
      const postData = isGetRequest ? '' : JSON.stringify(payload);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method.toUpperCase(),
        headers: {
          'User-Agent': 'Model-Deployment-UI/1.0'
        },
        timeout: 30000 // 30秒超时
      };

      // 只有 POST 请求才需要 Content-Type 和 Content-Length
      if (!isGetRequest) {
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      console.log(`HTTP ${method} → ${url}`);

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log(`HTTP ${method} ← ${res.statusCode} (${data.length} bytes)`);

          // 处理不同的响应状态
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // 成功响应
            try {
              const jsonData = JSON.parse(data);
              resolve({
                success: true,
                status: res.statusCode,
                data: jsonData
              });
            } catch (parseError) {
              // 如果不是 JSON，返回原始文本
              console.log('Response is not JSON, returning as text');
              resolve({
                success: true,
                status: res.statusCode,
                data: data,
                isText: true
              });
            }
          } else {
            // 错误响应
            try {
              const errorData = JSON.parse(data);
              resolve({
                success: false,
                status: res.statusCode,
                error: errorData.error || `HTTP ${res.statusCode}`,
                data: errorData
              });
            } catch (parseError) {
              resolve({
                success: false,
                status: res.statusCode,
                error: `HTTP ${res.statusCode}: ${data}`,
                data: data
              });
            }
          }
        });
      });

      req.on('error', (error) => {
        console.error('HTTP request error:', error);
        reject({
          success: false,
          error: `Network error: ${error.message}`
        });
      });

      req.on('timeout', () => {
        console.error('HTTP request timeout');
        req.destroy();
        reject({
          success: false,
          error: 'Request timeout (30s)'
        });
      });

      // 只有非 GET 请求才写入 payload
      if (!isGetRequest && postData) {
        req.write(postData);
      }
      req.end();

    } catch (error) {
      console.error('HTTP request setup error:', error);
      reject({
        success: false,
        error: `Request setup error: ${error.message}`
      });
    }
  });
}

/**
 * 生成带时间戳的部署标签
 *
 * 生成格式: {baseName}-YYMMDD-HHMMSS
 * 符合 Kubernetes 命名规范
 *
 * @param {string} [baseName='model'] - 基础名称
 * @returns {string} 部署标签，如 'my-model-250107-143052'
 *
 * @example
 * const tag = generateDeploymentTag('llama');
 * // 返回: 'llama-250107-143052'
 *
 * const tag2 = generateDeploymentTag();
 * // 返回: 'model-250107-143052'
 */
function generateDeploymentTag(baseName = 'model') {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${yy}${mm}${dd}-${hh}${min}${ss}`;
  return `${baseName}-${timestamp}`;
}

/**
 * 生成混合调度节点选择器条件 (HyperPod + EKS NodeGroup + Karpenter)
 *
 * 支持三种节点类型的混合调度：
 * - HyperPod 节点 (ml.* 实例类型) - 需要额外的 compute-type 标签
 * - EKS NodeGroup 节点 (g系列/p系列 实例类型)
 * - Karpenter 动态节点 (两种类型都支持)
 *
 * @param {string[]} instanceTypes - 选择的实例类型数组，如 ['ml.g6.12xlarge', 'g6.12xlarge']
 * @returns {string} YAML 格式的 nodeSelectorTerms，用于替换模板中的 HYBRID_NODE_SELECTOR_TERMS
 *
 * @example
 * // 混合调度场景
 * const terms = generateHybridNodeSelectorTerms(['ml.g6.12xlarge', 'g6.12xlarge']);
 * // 输出包含 HyperPod 和 EC2 两种节点选择器
 *
 * // 纯 HyperPod 场景
 * const terms2 = generateHybridNodeSelectorTerms(['ml.g6.12xlarge']);
 * // 输出仅包含 HyperPod 节点选择器
 */
function generateHybridNodeSelectorTerms(instanceTypes) {
  if (!instanceTypes || instanceTypes.length === 0) {
    console.warn('No instance types selected, using default ml.g6.12xlarge');
    instanceTypes = ['ml.g6.12xlarge'];
  }

  const hyperpodTypes = instanceTypes.filter(t => t.startsWith('ml.'));
  const gpuTypes = instanceTypes.filter(t => !t.startsWith('ml.'));

  let nodeSelectorTerms = [];

  // HyperPod 节点选择器（原生 + Karpenter 都有 sagemaker.amazonaws.com/compute-type 标签）
  if (hyperpodTypes.length > 0) {
    nodeSelectorTerms.push(`            # HyperPod 节点（原生 + Karpenter）
            - matchExpressions:
              - key: sagemaker.amazonaws.com/compute-type
                operator: In
                values: ["hyperpod"]
              - key: node.kubernetes.io/instance-type
                operator: In
                values: [${hyperpodTypes.map(t => `"${t}"`).join(', ')}]`);
  }

  // EC2 节点选择器条件 (EKS NodeGroup + Karpenter EC2)
  if (gpuTypes.length > 0) {
    nodeSelectorTerms.push(`            # EC2 GPU 节点 (EKS NodeGroup + Karpenter)
            - matchExpressions:
              - key: node.kubernetes.io/instance-type
                operator: In
                values: [${gpuTypes.map(t => `"${t}"`).join(', ')}]`);
  }

  return nodeSelectorTerms.join('\n');
}

/**
 * 生成 Kubernetes resources 配置 (limits/requests)
 * 用于 Container 推理部署
 *
 * @param {Object} config - 资源配置
 * @param {number} config.gpuCount - GPU 数量
 * @param {number} [config.gpuMemory=-1] - HAMi GPU 内存 (MB)，-1 表示不限制
 * @param {number} [config.cpuRequest=-1] - CPU 请求，-1 表示不限制
 * @param {number} [config.memoryRequest=-1] - 内存请求 (Gi)，-1 表示不限制
 * @returns {string} YAML 格式的 resources 配置
 *
 * @example
 * const resources = generateResourcesSection({ gpuCount: 4 });
 * // 返回仅包含 GPU 的 resources 配置
 *
 * const resources2 = generateResourcesSection({
 *   gpuCount: 4,
 *   gpuMemory: 40000,
 *   cpuRequest: 16,
 *   memoryRequest: 64
 * });
 * // 返回包含 GPU、HAMi GPU 内存、CPU、Memory 的完整 resources 配置
 */
function generateResourcesSection({ gpuCount, gpuMemory = -1, cpuRequest = -1, memoryRequest = -1 }) {
  const limits = [`nvidia.com/gpu: ${gpuCount}`];
  const requests = [`nvidia.com/gpu: ${gpuCount}`];

  // HAMi GPU 内存
  if (gpuMemory > 0) {
    limits.push(`nvidia.com/gpumem: ${gpuMemory}`);
    requests.push(`nvidia.com/gpumem: ${gpuMemory}`);
  }

  // CPU
  if (cpuRequest > 0) {
    limits.push(`cpu: "${cpuRequest}"`);
    requests.push(`cpu: "${cpuRequest}"`);
  }

  // Memory
  if (memoryRequest > 0) {
    limits.push(`memory: ${memoryRequest}Gi`);
    requests.push(`memory: ${memoryRequest}Gi`);
  }

  return `resources:
            limits:
              ${limits.join('\n              ')}
            requests:
              ${requests.join('\n              ')}`;
}

module.exports = {
  generateNLBAnnotations,
  parseInferenceCommand,
  makeHttpRequest,
  generateDeploymentTag,
  generateHybridNodeSelectorTerms,
  generateResourcesSection
};
