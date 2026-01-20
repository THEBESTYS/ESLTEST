
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
    // 환경 변수로부터 API 키를 안전하게 가져옵니다.
    const apiKey = (window as any).process?.env?.API_KEY || (process as any)?.env?.API_KEY;
    
    if (!apiKey) {
      console.error("Critical: API_KEY is missing from the environment.");
      return this.getErrorResult("API 키가 설정되지 않았습니다. 관리자에게 문의하세요.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      // Blob 데이터를 Base64로 변환
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

      // 발음 분석을 위해 더 강력한 Gemini 3 Pro 모델 사용
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
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
                text: `Evaluate the English speaking attempt. 
                Target Sentence: "${targetText}"
                Analyze the user's audio for:
                1. Accuracy: How correctly words are pronounced.
                2. Intonation: Rhythm, stress, and flow.
                3. Fluency: Smoothness and natural speed.
                
                Respond ONLY with a JSON object containing accuracy, intonation, fluency, transcribed text, and helpful feedback in Korean.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: EVALUATION_SCHEMA,
          temperature: 0.1, // 일관된 평가를 위해 낮은 창의성 설정
        },
      });

      const resultText = response.text;
      if (!resultText) throw new Error("No response text from Gemini");

      return JSON.parse(resultText.trim()) as EvaluationResult;
    } catch (error: any) {
      console.error("AI Evaluation failed:", error);
      
      // 구체적인 에러 메시지 처리
      if (error.message?.includes("403") || error.message?.includes("API key")) {
        return this.getErrorResult("API 키 권한 문제로 분석이 거부되었습니다.");
      }
      
      return this.getErrorResult("분석 중 오류가 발생했습니다. 다시 한번 녹음해 주세요.");
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
