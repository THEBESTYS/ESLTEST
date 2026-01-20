
import React, { useState } from 'react';
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
  const [permissionError, setPermissionError] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const currentSentence = TEST_SENTENCES[currentIndex];
  const progress = ((currentIndex) / TEST_SENTENCES.length) * 100;

  const handleOpenKeySelector = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      await aiStudio.openSelectKey();
      setErrorToast("키를 선택하셨다면 다시 녹음을 진행해주세요.");
    }
  };

  const handleStartRecording = async () => {
    try {
      setPermissionError(false);
      setErrorToast(null);
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
      const evaluation = await aiEvaluator.analyzeSpeech(audioBlob, currentSentence.text);
      
      if (evaluation.accuracy === 0 && evaluation.feedback.includes("API")) {
        setErrorToast(evaluation.feedback);
        setIsAnalyzing(false);
        return;
      }

      const newResults = [...results, evaluation];
      setResults(newResults);

      setTimeout(() => {
        if (currentIndex < TEST_SENTENCES.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setIsAnalyzing(false);
        } else {
          finishTest(newResults);
        }
      }, 800);
    } catch (error) {
      console.error("Evaluation failed", error);
      setErrorToast("분석에 실패했습니다. 다시 시도해 주세요.");
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
      details: { avgAccuracy, avgIntonation, avgFluency },
      individualScores: finalResults
    };

    StorageManager.saveAttempt(attempt);
    navigate(`/result/${attempt.id}`);
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-slate-500">Step {currentIndex + 1} of {TEST_SENTENCES.length}</span>
            <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Error Notification */}
        {errorToast && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between">
            <div className="flex items-center">
              <span className="mr-2">⚠️</span>
              <span className="text-sm font-medium">{errorToast}</span>
            </div>
            {errorToast.includes("API") && (
              <button 
                onClick={handleOpenKeySelector}
                className="ml-4 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm"
              >
                API 키 설정하기
              </button>
            )}
          </div>
        )}

        {/* Test Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden transition-all duration-300">
          <div className="p-8 md:p-12 text-center">
            <div className="mb-10">
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold mb-4 uppercase tracking-wider">
                Sentence {currentIndex + 1}
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed max-w-2xl mx-auto">
                "{currentSentence.text}"
              </h2>
            </div>

            <div className="flex flex-col items-center space-y-6">
              {!isAnalyzing ? (
                <div className="relative">
                  <button
                    onMouseDown={handleStartRecording}
                    onMouseUp={handleStopRecording}
                    onTouchStart={handleStartRecording}
                    onTouchEnd={handleStopRecording}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${
                      isRecording ? 'bg-red-500 scale-110 shadow-red-200 animate-pulse' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                    }`}
                  >
                    {isRecording ? (
                      <div className="w-8 h-8 bg-white rounded-sm" />
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
                <div className="flex flex-col items-center py-4">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-blue-600 font-bold">AI 분석 중...</p>
                </div>
              )}
              <p className="text-slate-400 text-sm font-medium">
                {isRecording ? "녹음 중입니다. 손을 떼면 분석이 시작됩니다." : "버튼을 누른 채로 문장을 읽어주세요."}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-6 border-t border-slate-100 flex items-center justify-center space-x-2 text-slate-500 text-xs">
            <span className="font-bold">TIP:</span>
            <span>정확한 발음도 중요하지만, 자연스러운 강세와 리듬에 신경 써보세요.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Test;
