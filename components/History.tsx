
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageManager } from '../services/storage';
import { TestAttempt, CEFRLevel } from '../types';
import { LEVEL_CRITERIA } from '../constants';

const History: React.FC = () => {
  const [history, setHistory] = useState<TestAttempt[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setHistory(StorageManager.getHistory());
  }, []);

  const handleClear = () => {
    if (confirm("모든 기록을 삭제하시겠습니까?")) {
      StorageManager.clearHistory();
      setHistory([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">내 테스트 기록</h1>
          <p className="text-slate-500 mt-1">총 {history.length}개의 테스트 결과가 있습니다.</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm font-bold text-red-500 hover:text-red-600 px-4 py-2 border border-red-100 rounded-lg"
          >
            기록 삭제
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl shadow-sm border border-slate-100 text-center">
          <div className="text-6xl mb-6">📭</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">아직 기록이 없습니다</h2>
          <p className="text-slate-500 mb-8">첫 번째 레벨 테스트를 시작하여 실력을 확인해보세요.</p>
          <button
            onClick={() => navigate('/test')}
            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            테스트 시작하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((attempt) => (
            <div
              key={attempt.id}
              onClick={() => navigate(`/result/${attempt.id}`)}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
            >
              <div className="flex items-center space-x-6">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-black shadow-inner ${LEVEL_CRITERIA[attempt.level].color}`}>
                  {attempt.level}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {LEVEL_CRITERIA[attempt.level].label} Level
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {new Date(attempt.date).toLocaleDateString()} · {new Date(attempt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-8">
                <div className="text-right hidden sm:block">
                  <div className="text-2xl font-black text-slate-900">{Math.round(attempt.overallScore)}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</div>
                </div>
                <div className="text-slate-300 group-hover:text-blue-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
