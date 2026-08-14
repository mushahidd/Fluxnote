// classifyNodeIntent(text) → calls Groq AI (Llama 3)
//   Prompt: "Classify this text as one of: action_item, decision, question, reference.
//            Return JSON: { intent, confidence }"
//   If intent === "action_item": call eventService.insertEvent("TASK_CREATED", ...)
//   Debounce: only call AI after user stops typing for 1500ms
//   Returns: { intent: "action_item" | "decision" | "question" | "reference" }

const Groq = require('groq-sdk');
const eventService = require('./eventService');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Debounce map: nodeId -> timeout
const debounceTimers = new Map();
const DEBOUNCE_DELAY = 1500;

/**
 * Classify node text intent using Groq AI (Llama 3) with debouncing
 * @param {string} text - The node text to classify
 * @param {string} nodeId - The node ID
 * @param {string} roomId - The room ID
 * @param {string} userId - The user ID who created/updated the node
 * @returns {Promise<{intent: string, confidence: number}>}
 */
async function classifyNodeIntent(text, nodeId, roomId, userId) {
  return new Promise((resolve, reject) => {
    // Clear existing timer for this node
    if (debounceTimers.has(nodeId)) {
      clearTimeout(debounceTimers.get(nodeId));
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      try {
        const result = await performClassification(text, nodeId, roomId, userId);
        debounceTimers.delete(nodeId);
        resolve(result);
      } catch (error) {
        debounceTimers.delete(nodeId);
        reject(error);
      }
    }, DEBOUNCE_DELAY);

    debounceTimers.set(nodeId, timer);
  });
}

/**
 * Perform the actual classification using Groq AI (Llama 3)
 */
async function performClassification(text, nodeId, roomId, userId) {
  if (!text || text.trim().length === 0) {
    return { intent: 'reference', confidence: 1.0 };
  }

  try {
    const prompt = `Classify the following text into one of these categories: action_item, decision, question, reference.

Rules:
- action_item: Tasks, todos, things that need to be done
- decision: Conclusions, agreements, resolved choices
- question: Queries, uncertainties, things needing answers
- reference: Information, notes, documentation, links

Return ONLY valid JSON in this exact format:
{"intent": "category", "confidence": 0.95}

Text to classify: "${text}"`;

    // Call Groq API with Llama 3
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile', // Fast and accurate
      temperature: 0.3, // Lower temperature for more consistent classification
      max_tokens: 100,
      response_format: { type: 'json_object' }, // Force JSON response
    });

    // Parse Groq's response
    const responseText = chatCompletion.choices[0]?.message?.content || '{}';
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[^}]+\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw parseError;
      }
    }

    // Validate response
    const validIntents = ['action_item', 'decision', 'question', 'reference'];
    if (!validIntents.includes(result.intent)) {
      result.intent = 'reference';
      result.confidence = 0.5;
    }

    // Ensure confidence is a number
    if (typeof result.confidence !== 'number') {
      result.confidence = parseFloat(result.confidence) || 0.5;
    }

    // If classified as action_item, create a task
    if (result.intent === 'action_item' && result.confidence > 0.7) {
      // Insert event for audit log
      await eventService.insertEvent('TASK_CREATED', {
        nodeId,
        text,
        status: 'todo',
      }, userId, roomId);

      // Also create a real Task record so GET /api/tasks/:roomId returns it
      try {
        const prisma = require('../db/prisma');
        const existing = await prisma.task.findFirst({ where: { nodeId } });
        if (!existing) {
          const task = await prisma.task.create({
            data: { text, authorId: userId, nodeId, roomId, status: 'todo' },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                }
              }
            }
          });

          // Broadcast task creation to all users in room via WebSocket
          const { broadcast } = require('../ws/wsServer');
          broadcast(roomId, {
            type: 'task:created',
            task: {
              id: task.id,
              text: task.text,
              status: task.status,
              nodeId: task.nodeId,
              authorId: task.authorId,
              authorName: task.author?.name || task.author?.email || 'Unknown',
              roomId: task.roomId,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
            },
          });

          console.log(`[IntentService] Task created and broadcasted for node ${nodeId}`);
        }
      } catch (dbErr) {
        console.error('Failed to create Task record:', dbErr.message);
      }
    }

    return result;
  } catch (error) {
    console.error('Intent classification error:', error.message);
    // Fallback to reference on error
    return { intent: 'reference', confidence: 0.0 };
  }
}

/**
 * Cancel pending classification for a node
 */
function cancelClassification(nodeId) {
  if (debounceTimers.has(nodeId)) {
    clearTimeout(debounceTimers.get(nodeId));
    debounceTimers.delete(nodeId);
  }
}

module.exports = {
  classifyNodeIntent,
  cancelClassification,
};
