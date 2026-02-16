// AI Configuration and Defaults
export const AI_CONFIG = {
  // OpenAI Models
  OPENAI_MODELS: {
    GPT4: 'gpt-4o',
    GPT4_MINI: 'gpt-4o-mini',
    GPT35: 'gpt-3.5-turbo',
  },
  
  // Ollama Models
  OLLAMA_MODELS: {
    LLAMA3: 'llama3.2',
    LLAMA3_70B: 'llama3.1:70b',
    MISTRAL: 'mistral',
    CODELLAMA: 'codellama',
  },
  
  // Default Settings
  DEFAULTS: {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 500,
    TOP_P: 1,
    FREQUENCY_PENALTY: 0,
    PRESENCE_PENALTY: 0,
  },
  
  // Lead Scoring Weights
  LEAD_SCORING: {
    ENGAGEMENT: {
      EMAIL_OPEN: 5,
      EMAIL_CLICK: 10,
      MESSAGE_REPLY: 20,
      WEBSITE_VISIT: 15,
      FORM_SUBMIT: 25,
    },
    DEMOGRAPHIC: {
      PHONE_VERIFIED: 10,
      EMAIL_VERIFIED: 5,
      PROFILE_COMPLETE: 15,
    },
    DECAY: {
      DAILY: 2, // Points lost per day of inactivity
      MAX_AGE_DAYS: 90,
    },
  },
  
  // Conversation Settings
  CONVERSATION: {
    MAX_HISTORY: 10,
    HANDOFF_KEYWORDS: ['human', 'agent', 'support', 'help', 'talk to someone'],
    SALE_KEYWORDS: ['buy', 'purchase', 'price', 'cost', 'payment', 'checkout'],
  },
  
  // Voice Settings
  VOICE: {
    OPENAI_VOICES: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    DEFAULT_VOICE: 'alloy',
  },
  
  // Template Categories with Prompts
  TEMPLATE_PROMPTS: {
    WELCOME: 'Create a warm, welcoming message for new leads',
    FOLLOW_UP: 'Create a follow-up message that adds value without being pushy',
    PROMOTIONAL: 'Create a compelling promotional message with clear CTA',
    APPOINTMENT: 'Create a professional appointment reminder message',
    PAYMENT: 'Create a friendly payment reminder or checkout message',
    REVIVAL: 'Create a message to re-engage a dormant lead',
  },
};

// System Prompts for Different AI Tasks
export const SYSTEM_PROMPTS = {
  LEAD_QUALIFICATION: `You are an expert sales qualification AI. Your job is to:
1. Ask relevant questions to understand the lead's needs
2. Identify buying intent signals
3. Score the lead's potential (cold, warm, hot)
4. Suggest next best actions

Be conversational, helpful, and professional. Don't be pushy.`,

  WHATSAPP_ASSISTANT: `You are a helpful WhatsApp business assistant. You help customers with:
- Product information
- Answering questions
- Booking appointments
- Processing simple requests

Keep responses concise (under 300 characters when possible) and conversational. Use emojis appropriately.`,

  EMAIL_COPYWRITER: `You are an expert email marketing copywriter. You write:
- Compelling subject lines
- Engaging email body copy
- Clear call-to-actions

Focus on benefits, not features. Use persuasive but not pushy language.`,

  VOICE_SALES: `You are a friendly sales representative making outbound calls. You:
1. Introduce yourself and the company
2. Qualify the prospect
3. Present relevant solutions
4. Handle objections professionally
5. Close for next steps (appointment, demo, or sale)

Speak naturally and conversationally. Listen more than you talk.`,

  LEAD_REVIVAL: `You are a re-engagement specialist. You craft messages that:
1. Acknowledge the time gap
2. Provide new value or updates
3. Make it easy to re-engage
4. Don't make the lead feel guilty

Be friendly, helpful, and low-pressure.`,

  INTENT_DETECTION: `Analyze the following message and identify:
1. Primary intent (question, complaint, interest, purchase, unsubscribe)
2. Sentiment (positive, neutral, negative)
3. Urgency (low, medium, high)
4. Suggested response type

Respond in JSON format.`,
};
