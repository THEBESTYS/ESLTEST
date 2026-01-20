
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEST_SENTENCES } from '../constants';
import { AudioManager } from '../services/audio';
import { AIEvaluator } from '../services/gemini';
import { StorageManager } from '../services/storage';
import { EvaluationResult, TestAttempt, CEFRLevel } from '../types';

const audioManager = new AudioManager();
const aiEvaluator = new AIEvaluator();

const Test: React.FC = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [currentAudio, setCurrentAudio] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  const currentSentence = TEST_SENTENCES[currentIndex];
  const progress = ((currentIndex) / TEST_SENTENCES.length) * 100;

  const handleStartRecording = async () => {
    try {
      setPermissionError(false);
      await audioManager.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error("Recording failed to start", error);
      setPermissionError(true);
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setIsAnalyzing(true);
    try {
      const audioBlob = await audioManager.stopRecording();
      setCurrentAudio(audioBlob);

      const evaluation = await aiEvaluator.analyzeSpeech(audioBlob, currentSentence.text);
      setResults(prev => [...prev, evaluation]);

      // Automatic next after a brief delay
      setTimeout(() => {
        if (currentIndex < TEST_SENTENCES.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setIsAnalyzing(false);
          setCurrentAudio(null);
        } else {
          finishTest([...results, evaluation]);
        }
      }, 1500);
    } catch (error) {
      console.error("Evaluation failed", error);
      setIsAnalyzing(false);
    }
  };

  const finishTest = (finalResults: EvaluationResult[]) => {
    const avgAccuracy = finalResults.reduce((acc, r) => acc + r.accuracy, 0) / finalResults.length;
    const avgIntonation = finalResults.reduce((acc, r) => acc + r.intonation, 0) / finalResults.length;
    const avgFluency = finalResults.reduce((acc, r) => acc + r.fluency, 0) / finalResults.length;
    const overallScore = (avgAccuracy + avgIntonation + avgFluency) / 3;

    let level = CEFRLevel.A1;
    if (overallScore > 95) level = CEFRLevel.C2;
    else if (overallScore > 80) level = CEFRLevel.C1;
    else if (overallScore > 60) level = CEFRLevel.B2;
    else if (overallScore > 40) level = CEFRLevel.B1;
    else if (overallScore > 20) level = CEFRLevel.A2;

    const attempt: TestAttempt = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      overallScore,
      level,
      details: {
        avgAccuracy,
        avgIntonation,
        avgFluency
      },
      individualScores: finalResults
    };

    StorageManager.saveAttempt(attempt);
    navigate(`/result/${attempt.id}`);
  };

  if (permissionError) {
    return (
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold mb-4">마이크 권한이 필요합니다</h2>
          <p className="text-slate-600 mb-6">스피킹 테스트를 진행하려면 브라우저의 마이크 접근 권한을 허용해 주세요.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Step {currentIndex + 1} of {TEST_SENTENCES.length}
            </span>
            <span className="text-sm font-bold text-blue-600">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Main Test Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden">
          <div className="p-8 md:p-12 text-center">
            <div className="mb-8">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold mb-4 uppercase">
                Difficulty: {currentSentence.difficulty}
              </span>
              <h2 className="text-2xl md:text-4xl font-bold text-slate-800 leading-tight">
                "{currentSentence.text}"
              </h2>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center space-y-6">
              {!isAnalyzing ? (
                <div className="relative">
                  <button
                    onMouseDown={handleStartRecording}
                    onMouseUp={handleStopRecording}
                    onTouchStart={handleStartRecording}
                    onTouchEnd={handleStopRecording}
                    className={`
                      w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg
                      ${isRecording ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}
                    `}
                  >
                    {isRecording ? (
                      <div className="w-8 h-8 bg-white rounded-sm animate-pulse" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                  {isRecording && (
                    <div className="absolute -top-2 -right-2">
                      <span className="flex h-6 w-6 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500"></span>
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-blue-600 font-bold">AI가 분석 중입니다...</p>
                </div>
              )}

              <div className="text-slate-500 text-sm font-medium">
                {isRecording ? "녹음 중... 손을 떼면 완료됩니다" : "버튼을 누르고 문장을 소리 내어 읽으세요"}
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className="bg-slate-50 p-6 border-t border-slate-100">
            <div className="flex items-start space-x-3">
              <div className="text-blue-500 mt-0.5">💡</div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Speaking Tip</h4>
                <p className="text-xs text-slate-500 mt-1">
                  너무 빨리 읽기보다는 단어 하나하나의 발음과 전체적인 억양에 신경 써 보세요. 자연스러운 호흡이 중요합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Test;
