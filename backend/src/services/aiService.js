// AI Service - Groq-powered intent classification
// Classifies node text into: Action, Decision, Question, Reference

const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Classify node text intent using Groq AI (Llama 3.3 70B)
 * @param {string} text - The text to classify
 * @returns {Promise<string>} - One of: "Action", "Decision", "Question", "Reference"
 */
async function classifyNodeIntent(text) {
  if (!text || text.trim().length === 0) {
    return 'Reference';
  }

  try {
    const prompt = `Classify the following text as exactly one of these categories: Action, Decision, Question, Reference. Reply with only the single word, nothing else.

Text: ${text}`;

    // Call Groq API with Llama 3.3 70B
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile', // Fast and powerful
      temperature: 0.3, // Lower temperature for consistent classification
      max_tokens: 10, // We only need one word
    });

    // Parse response
    const responseText = chatCompletion.choices[0]?.message?.content || 'Reference';
    const intent = responseText.trim();
    
    // Validate and capitalize
    const validIntents = ['Action', 'Decision', 'Question', 'Reference'];
    const normalized = intent.charAt(0).toUpperCase() + intent.slice(1).toLowerCase();
    
    if (validIntents.includes(normalized)) {
      return normalized;
    }
    
    // Fallback
    return 'Reference';
  } catch (error) {
    console.error('[aiService] Intent classification error:', error.message);
    // Fallback to Reference on error
    return 'Reference';
  }
}

/**
 * Summarize a collaborative session with structured output
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} Structured summary with decisions, tasks, questions, themes, and markdown
 */
async function summarizeSession(roomId) {
  const prisma = require('../db/prisma');
  
  try {
    // 1. Fetch all canvas nodes for the room
    const nodes = await prisma.canvasNode.findMany({
      where: { roomId },
      include: { 
        author: { 
          select: { name: true, email: true } 
        } 
      },
    });

    // 2. Fetch all tasks for the room
    const tasks = await prisma.task.findMany({
      where: { roomId },
      include: { 
        author: { 
          select: { name: true, email: true } 
        } 
      },
    });

    // 3. CRITICAL: Serialize nodes to plain readable text
    // This prevents [object Object] bug
    const nodeLines = nodes
      .filter(n => {
        // Extract text from various possible locations
        let hasText = false;
        if (n.text && n.text.trim() !== '') hasText = true;
        if (n.content && typeof n.content === 'object' && n.content.text) hasText = true;
        return hasText;
      })
      .map(n => {
        const intent = n.intent || 'Unknown';
        const author = n.author?.name || n.author?.email || 'Unknown';
        
        // Extract text safely
        let text = '';
        if (typeof n.text === 'string') {
          text = n.text.trim();
        } else if (n.content && typeof n.content === 'object') {
          text = n.content.text || JSON.stringify(n.content);
        } else if (n.text) {
          text = JSON.stringify(n.text);
        }
        
        return `- [${intent}] "${text}" (by ${author})`;
      })
      .join('\n');

    const taskLines = tasks
      .map(t => {
        const author = t.author?.name || t.author?.email || 'Unknown';
        const title = typeof t.text === 'string' ? t.text : JSON.stringify(t.text);
        return `- ${title} (assigned to: ${author}, status: ${t.status})`;
      })
      .join('\n');

    // 4. Build clean string prompt — NO raw objects anywhere
    const prompt = `You are summarizing a collaborative brainstorming session.

Return a JSON object with this exact structure, nothing else:
{
  "decisions": ["decision 1", "decision 2"],
  "tasks": [{ "title": "task", "assignee": "name", "status": "todo" }],
  "questions": ["question 1", "question 2"],
  "themes": "2-3 sentence summary of main topics",
  "markdown": "Full formatted markdown summary of the session"
}

CANVAS NODES FROM THE SESSION:
${nodeLines || 'No nodes found.'}

TASKS CREATED:
${taskLines || 'No tasks found.'}

Please produce a structured summary with these exact sections in the markdown:
## Decisions Made
List all Decision-type notes as bullet points.

## Tasks Assigned
List all tasks with who they are assigned to and current status.

## Open Questions
List all Question-type notes as bullet points.

## Key Themes
2-3 sentences summarizing the main topics discussed.`;

    // 5. Call Groq API with the clean string prompt
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    
    // 6. Parse JSON safely
    try {
      // Remove markdown code fences if present
      const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      return {
        decisions: parsed.decisions || [],
        tasks: parsed.tasks || [],
        questions: parsed.questions || [],
        themes: parsed.themes || 'No themes identified.',
        markdown: parsed.markdown || raw,
      };
    } catch (parseError) {
      console.error('[aiService] Failed to parse AI response as JSON:', parseError.message);
      
      // Fallback: return raw response as markdown
      return {
        decisions: [],
        tasks: [],
        questions: [],
        themes: 'Could not parse summary.',
        markdown: raw,
      };
    }
  } catch (error) {
    console.error('[aiService] Session summary error:', error.message);
    throw error;
  }
}

module.exports = {
  classifyNodeIntent,
  summarizeSession,
};
