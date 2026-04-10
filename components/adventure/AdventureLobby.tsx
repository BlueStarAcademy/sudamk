import React from 'react';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import { replaceAppHash } from '../../utils/appUtils.js';

const STAGE_CARD_RINGS: readonly string[] = [
    'ring-emerald-400/35',
    'ring-sky-400/35',
    'ring-blue-400/35',
    'ring-amber-400/35',
    'ring-fuchsia-400/35',
];

const AdventureLobby: React.FC = () => {
    const { isNativeMobile } = useNativeMobileShell();
    const onBack = () => replaceAppHash('#/profile');

    return (
        <div
            className={`relative mx-auto flex w-full flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-zinc-100 ${
                isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-hidden px-0.5' : 'h-full min-h-0 p-2 sm:p-4 lg:p-8'
            }`}
        >
            <header
                className={`flex flex-shrink-0 items-center ${isNativeMobile ? 'mb-0.5 justify-center px-1 py-1' : 'mb-3 justify-between px-2 sm:mb-4 sm:px-0 lg:mb-6'}`}
            >
                {!isNativeMobile && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex h-10 w-10 items-center justify-center rounded-lg p-0 transition-transform hover:bg-zinc-800 hover:drop-shadow-lg active:scale-90 sm:h-12 sm:w-12"
                        aria-label="뒤로가기"
                    >
                        <img src="/images/button/back.png" alt="" className="h-full w-full" />
                    </button>
                )}
                <div className={`flex min-w-0 flex-col items-center ${isNativeMobile ? '' : 'flex-1'}`}>
                    <h1 className={`font-bold tracking-tight text-transparent bg-gradient-to-r from-fuchsia-200 via-violet-100 to-cyan-200 bg-clip-text ${isNativeMobile ? 'text-lg' : 'text-xl sm:text-2xl lg:text-3xl'}`}>
                        모험
                    </h1>
                </div>
                {!isNativeMobile && <div className="w-10 sm:w-12" aria-hidden />}
            </header>

            <p className={`text-center text-xs text-zinc-500 ${isNativeMobile ? 'mb-1 px-2' : 'mb-3 sm:mb-4'}`}>
                스테이지를 선택하면 이후 몬스터 대국·보상이 연결됩니다.
            </p>

            <div
                className={`grid min-h-0 w-full flex-1 auto-rows-fr gap-2 overflow-y-auto overscroll-y-contain sm:gap-3 ${
                    isNativeMobile
                        ? 'grid-cols-1 px-0.5 pb-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
                }`}
            >
                {ADVENTURE_STAGES.map((stage, i) => {
                    const ringClass = STAGE_CARD_RINGS[i] ?? STAGE_CARD_RINGS[0];
                    return (
                        <button
                            key={stage.id}
                            type="button"
                            onClick={() => replaceAppHash(`#/adventure/${stage.id}`)}
                            aria-label={`${stage.title} 맵으로 입장`}
                            className={`relative flex min-h-[7.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-3 text-left shadow-[0_18px_40px_-22px_rgba(0,0,0,0.85)] ring-1 transition-transform duration-200 hover:-translate-y-0.5 hover:ring-amber-300/35 active:translate-y-0 sm:min-h-[8.5rem] sm:p-4 ${ringClass}`}
                        >
                            <img
                                src={stage.mapWebp}
                                alt=""
                                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                                draggable={false}
                            />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/88 via-black/40 to-black/25" />
                            <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,255,255,0.25),transparent_55%)]" />
                            <div className="relative z-[1] flex items-start justify-between gap-2">
                                <span className="rounded-md border border-white/15 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amber-100/90 sm:text-xs">
                                    STAGE {stage.stageIndex}
                                </span>
                                <span className="rounded-md border border-amber-400/30 bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100/95 sm:text-xs">
                                    맵 보기
                                </span>
                            </div>
                            <div className="relative z-[1] mt-2 min-w-0 text-left">
                                <h2 className="text-base font-black leading-tight text-white drop-shadow-md sm:text-lg">{stage.title}</h2>
                                <p className="mt-1 text-[11px] font-medium text-zinc-300/90 sm:text-xs">탭하여 16:9 탐험 맵</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AdventureLobby;
