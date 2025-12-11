import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Alert,
  Tooltip,
  Row,
  Col,
  AutoComplete,
  Select,
  message
} from 'antd';
import {
  RocketOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CodeOutlined,
  DockerOutlined,
  TagOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

const ManagedInferencePanel = ({ onDeploy, deploymentStatus }) => {
  const [deploymentForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 实例类型相关状态 - 只需要 HyperPod 实例类型
  const [instanceTypes, setInstanceTypes] = useState({
    hyperpod: [],
    karpenterHyperPod: []
  });
  const [instanceTypesLoading, setInstanceTypesLoading] = useState(false);
  const [s3Buckets, setS3Buckets] = useState([]);
  const [s3Region, setS3Region] = useState('');

  // Docker镜像预设选项
  const dockerImageOptions = useMemo(() => [
    {
      value: 'vllm/vllm-openai:latest',
      label: 'vllm/vllm-openai:latest'
    },
    {
      value: 'lmsysorg/sglang:latest',
      label: 'lmsysorg/sglang:latest'
    }
  ], []);

  // 根据Docker镜像获取对应的默认命令（bash 风格，参考 ConfigPanel）
  const getDefaultCommandByImage = useCallback((dockerImage, deploymentName) => {
    if (!dockerImage) {
      return '';
    }

    const modelName = deploymentName || 'model-name';

    if (dockerImage.includes('sglang')) {
      return `python3 -m sglang.launch_server \\
--model-path /opt/ml/model \\
--host 0.0.0.0 \\
--port 22022 \\
--trust-remote-code`;
    } else {
      // vLLM: 显示完整命令（用户友好），后端会自动去掉 vllm serve
      // 必须包含 --model /opt/ml/model 参数
      return `vllm serve \\
--model /opt/ml/model \\
--served-model-name ${modelName} \\
--max-model-len 2048 \\
--dtype auto`;
    }
  }, []);

  // 处理Docker镜像选择变化
  const handleDockerImageChange = useCallback((value) => {
    const deploymentName = deploymentForm.getFieldValue('deploymentName');
    const newCommand = getDefaultCommandByImage(value, deploymentName);
    deploymentForm.setFieldsValue({ workerCommand: newCommand });

    // SGLang 使用 22022 端口，vLLM 使用 8000
    const defaultPort = value.includes('sglang') ? 22022 : 8000;
    deploymentForm.setFieldsValue({ port: defaultPort });
  }, [getDefaultCommandByImage, deploymentForm]);

  // 处理 Deployment Name 变化
  const handleDeploymentNameChange = useCallback((e) => {
    const deploymentName = e.target.value;
    const dockerImage = deploymentForm.getFieldValue('dockerImage');
    if (dockerImage) {
      const newCommand = getDefaultCommandByImage(dockerImage, deploymentName);
      deploymentForm.setFieldsValue({ workerCommand: newCommand });
    }
  }, [getDefaultCommandByImage, deploymentForm]);

  // 获取集群可用实例类型
  const fetchInstanceTypes = useCallback(async () => {
    setInstanceTypesLoading(true);
    try {
      const response = await fetch('/api/cluster/cluster-available-instance');
      const data = await response.json();

      if (data.success) {
        setInstanceTypes({
          hyperpod: data.data.hyperpod || [],
          karpenterHyperPod: data.data.karpenterHyperPod || []
        });
        console.log('Instance types loaded:', data.data);
      } else {
        console.error('Failed to fetch instance types:', data.error);
      }
    } catch (error) {
      console.error('Error fetching instance types:', error);
    } finally {
      setInstanceTypesLoading(false);
    }
  }, []);

  // 获取 S3 存储桶和默认 region
  const fetchS3Buckets = useCallback(async () => {
    try {
      // 获取集群信息以获取默认 region 和 S3 bucket
      const clusterInfoResponse = await fetch('/api/cluster/info');
      const clusterInfo = await clusterInfoResponse.json();

      if (clusterInfo.success) {
        // 设置默认 region
        if (clusterInfo.region) {
          deploymentForm.setFieldsValue({ s3Region: clusterInfo.region });
          setS3Region(clusterInfo.region);
        }

        // 尝试获取 S3 bucket（从环境变量或 metadata）
        const s3Response = await fetch('/api/cluster/s3-buckets');
        const s3Data = await s3Response.json();

        if (s3Data.success && s3Data.clusterBucket) {
          deploymentForm.setFieldsValue({
            s3BucketName: s3Data.clusterBucket.name
          });
          setS3Buckets([s3Data.clusterBucket]);
        }
      }
    } catch (error) {
      console.error('Error fetching cluster info:', error);
    }
  }, [deploymentForm]);

  // 组件挂载时获取数据
  useEffect(() => {
    fetchInstanceTypes();
    fetchS3Buckets();
  }, [fetchInstanceTypes, fetchS3Buckets]);

  // 实例类型选项
  const instanceTypeOptions = useMemo(() => {
    const options = [];

    // HyperPod 实例
    if (instanceTypes.hyperpod.length > 0) {
      options.push(
        <Select.OptGroup key="hyperpod" label="HyperPod (ml.*)">
          {instanceTypes.hyperpod.map(type => (
            <Option key={`hp-${type.type}`} value={type.type}>
              {type.type} ({type.group}) [{type.count} nodes]
            </Option>
          ))}
        </Select.OptGroup>
      );
    }

    // Karpenter HyperPod 实例
    if (instanceTypes.karpenterHyperPod.length > 0) {
      options.push(
        <Select.OptGroup key="karpenter-hyperpod" label="Karpenter HyperPod (ml.*)">
          {instanceTypes.karpenterHyperPod.map((type, index) => (
            <Option key={`kar-hp-${type.type}-${type.nodePool}-${index}`} value={type.type}>
              {type.type} (Karpenter: {type.nodePool})
            </Option>
          ))}
        </Select.OptGroup>
      );
    }

    return options;
  }, [instanceTypes]);

  const handleSubmit = async (values) => {
    console.log('ManagedInferencePanel handleSubmit called with values:', values);

    setLoading(true);
    try {
      const deploymentConfig = {
        ...values,
        deploymentType: 'managed-inference'
      };

      console.log('Managed inference deployment config:', deploymentConfig);
      await onDeploy(deploymentConfig);
      message.success('Managed inference deployment initiated');
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      message.error('Failed to submit deployment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusAlert = () => {
    if (!deploymentStatus) return null;

    const { status, message: msg } = deploymentStatus;

    if (status === 'success') {
      return (
        <Alert
          message="Deployment Successful"
          description={msg}
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      );
    } else if (status === 'error') {
      return (
        <Alert
          message="Deployment Failed"
          description={msg}
          type="error"
          icon={<ExclamationCircleOutlined />}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      );
    }

    return null;
  };

  return (
    <div>
      {getStatusAlert()}

      <Form
        form={deploymentForm}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          replicas: 1,
          gpuCount: 1,
          gpuMemory: -1,
          port: 8000,
          cpuRequest: -1,
          memoryRequest: -1,
          s3Region: '',
          workerCommand: ''
        }}
      >
        <Row gutter={16}>
          <Col span={18}>
            <Form.Item
              label={
                <Space>
                  <TagOutlined />
                  Deployment Name
                  <Tooltip title="Kubernetes resource identifier (will be used as model name)">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="deploymentName"
              rules={[
                { required: true, message: 'Please input deployment name!' },
                { pattern: /^[a-z0-9-]+$/, message: 'Only lowercase letters, numbers and hyphens allowed' }
              ]}
            >
              <Input
                placeholder="e.g., qwen3-06b, llama2-7b"
                style={{ fontFamily: 'monospace' }}
                onChange={handleDeploymentNameChange}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={
                <Space>
                  <ThunderboltOutlined />
                  Replicas
                  <Tooltip title="Number of pod replicas">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="replicas"
              rules={[
                { required: true, message: 'Please input replica count!' },
                { type: 'number', min: 1, max: 10, message: 'Replicas must be between 1 and 10' }
              ]}
            >
              <InputNumber
                min={1}
                max={10}
                style={{ width: '100%' }}
                placeholder="Replicas"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              label={
                <Space>
                  GPU Count
                  <Tooltip title="Number of GPUs per replica">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="gpuCount"
              rules={[
                { required: true, message: 'Please input GPU count!' },
                { type: 'number', min: 1, max: 8, message: 'GPU count must be between 1 and 8' }
              ]}
            >
              <InputNumber
                min={1}
                max={8}
                style={{ width: '100%' }}
                placeholder="GPUs"
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={
                <Space>
                  GPU Memory (HAMi)
                  <Tooltip title="GPU memory in MB. -1 to use full GPU without HAMi">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="gpuMemory"
              rules={[
                { required: true, message: 'Please input GPU memory!' },
                { type: 'number', min: -1, message: 'GPU memory must be -1 or positive' }
              ]}
            >
              <InputNumber
                min={-1}
                addonAfter="MB"
                style={{ width: '100%' }}
                placeholder="-1 (ignore HAMi)"
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={
                <Space>
                  CPU
                  <Tooltip title="-1 = no limit, or specify cores">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="cpuRequest"
              rules={[
                { required: true, message: 'Required' },
                { type: 'number', min: -1, message: 'Must be -1 or positive' }
              ]}
            >
              <InputNumber
                min={-1}
                addonAfter="cores"
                placeholder="-1"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={
                <Space>
                  Memory
                  <Tooltip title="-1 = no limit, or specify Gi">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="memoryRequest"
              rules={[
                { required: true, message: 'Required' },
                { type: 'number', min: -1, message: 'Must be -1 or positive' }
              ]}
            >
              <InputNumber
                min={-1}
                addonAfter="Gi"
                placeholder="-1"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label={
                <Space>
                  <CloudServerOutlined />
                  Instance Type
                  <Tooltip title="Select HyperPod instance type (ml.*)">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              required
            >
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item
                  name="instanceType"
                  noStyle
                  rules={[
                    { required: true, message: 'Please select an instance type!' }
                  ]}
                >
                  <Select
                    placeholder="Select instance type"
                    loading={instanceTypesLoading}
                    style={{ fontFamily: 'monospace', flex: 1 }}
                    allowClear
                    notFoundContent={instanceTypesLoading ? 'Loading...' : 'No HyperPod instance types available'}
                  >
                    {instanceTypeOptions}
                  </Select>
                </Form.Item>
                <Button
                  icon={<ReloadOutlined />}
                  loading={instanceTypesLoading}
                  onClick={fetchInstanceTypes}
                  title="Refresh instance types"
                />
              </Space.Compact>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={18}>
            <Form.Item
              label={
                <Space>
                  <DockerOutlined />
                  Docker Image
                  <Tooltip title="Select preset image or input custom image">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="dockerImage"
              rules={[{ required: true, message: 'Please select or input docker image!' }]}
            >
              <AutoComplete
                options={dockerImageOptions}
                placeholder="Select Docker image"
                style={{ fontFamily: 'monospace' }}
                onChange={handleDockerImageChange}
                filterOption={false}
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={
                <Space>
                  <GlobalOutlined />
                  Port
                  <Tooltip title="Container port for inference">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="port"
              rules={[{ required: true, message: 'Please input port!' }]}
            >
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Alert
          message="S3 Model Source: Configure the S3 location where your model is stored"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <GlobalOutlined />
                  S3 Region
                  <Tooltip title="AWS region (auto-filled from cluster)">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="s3Region"
              rules={[{ required: true, message: 'Please input S3 region!' }]}
            >
              <Input
                placeholder="e.g., us-west-2"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <DatabaseOutlined />
                  S3 Bucket
                  <Tooltip title="S3 bucket containing the model">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="s3BucketName"
              rules={[{ required: true, message: 'Please input S3 bucket!' }]}
            >
              <Input
                placeholder="e.g., my-model-bucket"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label={
                <Space>
                  <DatabaseOutlined />
                  Model Path
                  <Tooltip title="Path to model within S3 bucket">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="modelLocation"
              rules={[{ required: true, message: 'Please input model path!' }]}
            >
              <Input
                placeholder="e.g., Qwen-Qwen3-0.6B"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label={
            <Space>
              <CodeOutlined />
              Worker Command
              <Tooltip title="Container entrypoint command. Keep /opt/ml/model unchanged - it's the mounted model path.">
                <InfoCircleOutlined />
              </Tooltip>
            </Space>
          }
          name="workerCommand"
          rules={[{ required: true, message: 'Please input worker command!' }]}
          extra="e.g., Keep /opt/ml/model unchanged - it represents the mounted model path"
        >
          <TextArea
            rows={8}
            placeholder="Select Docker image first, default command will be auto-generated"
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<RocketOutlined />}
            loading={loading}
            block
            size="large"
          >
            Deploy Managed Inference
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default ManagedInferencePanel;
