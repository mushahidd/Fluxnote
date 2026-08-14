// getCanvasState(roomId)
//   → replay all events for room → reconstruct current state
//   → return: { nodes: [], version: latestEventId }
// 
// This is how canvas state is rebuilt — from events, not a state table
// Called when a new user joins a room

const prisma = require('../db/prisma');
const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Get canvas state from database
 * First tries to load from CanvasNode table (fast), falls back to event replay (slow)
 * @param {string} roomId - Room ID
 * @returns {Promise<{nodes: Array, version: number}>}
 */
async function getCanvasState(roomId) {
  console.log(`[CanvasService] Getting canvas state for room: ${roomId}`);
  
  try {
    // Try to load from CanvasNode table first (fast path)
    const canvasNodes = await prisma.canvasNode.findMany({
      where: { roomId },
      orderBy: { updatedAt: 'desc' },
    });

    if (canvasNodes.length > 0) {
      console.log(`[CanvasService] Loaded ${canvasNodes.length} nodes from CanvasNode table`);
      return {
        nodes: canvasNodes,
        version: 0,
        source: 'database',
      };
    }

    console.log(`[CanvasService] No nodes in CanvasNode table, trying event replay...`);

    // Fallback: Fetch all events for the room in chronological order
    const events = await prisma.event.findMany({
      where: { roomId },
      orderBy: { timestamp: 'asc' },
    });

    console.log(`[CanvasService] Found ${events.length} events for room: ${roomId}`);

    // Reconstruct state by replaying events
    const nodes = new Map();
    let latestEventId = 0;

    for (const event of events) {
      latestEventId = event.id;
      const { type, payload } = event;

      switch (type) {
        case 'NODE_CREATED':
        case 'CRDT_NODE_CREATED':
          nodes.set(payload.nodeId, {
            id: payload.nodeId,
            ...payload,
            deleted: false,
          });
          break;

        case 'NODE_UPDATED':
        case 'CRDT_NODE_UPDATED':
          if (nodes.has(payload.nodeId)) {
            const node = nodes.get(payload.nodeId);
            nodes.set(payload.nodeId, { ...node, ...payload });
          }
          break;

        case 'NODE_DELETED':
        case 'CRDT_NODE_DELETED':
          if (nodes.has(payload.nodeId)) {
            const node = nodes.get(payload.nodeId);
            nodes.set(payload.nodeId, { ...node, deleted: true });
          }
          break;

        case 'NODE_MOVED':
        case 'CRDT_NODE_MOVED':
          if (nodes.has(payload.nodeId)) {
            const node = nodes.get(payload.nodeId);
            nodes.set(payload.nodeId, {
              ...node,
              x: payload.x,
              y: payload.y,
            });
          }
          break;

        case 'LOCK_NODE':
          if (nodes.has(payload.nodeId)) {
            const node = nodes.get(payload.nodeId);
            nodes.set(payload.nodeId, {
              ...node,
              locked: payload.locked,
              lockedBy: payload.lockedBy,
            });
          }
          break;

        case 'RESET':
          nodes.clear();
          break;
      }
    }

    // Filter out deleted nodes and convert to array
    const activeNodes = Array.from(nodes.values()).filter(node => !node.deleted);

    console.log(`[CanvasService] Returning ${activeNodes.length} active nodes from event replay`);

    return {
      nodes: activeNodes,
      version: latestEventId,
      source: 'events',
    };
  } catch (error) {
    console.error('[CanvasService] Database error in getCanvasState:', error.message);
    console.warn('[CanvasService] Falling back to empty state (using in-memory Yjs only)');
    
    // Fallback: Return empty state when database is unavailable
    // Real-time sync will still work via Yjs WebSocket
    return {
      nodes: [],
      version: 0,
      fallback: true,
      message: 'Database unavailable - using real-time sync only'
    };
  }
}

/**
 * Export canvas summary using Groq AI (Llama 3)
 * Summarizes all canvas nodes into a coherent document
 * @param {string} roomId - Room ID
 * @returns {Promise<string>} Markdown summary
 */
async function exportCanvasSummary(roomId) {
  // Get current canvas state
  const { nodes } = await getCanvasState(roomId);

  if (nodes.length === 0) {
    return '# Canvas Summary\n\nNo content available.';
  }

  // Prepare node content for summarization
  const nodeContents = nodes.map((node, index) => {
    // Extract text from different node formats
    let text = 'No content';
    
    // Try to get text from various possible locations
    if (node.text) {
      text = node.text;
    } else if (node.content) {
      // Handle content as object
      if (typeof node.content === 'string') {
        try {
          // Try to parse if it's a JSON string
          const parsed = JSON.parse(node.content);
          text = parsed.text || parsed.value || parsed.label || node.content;
        } catch {
          text = node.content;
        }
      } else if (typeof node.content === 'object' && node.content !== null) {
        // Extract text from content object
        text = node.content.text || 
               node.content.value || 
               node.content.label || 
               node.content.content ||
               'No text content';
      }
    }
    
    // Build node description
    const nodeType = node.type || 'unknown';
    const nodeInfo = [];
    
    if (text && text !== 'No content' && text !== 'No text content') {
      nodeInfo.push(`Text: "${text}"`);
    }
    
    if (node.intent) {
      nodeInfo.push(`Intent: ${node.intent}`);
    }
    
    if (node.taskStatus) {
      nodeInfo.push(`Task Status: ${node.taskStatus}`);
    }
    
    const description = nodeInfo.length > 0 ? nodeInfo.join(', ') : 'Empty node';
    
    return `Node ${index + 1} (${nodeType}): ${description}`;
  }).join('\n\n');

  try {
    const prompt = `You are summarizing a collaborative canvas workspace. Below are all the nodes from the canvas. Create a well-structured markdown summary that:

1. Groups related content together
2. Identifies key decisions, action items, and questions
3. Provides a coherent narrative of the canvas content
4. Uses proper markdown formatting with headers and lists

Canvas Nodes:
${nodeContents}

Generate a comprehensive summary in markdown format:`;

    // Call Groq API with Llama 3
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile', // Fast and powerful
      temperature: 0.7,
      max_tokens: 2048,
    });

    const summary = chatCompletion.choices[0]?.message?.content || '';

    // Add metadata header
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { name: true, createdAt: true },
    });

    const header = `# Canvas Summary: ${room?.name || 'Untitled'}\n\n**Generated:** ${new Date().toISOString()}\n**Total Nodes:** ${nodes.length}\n**AI Model:** Llama 3.3 70B (Groq)\n\n---\n\n`;

    return header + summary;
  } catch (error) {
    console.error('Canvas summary export error:', error);
    
    // Fallback: simple list of nodes
    const fallbackSummary = `# Canvas Summary\n\n**Total Nodes:** ${nodes.length}\n\n## Content\n\n${nodeContents}`;
    return fallbackSummary;
  }
}

module.exports = {
  getCanvasState,
  exportCanvasSummary,
};
