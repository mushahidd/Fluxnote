// AI API Routes
// POST   /api/rooms/:roomId/summary          → generate AI summary
// GET    /api/rooms/:roomId/summary/export   → download summary as markdown

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { summarizeSession } = require('../services/aiService');

// Generate AI summary for a room
router.post('/:roomId/summary', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log(`[AI] Generating summary for room: ${roomId}`);
    
    const summary = await summarizeSession(roomId);
    
    // Return structured summary object
    res.json(summary);
  } catch (error) {
    console.error('[AI] Summary generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate summary',
      message: error.message 
    });
  }
});

// Export summary as downloadable markdown file
router.get('/:roomId/summary/export', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log(`[AI] Exporting summary for room: ${roomId}`);
    
    const summary = await summarizeSession(roomId);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="session-summary-${roomId}.md"`);
    
    // Send markdown content
    res.send(summary.markdown);
  } catch (error) {
    console.error('[AI] Summary export error:', error);
    res.status(500).json({ 
      error: 'Failed to export summary',
      message: error.message 
    });
  }
});

module.exports = router;
