
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
  
  // 초기 상태를 구글 시스템에 직접 물어봅니다.
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const checkActualKeyStatus = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio) {
        const isSelected = await aiStudio.hasSelectedApiKey();
        if (isSelected) {
          setHasKey(true);
        }
      } else if (process.env.API_KEY) {
        // 로컬 환경이나 이미 주입된 경우
        setHasKey(true);
      }
    };

    checkActualKeyStatus();
    // 주기적으로 체크하여 상태 변경을 감지합니다.
    const interval = setInterval(checkActualKeyStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenKeySelector = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        setIsConnecting(true);
        await aiStudio.openSelectKey();
        
        // 중요: 구글 지침에 따라 선택 창을 닫으면 즉시 성공한 것으로 간주하고 진행합니다.
        setHasKey(true);
        setIsConnecting(false);
      } catch (e) {
        setIsConnecting(false);
        setErrorToast("키 선택 창을 여는 중 문제가 발생했습니다.");
      }
    } else {
      window.open('https://aistudio.google.com/app/apikey', '_blank');
      setErrorToast("자동 키 선택이 지원되지 않는 환경입니다. 직접 키를 확인해주세요.");
    }
  };

  const handleStartRecording = async () => {
    try {
      setErrorToast(null);
      await audioManager.startRecording();
      setIsRecording(true);
    } catch (error) {
      setErrorToast("마이크 권한이 필요합니다.");
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsAnalyzing(true);
    try {
      const audioBlob = await audioManager.stopRecording();
      // 매번 분석 시점에 최신 API 인스턴스를 사용하도록 Evaluation 로직 내부에서 처리됨
      const evaluation = await aiEvaluator.analyzeSpeech(audioBlob, TEST_SENTENCES[currentIndex].text);
      
      // 만약 키 문제로 분석이 실패했다면 다시 키 선택 화면으로 보냅니다.
      if (evaluation.accuracy === 0 && evaluation.feedback.includes("API 키")) {
        setHasKey(false);
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
      setErrorToast("분석 중 오류가 발생했습니다. 다시 시도해주세요.");
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
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
              🛡️
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">분석 준비 완료</h2>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">
              구글 AI 스튜디오에서 프로젝트를 선택하셨다면 아래 버튼을 눌러 바로 시작하세요.
            </p>
          </div>
          
          <div className="space-y-4 mb-10 text-left">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800 mb-1">✅ 프로젝트 선택 확인</p>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                이미 프로젝트를 선택하셨는데도 이 화면이 보인다면, 아래 버튼을 다시 한 번 눌러주세요. 시스템이 즉시 연결을 승인합니다.
              </p>
            </div>
          </div>

          <button 
            onClick={handleOpenKeySelector}
            disabled={isConnecting}
            className={`w-full py-4 ${isConnecting ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black text-lg rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center justify-center space-x-3`}
          >
            <span>{isConnecting ? '연결 확인 중...' : '테스트 시작하기'}</span>
            {!isConnecting && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
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

        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center space-x-2 text-emerald-700 font-bold text-sm shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>AI 분석 엔진이 활성화되었습니다.</span>
          <button 
            onClick={() => setHasKey(false)} 
            className="ml-4 text-[10px] underline opacity-60 hover:opacity-100"
          >
            연결 재설정
          </button>
        </div>

        {errorToast && (
          <div className="mb-4 p-4 bg-red-100 border border-red-200 text-red-700 rounded-2xl text-center text-sm font-bold">
            {errorToast}
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
              {isRecording ? "녹음 중... 손을 떼면 완료됩니다." : "버튼을 꾹 누른 채로 읽어주세요."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Test;
