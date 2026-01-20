
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
    // 1. 시스템 주입 API Key 확인
    const apiKey = process.env.API_KEY;
    
    // 2. 키가 없는 경우 플랫폼 선택 도구 확인
    const aiStudio = (window as any).aistudio;
    if (!apiKey && aiStudio) {
      const hasKey = await aiStudio.hasSelectedApiKey();
      if (!hasKey) {
        await aiStudio.openSelectKey();
        // 키 선택 창을 연 후에는 사용자에게 다시 시도하도록 안내하는 것이 안전합니다.
        return this.getErrorResult("API 키가 설정되지 않았습니다. 상단 또는 팝업에서 키를 선택한 후 다시 시도해주세요.");
      }
    }

    if (!apiKey) {
      return this.getErrorResult("API 키를 찾을 수 없습니다. 환경 설정을 확인하거나 키를 선택해주세요.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (typeof result === 'string') {
            resolve(result.split(',')[1]);
          } else {
            reject(new Error("Failed to read audio blob as base64"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // 가장 빠르고 호환성이 좋은 gemini-3-flash-preview 모델 사용
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
                text: `You are an English speaking level evaluator. 
                Evaluate this audio based on the target sentence: "${targetText}".
                Return a JSON object with accuracy, intonation, fluency, transcribed text, and helpful feedback in Korean.`,
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
      if (!resultText) throw new Error("No response text from Gemini");

      return JSON.parse(resultText.trim()) as EvaluationResult;
    } catch (error: any) {
      console.error("AI Evaluation failed:", error);
      
      // API Key 관련 특정 에러 발생 시 키 선택 창 다시 호출
      if (error.message?.includes("API key") || error.message?.includes("not found")) {
        if (aiStudio) await aiStudio.openSelectKey();
        return this.getErrorResult("API 키가 유효하지 않거나 만료되었습니다. 키를 다시 선택해주세요.");
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
