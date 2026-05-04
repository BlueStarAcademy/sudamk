import React, { useState } from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { canSaveStrategicPvpGameRecord, GAME_RECORD_SLOT_FULL_MESSAGE } from '../utils/strategicPvpGameRecord.js';
import { useGameRecordSaveLock } from '../hooks/useGameRecordSaveLock.js';
import {
    GAME_RESULT_MOBILE_DVH_BOTTOM_GAP_PX,
    GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_CSS,
    GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_VH,
} from './game/gameResultModalViewport.js';

interface NoContestModalProps {
    session: LiveGameSession;
    currentUser: User;
    onConfirm: () => void;
    onAction?: (action: ServerAction) => void | Promise<unknown>;
    onOpenGameRecordList?: () => void;
    isSpectator?: boolean;
}

const NoContestModal: React.FC<NoContestModalProps> = ({ session, currentUser, onConfirm, onAction, onOpenGameRecordList, isSpectator = false }) => {
    const [savingRecord, setSavingRecord] = useState(false);
    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const isInitiator = session.noContestInitiatorIds?.includes(currentUser.id);
    const canUseGameRecordUi = canSaveStrategicPvpGameRecord(session) && !isSpectator;
    const { recordAlreadySaved, setSavedOptimistic } = useGameRecordSaveLock(session.id, currentUser.savedGameRecords);
    const recordCount = currentUser.savedGameRecords?.length ?? 0;

    return (
        <DraggableWindow
            title="무효 대국"
            onClose={onConfirm}
            initialWidth={450}
            windowId="no-contest"
            mobileViewportFit={isMobile}
            mobileLockViewportHeight={isMobile}
            mobileViewportMaxHeightVh={isMobile ? GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_VH : 90}
            mobileViewportMaxHeightCss={isMobile ? GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_CSS : undefined}
            mobileViewportDvhBottomGapPx={isMobile ? GAME_RESULT_MOBILE_DVH_BOTTOM_GAP_PX : undefined}
            hideFooter={isMobile}
        >
            <>
            <div className="text-white">
                <div className="bg-gray-900/50 p-4 rounded-lg mb-6 text-center">
                    <p className="text-lg">
                        10수 미만 대국에서 기권 또는 계가 요청이 있어<br/>
                        해당 대국은 무효 처리되었습니다.
                    </p>
                    {isInitiator && (
                        <p className="text-sm text-red-400 mt-3">
                            경고: 반복적으로 무효 대국을 만들 경우, 페널티가 적용될 수 있습니다.
                        </p>
                    )}
                </div>

                {canUseGameRecordUi && (onAction || onOpenGameRecordList) && !isMobile && (
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        {onAction && (
                            <Button
                                onClick={async () => {
                                    if (savingRecord) return;
                                    if (savingRecord || recordAlreadySaved) return;
                                    if (recordCount >= 10) {
                                        alert(GAME_RECORD_SLOT_FULL_MESSAGE);
                                        return;
                                    }
                                    setSavingRecord(true);
                                    try {
                                        const out = await onAction({ type: 'SAVE_GAME_RECORD', payload: { gameId: session.id } });
                                        if (out && typeof out === 'object' && 'error' in out && (out as { error?: string }).error) return;
                                        setSavedOptimistic(true);
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setSavingRecord(false);
                                    }
                                }}
                                disabled={savingRecord || recordAlreadySaved}
                                className={`flex-1 py-2 ${recordAlreadySaved ? 'opacity-50' : ''}`}
                            >
                                {savingRecord ? '저장 중...' : recordAlreadySaved ? '이미 저장됨' : '기보 저장'}
                            </Button>
                        )}
                        {onOpenGameRecordList && (
                            <Button onClick={() => onOpenGameRecordList()} colorScheme="gray" className="flex-1 py-2">
                                기보 관리
                            </Button>
                        )}
                    </div>
                )}
            </div>
                <div className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} px-1 pt-2`}>
                    <Button onClick={onConfirm} className="w-full py-3">
                        확인
                    </Button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default NoContestModal;