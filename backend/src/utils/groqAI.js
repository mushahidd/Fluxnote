// Groq AI helper for Llama 3 integration
const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Call Groq AI with Llama 3 model
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Optional configuration
 * @returns {Promise<string>} AI response
 */
async function callGroq(prompt, options = {}) {
  try {
    const {
      model = 'llama-3.3-70b-versatile',
      temperature = 0.7,
      maxTokens = 1024,
      responseFormat = null,
    } = options;

    const requestOptions = {
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model,
      temperature,
      max_tokens: maxTokens,
    };

    // Add response format if specified (for JSON responses)
    if (responseFormat) {
      requestOptions.response_format = responseFormat;
    }

    const chatCompletion = await groq.chat.completions.create(requestOptions);

    return chatCompletion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Groq AI API error:', error.message);
    throw new Error('AI API call failed');
  }
}

/**
 * Call Groq with conversation history
 * @param {Array} messages - Array of {role, content} messages
 * @param {Object} options - Optional configuration
 * @returns {Promise<string>} AI response
 */
async function callGroqWithHistory(messages, options = {}) {
  try {
    const {
      model = 'llama-3.3-70b-versatile',
      temperature = 0.7,
      maxTokens = 1024,
      responseFormat = null,
    } = options;

    const requestOptions = {
      messages,
      model,
      temperature,
      max_tokens: maxTokens,
    };

    // Add response format if specified
    if (responseFormat) {
      requestOptions.response_format = responseFormat;
    }

    const chatCompletion = await groq.chat.completions.create(requestOptions);

    return chatCompletion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Groq AI API error:', error.message);
    throw new Error('AI API call failed');
  }
}

/**
 * Available Groq models
 */
const GROQ_MODELS = {
  LLAMA_70B: 'llama-3.3-70b-versatile', // Best for complex tasks
  LLAMA_8B: 'llama-3.1-8b-instant',     // Fastest for simple tasks
  MIXTRAL: 'mixtral-8x7b-32768',        // Good for long context
};

module.exports = {
  callGroq,
  callGroqWithHistory,
  GROQ_MODELS,
};
