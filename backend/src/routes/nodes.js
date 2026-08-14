// GET    /api/nodes/:nodeId        → get single node + its ACL
// PATCH  /api/nodes/:nodeId/lock   → Lead locks a node (inserts LOCK_NODE event)
// PATCH  /api/nodes/:nodeId/role   → assign role to node
// DELETE /api/nodes/:nodeId        → inserts DELETE event (never removes from DB)
// Server validates role before every mutation here

const express = require('express');
const router = express.Router();
const rbacService = require('../services/rbacService');
const eventService = require('../services/eventService');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, checkNodePermission } = require('../middleware/rbac');

// Get single node with ACL
router.get('/:nodeId', authenticateToken, async (req, res) => {
  try {
    const { nodeId } = req.params;
    const acl = await rbacService.getNodeAcl(nodeId, req.accessToken);
    
    res.json({
      nodeId,
      acl: acl || { allowedRoles: ['Lead', 'Contributor'] },
    });
  } catch (error) {
    console.error('Get node error:', error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// Lock/unlock node (Lead only)
router.patch('/:nodeId/lock', authenticateToken, requireRole('Lead'), async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { locked, roomId } = req.body;

    if (typeof locked !== 'boolean' || !roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'locked (boolean) and roomId (string) required' });
    }

    const event = await eventService.insertEvent(
      'LOCK_NODE',
      {
        nodeId,
        locked,
        lockedBy: locked ? req.user.id : null,
      },
      req.user.id,
      roomId
    );

    res.json({ success: true, event });
  } catch (error) {
    console.error('Lock node error:', error);
    res.status(500).json({ error: 'Failed to lock node' });
  }
});

// Set node ACL (Lead only)
router.patch('/:nodeId/acl', authenticateToken, requireRole('Lead'), async (req, res) => {
  try {
    const { nodeId } = req.params;
    const allowedRoles = Array.isArray(req.body.allowedRoles)
      ? req.body.allowedRoles
      : req.body.acl?.allowedRoles;
    const { roomId } = req.body;

    if (!Array.isArray(allowedRoles)) {
      return res.status(400).json({ error: 'allowedRoles (array) required' });
    }

    const validRoles = ['Lead', 'Contributor'];
    const invalidRoles = allowedRoles.filter(role => !validRoles.includes(role));
    
    if (invalidRoles.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid roles',
        invalid: invalidRoles,
        valid: validRoles,
      });
    }

    const acl = await rbacService.setNodeAcl(nodeId, roomId, allowedRoles, req.accessToken);
    res.json({ success: true, acl });
  } catch (error) {
    console.error('Set node ACL error:', error);
    res.status(500).json({ error: 'Failed to set node ACL' });
  }
});

// Delete node (soft delete via event)
router.delete('/:nodeId', authenticateToken, checkNodePermission('delete'), async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: 'roomId required' });
    }

    const event = await eventService.insertEvent(
      'NODE_DELETED',
      { nodeId },
      req.user.id,
      roomId
    );

    res.json({ success: true, event });
  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

module.exports = router;
