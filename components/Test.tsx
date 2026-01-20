
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
  
  // 브라우저 세션에 연결 상태를 임시 저장하여 새로고침 시에도 유지되도록 합니다.
  const [hasKey, setHasKey] = useState<boolean>(() => {
    return !!process.env.API_KEY || sessionStorage.getItem('ai_connected') === 'true';
  });
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // 자동 감지는 '성공'일 때만 수행하고, 실패했다고 해서 hasKey를 false로 꺾지 않습니다.
    const checkKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (aiStudio && await aiStudio.hasSelectedApiKey()) {
        setHasKey(true);
        sessionStorage.setItem('ai_connected', 'true');
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    // [중요] 구글 지침: 버튼 클릭 시 즉시 성공으로 간주하고 진입합니다.
    setHasKey(true);
    sessionStorage.setItem('ai_connected', 'true');
    setErrorToast(null);

    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        setIsConnecting(true);
        // await를 사용하지 않거나, 에러가 나도 무시하고 진행합니다.
        aiStudio.openSelectKey().catch(() => {});
        setIsConnecting(false);
      } catch (e) {
        setIsConnecting(false);
      }
    } else {
      window.open('https://aistudio.google.com/app/apikey', '_blank');
    }
  };

  const handleStartRecording = async () => {
    try {
      setErrorToast(null);
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
    try {
      const audioBlob = await audioManager.stopRecording();
      const evaluation = await aiEvaluator.analyzeSpeech(audioBlob, TEST_SENTENCES[currentIndex].text);
      
      // 실제 호출 시점에 키가 유효하지 않은 경우에만 다시 연결 화면으로 보냅니다.
      if (evaluation.accuracy === 0 && (evaluation.feedback.includes("API 키") || evaluation.feedback.includes("403"))) {
        setHasKey(false);
        sessionStorage.removeItem('ai_connected');
        setErrorToast("API 키가 아직 활성화되지 않았거나 권한이 없습니다. 다시 프로젝트를 선택해주세요.");
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
      setErrorToast("분석 중 오류가 발생했습니다. 다시 한 번 말씀해주세요.");
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
              🚀
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">시작할 준비가 되셨나요?</h2>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">
              구글 AI 프로젝트 선택을 완료하셨다면,<br/>아래 버튼을 눌러 즉시 테스트를 시작합니다.
            </p>
          </div>
          
          <div className="space-y-4 mb-10 text-left">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800 mb-1">💡 프로젝트를 이미 선택했다면?</p>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                시스템 반영까지 시간이 걸릴 수 있습니다. **'테스트 시작하기'** 버튼을 누르면 즉시 진입이 가능합니다.
              </p>
            </div>
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
          <div className="mb-4 p-4 bg-red-100 border border-red-200 text-red-700 rounded-2xl text-center text-sm font-bold animate-bounce">
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
