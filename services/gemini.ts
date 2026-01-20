
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
  private ai: GoogleGenAI | null = null;

  constructor() {
    // API_KEY는 환경 변수에서 주입됩니다.
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn("API_KEY not found in environment variables.");
    }
  }

  async analyzeSpeech(audioBlob: Blob, targetText: string): Promise<EvaluationResult> {
    if (!this.ai) {
      return {
        accuracy: 0,
        intonation: 0,
        fluency: 0,
        transcribed: "[API Key missing]",
        feedback: "API 키 설정이 필요합니다.",
      };
    }

    const reader = new FileReader();
    const base64AudioPromise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
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

      const resultText = response.text || "{}";
      return JSON.parse(resultText) as EvaluationResult;
    } catch (error) {
      console.error("AI Evaluation failed:", error);
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
