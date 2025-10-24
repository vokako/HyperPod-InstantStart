import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 异步操作：获取 Pods 状态
export const fetchPods = createAsyncThunk(
  'appStatus/fetchPods',
  async (_, { rejectWithValue }) => {
    try {
      console.log('Fetching pods status via Redux...');
      const response = await fetch('/api/pods');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Pods status response:', data);

      return {
        pods: data.items || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching pods:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 异步操作：获取 Services 状态
export const fetchServices = createAsyncThunk(
  'appStatus/fetchServices',
  async (_, { rejectWithValue }) => {
    try {
      console.log('Fetching services status via Redux...');
      const response = await fetch('/api/services');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Services status response:', data);

      return {
        services: data.items || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching services:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 异步操作：获取 RayJobs 状态
export const fetchRayJobs = createAsyncThunk(
  'appStatus/fetchRayJobs',
  async (_, { rejectWithValue }) => {
    try {
      console.log('Fetching RayJobs status via Redux...');
      const response = await fetch('/api/ray-jobs');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('RayJobs status response:', data);

      return {
        rayJobs: data.items || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching RayJobs:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 异步操作：获取业务服务状态
export const fetchBusinessServices = createAsyncThunk(
  'appStatus/fetchBusinessServices',
  async (_, { rejectWithValue }) => {
    try {
      console.log('Fetching business services status via Redux...');
      const response = await fetch('/api/business-services');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Business services status response:', data);

      return {
        businessServices: data.services || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching business services:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 组合操作：刷新所有应用状态
export const refreshAllAppStatus = createAsyncThunk(
  'appStatus/refreshAllAppStatus',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const results = await Promise.allSettled([
        dispatch(fetchPods()).unwrap(),
        dispatch(fetchServices()).unwrap(),
        dispatch(fetchRayJobs()).unwrap(),
        dispatch(fetchBusinessServices()).unwrap()
      ]);

      const errors = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const operations = ['Pods', 'Services', 'RayJobs', 'Business Services'];
          errors.push(`${operations[index]}: ${result.reason}`);
        }
      });

      if (errors.length > 0) {
        // 部分失败也返回成功，只记录错误
        console.warn('Some app status operations failed:', errors);
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        errors: errors.length > 0 ? errors : null
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const appStatusSlice = createSlice({
  name: 'appStatus',
  initialState: {
    // 各类应用数据
    pods: [],
    services: [],
    rayJobs: [],
    businessServices: [],

    // 加载状态管理
    loading: false,
    podsLoading: false,
    servicesLoading: false,
    rayJobsLoading: false,
    businessServicesLoading: false,

    // 错误状态管理
    error: null,
    podsError: null,
    servicesError: null,
    rayJobsError: null,
    businessServicesError: null,

    // 时间戳记录
    lastUpdate: null,
    lastPodsUpdate: null,
    lastServicesUpdate: null,
    lastRayJobsUpdate: null,
    lastBusinessServicesUpdate: null,

    // 统计信息
    stats: {
      totalPods: 0,
      runningPods: 0,
      pendingPods: 0,
      failedPods: 0,
      totalServices: 0,
      activeServices: 0,
      totalRayJobs: 0,
      runningRayJobs: 0,
      completedRayJobs: 0,
      failedRayJobs: 0,
      totalBusinessServices: 0,
      healthyBusinessServices: 0
    }
  },
  reducers: {
    // 清除错误状态
    clearError: (state) => {
      state.error = null;
      state.podsError = null;
      state.servicesError = null;
      state.rayJobsError = null;
      state.businessServicesError = null;
    },

    // 更新单个 Pod 状态（用于 WebSocket 实时更新）
    updatePodStatus: (state, action) => {
      const { podName, status } = action.payload;
      const podIndex = state.pods.findIndex(pod => pod.metadata?.name === podName);

      if (podIndex !== -1) {
        state.pods[podIndex] = { ...state.pods[podIndex], ...status };
        state.lastPodsUpdate = new Date().toISOString();
        // 触发统计更新
        appStatusSlice.caseReducers.updateStats(state);
      }
    },

    // 更新单个 Service 状态
    updateServiceStatus: (state, action) => {
      const { serviceName, status } = action.payload;
      const serviceIndex = state.services.findIndex(service => service.metadata?.name === serviceName);

      if (serviceIndex !== -1) {
        state.services[serviceIndex] = { ...state.services[serviceIndex], ...status };
        state.lastServicesUpdate = new Date().toISOString();
        appStatusSlice.caseReducers.updateStats(state);
      }
    },

    // 更新单个 RayJob 状态
    updateRayJobStatus: (state, action) => {
      const { jobName, status } = action.payload;
      const jobIndex = state.rayJobs.findIndex(job => job.metadata?.name === jobName);

      if (jobIndex !== -1) {
        state.rayJobs[jobIndex] = { ...state.rayJobs[jobIndex], ...status };
        state.lastRayJobsUpdate = new Date().toISOString();
        appStatusSlice.caseReducers.updateStats(state);
      }
    },

    // 更新业务服务状态
    updateBusinessServiceStatus: (state, action) => {
      const { serviceName, status } = action.payload;
      const serviceIndex = state.businessServices.findIndex(service => service.name === serviceName);

      if (serviceIndex !== -1) {
        state.businessServices[serviceIndex] = { ...state.businessServices[serviceIndex], ...status };
        state.lastBusinessServicesUpdate = new Date().toISOString();
        appStatusSlice.caseReducers.updateStats(state);
      }
    },

    // 计算并更新统计信息
    updateStats: (state) => {
      // Pods 统计
      const podStats = state.pods.reduce((acc, pod) => {
        const phase = pod.status?.phase;
        return {
          totalPods: acc.totalPods + 1,
          runningPods: acc.runningPods + (phase === 'Running' ? 1 : 0),
          pendingPods: acc.pendingPods + (phase === 'Pending' ? 1 : 0),
          failedPods: acc.failedPods + (phase === 'Failed' ? 1 : 0)
        };
      }, {
        totalPods: 0,
        runningPods: 0,
        pendingPods: 0,
        failedPods: 0
      });

      // Services 统计
      const serviceStats = {
        totalServices: state.services.length,
        activeServices: state.services.filter(service =>
          service.spec?.type && service.status?.loadBalancer
        ).length
      };

      // RayJobs 统计
      const rayJobStats = state.rayJobs.reduce((acc, job) => {
        const jobStatus = job.status?.jobStatus;
        return {
          totalRayJobs: acc.totalRayJobs + 1,
          runningRayJobs: acc.runningRayJobs + (jobStatus === 'RUNNING' ? 1 : 0),
          completedRayJobs: acc.completedRayJobs + (jobStatus === 'SUCCEEDED' ? 1 : 0),
          failedRayJobs: acc.failedRayJobs + (jobStatus === 'FAILED' ? 1 : 0)
        };
      }, {
        totalRayJobs: 0,
        runningRayJobs: 0,
        completedRayJobs: 0,
        failedRayJobs: 0
      });

      // 业务服务统计
      const businessServiceStats = {
        totalBusinessServices: state.businessServices.length,
        healthyBusinessServices: state.businessServices.filter(service =>
          service.status === 'healthy' || service.health === 'ok'
        ).length
      };

      state.stats = {
        ...podStats,
        ...serviceStats,
        ...rayJobStats,
        ...businessServiceStats
      };
    }
  },
  extraReducers: (builder) => {
    // 处理获取 Pods
    builder
      .addCase(fetchPods.pending, (state) => {
        state.podsLoading = true;
        state.podsError = null;
      })
      .addCase(fetchPods.fulfilled, (state, action) => {
        state.podsLoading = false;
        state.pods = action.payload.pods;
        state.lastPodsUpdate = action.payload.timestamp;

        // 自动更新统计信息
        appStatusSlice.caseReducers.updateStats(state);
      })
      .addCase(fetchPods.rejected, (state, action) => {
        state.podsLoading = false;
        state.podsError = action.payload;
      })

    // 处理获取 Services
      .addCase(fetchServices.pending, (state) => {
        state.servicesLoading = true;
        state.servicesError = null;
      })
      .addCase(fetchServices.fulfilled, (state, action) => {
        state.servicesLoading = false;
        state.services = action.payload.services;
        state.lastServicesUpdate = action.payload.timestamp;

        appStatusSlice.caseReducers.updateStats(state);
      })
      .addCase(fetchServices.rejected, (state, action) => {
        state.servicesLoading = false;
        state.servicesError = action.payload;
      })

    // 处理获取 RayJobs
      .addCase(fetchRayJobs.pending, (state) => {
        state.rayJobsLoading = true;
        state.rayJobsError = null;
      })
      .addCase(fetchRayJobs.fulfilled, (state, action) => {
        state.rayJobsLoading = false;
        state.rayJobs = action.payload.rayJobs;
        state.lastRayJobsUpdate = action.payload.timestamp;

        appStatusSlice.caseReducers.updateStats(state);
      })
      .addCase(fetchRayJobs.rejected, (state, action) => {
        state.rayJobsLoading = false;
        state.rayJobsError = action.payload;
      })

    // 处理获取业务服务
      .addCase(fetchBusinessServices.pending, (state) => {
        state.businessServicesLoading = true;
        state.businessServicesError = null;
      })
      .addCase(fetchBusinessServices.fulfilled, (state, action) => {
        state.businessServicesLoading = false;
        state.businessServices = action.payload.businessServices;
        state.lastBusinessServicesUpdate = action.payload.timestamp;

        appStatusSlice.caseReducers.updateStats(state);
      })
      .addCase(fetchBusinessServices.rejected, (state, action) => {
        state.businessServicesLoading = false;
        state.businessServicesError = action.payload;
      })

    // 处理组合刷新操作
      .addCase(refreshAllAppStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshAllAppStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.lastUpdate = action.payload.timestamp;

        if (action.payload.errors) {
          console.warn('Some app status refresh operations had errors:', action.payload.errors);
        }
      })
      .addCase(refreshAllAppStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  clearError,
  updatePodStatus,
  updateServiceStatus,
  updateRayJobStatus,
  updateBusinessServiceStatus,
  updateStats
} = appStatusSlice.actions;

export default appStatusSlice.reducer;