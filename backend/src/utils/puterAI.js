// Puter.js AI API helper for Grok integration
const axios = require('axios');

const PUTER_API_URL = 'https://api.puter.com/drivers/call';

/**
 * Call Puter.js AI API with Grok model
 * @param {string} prompt - The prompt to send
 * @param {string} model - Model to use (default: grok-beta)
 * @returns {Promise<string>} AI response
 */
async function callGrok(prompt, model = 'grok-beta') {
  try {
    const response = await axios.post(PUTER_API_URL, {
      interface: 'puter-chat-completion',
      driver: 'x-ai',
      method: 'complete',
      args: {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        model
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PUTER_API_KEY}`
      },
      timeout: 30000 // 30 second timeout
    });

    return response.data.message.content;
  } catch (error) {
    console.error('Puter.js AI API error:', error.response?.data || error.message);
    throw new Error('AI API call failed');
  }
}

/**
 * Call Grok with conversation history
 * @param {Array} messages - Array of {role, content} messages
 * @param {string} model - Model to use
 * @returns {Promise<string>} AI response
 */
async function callGrokWithHistory(messages, model = 'grok-beta') {
  try {
    const response = await axios.post(PUTER_API_URL, {
      interface: 'puter-chat-completion',
      driver: 'x-ai',
      method: 'complete',
      args: {
        messages,
        model
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PUTER_API_KEY}`
      },
      timeout: 30000
    });

    return response.data.message.content;
  } catch (error) {
    console.error('Puter.js AI API error:', error.response?.data || error.message);
    throw new Error('AI API call failed');
  }
}

module.exports = {
  callGrok,
  callGrokWithHistory,
};
