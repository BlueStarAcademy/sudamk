import React from 'react';

type Props = { show: boolean };

/**
 * 모바일에서 세로 모드일 때만 표시. "가로 모드로 돌려주세요" 안내.
 */
const LandscapeOnlyOverlay: React.FC<Props> = ({ show }) => {
    if (!show) return null;
    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary text-on-panel"
            style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}
        >
            <div className="flex flex-col items-center gap-6 px-6 text-center">
                <div className="w-16 h-16 rounded-full border-4 border-primary border-t-on-panel animate-spin" />
                <div>
                    <p className="text-xl font-bold">가로 모드로 사용해 주세요</p>
                    <p className="mt-2 text-sm text-gray-400">화면을 가로로 돌리면 PC와 동일한 화면으로 이용할 수 있습니다.</p>
                </div>
            </div>
        </div>
    );
};

export default LandscapeOnlyOverlay;
