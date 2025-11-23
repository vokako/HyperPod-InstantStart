import React, { useState, useRef } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Row, 
  Col, 
  Switch, 
  InputNumber, 
  Steps, 
  Space, 
  Divider, 
  Tag, 
  Alert, 
  Spin,
  Typography,
  message
} from 'antd';
import { 
  PlayCircleOutlined, 
  SettingOutlined, 
  ReloadOutlined, 
  DownOutlined,
  CopyOutlined
} from '@ant-design/icons';

const { Text } = Typography;

const CreateClusterDeprecated = ({ 
  form,
  defaultConfig,
  enableFtp,
  setEnableFtp,
  handleFormSubmit,
  currentStep,
  step1Status,
  step2Status,
  executeStep1,
  executeStep2,
  loading,
  refreshAllStatus,
  step1Details,
  step2Details,
  step1Result,
  step2Result,
  mlflowInfo,
  activeLogTab,
  switchLogTab,
  logs,
  logContainerRef,
  getCloudFormationStatusTag,
  getStatusTag
}) => {
  return (
    <Row gutter={[24, 24]} style={{ display: 'flex', alignItems: 'stretch' }}>
      {/* 左侧：配置表单 */}
      <Col xs={24} lg={8} style={{ display: 'flex' }}>
        <Card title="Cluster Configuration" className="theme-card compute" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleFormSubmit}
              initialValues={defaultConfig}
              style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
            >
            {/* 第一行：Cluster Tag - 核心字段 */}
            <Form.Item
              label="Cluster Tag"
              name="clusterTag"
              rules={[{ required: true, message: 'Please enter cluster tag' }]}
              extra="This tag will be used to generate all resource names automatically"
            >
              <Input placeholder="hypd-instrt-0821t1" />
            </Form.Item>

            {/* 第二行：AWS Region */}
            <Form.Item
              label="AWS Region"
              name="awsRegion"
              rules={[{ required: true, message: 'Please enter AWS region' }]}
            >
              <Input placeholder="us-west-2" />
            </Form.Item>

            {/* 第三行：FTP 配置 */}
            <Row gutter={12} style={{ margin: 0 }}>
              <Col span={8} style={{ paddingLeft: 0, paddingRight: 4 }}>
                <Form.Item label="Enable FTP">
                  <div style={{ paddingTop: '5px' }}>
                    <Switch 
                      checked={enableFtp} 
                      onChange={setEnableFtp}
                      checkedChildren="ON"
                      unCheckedChildren="OFF"
                    />
                  </div>
                </Form.Item>
              </Col>
              <Col span={16} style={{ paddingLeft: 4, paddingRight: 0 }}>
                {enableFtp && (
                  <Form.Item
                    label="FTP Name"
                    name="ftpName"
                    rules={[{ required: enableFtp, message: 'Please enter FTP name' }]}
                  >
                    <Input placeholder="your-ftp-name" />
                  </Form.Item>
                )}
              </Col>
            </Row>

            {/* 第四行：GPU 配置 */}
            <Form.Item
              label="GPU Capacity AZ"
              name="gpuCapacityAz"
              rules={[{ required: true, message: 'Please enter availability zone' }]}
            >
              <Input placeholder="us-west-2a" />
            </Form.Item>

            {/* 第五行：GPU Instance 配置 */}
            <Row gutter={12} style={{ margin: 0 }}>
              <Col span={16} style={{ paddingLeft: 0, paddingRight: 6 }}>
                <Form.Item
                  label="GPU Instance Type"
                  name="gpuInstanceType"
                  rules={[{ required: true, message: 'Please enter GPU instance type' }]}
                >
                  <Input placeholder="ml.g6.12xlarge" />
                </Form.Item>
              </Col>
              <Col span={8} style={{ paddingLeft: 6, paddingRight: 0 }}>
                <Form.Item
                  label="GPU Instance Count"
                  name="gpuInstanceCount"
                  rules={[{ required: true, message: 'Please enter instance count' }]}
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Button type="primary" htmlType="submit" size="large" block>
                Save Configuration
              </Button>
            </Form.Item>
          </Form>
          </div>
        </Card>
      </Col>

      {/* 中间：执行步骤和状态 */}
      <Col xs={24} lg={8} style={{ display: 'flex' }}>
        <Card 
          title="Deployment Steps" 
          className="theme-card analytics" 
          style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          extra={
            <Button 
              type="text" 
              icon={<ReloadOutlined />} 
              onClick={() => refreshAllStatus(true)}
              loading={loading}
              size="small"
            >
              Refresh All Status
            </Button>
          }
        >
          <div style={{ flex: 1, overflow: 'auto' }}>
          <Steps
            current={currentStep}
            direction="vertical"
            items={[
              {
                title: 'Cluster Launch',
                description: 'Create CloudFormation stack and launch cluster',
                status: step1Status,
                icon: step1Status === 'process' ? <Spin size="small" /> : <PlayCircleOutlined />
              },
              {
                title: 'Cluster Configuration',
                description: 'Configure cluster settings and dependencies',
                status: step2Status,
                icon: step2Status === 'process' ? <Spin size="small" /> : <SettingOutlined />
              }
            ]}
          />

          <Divider />

          {/* Step 1 控制 */}
          <div style={{ marginBottom: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={executeStep1}
                loading={loading && step1Status === 'process'}
                disabled={step1Status === 'process' || step2Status === 'process' || step1Status === 'finish'}
                block
              >
                {step1Status === 'finish' ? 'Step 1: Completed' : 'Execute Step 1: Cluster Launch'}
              </Button>
              {step1Status === 'finish' && (
                <div style={{ fontSize: '12px', color: '#52c41a', marginTop: '4px' }}>
                  ✓ CloudFormation stack already exists. Step 1 is complete.
                </div>
              )}
            </Space>
          </div>

          {/* Step 2 控制 */}
          <div style={{ marginBottom: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={executeStep2}
                loading={loading && step2Status === 'process'}
                disabled={step1Status !== 'finish' || step2Status === 'process' || step2Status === 'finish'}
                block
              >
                {step2Status === 'finish' ? 'Step 2: Completed' : 'Execute Step 2: Cluster Configuration'}
              </Button>
              {step2Status === 'finish' && (
                <div style={{ fontSize: '12px', color: '#52c41a', marginTop: '4px' }}>
                  ✓ All Kubernetes components are ready. Step 2 is complete.
                </div>
              )}
            </Space>
          </div>

          <Divider />

          {/* 集群状态显示 */}
          <div style={{ marginBottom: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {/* CloudFormation Status (Step 1) */}
              <div>
                <Text strong>Launch Status (CloudFormation):</Text>
                {step1Details ? (
                  <div style={{ marginTop: '4px' }}>
                    {getCloudFormationStatusTag(step1Details.stackStatus || step1Details.status)}
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Stack: {step1Details.stackName} | Last Updated: {step1Details.details?.lastUpdatedTime ? new Date(step1Details.details.lastUpdatedTime).toLocaleString() : 'N/A'}
                    </Text>
                  </div>
                ) : (
                  <div style={{ marginTop: '4px' }}>
                    <Text type="secondary">Click "Refresh All Status" to check</Text>
                  </div>
                )}
              </div>

              <Divider style={{ margin: '8px 0' }} />

              {/* Cluster Configuration Status (Step 2) */}
              <div>
                <Text strong>Configuration Status (Kubernetes):</Text>
                {step2Details ? (
                  <div style={{ marginTop: '4px' }}>
                    {step2Details.status === 'completed' ? (
                      <Tag color="success">All Components Ready</Tag>
                    ) : step2Details.status === 'partial' ? (
                      <Tag color="processing">Partially Ready</Tag>
                    ) : step2Details.status === 'error' ? (
                      <Tag color="error">Configuration Error</Tag>
                    ) : (
                      <Tag color="default">Not Started</Tag>
                    )}
                    <br />
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Ready: {step2Details.summary?.ready || 0}/{step2Details.summary?.total || 0} components
                      </Text>
                      {step2Details.checks && step2Details.checks.length > 0 && (
                        <>
                          {step2Details.checks.map((check, index) => (
                            <Tag 
                              key={index}
                              size="small" 
                              color={check.status === 'ready' ? 'green' : check.status === 'missing' ? 'orange' : 'red'}
                              style={{ fontSize: '11px', margin: 0 }}
                            >
                              {check.name}
                            </Tag>
                          ))}
                        </>
                      )}
                    </div>
                    
                    {/* MLFlow 信息显示 - 只在 Step 2 完成后显示 */}
                    {step2Details.status === 'completed' && (
                      <>
                        <Divider style={{ margin: '8px 0' }} />
                        
                        <div>
                          <Text strong>SageMaker Managed MLFlow Tracking Server ARN:</Text>
                          {mlflowInfo ? (
                            mlflowInfo.status === 'found' && mlflowInfo.trackingServerArn ? (
                              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Text 
                                  style={{ 
                                    fontSize: '12px', 
                                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                    backgroundColor: '#f6f8fa',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    border: '1px solid #d1d9e0',
                                    color: '#0969da',
                                    wordBreak: 'break-all',
                                    flex: 1
                                  }}
                                >
                                  {mlflowInfo.trackingServerArn}
                                </Text>
                                <Button
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => {
                                    navigator.clipboard.writeText(mlflowInfo.trackingServerArn);
                                    message.success('ARN copied to clipboard');
                                  }}
                                  title="Copy ARN"
                                  style={{ flexShrink: 0 }}
                                />
                              </div>
                            ) : mlflowInfo.status === 'not_found' ? (
                              <div style={{ marginTop: '4px' }}>
                                <Tag color="processing" size="small">Creating...</Tag>
                                <Text type="secondary" style={{ fontSize: '11px', marginLeft: '8px' }}>
                                  MLflow server info not available yet
                                </Text>
                              </div>
                            ) : mlflowInfo.status === 'error' ? (
                              <div style={{ marginTop: '4px' }}>
                                <Tag color="error" size="small">Error</Tag>
                                <Text type="secondary" style={{ fontSize: '11px', marginLeft: '8px' }}>
                                  {mlflowInfo.error || 'Failed to load MLflow info'}
                                </Text>
                              </div>
                            ) : (
                              <div style={{ marginTop: '4px' }}>
                                <Tag color="orange" size="small">Unknown Status</Tag>
                                <Text type="secondary" style={{ fontSize: '11px', marginLeft: '8px' }}>
                                  Unexpected MLflow status: {mlflowInfo.status}
                                </Text>
                              </div>
                            )
                          ) : (
                            <div style={{ marginTop: '4px' }}>
                              <Tag color="default" size="small">Loading...</Tag>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: '4px' }}>
                    <Text type="secondary">Complete Step 1 first, then refresh to check</Text>
                  </div>
                )}
              </div>
            </Space>
          </div>

          {/* 执行结果显示 */}
          {step1Result && (
            <Alert
              message="Step 1 Result"
              description={
                <pre style={{ fontSize: '11px', maxHeight: '120px', overflow: 'auto' }}>
                  {JSON.stringify(step1Result, null, 2)}
                </pre>
              }
              type={step1Status === 'finish' ? 'success' : 'error'}
              style={{ marginBottom: '16px' }}
            />
          )}

          {step2Result && (
            <Alert
              message="Step 2 Result"
              description={
                <pre style={{ fontSize: '11px', maxHeight: '120px', overflow: 'auto' }}>
                  {JSON.stringify(step2Result, null, 2)}
                </pre>
              }
              type={step2Status === 'finish' ? 'success' : 'error'}
            />
          )}
          </div>
        </Card>
      </Col>

      {/* 右侧：部署日志 */}
      <Col xs={24} lg={8} style={{ display: 'flex' }}>
        <Card 
          title="Deployment Logs" 
          className="theme-card storage"
          style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          extra={
            <Space size="small">
              <Button 
                size="small" 
                icon={<ReloadOutlined />}
                onClick={() => refreshAllStatus(true)}
                loading={loading}
              >
                Refresh
              </Button>
              <Button 
                size="small" 
                icon={<DownOutlined />}
                onClick={() => {
                  if (logContainerRef.current) {
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                  }
                }}
                title="Scroll to bottom"
              >
                Bottom
              </Button>
            </Space>
          }
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 日志选择 Tabs - 最小化空间 */}
            <div style={{ marginBottom: '4px', flexShrink: 0 }}>
              <Space size="small">
                <Button 
                  size="small" 
                  type={activeLogTab === 'launch' ? 'primary' : 'default'}
                  onClick={() => switchLogTab('launch')}
                >
                  Step 1
                </Button>
                <Button 
                  size="small" 
                  type={activeLogTab === 'configure' ? 'primary' : 'default'}
                  onClick={() => switchLogTab('configure')}
                >
                  Step 2
                </Button>
              </Space>
            </div>

            {/* 日志显示区域 - 固定高度，支持滚动，自定义滚动条样式 */}
            <div
              ref={logContainerRef}
              style={{
                height: '400px', // 固定高度，不再使用 flex: 1
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '12px',
                padding: '8px',
                overflowY: 'auto', // 垂直滚动
                overflowX: 'hidden', // 隐藏水平滚动
                border: '1px solid #333',
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', // 长行自动换行
                
                // 自定义滚动条样式 - 深色主题
                scrollbarWidth: 'thin', // Firefox
                scrollbarColor: '#555 #2a2a2a', // Firefox: thumb track
              }}
              className="custom-scrollbar"
            >
              {logs[activeLogTab] || (
                activeLogTab === 'launch' ? 
                  'Click "Execute Step 1" to start cluster launch and view logs...' :
                  'Complete Step 1 first, then execute Step 2 to view configuration logs...'
              )}
            </div>

            {/* 状态栏 - 极简显示 */}
            <div style={{ 
              marginTop: '4px', 
              padding: '4px 6px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '3px',
              fontSize: '9px',
              color: '#666',
              flexShrink: 0,
              lineHeight: '1.2'
            }}>
              <Space size="small" style={{ fontSize: '9px' }}>
                {activeLogTab === 'launch' ? getStatusTag(step1Status) : getStatusTag(step2Status)}
                <span>•</span>
                <span>Manual Refresh</span>
                <span>•</span>
                <span>{new Date().toLocaleTimeString().slice(0, 5)}</span>
              </Space>
            </div>

            {/* 详细状态信息 - 条件显示，极简格式 */}
            {activeLogTab === 'launch' && step1Details && (
              <div style={{ 
                marginTop: '3px', 
                padding: '4px 6px', 
                backgroundColor: '#e6f7ff', 
                borderRadius: '3px',
                fontSize: '9px',
                flexShrink: 0,
                lineHeight: '1.2'
              }}>
                <Text style={{ fontSize: '9px' }}>
                  CF: {step1Details.stackStatus || step1Details.status} | {step1Details.stackName}
                </Text>
              </div>
            )}

            {activeLogTab === 'configure' && step2Details && (
              <div style={{ 
                marginTop: '3px', 
                padding: '4px 6px', 
                backgroundColor: '#f6ffed', 
                borderRadius: '3px',
                fontSize: '9px',
                flexShrink: 0,
                lineHeight: '1.2'
              }}>
                <Text style={{ fontSize: '9px' }}>
                  K8s: {step2Details.summary?.ready || 0}/{step2Details.summary?.total || 0} ready
                  {step2Details.checks?.filter(c => c.status !== 'ready').length > 0 && (
                    <span style={{ color: '#fa8c16', marginLeft: '6px' }}>
                      ({step2Details.checks?.filter(c => c.status !== 'ready').map(c => c.name).join(', ')})
                    </span>
                  )}
                </Text>
              </div>
            )}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default CreateClusterDeprecated;
