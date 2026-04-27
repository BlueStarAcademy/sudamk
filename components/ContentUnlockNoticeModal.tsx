import React from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.js';
import { ADVENTURE_STAGES } from '../constants/adventureConstants.js';

export type ContentUnlockType = 'tower' | 'adventure';

type ContentUnlockNoticeModalProps = {
    unlockType: ContentUnlockType;
    onClose: () => void;
    isTopmost?: boolean;
};

const CONTENT_META: Record<ContentUnlockType, { title: string; subtitle: string; image: string; routeHint: string }> = {
    tower: {
        title: '도전의 탑 오픈',
        subtitle: '바둑학원 입문반 20 클리어로\n도전의 탑이 해금되었습니다.',
        image: '/images/tower/Tower1.png',
        routeHint: '홈 화면에서 도전의 탑으로 바로 입장할 수 있습니다.',
    },
    adventure: {
        title: '모험 오픈',
        subtitle: '바둑학원 초급반 20 클리어로\n모험 콘텐츠가 해금되었습니다.',
        image: ADVENTURE_STAGES[0]?.mapWebp ?? '/images/adventure/chapter1/map.webp',
        routeHint: '홈 화면에서 모험으로 바로 입장할 수 있습니다.',
    },
};

const ContentUnlockNoticeModal: React.FC<ContentUnlockNoticeModalProps> = ({
    unlockType,
    onClose,
    isTopmost = true,
}) => {
    const meta = CONTENT_META[unlockType];
    const overlayZ = isTopmost ? 'z-[12062]' : 'z-[12048]';

    const node = (
        <div
            className={`fixed inset-0 ${overlayZ} flex items-center justify-center px-3 py-3`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="content-unlock-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                aria-label="배경 닫기"
                onClick={onClose}
            />
            <div
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-b from-[#1c1210] via-[#120c0a] to-[#090604] shadow-[0_28px_64px_-24px_rgba(0,0,0,0.92)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_45%_at_50%_-5%,rgba(245,158,11,0.35),transparent_60%)]" />
                <div className="relative p-6 sm:p-7">
                    <p className="text-center text-xs font-bold uppercase tracking-[0.24em] text-amber-300/80">Content Unlock</p>
                    <h2 id="content-unlock-title" className="mt-2 text-center text-2xl font-black text-amber-100 sm:text-3xl">
                        {meta.title}
                    </h2>
                    <p className="mt-3 whitespace-pre-line text-center text-sm leading-relaxed text-amber-50/90">{meta.subtitle}</p>

                    <div className="my-5 flex justify-center">
                        <img
                            src={meta.image}
                            alt={meta.title}
                            className="h-28 w-28 rounded-xl border border-white/10 bg-black/25 object-cover shadow-[0_12px_28px_-16px_rgba(251,191,36,0.55)]"
                        />
                    </div>

                    <p className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center text-xs text-slate-200">
                        {meta.routeHint}
                    </p>

                    <div className="mt-5 flex justify-center">
                        <Button onClick={onClose} colorScheme="blue" className="min-h-[2.75rem] w-full max-w-xs font-bold">
                            확인
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return node;
    return createPortal(node, document.body);
};

export default ContentUnlockNoticeModal;
