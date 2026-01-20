
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
  const [needsConnection, setNeedsConnection] = useState(false);

  // 컴포넌트 마운트 시 마이크 권한 미리 확인
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
      setErrorToast("마이크 권한이 거부되었습니다. 원활한 테스트를 위해 마이크를 허용해 주세요.");
    });
  }, []);

  const handleOpenKeySelector = async () => {
    setErrorToast(null);
    setNeedsConnection(false);
    
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        // 키 선택 후 즉시 에러 상태를 해제하여 다시 시도할 수 있게 함
      } catch (e) {
        console.error("Key selection failed", e);
      }
    } else {
      window.open('https://aistudio.google.com/app/apikey', '_blank');
    }
  };

  const handleStartRecording = async () => {
    try {
      setErrorToast(null);
      setNeedsConnection(false);
      await audioManager.startRecording();
      setIsRecording(true);
    } catch (error) {
      setErrorToast("마이크를 사용할 수 없습니다. 설정을 확인해 주세요.");
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsAnalyzing(true);

    try {
      const audioBlob = await audioManager.stopRecording();
      const evaluation = await aiEvaluator.analyzeSpeech(audioBlob, TEST_SENTENCES[currentIndex].text);
      
      // API 키 관련 특수 에러 처리 (사용자를 내쫓지 않음)
      if (evaluation.feedback === "API_KEY_MISSING" || evaluation.feedback === "API_KEY_INVALID") {
        setErrorToast("구글 AI 프로젝트 연결이 필요합니다. 아래 버튼을 눌러 프로젝트를 선택해 주세요.");
        setNeedsConnection(true);
        setIsAnalyzing(false);
        return;
      }

      // 서버 반영 대기 중 에러 (Entity not found 등)
      if (evaluation.accuracy === 0 && evaluation.transcribed === "[분석 실패]") {
        setErrorToast(evaluation.feedback);
        setIsAnalyzing(false);
        return;
      }

      // 분석 성공 - 결과 저장 및 다음 문장 이동
      const newResults = [...results, evaluation];
      setResults(newResults);

      if (currentIndex < TEST_SENTENCES.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsAnalyzing(false);
      } else {
        finishTest(newResults);
      }
    } catch (error: any) {
      setErrorToast("분석 중 오류가 발생했습니다. 다시 한 번 말씀해 주세요.");
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

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="max-w-3xl w-full">
        {/* 상단 진행 표시줄 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2 text-xs font-black text-slate-400">
            <span className="uppercase tracking-widest">Question {currentIndex + 1} / {TEST_SENTENCES.length}</span>
            <span className="text-blue-600">{Math.round((currentIndex / TEST_SENTENCES.length) * 100)}%</span>
          </div>
          <div className="w-full h-3 bg-white rounded-full p-1 shadow-inner border border-slate-100">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out shadow-sm" 
              style={{ width: `${((currentIndex + 1) / TEST_SENTENCES.length) * 100}%` }} 
            />
          </div>
        </div>

        {/* 안내/에러 메시지 영역 */}
        <div className="min-h-[80px] mb-6">
          {errorToast ? (
            <div className="p-5 bg-white border-2 border-red-100 rounded-[2rem] shadow-xl shadow-red-50 text-center animate-in fade-in slide-in-from-top-4 duration-300">
              <p className="text-red-600 font-bold text-sm mb-3">⚠️ {errorToast}</p>
              {needsConnection && (
                <button 
                  onClick={handleOpenKeySelector}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-100 active:scale-95"
                >
                  AI 프로젝트 연결하기
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-400 font-medium text-sm">
              {isRecording ? "목소리를 듣고 있습니다... 문장을 끝까지 읽어주세요." : "준비가 되었다면 아래 버튼을 누른 채 말씀해 보세요."}
            </div>
          )}
        </div>

        {/* 메인 문장 카드 */}
        <div className="bg-white rounded-[3rem] shadow-2xl shadow-blue-100/50 border border-slate-100 p-10 md:p-20 text-center relative overflow-hidden">
          {/* 장식용 배경 */}
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg className="w-32 h-32" viewBox="0 0 24 24" fill="currentColor"><path d="M14 17h2v2h-2v-2zm-2-4h2v2h-2v-2zm2-4h2v2h-2V9zm-2-4h2v2h-2V5zm-2 4h2v2h-2V9zm0 4h2v2h-2v-2zM6 9h2v2H6V9zm0 4h2v2H6v-2zm10-4h2v2h-2V9zM6 17h2v2H6v-2zm10 0h2v2h-2v-2zM6 5h2v2H6V5zm4 0h2v2h-2V5zm4 0h2v2h-2V5zm4 0h2v2h-2V5z"/></svg>
          </div>

          <div className="mb-16">
            <span className="inline-block px-4 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase mb-4 tracking-widest">Target Sentence</span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-800 leading-tight">
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
                className={`group relative w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ease-out ${
                  isRecording 
                    ? 'bg-red-500 scale-110 shadow-2xl shadow-red-200' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200'
                }`}
              >
                {isRecording ? (
                  <div className="w-14 h-14 bg-white rounded-2xl animate-pulse shadow-inner" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
                {isRecording && (
                  <div className="absolute inset-0 rounded-full border-[10px] border-red-200 animate-ping opacity-50" />
                )}
              </button>
            ) : (
              <div className="flex flex-col items-center py-8">
                <div className="relative">
                  <div className="w-20 h-20 border-[6px] border-blue-100 rounded-full" />
                  <div className="absolute inset-0 w-20 h-20 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="mt-6 text-blue-600 font-black text-2xl animate-pulse">AI 분석 중...</p>
              </div>
            )}
            <p className="mt-12 text-slate-400 font-bold text-lg">
              {isRecording ? "녹음 중입니다... 문장을 모두 읽고 버튼을 떼세요." : "버튼을 꾹 누른 상태로 말씀해 주세요."}
            </p>
          </div>
        </div>

        {/* 하단 보조 도구 */}
        <div className="mt-10 flex flex-col items-center space-y-4">
          <button 
            onClick={() => {
              if(confirm("테스트를 중단하고 홈으로 돌아가시겠습니까?")) navigate('/');
            }}
            className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            테스트 중단하기
          </button>
          <div className="flex items-center gap-4 py-2 px-6 bg-white rounded-full border border-slate-100 shadow-sm">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI Engine Live Status: Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Test;
