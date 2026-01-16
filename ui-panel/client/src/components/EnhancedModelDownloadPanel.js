import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, Input, Button, Card, Space, Collapse, message, Typography, Select, InputNumber, Row, Col, Radio } from 'antd';
import { DownloadOutlined, KeyOutlined, RobotOutlined, SettingOutlined, ReloadOutlined, DatabaseOutlined } from '@ant-design/icons';
import operationRefreshManager from '../hooks/useOperationRefresh';
import resourceEventBus from '../utils/resourceEventBus';

const { Panel } = Collapse;
const { Text } = Typography;
const { Option, OptGroup } = Select;

const EnhancedModelDownloadPanel = ({ onStorageChange }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [storages, setStorages] = useState([]);
  const [fsxStorages, setFsxStorages] = useState([]);
  const [instanceTypes, setInstanceTypes] = useState({ hyperpod: [], karpenterHyperPod: [], eksNodeGroup: [], karpenter: [] });
  const [instanceTypesLoading, setInstanceTypesLoading] = useState(false);
  const [repoType, setRepoType] = useState('model'); // 'model' or 'dataset'

  // 获取可用的S3存储配置
  const fetchStorages = async () => {
    try {
      const response = await fetch('/api/s3-storages');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setStorages(result.storages || []);
        }
      }
    } catch (error) {
      console.error('Error fetching S3 storages:', error);
      setStorages([]);
    }
  };

  // 获取可用的FSx存储配置
  const fetchFsxStorages = async () => {
    try {
      const response = await fetch('/api/fsx-storages');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFsxStorages(result.storages || []);
        }
      }
    } catch (error) {
      console.error('Error fetching FSx storages:', error);
      setFsxStorages([]);
    }
  };

  // 获取集群可用实例类型
  const fetchInstanceTypes = useCallback(async () => {
    setInstanceTypesLoading(true);
    try {
      const response = await fetch('/api/cluster/cluster-available-instance');
      const data = await response.json();
      if (data.success) {
        setInstanceTypes(data.data);
      }
    } catch (error) {
      console.error('Error fetching instance types:', error);
    } finally {
      setInstanceTypesLoading(false);
    }
  }, []);

  // 实例类型选项
  const instanceTypeOptions = useMemo(() => (
    <>
      <OptGroup label="HyperPod (ml.*)">
        {instanceTypes.hyperpod.map(type => (
          <Option key={`hp-${type.type}`} value={type.type}>
            {type.type} ({type.group}) [{type.count} nodes]
          </Option>
        ))}
      </OptGroup>
      <OptGroup label="EC2">
        {instanceTypes.eksNodeGroup.map(type => (
          <Option key={`eks-${type.type}-${type.nodeGroup}`} value={type.type}>
            {type.type} (NodeGroup: {type.nodeGroup}) [{type.count} nodes]
          </Option>
        ))}
      </OptGroup>
    </>
  ), [instanceTypes]);

  useEffect(() => {
    fetchStorages();
    fetchFsxStorages();
    fetchInstanceTypes();
    
    // 暂时注释掉全局刷新监听，避免超时问题
    // const unsubscribe = globalRefreshManager.subscribe(async () => {
    //   console.log('🔄 Enhanced Model Download Panel: Global refresh triggered');
    //   await fetchStorages();
    // });
    
    // return () => {
    //   unsubscribe();
    // };
  }, []);

  const handleDownload = async (values) => {
    try {
      setLoading(true);
      const resourceLabel = repoType === 'dataset' ? 'dataset' : 'model';
      console.log(`🚀 Starting ${resourceLabel} download with values:`, values);

      const response = await fetch('/api/download-model-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: values.modelId,
          repoType: repoType,
          hfToken: values.hfToken || null,
          resources: {
            cpu: values.cpu ?? -1,
            memory: values.memory ?? -1,
          },
          s3Storage: values.s3Storage || 's3-claim',
          instanceType: values.instanceType || null
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(`${repoType === 'dataset' ? 'Dataset' : 'Model'} download job created: ${result.jobName}`);
        
        // 触发操作刷新（旧机制，保留兼容）
        operationRefreshManager.triggerOperationRefresh('model-download', {
          modelId: values.modelId,
          jobName: result.jobName,
          timestamp: new Date().toISOString(),
          source: 'enhanced-model-download-panel'
        });

        // 触发新的事件总线（新机制）
        resourceEventBus.emit('model-download', {
          modelId: values.modelId,
          jobName: result.jobName
        });
        
        console.log('✅ Model download initiated and refresh triggered');
        form.resetFields();
      } else {
        message.error(`Download failed: ${result.error}`);
      }
    } catch (error) {
      const resourceLabel = repoType === 'dataset' ? 'dataset' : 'model';
      console.error(`❌ Error downloading ${resourceLabel}:`, error);
      message.error(`Failed to initiate ${resourceLabel} download`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          {repoType === 'dataset' ? <DatabaseOutlined /> : <RobotOutlined />}
          HuggingFace Download
        </Space>
      }
      size="small"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleDownload}
        initialValues={{
          cpu: -1,
          memory: -1,
          s3Storage: 's3-claim'
        }}
      >
        {/* Resource Type 选择 */}
        <Form.Item label="Resource Type" style={{ marginBottom: 12 }}>
          <Radio.Group
            value={repoType}
            onChange={e => setRepoType(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="model">
              <Space size={4}><RobotOutlined />Model</Space>
            </Radio.Button>
            <Radio.Button value="dataset">
              <Space size={4}><DatabaseOutlined />Dataset</Space>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* 存储选择 */}
        <Form.Item
          name="s3Storage"
          label={
            <Space>
              Storage Provision
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchStorages();
                  fetchFsxStorages();
                }}
                title="Refresh storage list"
              />
            </Space>
          }
          rules={[{ required: true, message: 'Please select storage provision' }]}
        >
          <Select
            placeholder="Select storage provision configuration"
            onChange={(value) => onStorageChange && onStorageChange(value)}
          >
            <OptGroup label="S3 Storage">
              {storages.map(storage => (
                <Option key={storage.pvcName} value={storage.pvcName}>
                  {storage.name} ({storage.bucketName})
                </Option>
              ))}
            </OptGroup>
            <OptGroup label="FSx Lustre Storage">
              {fsxStorages.map(storage => (
                <Option key={storage.pvcName} value={storage.pvcName}>
                  {storage.name} ({storage.fileSystemId})
                </Option>
              ))}
            </OptGroup>
          </Select>
        </Form.Item>

        {/* Model/Dataset ID */}
        <Form.Item
          name="modelId"
          label={repoType === 'dataset' ? 'Dataset ID' : 'Model ID'}
          rules={[{ required: true, message: `Please input ${repoType} ID` }]}
        >
          <Input
            placeholder={repoType === 'dataset'
              ? "e.g., HuggingFaceFW/fineweb, allenai/dolma"
              : "e.g., meta-llama/Llama-2-7b-hf, Qwen/Qwen2-7B"}
            prefix={repoType === 'dataset' ? <DatabaseOutlined /> : <RobotOutlined />}
          />
        </Form.Item>

        {/* 资源配置和HF Token合并 */}
        <Collapse size="small" style={{ marginBottom: 16 }}>
          <Panel 
            header={
              <Space>
                <SettingOutlined />
                Advanced Configuration
              </Space>
            } 
            key="advanced"
          >
            {/* Instance Type 选择器 */}
            <Form.Item
              name="instanceType"
              label={
                <Space>
                  Instance Type
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={fetchInstanceTypes}
                    loading={instanceTypesLoading}
                  />
                </Space>
              }
            >
              <Select
                placeholder="Any (no node selector)"
                loading={instanceTypesLoading}
                allowClear
                style={{ fontFamily: 'monospace' }}
              >
                {instanceTypeOptions}
              </Select>
            </Form.Item>

            {/* 资源配置 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Form.Item
                  name="cpu"
                  label="CPU Cores"
                >
                  <InputNumber
                    min={-1}
                    max={32}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="memory"
                  label="Memory (GB)"
                >
                  <InputNumber
                    min={-1}
                    max={128}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* HF Token */}
            <Form.Item
              name="hfToken"
              label={
                <Space>
                  <KeyOutlined />
                  <Text>Hugging Face Token</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    (Optional, for private models)
                  </Text>
                </Space>
              }
            >
              <Input.Password 
                placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                visibilityToggle
              />
            </Form.Item>
          </Panel>
        </Collapse>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<DownloadOutlined />}
            block
          >
            Download {repoType === 'dataset' ? 'Dataset' : 'Model'}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default EnhancedModelDownloadPanel;
