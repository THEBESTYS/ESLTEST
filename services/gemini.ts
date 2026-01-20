
import { GoogleGenAI, Type } from "@google/genai";
import { EvaluationResult } from "../types";

const EVALUATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    accuracy: { type: Type.NUMBER, description: "Score from 0 to 100 representing how accurately the user spoke the target sentence." },
    intonation: { type: Type.NUMBER, description: "Score from 0 to 100 for rhythm and musicality of speech." },
    fluency: { type: Type.NUMBER, description: "Score from 0 to 100 for smoothness and speed." },
    transcribed: { type: Type.STRING, description: "The transcribed text of what the user actually said." },
    feedback: { type: Type.STRING, description: "A short, helpful feedback sentence in Korean for improvement." },
  },
  required: ["accuracy", "intonation", "fluency", "transcribed", "feedback"],
};

export class AIEvaluator {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  }

  async analyzeSpeech(audioBlob: Blob, targetText: string): Promise<EvaluationResult> {
    const reader = new FileReader();
    const base64AudioPromise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(audioBlob);
    });

    const base64Data = await base64AudioPromise;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: audioBlob.type,
                  data: base64Data,
                },
              },
              {
                text: `You are an English pronunciation coach. The user was supposed to say: "${targetText}".
                Evaluate the provided audio based on the target text.
                Provide the evaluation in JSON format including accuracy (0-100), intonation (0-100), fluency (0-100), the transcribed text, and a short helpful feedback in Korean.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: EVALUATION_SCHEMA,
        },
      });

      const resultText = response.text || "";
      return JSON.parse(resultText) as EvaluationResult;
    } catch (error) {
      console.error("AI Evaluation failed:", error);
      // Fallback
      return {
        accuracy: 0,
        intonation: 0,
        fluency: 0,
        transcribed: "[Error analyzing audio]",
        feedback: "오류가 발생했습니다. 다시 시도해 주세요.",
      };
    }
  }
}
