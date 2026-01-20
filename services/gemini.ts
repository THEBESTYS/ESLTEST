
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
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      const aiStudio = (window as any).aistudio;
      if (aiStudio) await aiStudio.openSelectKey();
      return this.getErrorResult("분석을 위해 API 키 선택이 필요합니다.");
    }

    try {
      // 분석 호출마다 새로운 인스턴스를 생성하여 최신 주입된 키를 사용하도록 함
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
                text: `You are an English teacher. Evaluate this audio based on the text: "${targetText}". Return JSON with scores (0-100) for accuracy, intonation, fluency, the transcription, and Korean feedback.`,
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
      if (!resultText) throw new Error("AI returned empty response");

      return JSON.parse(resultText.trim()) as EvaluationResult;
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      
      const errorMessage = error.message || "";
      // 특정 API 키 관련 오류(Requested entity was not found 등) 대응
      if (errorMessage.includes("Requested entity was not found") || 
          errorMessage.includes("API key") || 
          errorMessage.includes("403")) {
        
        const aiStudio = (window as any).aistudio;
        if (aiStudio) await aiStudio.openSelectKey();
        return this.getErrorResult("API 키 프로젝트가 올바르지 않거나 유료 설정이 필요합니다. 다시 선택해주세요.");
      }
      
      return this.getErrorResult("일시적인 오류가 발생했습니다. 다시 시도해 주세요.");
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
