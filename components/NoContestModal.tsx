import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { canSaveStrategicPvpGameRecord, GAME_RECORD_SLOT_FULL_MESSAGE } from '../utils/strategicPvpGameRecord.js';
import { useGameRecordSaveLock } from '../hooks/useGameRecordSaveLock.js';
import { useGameResultModalLayout } from './game/useGameResultModalLayout.js';

interface NoContestModalProps {
    session: LiveGameSession;
    currentUser: User;
    onConfirm: () => void;
    onAction?: (action: ServerAction) => void | Promise<unknown>;
    onOpenGameRecordList?: () => void;
    isSpectator?: boolean;
}

const NoContestModal: React.FC<NoContestModalProps> = ({ session, currentUser, onConfirm, onAction, onOpenGameRecordList, isSpectator = false }) => {
    const { t } = useTranslation('game');
    const [savingRecord, setSavingRecord] = useState(false);
    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const isInitiator = session.noContestInitiatorIds?.includes(currentUser.id);
    const canUseGameRecordUi = canSaveStrategicPvpGameRecord(session) && !isSpectator;
    const { recordAlreadySaved, setSavedOptimistic } = useGameRecordSaveLock(session.id, currentUser.savedGameRecords);
    const recordCount = currentUser.savedGameRecords?.length ?? 0;
    const { commonWindowProps: commonResultWindowProps } = useGameResultModalLayout({
        isMobile,
        designWidth: 520,
        designHeight: 480,
    });

    return (
        <DraggableWindow
            title={t('modals.noContest.title')}
            onClose={onConfirm}
            windowId="no-contest"
            viewportPortal
            {...commonResultWindowProps}
            hideFooter={isMobile}
        >
            <>
            <div className="text-white">
                <div className="bg-gray-900/50 p-4 rounded-lg mb-6 text-center">
                    <p className="text-lg">
                        {t('modals.noContest.body')}
                    </p>
                    {isInitiator && (
                        <p className="text-sm text-red-400 mt-3">
                            {t('modals.noContest.warning')}
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
                                        const out = await onAction({
                                            type: 'SAVE_GAME_RECORD',
                                            payload: { gameId: session.id, sessionSnapshot: session },
                                        });
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
            </>
        </DraggableWindow>
    );
};

export default NoContestModal;