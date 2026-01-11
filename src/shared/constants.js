export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export const DEFAULT_SETTINGS = {
  tweetsPerQuiz: 5,
  apiKey: '',
  removeVideos: false,
  viewTimeMs: 2000
};

export const QUIZ_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  FILL_BLANK: 'fill_blank'
};

export const MESSAGE_TYPES = {
  TWEETS_COLLECTED: 'TWEETS_COLLECTED',
  QUIZ_READY: 'QUIZ_READY',
  REQUEST_QUIZ: 'REQUEST_QUIZ',
  SUBMIT_ANSWER: 'SUBMIT_ANSWER',
  GET_STATS: 'GET_STATS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  GET_SETTINGS: 'GET_SETTINGS'
};
