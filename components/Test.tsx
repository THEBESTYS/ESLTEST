
import React, { useState, useEffect } from 'react';
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
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showKeyFixButton, setShowKeyFixButton] = useState(false);
  
  const [hasKey, setHasKey] = useState<boolean>(() => {
    return !!process.env.API_KEY || sessionStorage.getItem('ai_connected') === 'true';
  });

  useEffect(() => {
    const checkKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio && await aiStudio.hasSelectedApiKey()) {
        sessionStorage.setItem('ai_connected', 'true');
        if (!hasKey) setHasKey(true);
      }
    };
    checkKey();
  }, [hasKey]);

  const handleOpenKeySelector = async () => {
    setHasKey(true);
    sessionStorage.setItem('ai_connected', 'true');
    setErrorToast(null);
    setShowKeyFixButton(false);

    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      aiStudio.openSelectKey().catch(() => {});
    } else {
      window.open('https://aistudio.google.com/app/apikey', '_blank');
    }
  };

  const handleStartRecording = async () => {
    try {
      setErrorToast(null);
      setShowKeyFixButton(false);
      await audioManager.startRecording();
      setIsRecording(true);
    } catch (error) {
      setErrorToast("마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.");
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsAnalyzing(true);
    setErrorToast(null);

    try {
      const audioBlob = await audioManager.stopRecording();
      const evaluation = await aiEvaluator.analyzeSpeech(audioBlob, TEST_SENTENCES[currentIndex].text);
      
      // API 키 관련 특수 에러 처리
      if (evaluation.feedback === "API_KEY_MISSING" || evaluation.feedback === "API_KEY_INVALID") {
        setErrorToast("구글 AI 프로젝트가 아직 연결되지 않았거나 승인 대기 중입니다.");
        setShowKeyFixButton(true);
        setIsAnalyzing(false);
        return;
      }

      // 일반 분석 실패
      if (evaluation.accuracy === 0 && evaluation.transcribed === "[분석 실패]") {
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
      }, 500);
    } catch (error: any) {
      setErrorToast("네트워크 상태를 확인하고 다시 시도해 주세요.");
      setIsAnalyzing(false);
    }
  };

  const finishTest = (finalResults: EvaluationResult[]) => {
    const avgAccuracy = finalResults.reduce((acc, r) => acc + r.accuracy, 0) / finalResults.length;
    const avgIntonation = finalResults.reduce((acc, r) => acc + r.intonation, 0) / finalResults.length;
    const avgFluency = finalResults.reduce((acc, r) => acc + r.fluency, 0) / finalResults.length;
    const overallScore = (avgAccuracy + avgIntonation + avgFluency) / 3;

    let level = CEFRLevel.A1;
    if (overallScore > 90) level = CEFRLevel.C2;
    else if (overallScore > 75) level = CEFRLevel.C1;
    else if (overallScore > 55) level = CEFRLevel.B2;
    else if (overallScore > 35) level = CEFRLevel.B1;
    else if (overallScore > 15) level = CEFRLevel.A2;

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

  if (!hasKey) {
    return (
      <div className="flex-grow flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100 p-10 border border-slate-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">🚀</div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">테스트 준비 완료</h2>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">
              구글 AI 프로젝트 선택을 완료하셨다면,<br/>아래 버튼을 눌러 즉시 테스트를 시작합니다.
            </p>
          </div>
          <button 
            onClick={handleOpenKeySelector}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center justify-center space-x-3"
          >
            <span>테스트 시작하기</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2 text-sm font-bold">
            <span className="text-slate-400 uppercase tracking-tighter">Sentence {currentIndex + 1} / 50</span>
            <span className="text-blue-600">{Math.round((currentIndex / 50) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${(currentIndex / 50) * 100}%` }} />
          </div>
        </div>

        {errorToast && (
          <div className="mb-6 p-6 bg-white border-2 border-amber-100 shadow-xl shadow-amber-50 rounded-[2rem] text-center">
            <div className="text-amber-600 font-bold mb-3 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {errorToast}
            </div>
            {showKeyFixButton ? (
              <button 
                onClick={handleOpenKeySelector}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-xl text-sm font-black transition-all shadow-md shadow-amber-100"
              >
                ✅ 프로젝트 다시 확인하기
              </button>
            ) : (
              <div className="text-xs text-slate-400">문장을 다시 한 번 천천히 읽어주세요.</div>
            )}
          </div>
        )}

        <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200 border border-slate-100 p-8 md:p-16 text-center">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 leading-tight">
              "{TEST_SENTENCES[currentIndex].text}"
            </h2>
          </div>

          <div className="flex flex-col items-center">
            {!isAnalyzing ? (
              <button
                onMouseDown={handleStartRecording}
                onMouseUp={handleStopRecording}
                onTouchStart={handleStartRecording}
                onTouchEnd={handleStopRecording}
                className={`group relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isRecording ? 'bg-red-500 scale-110' : 'bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100'
                }`}
              >
                {isRecording ? (
                  <div className="w-12 h-12 bg-white rounded-xl animate-pulse" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
                {isRecording && (
                  <div className="absolute inset-0 rounded-full border-8 border-red-200 animate-ping" />
                )}
              </button>
            ) : (
              <div className="flex flex-col items-center py-6">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6" />
                <p className="text-blue-600 font-black text-xl animate-pulse">발음 분석 중...</p>
              </div>
            )}
            <p className="mt-10 text-slate-400 font-bold text-lg">
              {isRecording ? "녹음 중... 손을 떼면 완료됩니다." : "버튼을 꾹 누르고 읽으세요."}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center space-y-2">
          <button 
            onClick={() => {
              if(confirm("연결을 다시 설정하시겠습니까? 초기화면으로 이동합니다.")) {
                sessionStorage.removeItem('ai_connected');
                window.location.reload();
              }
            }}
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-4"
          >
            AI 프로젝트 다시 연결하기
          </button>
          <div className="text-[10px] text-slate-300">
            * 프로젝트 선택 창에서 반드시 결제가 설정된 프로젝트를 선택해야 분석이 가능합니다.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Test;
