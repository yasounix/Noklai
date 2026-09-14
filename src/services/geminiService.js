import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
});

export async function askGemini(message) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: message,
    });

    return response.text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}