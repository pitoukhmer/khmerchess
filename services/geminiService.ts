
import { GoogleGenAI } from "@google/genai";

// Fix: We instantiate GoogleGenAI inside each function to ensure 
// we always use the most up-to-date API key from the environment/dialog as per guidelines.

export const getCoachAnalysis = async (fen: string, lastMove: string): Promise<string> => {
  try {
    // Initialize GoogleGenAI right before the API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this chess position (FEN: ${fen}) after the move ${lastMove}. Give a concise "Coach Tip" for a Khmer Chess Community user. Be encouraging but technical.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    // Access the .text property directly on the GenerateContentResponse object
    return response.text || "Keep focusing on controlling the center!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The engine is currently analyzing the depths of your strategy.";
  }
};

export const getBotMove = async (fen: string, difficulty: 'easy' | 'pro'): Promise<string> => {
  try {
    // Initialize GoogleGenAI right before the API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a chess engine playing at ${difficulty} level. Current FEN: ${fen}. Return the best move in algebraic notation (e.g. e2e4). ONLY return the move string.`,
    });
    // Access the .text property and trim for output
    const text = response.text;
    return text?.trim() || "";
  } catch (error) {
    console.error("Bot Error:", error);
    return "";
  }
};
