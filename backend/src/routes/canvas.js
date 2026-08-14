// GET  /api/canvas/:roomId        → fetch full canvas state (replay all events)
// POST /api/canvas/:roomId/reset  → admin only, soft-reset (inserts RESET event)
// GET  /api/canvas/:roomId/export → AI summary export of all canvas nodes
// All mutations happen via WebSocket, NOT here

const express = require('express');
const router = express.Router();
const Y = require('yjs');
const canvasService = require('../services/canvasService');
const eventService = require('../services/eventService');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { ydocs } = require('../ws/yjsServer');

// Get full canvas state — tries DB first, falls back to live Y.Doc
// Allow unauthenticated access for guest users (they can still access via WebSocket)
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    console.log(`[Canvas API] Getting canvas state for room: ${roomId}`);

    const state = await canvasService.getCanvasState(roomId);

    // If DB returned empty/fallback, enrich with live Y.Doc nodes
    if ((state.fallback || state.nodes.length === 0) && ydocs.has(roomId)) {
      const ydoc = ydocs.get(roomId);
      const nodesMap = ydoc.getMap('nodes');
      const liveNodes = [];
      nodesMap.forEach((value, key) => {
        liveNodes.push({ id: key, ...value });
      });
      if (liveNodes.length > 0) {
        console.log(`[Canvas API] Serving ${liveNodes.length} nodes from live Y.Doc`);
        return res.json({ nodes: liveNodes, version: 0, source: 'ydoc' });
      }
    }

    console.log(`[Canvas API] Returning ${state.nodes.length} nodes for room: ${roomId}`);
    res.json(state);
  } catch (error) {
    console.error('[Canvas API] Get canvas state error:', error);
    res.status(500).json({ error: 'Failed to fetch canvas state', message: error.message });
  }
});

// Reset canvas (Lead only)
router.post('/:roomId/reset', authenticateToken, requireRole('Lead'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const event = await eventService.insertEvent(
      'RESET',
      { timestamp: new Date() },
      req.user.id,
      roomId
    );
    res.json({ success: true, event });
  } catch (error) {
    console.error('Canvas reset error:', error);
    res.status(500).json({ error: 'Failed to reset canvas' });
  }
});

// Export AI summary of canvas
router.get('/:roomId/export', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const summary = await canvasService.exportCanvasSummary(roomId);
    
    // Return as markdown with proper content type
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="canvas-summary-${roomId}.md"`);
    res.send(summary);
  } catch (error) {
    console.error('Canvas export error:', error);
    res.status(500).json({ error: 'Failed to export canvas summary' });
  }
});

// Get canvas history/events
router.get('/:roomId/history', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { afterId } = req.query;
    
    console.log('[Canvas History] Fetching events for room:', roomId);
    
    const events = await eventService.getEvents(roomId, afterId ? parseInt(afterId) : 0);
    
    console.log('[Canvas History] Found', events.length, 'events');
    
    res.json({ 
      events,
      count: events.length,
      roomId 
    });
  } catch (error) {
    console.error('[Canvas History] Error:', error);
    console.error('[Canvas History] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch canvas history', details: error.message });
  }
});

module.exports = router;
