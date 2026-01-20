
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold text-blue-700 bg-blue-50 rounded-full">
            AI-Powered Speaking Assessment
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
            당신의 영어 스피킹 실력을<br/>
            <span className="text-blue-600">AI로 정확하게 측정하세요</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            SpeakLevel AI는 최첨단 음성 분석 기술을 사용하여 발음, 억양, 유창성을 평가합니다. 50단계의 문장 테스트를 통해 CEFR 기준의 레벨을 확인해 보세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/test')}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all"
            >
              무료 테스트 시작하기
            </button>
            <button
              onClick={() => navigate('/history')}
              className="w-full sm:w-auto px-8 py-4 bg-slate-100 text-slate-700 text-lg font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              내 기록 확인하기
            </button>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="w-full py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-16">핵심 기능</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🎙️"
              title="실시간 음성 분석"
              description="사용자의 음성을 실시간으로 캡처하고 AI가 즉각적으로 텍스트로 변환하여 분석합니다."
            />
            <FeatureCard
              icon="📊"
              title="상세 피드백"
              description="단순한 점수뿐만 아니라 발음, 억양, 속도 등 세부 항목별로 개선이 필요한 부분을 알려줍니다."
            />
            <FeatureCard
              icon="🏅"
              title="CEFR 레벨 매핑"
              description="국제 표준인 CEFR(A1-C2) 기준에 따라 당신의 정확한 언어 구사 능력을 평가합니다."
            />
          </div>
        </div>
      </section>

      {/* Stats/Proof */}
      <section className="w-full py-16 px-4 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold mb-1">50+</div>
            <div className="text-blue-100 text-sm">테스트 문장</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-1">98%</div>
            <div className="text-blue-100 text-sm">AI 정확도</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-1">CEFR</div>
            <div className="text-blue-100 text-sm">표준 점수</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-1">FREE</div>
            <div className="text-blue-100 text-sm">무료 분석</div>
          </div>
        </div>
      </section>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: string; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="p-8 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

export default Home;
