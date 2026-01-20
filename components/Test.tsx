
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
  
  // 브라우저 세션에 연결 상태를 저장하여 튕김을 방지합니다.
  const [hasKey, setHasKey] = useState<boolean>(() => {
    return !!process.env.API_KEY || sessionStorage.getItem('ai_connected') === 'true';
  });

  useEffect(() => {
    // 백그라운드에서 조용히 키 상태를 업데이트합니다.
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
    // 즉시 진입 허용
    setHasKey(true);
    sessionStorage.setItem('ai_connected', 'true');
    setErrorToast(null);

    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      // 팝업을 띄우되 결과를 기다려 흐름을 막지 않습니다.
      aiStudio.openSelectKey().catch(() => {});
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
      setErrorToast("마이크 권한이 필요합니다. 브라우저 주소창 옆의 자물쇠 아이콘을 눌러 마이크를 허용해주세요.");
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
      
      // 분석 실패 시 (키 문제 포함)
      if (evaluation.accuracy === 0 && evaluation.transcribed === "[분석 실패]") {
        setErrorToast(evaluation.feedback);
        setIsAnalyzing(false);
        // 여기서 setHasKey(false)를 하지 않음으로써 튕김 방지
        return;
      }

      const newResults = [...results, evaluation];
      setResults(newResults);

      // 성공 시 다음 문장으로
      setTimeout(() => {
        if (currentIndex < TEST_SENTENCES.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setIsAnalyzing(false);
        } else {
          finishTest(newResults);
        }
      }, 500);
    } catch (error: any) {
      console.error("Test process error:", error);
      setErrorToast("네트워크 연결이 불안정하거나 서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.");
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

  // 초기 진입 화면
  if (!hasKey) {
    return (
      <div className="flex-grow flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100 p-10 border border-slate-100">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
              🚀
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">테스트 준비 완료</h2>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">
              구글 AI 스튜디오 설정이 끝나셨나요?<br/>바로 테스트를 시작해 보세요.
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

  // 테스트 진행 화면
  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        {/* 상단 프로그레스 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2 text-sm font-bold">
            <span className="text-slate-400 uppercase tracking-tighter">Sentence {currentIndex + 1} / 50</span>
            <span className="text-blue-600">{Math.round((currentIndex / 50) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${(currentIndex / 50) * 100}%` }} />
          </div>
        </div>

        {/* 에러 메시지 (튕기지 않고 화면에 표시) */}
        {errorToast && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-center text-sm font-medium animate-pulse">
            ⚠️ {errorToast}
            <div className="mt-2 text-xs opacity-70">문장을 다시 한 번 천천히 읽어주세요.</div>
          </div>
        )}

        {/* 문장 카드 */}
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
                <p className="text-blue-600 font-black text-xl animate-pulse">AI가 발음을 듣고 있습니다...</p>
              </div>
            )}
            <p className="mt-10 text-slate-400 font-bold text-lg">
              {isRecording ? "녹음 중... 손을 떼면 분석이 시작됩니다." : "버튼을 꾹 누르고 읽으세요."}
            </p>
          </div>
        </div>

        {/* 하단 보조 메뉴 */}
        <div className="mt-8 flex justify-center">
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
        </div>
      </div>
    </div>
  );
};

export default Test;
