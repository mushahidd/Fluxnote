/**
 * Logging Utilities
 * Provides centralized logging with levels and formatting
 */

/**
 * Log levels
 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};

/**
 * Current log level (from environment)
 */
const currentLevel = process.env.LOG_LEVEL 
  ? LogLevel[process.env.LOG_LEVEL.toUpperCase()] 
  : LogLevel.INFO;

/**
 * Color codes for console output (development only)
 */
const colors = {
  DEBUG: '\x1b[36m',    // Cyan
  INFO: '\x1b[32m',     // Green
  WARN: '\x1b[33m',     // Yellow
  ERROR: '\x1b[31m',    // Red
  CRITICAL: '\x1b[35m', // Magenta
  RESET: '\x1b[0m',
};

/**
 * Format log message with timestamp and level
 * @param {number} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 * @returns {string} Formatted message
 */
function formatMessage(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const levelName = Object.keys(LogLevel).find(key => LogLevel[key] === level);
  const contextStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  
  // Add color in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    const color = colors[levelName] || colors.RESET;
    return `${color}[${timestamp}] [${levelName}]${colors.RESET} ${message}${contextStr}`;
  }
  
  return `[${timestamp}] [${levelName}] ${message}${contextStr}`;
}

/**
 * Log message if level is enabled
 * @param {number} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function log(level, message, context = {}) {
  if (level < currentLevel) return;
  
  const formatted = formatMessage(level, message, context);
  
  if (level >= LogLevel.ERROR) {
    console.error(formatted);
  } else if (level >= LogLevel.WARN) {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

/**
 * Debug level logging
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function debug(message, context) {
  log(LogLevel.DEBUG, message, context);
}

/**
 * Info level logging
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function info(message, context) {
  log(LogLevel.INFO, message, context);
}

/**
 * Warning level logging
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function warn(message, context) {
  log(LogLevel.WARN, message, context);
}

/**
 * Error level logging
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function error(message, context) {
  log(LogLevel.ERROR, message, context);
}

/**
 * Critical level logging
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function critical(message, context) {
  log(LogLevel.CRITICAL, message, context);
}

/**
 * Log WebSocket event with connection metadata
 * @param {string} event - Event name
 * @param {string} userId - User ID
 * @param {string} roomId - Room ID
 * @param {Object} metadata - Additional metadata
 */
function logWSEvent(event, userId, roomId, metadata = {}) {
  info(`WebSocket: ${event}`, {
    userId,
    roomId,
    ...metadata,
  });
}

/**
 * Log RBAC violation with full context
 * @param {string} userId - User ID
 * @param {string} nodeId - Node ID
 * @param {string} operation - Operation attempted
 * @param {string} reason - Reason for denial
 */
function logRBACViolation(userId, nodeId, operation, reason) {
  warn('RBAC Violation', {
    userId,
    nodeId,
    operation,
    reason,
  });
}

/**
 * Log performance metrics
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} metadata - Additional metadata
 */
function logPerformance(operation, duration, metadata = {}) {
  debug(`Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...metadata,
  });
}

module.exports = {
  LogLevel,
  log,
  debug,
  info,
  warn,
  error,
  critical,
  logWSEvent,
  logRBACViolation,
  logPerformance,
};
