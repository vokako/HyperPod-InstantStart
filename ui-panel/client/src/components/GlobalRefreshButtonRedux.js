import React, { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Tooltip, Switch, Input, Badge, Popover, Typography, List } from 'antd';
import { ReloadOutlined, SettingOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import {
  globalRefresh,
  autoRefresh,
  setAutoRefreshEnabled,
  setAutoRefreshInterval,
  setAutoRefreshTimerId,
  clearError,
  clearRefreshHistory
} from '../store/slices/globalRefreshSlice';
import {
  selectIsGlobalRefreshing,
  selectLastGlobalRefreshTime,
  selectAutoRefreshEnabled,
  selectAutoRefreshInterval,
  selectGlobalRefreshStats,
  selectRecentRefreshHistory,
  selectGlobalRefreshError
} from '../store/selectors';

const { Text, Paragraph } = Typography;

const GlobalRefreshButtonRedux = ({
  style = {},
  size = 'default',
  showStats = true,
  showAutoRefresh = true,
  autoRefreshOptions = {}
}) => {
  const dispatch = useDispatch();
  const isInitialized = useRef(false);

  // Redux 状态
  const isRefreshing = useSelector(selectIsGlobalRefreshing);
  const lastRefreshTime = useSelector(selectLastGlobalRefreshTime);
  const autoRefreshEnabled = useSelector(selectAutoRefreshEnabled);
  const autoRefreshInterval = useSelector(selectAutoRefreshInterval);
  const refreshStats = useSelector(selectGlobalRefreshStats);
  const recentHistory = useSelector(state => selectRecentRefreshHistory(state, 1)); // 只显示1个记录
  const error = useSelector(selectGlobalRefreshError);

  // 手动触发全局刷新
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;

    try {
      await dispatch(globalRefresh({
        source: 'manual',
        refreshClusterStatus: true,
        refreshAppStatus: true,
        force: true
      })).unwrap();
    } catch (error) {
      console.error('Manual refresh failed:', error);
    }
  }, [dispatch, isRefreshing]);

  // 切换自动刷新
  const handleAutoRefreshToggle = useCallback((enabled) => {
    dispatch(setAutoRefreshEnabled(enabled));
  }, [dispatch]);

  // 修改自动刷新间隔
  const handleIntervalChange = useCallback((e) => {
    const value = e.target.value;
    const interval = Math.max(10, parseInt(value) || 10) * 1000; // 最小 10 秒，修复输入处理
    dispatch(setAutoRefreshInterval(interval));
  }, [dispatch]);

  // 清除错误
  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // 清除历史记录
  const handleClearHistory = useCallback(() => {
    dispatch(clearRefreshHistory());
  }, [dispatch]);

  // 组件初始化时设置默认配置（只在首次挂载时执行）
  useEffect(() => {
    if (!isInitialized.current) {
      const { defaultEnabled, defaultInterval } = autoRefreshOptions;

      if (defaultEnabled !== undefined) {
        dispatch(setAutoRefreshEnabled(defaultEnabled));
      }

      if (defaultInterval !== undefined) {
        dispatch(setAutoRefreshInterval(defaultInterval));
      }

      isInitialized.current = true;
    }
  }, [autoRefreshOptions, dispatch]); // 监听 autoRefreshOptions 但只初始化一次

  // 设置自动刷新定时器
  useEffect(() => {
    let timerId = null;

    if (autoRefreshEnabled && !isRefreshing) {
      timerId = setInterval(() => {
        dispatch(autoRefresh());
      }, autoRefreshInterval);

      dispatch(setAutoRefreshTimerId(timerId));
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
        dispatch(setAutoRefreshTimerId(null));
      }
    };
  }, [autoRefreshEnabled, autoRefreshInterval, isRefreshing, dispatch]);

  // 格式化时间显示
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // 格式化间隔显示
  const formatInterval = (ms) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  // 获取按钮状态
  const getButtonType = () => {
    if (error) return 'danger';
    if (isRefreshing) return 'primary';
    return 'default';
  };

  // 构建设置面板内容
  const settingsContent = (
    <div style={{ width: 320, padding: '8px 0' }}>
      <div style={{ marginBottom: 16 }}>
        <Text strong>Auto Refresh Settings</Text>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center' }}>
          <Switch
            checked={autoRefreshEnabled}
            onChange={handleAutoRefreshToggle}
            size="small"
          />
          <Text style={{ marginLeft: 8 }}>
            Enable Auto Refresh ({formatInterval(autoRefreshInterval)})
          </Text>
        </div>
        {autoRefreshEnabled && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">Refresh Interval (seconds):</Text>
            <Input
              size="small"
              type="number"
              min={10}
              max={3600}
              value={autoRefreshInterval / 1000}
              onChange={handleIntervalChange}
              style={{ width: 80, marginLeft: 8 }}
            />
          </div>
        )}
      </div>

      {showStats && refreshStats && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>Refresh Statistics</Text>
          <div style={{ marginTop: 8 }}>
            <Paragraph style={{ margin: 0, fontSize: '12px' }}>
              Total: {refreshStats.totalRefreshes} |
              Success Rate: {refreshStats.successRate}% |
              Avg Duration: {refreshStats.averageDuration}ms
            </Paragraph>
          </div>
        </div>
      )}

      {recentHistory.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Recent Activity</Text>
            <Button size="small" type="link" onClick={handleClearHistory}>
              Clear
            </Button>
          </div>
          <List
            size="small"
            dataSource={recentHistory}
            renderItem={(record) => (
              <List.Item style={{ padding: '4px 0', borderBottom: 'none' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: '12px' }}>
                      {record.success ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                      ) : (
                        <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                      )}
                      {formatTime(record.timestamp)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {record.duration || 0}ms
                    </Text>
                  </div>
                  {record.source && (
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      Source: {record.source}
                    </Text>
                  )}
                </div>
              </List.Item>
            )}
          />
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="danger" strong>Error Message</Text>
            <Button size="small" type="link" onClick={handleClearError}>
              Clear
            </Button>
          </div>
          <Paragraph style={{ margin: 0, fontSize: '12px', color: '#ff4d4f' }}>
            {error}
          </Paragraph>
        </div>
      )}
    </div>
  );

  // 主按钮 - 透明背景，白色文字和边框，与标题栏统一
  const refreshButton = (
    <Button
      type={isRefreshing ? 'primary' : 'default'}
      icon={<ReloadOutlined spin={isRefreshing} />}
      size={size}
      loading={isRefreshing}
      onClick={handleManualRefresh}
      disabled={isRefreshing}
      style={{
        ...style,
        backgroundColor: isRefreshing ? undefined : 'transparent',
        borderColor: isRefreshing ? undefined : 'rgba(255, 255, 255, 0.65)',
        color: isRefreshing ? undefined : '#ffffff'
      }}
    >
      Refresh
    </Button>
  );

  // 如果有错误，显示错误徽章
  const buttonWithBadge = error ? (
    <Badge dot status="error">
      {refreshButton}
    </Badge>
  ) : refreshButton;

  // 构建工具提示内容
  const tooltipTitle = (
    <div>
      <div>Click to refresh all component data</div>
      {lastRefreshTime && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Last refresh: {formatTime(lastRefreshTime)}
        </div>
      )}
      {autoRefreshEnabled && (
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Auto refresh: {formatInterval(autoRefreshInterval)}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Tooltip title={tooltipTitle} placement="bottom">
        {buttonWithBadge}
      </Tooltip>

      {showAutoRefresh && (
        <Popover
          content={settingsContent}
          title="Global Refresh Settings"
          trigger="click"
          placement="bottomRight"
        >
          <Button
            icon={<SettingOutlined />}
            size={size}
            type="text"
            style={{
              padding: '0 8px',
              color: 'rgba(255, 255, 255, 0.9)',
              backgroundColor: 'transparent'
            }}
          />
        </Popover>
      )}
    </div>
  );
};

export default GlobalRefreshButtonRedux;