
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
  async analyzeSpeech(audioBlob: Blob, targetText: string): Promise<EvaluationResult> {
    // API_KEY는 시스템에 의해 process.env.API_KEY로 자동 주입됩니다.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error("API_KEY is not available in the environment.");
      return this.getErrorResult("API 키를 찾을 수 없습니다. 환경 설정을 확인해주세요.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Blob 데이터를 Base64로 변환
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: base64Data,
                },
              },
              {
                text: `You are an English pronunciation coach. The user was supposed to say: "${targetText}".
                Evaluate the provided audio based on the target text.
                Compare the audio with the target text carefully.
                Provide the evaluation in JSON format according to the schema.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: EVALUATION_SCHEMA,
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Empty response from AI");
      }

      return JSON.parse(resultText) as EvaluationResult;
    } catch (error) {
      console.error("AI Evaluation failed:", error);
      return this.getErrorResult("분석 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  }

  private getErrorResult(message: string): EvaluationResult {
    return {
      accuracy: 0,
      intonation: 0,
      fluency: 0,
      transcribed: "[Error]",
      feedback: message,
    };
  }
}
