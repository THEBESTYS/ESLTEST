
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
    // 호출 시점에 주입된 최신 API KEY를 사용합니다.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
      return this.getErrorResult("API_KEY_MISSING");
    }

    try {
      // 매번 새로운 인스턴스를 생성하여 세션 동기화 문제를 방지합니다.
      const ai = new GoogleGenAI({ apiKey });

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

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
                text: `Evaluate this English speaking for the sentence: "${targetText}". Return JSON with accuracy, intonation, fluency (0-100), transcribed text, and Korean feedback.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: EVALUATION_SCHEMA,
          temperature: 0.1,
        },
      });

      const resultText = response.text;
      if (!resultText) throw new Error("Empty response");

      return JSON.parse(resultText.trim()) as EvaluationResult;
    } catch (error: any) {
      console.error("Gemini API Error Detail:", error);
      
      const errMsg = error.message || "";
      
      // 프로젝트 생성 직후 또는 유효하지 않은 프로젝트일 때 발생하는 핵심 에러
      if (errMsg.includes("Requested entity was not found")) {
        return this.getErrorResult("API_PROJECT_PENDING");
      }
      
      if (errMsg.includes("API key") || errMsg.includes("403") || errMsg.includes("invalid")) {
        return this.getErrorResult("API_KEY_INVALID");
      }
      
      return this.getErrorResult("분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  private getErrorResult(message: string): EvaluationResult {
    return {
      accuracy: 0,
      intonation: 0,
      fluency: 0,
      transcribed: "[분석 실패]",
      feedback: message,
    };
  }
}
