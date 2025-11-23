// 调试全局刷新机制的工具脚本
// 在浏览器控制台中运行，检查全局刷新管理器的状态

export const debugGlobalRefresh = () => {
  if (typeof window !== 'undefined' && window.globalRefreshManager) {
    const manager = window.globalRefreshManager;

    console.log('=== 全局刷新管理器调试信息 ===');

    // 1. 获取组件状态
    const componentStatus = manager.getComponentStatus();
    console.log('1. 注册的组件列表：');
    componentStatus.forEach(component => {
      console.log(`   - ${component.id} (优先级: ${component.priority}, 启用: ${component.enabled}, 最后刷新: ${component.lastRefresh})`);
    });

    // 2. 获取刷新统计
    const stats = manager.getRefreshStats();
    console.log('2. 刷新统计：');
    console.log(`   - 总刷新次数: ${stats.totalRefreshes}`);
    console.log(`   - 成功次数: ${stats.successfulRefreshes}`);
    console.log(`   - 成功率: ${stats.successRate}%`);
    console.log(`   - 平均耗时: ${stats.averageDuration}ms`);
    console.log(`   - 最后刷新时间: ${stats.lastRefreshTime}`);
    console.log(`   - 是否正在刷新: ${stats.isRefreshing}`);
    console.log(`   - 自动刷新: ${stats.autoRefreshEnabled}`);

    // 3. 检查特定组件
    const targetComponents = ['cluster-status', 'status-monitor', 'app-status', 'pods-services'];
    console.log('3. 目标组件检查：');
    targetComponents.forEach(componentId => {
      const component = componentStatus.find(c => c.id === componentId);
      if (component) {
        console.log(`   ✅ ${componentId}: 已注册 (优先级: ${component.priority})`);
      } else {
        console.log(`   ❌ ${componentId}: 未注册`);
      }
    });

    // 4. 手动触发刷新测试
    console.log('4. 手动触发刷新测试：');
    return manager.triggerGlobalRefresh({ source: 'debug' })
      .then(result => {
        console.log('   刷新结果:', result);
        console.log(`   耗时: ${result.totalDuration}ms`);
        console.log(`   成功操作: ${(result.results || []).length}`);
        console.log(`   失败操作: ${(result.errors || []).length}`);

        if (result.errors && result.errors.length > 0) {
          console.log('   错误详情:');
          result.errors.forEach(error => {
            console.log(`     - ${error.componentId}: ${error.error}`);
          });
        }

        return result;
      })
      .catch(error => {
        console.error('   刷新失败:', error);
        return { success: false, error: error.message };
      });

  } else {
    console.error('❌ globalRefreshManager 未找到，请确保在开发环境中运行');
    return null;
  }
};

// 在开发环境中自动挂载到 window 对象
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.debugGlobalRefresh = debugGlobalRefresh;
  console.log('🔧 调试工具已加载，运行 debugGlobalRefresh() 来检查全局刷新状态');
}

export default debugGlobalRefresh;