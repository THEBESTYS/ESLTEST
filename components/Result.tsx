
import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageManager } from '../services/storage';
import { LEVEL_CRITERIA } from '../constants';

const Result: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const attempt = StorageManager.getAttemptById(id || "");

  useEffect(() => {
    if (attempt && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        // Clear previous chart if exists
        const chartStatus = (window as any).Chart.getChart(canvasRef.current);
        if (chartStatus) chartStatus.destroy();

        new (window as any).Chart(ctx, {
          type: 'radar',
          data: {
            labels: ['Accuracy', 'Intonation', 'Fluency'],
            datasets: [{
              label: 'My Score',
              data: [
                attempt.details.avgAccuracy,
                attempt.details.avgIntonation,
                attempt.details.avgFluency
              ],
              fill: true,
              backgroundColor: 'rgba(37, 99, 235, 0.2)',
              borderColor: 'rgb(37, 99, 235)',
              pointBackgroundColor: 'rgb(37, 99, 235)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(37, 99, 235)'
            }]
          },
          options: {
            elements: {
              line: { borderWidth: 3 }
            },
            scales: {
              r: {
                angleLines: { display: false },
                suggestedMin: 0,
                suggestedMax: 100
              }
            }
          }
        });
      }
    }
  }, [attempt]);

  if (!attempt) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">결과를 찾을 수 없습니다</h2>
          <button onClick={() => navigate('/')} className="text-blue-600 font-bold underline">홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  const levelInfo = LEVEL_CRITERIA[attempt.level];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 w-full">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">테스트 결과 분석</h1>
        <p className="text-slate-500">테스트 일시: {new Date(attempt.date).toLocaleString('ko-KR')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Level Highlight */}
        <div className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-6">최종 레벨</h2>
          <div className={`w-32 h-32 rounded-full flex items-center justify-center text-white text-5xl font-black mb-6 shadow-xl ${levelInfo.color}`}>
            {attempt.level}
          </div>
          <div className="text-2xl font-bold text-blue-600 mb-2">{levelInfo.label}</div>
          <p className="text-slate-600 text-sm leading-relaxed mb-8">
            {levelInfo.description}
          </p>
          <div className="w-full pt-6 border-t border-slate-100">
            <div className="text-4xl font-black text-slate-900">{Math.round(attempt.overallScore)}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Overall Score</div>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-8">영역별 평가</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <canvas ref={canvasRef} height="300"></canvas>
              </div>
              <div className="space-y-6">
                <ScoreMetric label="Accuracy" value={attempt.details.avgAccuracy} color="bg-blue-600" description="정확한 발음 구사력" />
                <ScoreMetric label="Intonation" value={attempt.details.avgIntonation} color="bg-indigo-600" description="억양 및 리듬감" />
                <ScoreMetric label="Fluency" value={attempt.details.avgFluency} color="bg-cyan-600" description="말하기의 유창성 및 속도" />
              </div>
            </div>
          </div>

          {/* Feedback Section */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-6">상세 피드백</h2>
            <div className="space-y-4">
              {attempt.individualScores.slice(0, 5).map((score, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold text-slate-700">Attempt {i + 1}</span>
                    <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{Math.round(score.accuracy)}%</span>
                  </div>
                  <p className="text-slate-600 text-sm italic mb-2">"{score.transcribed}"</p>
                  <p className="text-blue-600 text-sm font-medium">💡 {score.feedback}</p>
                </div>
              ))}
              {attempt.individualScores.length > 5 && (
                <p className="text-center text-slate-400 text-sm italic">...외 {attempt.individualScores.length - 5}문장 분석 완료</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={() => navigate('/test')}
          className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
        >
          다시 테스트하기
        </button>
        <button
          onClick={() => navigate('/history')}
          className="px-8 py-4 bg-white text-slate-700 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-all"
        >
          기록 보러가기
        </button>
      </div>
    </div>
  );
};

const ScoreMetric: React.FC<{ label: string, value: number, color: string, description: string }> = ({ label, value, color, description }) => (
  <div>
    <div className="flex justify-between items-end mb-1">
      <div>
        <div className="text-sm font-bold text-slate-800">{label}</div>
        <div className="text-[10px] text-slate-400 uppercase font-semibold">{description}</div>
      </div>
      <div className="text-lg font-black text-slate-800">{Math.round(value)}</div>
    </div>
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

export default Result;
