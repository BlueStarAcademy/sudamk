import React, { useState, useEffect } from 'react';

/** 계가 예상 소요 시간(ms). 진행 막대 및 "약 N초 남음"에 사용. 결과 수신 시 연출 즉시 종료됨 */
export const SCORING_PROGRESS_DURATION_MS = 3_000;
const SCAN_CYCLE_MS = 4_000; // 좌→우 스캔 1회 주기

/** 계가 중 오버레이: 스피너 + 텍스트 + 진행 막대. 결과 수신 시 부모에서 언마운트되어 즉시 종료 */
export function ScoringOverlay({ variant = 'fullscreen' }: { variant?: 'fullscreen' | 'inline' }) {
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / SCORING_PROGRESS_DURATION_MS) * 100);
      setProgress(p);
      setElapsedMs(elapsed);
      if (p >= 100) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, []);
  const remainingSec = Math.max(0, Math.ceil((SCORING_PROGRESS_DURATION_MS - elapsedMs) / 1000));
  const scanPhase = (elapsedMs % SCAN_CYCLE_MS) / SCAN_CYCLE_MS;
  // -10%에서 110%까지 이동하면서 좌측→우측 스캔 느낌을 줌
  const scanLeftPercent = scanPhase * 120 - 10;

  const content = (
    <>
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-100 mb-4" />
      <p className="text-xl font-bold text-white animate-pulse">계가 중...</p>
      <p className="text-sm text-gray-300 mt-1">AI가 바둑판을 분석하고 있어요</p>
      <p className="text-sm text-amber-200/90 mt-3 font-medium tabular-nums">
        {remainingSec > 0 ? `약 ${remainingSec}초 남음` : '곧 완료...'}
      </p>
      <div className="w-full max-w-md mt-3 px-6">
        <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-[width] duration-75 ease-linear"
            style={{
              width: `${progress}%`,
              boxShadow: '0 0 12px rgba(251, 191, 36, 0.6), 0 0 24px rgba(251, 191, 36, 0.3)',
            }}
          />
        </div>
      </div>
    </>
  );
  if (variant === 'inline') {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        {content}
      </div>
    );
  }
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-30 pointer-events-none overflow-hidden">
      {/* 좌측에서 우측으로 움직이는 스캔 광선 연출 (뒷 배경 바둑판 위에 얇게 덮여 보이도록) */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 bottom-0 w-1/3"
          style={{
            left: `${scanLeftPercent}%`,
            background:
              'linear-gradient(to right, rgba(56,189,248,0.0), rgba(56,189,248,0.55), rgba(56,189,248,0.0))',
            mixBlendMode: 'screen',
            opacity: 0.4,
            filter: 'blur(2px)',
          }}
        />
      </div>
      {content}
    </div>
  );
}

export default ScoringOverlay;
