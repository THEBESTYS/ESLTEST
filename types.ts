
export enum CEFRLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2'
}

export interface Sentence {
  id: number;
  text: string;
  difficulty: number; // 1 to 5
}

export interface EvaluationResult {
  accuracy: number;
  intonation: number;
  fluency: number;
  transcribed: string;
  feedback: string;
}

export interface TestAttempt {
  id: string;
  date: string;
  overallScore: number;
  level: CEFRLevel;
  details: {
    avgAccuracy: number;
    avgIntonation: number;
    avgFluency: number;
  };
  individualScores: EvaluationResult[];
}

export interface LevelCriteria {
  min: number;
  max: number;
  label: string;
  description: string;
  color: string;
}
