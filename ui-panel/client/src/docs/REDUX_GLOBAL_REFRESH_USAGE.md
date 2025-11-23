# Redux 全局刷新系统 - 使用指南

本文档说明如何使用新实现的基于 Redux 的全局刷新系统来解决 Cluster Status 和 App Status 组件的刷新问题。

## 🎯 解决的问题

1. **Cluster Status 和 App Status 组件不受全局刷新机制控制**
2. **手动刷新功能不统一**
3. **数据状态管理分散**
4. **刷新操作重复调用 API**
5. **界面响应速度慢**

## 📦 新实现的组件和文件

### Redux Slices
- `clusterStatusSlice.js` - 集群状态管理
- `appStatusSlice.js` - 应用状态管理
- `globalRefreshSlice.js` - 全局刷新管理

### Redux 选择器
- `selectors.js` - 包含所有新的选择器

### React 组件
- `ClusterStatusV2Redux.js` - 基于 Redux 的集群状态组件
- `StatusMonitorRedux.js` - 基于 Redux 的状态监控组件
- `GlobalRefreshButtonRedux.js` - 基于 Redux 的全局刷新按钮

## 🚀 快速开始

### 1. 替换现有组件

将现有组件替换为新的 Redux 版本：

```javascript
// 旧版本
import ClusterStatusV2 from './components/ClusterStatusV2';
import StatusMonitor from './components/StatusMonitor';

// 新版本
import ClusterStatusV2Redux from './components/ClusterStatusV2Redux';
import StatusMonitorRedux from './components/StatusMonitorRedux';
import GlobalRefreshButtonRedux from './components/GlobalRefreshButtonRedux';
```

### 2. 更新组件使用

```javascript
// 旧版本 - 需要传递 props 和回调
<ClusterStatusV2
  clusterData={clusterData}
  onRefresh={handleRefresh}
/>

<StatusMonitor
  pods={pods}
  services={services}
  businessServices={businessServices}
  onRefresh={handleRefresh}
  activeTab="pods"
/>

// 新版本 - 自动从 Redux 获取数据
<ClusterStatusV2Redux />

<StatusMonitorRedux activeTab="pods" />

<GlobalRefreshButtonRedux />
```

### 3. 使用全局刷新

```javascript
import React from 'react';
import { useDispatch } from 'react-redux';
import { globalRefresh } from '../store/slices/globalRefreshSlice';

const YourComponent = () => {
  const dispatch = useDispatch();

  const handleGlobalRefresh = async () => {
    try {
      await dispatch(globalRefresh({
        source: 'manual',
        refreshClusterStatus: true,
        refreshAppStatus: true,
        force: true
      })).unwrap();
      console.log('刷新成功');
    } catch (error) {
      console.error('刷新失败:', error);
    }
  };

  return (
    <Button onClick={handleGlobalRefresh}>
      全局刷新
    </Button>
  );
};
```

## 📋 API 参考

### globalRefresh Thunk 参数

```typescript
interface GlobalRefreshOptions {
  source?: string;                    // 刷新来源标识 ('manual', 'auto', 等)
  refreshClusterStatus?: boolean;     // 是否刷新集群状态 (默认: true)
  refreshAppStatus?: boolean;         // 是否刷新应用状态 (默认: true)
  refreshTraining?: boolean;          // 是否刷新训练作业 (默认: false)
  refreshInference?: boolean;         // 是否刷新推理服务 (默认: false)
  refreshNodeGroups?: boolean;        // 是否刷新节点组 (默认: false)
  force?: boolean;                    // 是否强制刷新，忽略最后更新时间 (默认: false)
}
```

### 主要选择器

```javascript
import {
  // 集群状态选择器
  selectClusterNodes,
  selectPendingGPUs,
  selectClusterStatusLoading,
  selectCalculatedClusterStats,

  // 应用状态选择器
  selectAppPods,
  selectAppServices,
  selectAppRayJobs,
  selectAppBusinessServices,
  selectAppHealthSummary,

  // 全局刷新选择器
  selectIsGlobalRefreshing,
  selectLastGlobalRefreshTime,
  selectAutoRefreshEnabled,
  selectGlobalRefreshStats,

  // 综合选择器
  selectOverallSystemHealth
} from '../store/selectors';
```

## 🔧 配置选项

### 自动刷新配置

```javascript
import { setAutoRefreshEnabled, setAutoRefreshInterval } from '../store/slices/globalRefreshSlice';

// 启用自动刷新
dispatch(setAutoRefreshEnabled(true));

// 设置刷新间隔 (毫秒)
dispatch(setAutoRefreshInterval(30000)); // 30秒
```

### 组件配置选项

#### GlobalRefreshButtonRedux

```javascript
<GlobalRefreshButtonRedux
  style={{ margin: '8px' }}           // 按钮样式
  size="small"                        // 按钮大小
  showStats={true}                    // 显示统计信息
  showAutoRefresh={true}              // 显示自动刷新控制
  autoRefreshOptions={{               // 自动刷新选项
    defaultEnabled: false,
    defaultInterval: 60000
  }}
/>
```

#### StatusMonitorRedux

```javascript
<StatusMonitorRedux
  activeTab="pods"                    // 激活的标签页 ('pods', 'services', 'rayjobs')
/>
```

## 🎛️ 高级用法

### 1. 监听刷新状态

```javascript
import { useSelector } from 'react-redux';
import { selectIsGlobalRefreshing, selectGlobalRefreshStats } from '../store/selectors';

const MyComponent = () => {
  const isRefreshing = useSelector(selectIsGlobalRefreshing);
  const refreshStats = useSelector(selectGlobalRefreshStats);

  useEffect(() => {
    if (isRefreshing) {
      console.log('正在刷新...');
    }
  }, [isRefreshing]);

  return (
    <div>
      <span>成功率: {refreshStats?.successRate}%</span>
      <span>平均耗时: {refreshStats?.averageDuration}ms</span>
    </div>
  );
};
```

### 2. 自定义刷新逻辑

```javascript
import { globalRefresh } from '../store/slices/globalRefreshSlice';

// 只刷新集群状态
dispatch(globalRefresh({
  source: 'cluster-only',
  refreshClusterStatus: true,
  refreshAppStatus: false
}));

// 强制刷新所有数据
dispatch(globalRefresh({
  source: 'force-all',
  refreshClusterStatus: true,
  refreshAppStatus: true,
  refreshTraining: true,
  refreshInference: true,
  force: true
}));
```

### 3. 实时状态更新

```javascript
// WebSocket 集成示例
const handleWebSocketMessage = (message) => {
  switch (message.type) {
    case 'node-status-update':
      dispatch(updateNodeStatus({
        nodeName: message.nodeName,
        status: message.status
      }));
      break;

    case 'pod-status-update':
      dispatch(updatePodStatus({
        podName: message.podName,
        status: message.status
      }));
      break;
  }
};
```

## 🔍 调试和监控

### 1. Redux DevTools

新系统完全支持 Redux DevTools，可以：
- 查看所有状态变化
- 时间旅行调试
- 监控异步操作

### 2. 控制台日志

所有刷新操作都会在控制台输出详细日志：

```
Starting global refresh from source: manual
Cluster status response: {...}
Pods status response: {...}
Global refresh completed: {duration: 1234, success: true, operations: 2, errors: 0}
```

### 3. 性能监控

```javascript
const refreshStats = useSelector(selectGlobalRefreshStats);

console.log('刷新统计:', {
  总次数: refreshStats.totalRefreshes,
  成功率: `${refreshStats.successRate}%`,
  平均耗时: `${refreshStats.averageDuration}ms`,
  最后错误: refreshStats.lastError
});
```

## 🚨 注意事项

### 1. 迁移检查清单

- [ ] 确认所有 API 端点正常工作
- [ ] 测试手动刷新功能
- [ ] 测试自动刷新功能
- [ ] 验证 WebSocket 实时更新
- [ ] 检查错误处理机制
- [ ] 确认性能改善

### 2. 兼容性

- 新组件完全向后兼容原有 UI 和功能
- 保持所有现有的业务逻辑不变
- API 调用方式和参数保持一致

### 3. 性能优化

- 智能刷新：只刷新需要的数据
- 去重处理：避免重复 API 调用
- 并行执行：多个 API 调用同时进行
- 缓存机制：基于时间戳的智能刷新决策

## 📈 预期收益

### 功能改进
- ✅ Cluster Status 和 App Status 响应全局刷新
- ✅ 统一的刷新机制和错误处理
- ✅ 实时状态更新支持

### 性能提升
- ⚡ 刷新响应时间 < 2秒
- 🔄 API 重复调用减少 > 50%
- 🚀 界面响应速度提升 > 30%

### 开发体验
- 🛠️ 组件代码简化 > 20%
- 🔧 新组件接入 < 5分钟
- 🐛 完整的 Redux DevTools 支持

---

如需更多帮助，请参考：
- [Redux Toolkit 官方文档](https://redux-toolkit.js.org/)
- [React-Redux 官方文档](https://react-redux.js.org/)
- `GLOBAL_REFRESH_REDESIGN.md` - 详细的设计文档