/**
 * CRDT Helper Utilities
 * Centralizes Yjs CRDT operations and provides validation support
 */

const Y = require('yjs');
const { CRDTError } = require('./errors');

/**
 * Decode Y.Doc binary update to extract node changes
 * MOVED FROM yjsServer.js - this is the existing implementation
 * 
 * Seeds a temp doc with prevStateUpdate (state BEFORE the update), then applies
 * the update so the observer fires for exactly what changed.
 * 
 * @param {Uint8Array} update - Binary CRDT update (the delta)
 * @param {Uint8Array|null} prevStateUpdate - Full encoded state of ydoc BEFORE this update
 * @returns {Array<Object>} Array of mutations: [{ nodeId, operation, payload, previousValues }]
 */
function decodeYjsUpdate(update, prevStateUpdate) {
  const mutations = [];

  try {
    const tempDoc = new Y.Doc();
    const tempMap = tempDoc.getMap('nodes');

    // Seed the temp doc with the state that existed BEFORE this update
    if (prevStateUpdate && prevStateUpdate.length > 0) {
      Y.applyUpdate(tempDoc, prevStateUpdate);
    }

    const observer = (event) => {
      event.changes.keys.forEach((change, nodeId) => {
        let operation;
        let payload;
        let previousValues = null;

        if (change.action === 'add') {
          const currentValue = tempMap.get(nodeId);
          operation = 'create';
          payload = { nodeId, ...(currentValue || {}) };

        } else if (change.action === 'delete') {
          operation = 'delete';
          previousValues = change.oldValue;
          payload = { nodeId };

        } else if (change.action === 'update') {
          previousValues = change.oldValue;
          const currentValue = tempMap.get(nodeId);

          if (previousValues && currentValue) {
            const allKeys = new Set([
              ...Object.keys(previousValues),
              ...Object.keys(currentValue),
            ]);
            const changedProps = [...allKeys].filter(
              (key) =>
                JSON.stringify(currentValue[key]) !==
                JSON.stringify(previousValues[key])
            );
            operation =
              changedProps.length > 0 &&
              changedProps.every((k) => k === 'x' || k === 'y')
                ? 'move'
                : 'update';
          } else {
            operation = 'update';
          }
          payload = { nodeId, ...(currentValue || {}) };
        }

        if (operation) {
          mutations.push({ nodeId, operation, payload, previousValues });
        }
      });
    };

    tempMap.observe(observer);
    Y.applyUpdate(tempDoc, update);
    tempMap.unobserve(observer);
    tempDoc.destroy();

  } catch (error) {
    console.error('Error decoding Yjs update:', error);
  }

  return mutations;
}

/**
 * Safely apply Yjs update with optional validation callback
 * This solves the RBAC-before-apply issue
 * 
 * @param {Y.Doc} ydoc - Yjs document
 * @param {Uint8Array} update - Binary update
 * @param {Object} options - Options
 * @param {Function} options.validate - Validation callback (mutations) => Promise<boolean>
 * @param {Object} options.origin - Origin metadata
 * @returns {Promise<{ success: boolean, error?: string, mutations?: Array }>}
 * 
 * NOTE: On validation failure, `mutations` are present (decoded from temp doc)
 * but the update was NOT applied to `ydoc`. These mutations are useful for logging
 * RBAC violations but do not reflect the actual document state.
 */
async function safeApplyUpdate(ydoc, update, options = {}) {
  const { validate, origin } = options;

  try {
    // Capture state before applying
    const prevStateUpdate = Y.encodeStateAsUpdate(ydoc);
    
    // Decode mutations
    const mutations = decodeYjsUpdate(update, prevStateUpdate);
    
    // Run validation if provided
    if (validate && typeof validate === 'function') {
      const isValid = await validate(mutations);
      if (!isValid) {
        return {
          success: false,
          error: 'Validation failed',
          mutations, // Present but NOT applied to ydoc
        };
      }
    }
    
    // Apply update
    Y.applyUpdate(ydoc, update, origin);
    
    return {
      success: true,
      mutations,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get human-readable diff between two states
 * Useful for debugging and audit logs
 * 
 * @param {Uint8Array} beforeState - State before update
 * @param {Uint8Array} afterState - State after update
 * @returns {Object} Diff object with changes count and mutations
 */
function getStateDiff(beforeState, afterState) {
  const mutations = decodeYjsUpdate(afterState, beforeState);
  return {
    changes: mutations.length,
    mutations: mutations,
  };
}

/**
 * Validate Yjs update structure
 * Checks if update is well-formed before applying
 * 
 * @param {Uint8Array} update - Binary update
 * @returns {boolean} True if valid
 */
function isValidUpdate(update) {
  if (!update || !(update instanceof Uint8Array)) {
    return false;
  }
  
  if (update.length === 0) {
    return false;
  }
  
  try {
    // Try to decode - if it throws, it's invalid
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, update);
    tempDoc.destroy();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get event type for CRDT mutation
 * @param {Object} mutation - Mutation object with operation type
 * @returns {string} Event type
 */
function getEventType(mutation) {
  switch (mutation.operation) {
    case 'create': return 'CRDT_NODE_CREATED';
    case 'update': return 'CRDT_NODE_UPDATED';
    case 'delete': return 'CRDT_NODE_DELETED';
    case 'move':   return 'CRDT_NODE_MOVED';
    default:       return 'CRDT_NODE_UPDATED';
  }
}

module.exports = {
  decodeYjsUpdate,
  safeApplyUpdate,
  getStateDiff,
  isValidUpdate,
  getEventType,
};
