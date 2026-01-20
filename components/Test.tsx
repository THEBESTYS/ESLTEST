
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
  const [statusType, setStatusType] = useState<'error' | 'pending' | 'none'>('none');

  const handleOpenKeySelector = async () => {
    setErrorToast(null);
    setStatusType('none');
    
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        await aiStudio.openSelectKey();
        // 선택 후에는 자동으로 성공했다고 가정하고 UI를 리셋합니다.
        setErrorToast("프로젝트가 선택되었습니다. 10초만 기다린 후 다시 말씀해 보세요.");
        setStatusType('pending');
      } catch (e) {
        console.error("Key selector error", e);
      }
    } else {
      window.open('https://aistudio.google.com/app/apikey', '_blank');
    }
  };

  const handleStartRecording = async () => {
    try {
      setErrorToast(null);
      setStatusType('none');
      await audioManager.startRecording();
      setIsRecording(true);
    } catch (error) {
      setErrorToast("마이크 연결을 확인해 주세요.");
      setStatusType('error');
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsAnalyzing(true);

    try {
      const audioBlob = await audioManager.stopRecording();
      const evaluation = await aiEvaluator.analyzeSpeech(audioBlob, TEST_SENTENCES[currentIndex].text);
      
      // 상태별 대응 로직
      if (evaluation.feedback === "API_KEY_MISSING") {
        setErrorToast("먼저 AI 프로젝트를 연결해야 합니다.");
        setStatusType('error');
        setIsAnalyzing(false);
        return;
      }

      if (evaluation.feedback === "API_PROJECT_PENDING") {
        setErrorToast("구글 서버가 프로젝트 정보를 반영 중입니다. 약 10초 후 다시 시도해 주세요.");
        setStatusType('pending');
        setIsAnalyzing(false);
        return;
      }

      if (evaluation.feedback === "API_KEY_INVALID") {
        setErrorToast("유효하지 않은 프로젝트입니다. 다른 프로젝트를 선택해 주세요.");
        setStatusType('error');
        setIsAnalyzing(false);
        return;
      }

      // 분석 실패 (소리가 작거나 인식이 안 될 때)
      if (evaluation.accuracy === 0 && evaluation.transcribed === "[분석 실패]") {
        setErrorToast("목소리가 잘 들리지 않습니다. 조금 더 크게 말씀해 주세요.");
        setStatusType('none');
        setIsAnalyzing(false);
        return;
      }

      // 성공
      const newResults = [...results, evaluation];
      setResults(newResults);
      setErrorToast(null);
      setStatusType('none');

      if (currentIndex < TEST_SENTENCES.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsAnalyzing(false);
      } else {
        finishTest(newResults);
      }
    } catch (error: any) {
      setErrorToast("연결 상태가 불안정합니다. 다시 시도해 주세요.");
      setStatusType('error');
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
        {/* 프로그레스 바 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sentence {currentIndex + 1} / {TEST_SENTENCES.length}</span>
            <span className="text-sm font-black text-blue-600">{Math.round((currentIndex / TEST_SENTENCES.length) * 100)}%</span>
          </div>
          <div className="h-2 w-full bg-white rounded-full p-0.5 shadow-inner border border-slate-100">
            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700" style={{ width: `${((currentIndex + 1) / TEST_SENTENCES.length) * 100}%` }} />
          </div>
        </div>

        {/* 안내 메시지 영역 */}
        <div className="min-h-[120px] mb-6 flex items-center justify-center">
          {errorToast ? (
            <div className={`w-full p-6 rounded-[2.5rem] shadow-xl text-center animate-in zoom-in-95 duration-300 ${statusType === 'pending' ? 'bg-amber-50 border-2 border-amber-200 shadow-amber-100/50' : 'bg-white border-2 border-red-50 shadow-red-100/50'}`}>
              <div className={`font-black text-sm mb-4 flex items-center justify-center gap-2 ${statusType === 'pending' ? 'text-amber-700' : 'text-red-600'}`}>
                {statusType === 'pending' ? '⏳' : '⚠️'} {errorToast}
              </div>
              <button 
                onClick={handleOpenKeySelector}
                className={`px-8 py-3 rounded-2xl text-sm font-black transition-all shadow-lg active:scale-95 ${statusType === 'pending' ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}
              >
                {statusType === 'pending' ? '다른 프로젝트 선택하기' : 'AI 프로젝트 연결하기'}
              </button>
            </div>
          ) : (
            <p className="text-center text-slate-400 font-bold text-sm">
              {isRecording ? "녹음 중... 문장을 읽고 버튼을 떼세요." : "버튼을 꾹 누르고 문장을 읽어주세요."}
            </p>
          )}
        </div>

        {/* 카드 영역 */}
        <div className="bg-white rounded-[4rem] shadow-2xl shadow-blue-100/40 border border-slate-100 p-12 md:p-24 text-center relative">
          <div className="mb-16">
            <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase mb-6 tracking-widest border border-blue-100">AI Level Test</span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-800 leading-tight">"{TEST_SENTENCES[currentIndex].text}"</h2>
          </div>

          <div className="flex flex-col items-center">
            {!isAnalyzing ? (
              <button
                onMouseDown={handleStartRecording}
                onMouseUp={handleStopRecording}
                onTouchStart={handleStartRecording}
                onTouchEnd={handleStopRecording}
                className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${isRecording ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
              >
                {isRecording ? <div className="w-16 h-16 bg-white rounded-3xl animate-pulse" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
              </button>
            ) : (
              <div className="flex flex-col items-center py-6">
                <div className="w-20 h-20 border-8 border-blue-600 border-t-transparent rounded-full animate-spin mb-6" />
                <p className="text-blue-600 font-black text-2xl animate-pulse">분석 중...</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center space-y-4">
          <button onClick={() => navigate('/')} className="text-sm font-black text-slate-300 hover:text-slate-500 transition-colors uppercase tracking-widest">Cancel Test</button>
          <div className="px-6 py-2 bg-white rounded-full border border-slate-100 shadow-sm flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest tracking-tighter">AI Engine Status: Live</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Test;
