/**
 * Custom Error Classes
 * Provides structured error handling across the application
 */

/**
 * Base application error
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {boolean} isOperational - Whether error is operational (expected) or programming error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication error (401)
 * Used when JWT is invalid or missing
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true);
  }
}

/**
 * Authorization error (403) - RBAC violations
 * Used when user lacks permission for operation
 * @param {string} message - Error message
 * @param {Object} context - Context object with userId, nodeId, operation
 */
class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', context = {}) {
    super(message, 403, true);
    this.context = context; // { userId, nodeId, operation }
  }
}

/**
 * Validation error (400)
 * Used for invalid input data
 * @param {string} message - Error message
 * @param {Array<string>} errors - Array of specific validation failures
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400, true);
    this.errors = errors;
  }
}

/**
 * Not found error (404)
 * @param {string} resource - Resource name
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, true);
  }
}

/**
 * WebSocket error
 * Used for WebSocket-specific issues
 * @param {string} message - Error message
 * @param {number} code - WebSocket close code
 */
class WebSocketError extends AppError {
  constructor(message, code = 1011) {
    super(message, 500, true);
    this.wsCode = code;
  }
}

/**
 * CRDT sync error
 * Used when Yjs operations fail
 * @param {string} message - Error message
 * @param {Uint8Array|null} updateData - Binary update data
 */
class CRDTError extends AppError {
  constructor(message, updateData = null) {
    super(message, 500, true);
    this.updateData = updateData;
  }
}

/**
 * Database error
 * Used for Prisma/database failures
 * @param {string} message - Error message
 * @param {Error|null} originalError - Original error object
 */
class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, false); // Not operational - programming error
    this.originalError = originalError;
  }
}

/**
 * External API error (Anthropic)
 * Used when AI classification fails
 * @param {string} service - Service name
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 */
class ExternalAPIError extends AppError {
  constructor(service, message, statusCode = 500) {
    super(`${service} API error: ${message}`, statusCode, true);
    this.service = service;
  }
}

module.exports = {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  WebSocketError,
  CRDTError,
  DatabaseError,
  ExternalAPIError,
};
