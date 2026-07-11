import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateStrategy = async (prompt: string): Promise<string> => {
  if (!apiKey) {
    return "Error: Gemini API Key is missing. Please check your environment variables.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert Agar.io strategy assistant for a botting application called XevBots.
      The user is asking: "${prompt}".
      Provide a concise, strategic, and technical answer suitable for a bot operator.
      Keep it under 150 words.`,
    });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to communicate with AI Assistant. Please try again later.";
  }
};