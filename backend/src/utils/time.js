/**
 * Time and Debouncing Utilities
 * Provides debouncing, throttling, and time-related helper functions
 */

/**
 * Debounce function execution
 * Delays execution until after wait milliseconds have elapsed since last call
 * 
 * NOTE: This is a minimal implementation. It does NOT:
 * - Return the function's return value
 * - Provide cancel() or flush() methods
 * - Support awaiting the debounced call
 * 
 * For advanced features, use lodash.debounce or similar library.
 * 
 * @param {Function} func - Function to debounce
 * @param {number} waitMs - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, waitMs) {
  let timeoutId;
  
  return function debounced(...args) {
    const context = this;
    
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, waitMs);
  };
}

/**
 * Throttle function execution
 * Ensures function is called at most once per limit period
 * 
 * @param {Function} func - Function to throttle
 * @param {number} limitMs - Minimum milliseconds between calls
 * @returns {Function} Throttled function
 */
function throttle(func, limitMs) {
  let inThrottle;
  
  return function throttled(...args) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limitMs);
    }
  };
}

/**
 * Get current timestamp in ISO format
 * @returns {string} ISO timestamp
 */
function now() {
  return new Date().toISOString();
}

/**
 * Calculate time difference in milliseconds
 * @param {Date} start - Start time
 * @param {Date} end - End time
 * @returns {number} Difference in milliseconds
 */
function timeDiff(start, end) {
  return end.getTime() - start.getTime();
}

/**
 * Check if timestamp is within range
 * @param {Date} timestamp - Timestamp to check
 * @param {number} rangeMs - Range in milliseconds
 * @returns {boolean} True if within range
 */
function isWithinRange(timestamp, rangeMs) {
  const now = new Date();
  const diff = Math.abs(now.getTime() - timestamp.getTime());
  return diff <= rangeMs;
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {Date} timestamp - Timestamp
 * @returns {string} Relative time string
 */
function getRelativeTime(timestamp) {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Format timestamp for display
 * @param {Date} timestamp - Timestamp
 * @param {string} format - Format string (default: ISO)
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(timestamp, format = 'iso') {
  if (format === 'iso') {
    return timestamp.toISOString();
  } else if (format === 'locale') {
    return timestamp.toLocaleString();
  } else if (format === 'date') {
    return timestamp.toLocaleDateString();
  } else if (format === 'time') {
    return timestamp.toLocaleTimeString();
  }
  return timestamp.toString();
}

/**
 * Sleep/delay utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after specified time
 * Useful for adding timeouts to async operations
 * 
 * @param {number} ms - Milliseconds before timeout
 * @param {string} message - Error message
 * @returns {Promise<never>}
 */
function timeout(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Race a promise against a timeout
 * @param {Promise} promise - Promise to race
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Result of promise or timeout error
 */
async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    timeout(ms),
  ]);
}

module.exports = {
  debounce,
  throttle,
  now,
  timeDiff,
  isWithinRange,
  getRelativeTime,
  formatTimestamp,
  sleep,
  timeout,
  withTimeout,
};
