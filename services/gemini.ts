
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
      return this.getErrorResult("API 연결 설정 중입니다. 버튼을 다시 한 번 눌러주시거나 잠시만 기다려주세요.");
    }

    try {
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
        return this.getErrorResult("구글 프로젝트 설정이 아직 서버에 반영 중입니다. 10초 정도 후에 다시 시도해주세요.");
      }
      if (errMsg.includes("API key") || errMsg.includes("403")) {
        return this.getErrorResult("API 키가 아직 활성화되지 않았습니다. 프로젝트 선택창에서 결제 정보가 포함된 프로젝트인지 다시 한 번 확인해주세요.");
      }
      
      return this.getErrorResult("음성 분석 중 일시적인 오류가 발생했습니다. 다시 한 번 녹음해 주세요.");
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
