/**
 * Log Stream Manager
 *
 * Pod 日志管理 API 模块，从 index.js 提取
 *
 * 包含的 API:
 * - GET /:jobName/:podName - 获取完整日志文件
 * - GET /:jobName/:podName/download - 下载日志文件
 * - GET /:jobName/:podName/info - 获取日志文件信息
 *
 * 注意: 集群创建日志 (/api/cluster/logs/*) 由 multiClusterAPIs 模块处理
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 日志存储目录
const LOGS_BASE_DIR = path.join(__dirname, '..', 'logs');

/**
 * 确保日志目录存在
 * @param {string} jobName - 任务名称
 * @param {string} podName - Pod 名称
 * @returns {string} 日志文件完整路径
 */
function ensureLogDirectory(jobName, podName) {
  const jobLogDir = path.join(LOGS_BASE_DIR, jobName);
  if (!fs.existsSync(jobLogDir)) {
    fs.mkdirSync(jobLogDir, { recursive: true });
  }
  return path.join(jobLogDir, `${podName}.log`);
}

/**
 * 获取日志文件路径
 * @param {string} jobName - 任务名称
 * @param {string} podName - Pod 名称
 * @returns {string} 日志文件完整路径
 */
function getLogFilePath(jobName, podName) {
  return path.join(LOGS_BASE_DIR, jobName, `${podName}.log`);
}

// ==================== 获取完整日志文件 API ====================

/**
 * GET /:jobName/:podName
 * 获取完整日志文件内容
 */
router.get('/:jobName/:podName', (req, res) => {
  try {
    const { jobName, podName } = req.params;
    const logFilePath = getLogFilePath(jobName, podName);

    if (fs.existsSync(logFilePath)) {
      res.sendFile(path.resolve(logFilePath));
    } else {
      res.status(404).json({
        success: false,
        error: 'Log file not found',
        path: logFilePath
      });
    }
  } catch (error) {
    console.error('Error serving log file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 下载日志文件 API ====================

/**
 * GET /:jobName/:podName/download
 * 下载完整日志文件
 */
router.get('/:jobName/:podName/download', (req, res) => {
  try {
    const { jobName, podName } = req.params;
    const logFilePath = getLogFilePath(jobName, podName);

    if (fs.existsSync(logFilePath)) {
      res.download(logFilePath, `${podName}.log`, (err) => {
        if (err) {
          console.error('Error downloading log file:', err);
          res.status(500).json({
            success: false,
            error: 'Failed to download log file'
          });
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Log file not found',
        path: logFilePath
      });
    }
  } catch (error) {
    console.error('Error downloading log file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 获取日志文件信息 API ====================

/**
 * GET /:jobName/:podName/info
 * 获取日志文件的元信息（大小、创建时间等）
 */
router.get('/:jobName/:podName/info', (req, res) => {
  try {
    const { jobName, podName } = req.params;
    const logFilePath = getLogFilePath(jobName, podName);

    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      res.json({
        success: true,
        info: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          path: logFilePath
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Log file not found'
      });
    }
  } catch (error) {
    console.error('Error getting log file info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 模块导出 ====================

module.exports = {
  router,
  LOGS_BASE_DIR,
  ensureLogDirectory,
  getLogFilePath
};
