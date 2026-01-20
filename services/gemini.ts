
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
    // 매 호출마다 최신 API 키를 확인합니다.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey === "") {
      return this.getErrorResult("API_KEY_MISSING");
    }

    try {
      // 매번 새로운 인스턴스를 생성하여 키 업데이트를 반영합니다.
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
                text: `You are an English teacher. Evaluate this audio based on the text: "${targetText}". Return JSON with scores (0-100) for accuracy, intonation, fluency, the transcription, and Korean feedback. If the audio is too short or silent, provide low scores and mention it in feedback.`,
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
      console.error("AI Analysis error detail:", error);
      
      const errMsg = error.message || "";
      if (errMsg.includes("Requested entity was not found")) {
        return this.getErrorResult("구글 서버가 프로젝트 설정을 반영 중입니다. 약 5~10초만 기다린 후 다시 녹음해 주세요.");
      }
      if (errMsg.includes("API key") || errMsg.includes("403") || errMsg.includes("invalid")) {
        return this.getErrorResult("API_KEY_INVALID");
      }
      
      return this.getErrorResult("음성 분석 중 오류가 발생했습니다. 다시 한 번 녹음해 주시면 감사하겠습니다.");
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
