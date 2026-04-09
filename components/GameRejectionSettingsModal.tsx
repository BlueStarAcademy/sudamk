import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GameMode } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import Button from './Button';
import DraggableWindow from './DraggableWindow';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';

interface GameRejectionSettingsModalProps {
  onClose: () => void;
  lobbyType?: 'strategic' | 'playful';
}

/** 체크 시 X가 채워지는 박스(행 버튼의 시각적 부분만) */
function RejectModeCheckboxVisual({ checked, accentClass }: { checked: boolean; accentClass: string }) {
  return (
    <span
      className={
        `relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150 ` +
        (checked
          ? `${accentClass} border-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`
          : 'border-white/20 bg-black/25 group-hover:border-white/35 group-hover:bg-black/35')
      }
      aria-hidden
    >
      <span
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
          checked ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" className="text-white drop-shadow-sm" fill="none">
          <path
            d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}

const GAME_REJECTION_WINDOW_ID = 'game-rejection-settings';

const GameRejectionSettingsModal: React.FC<GameRejectionSettingsModalProps> = ({ onClose, lobbyType }) => {
  const { currentUserWithStatus, handlers } = useAppContext();
  const [rejectedGameModes, setRejectedGameModes] = useState<GameMode[]>([]);

  useEffect(() => {
    if (currentUserWithStatus?.rejectedGameModes) {
      setRejectedGameModes(currentUserWithStatus.rejectedGameModes);
    }
  }, [currentUserWithStatus]);

  const gameOptions = useMemo(() => {
    if (lobbyType === 'strategic') {
      return SPECIAL_GAME_MODES.map((mode) => ({ mode: mode.mode, name: mode.name }));
    }
    if (lobbyType === 'playful') {
      return PLAYFUL_GAME_MODES.map((mode) => ({ mode: mode.mode, name: mode.name }));
    }
    return [
      ...SPECIAL_GAME_MODES.map((mode) => ({ mode: mode.mode, name: mode.name })),
      ...PLAYFUL_GAME_MODES.map((mode) => ({ mode: mode.mode, name: mode.name })),
    ];
  }, [lobbyType]);

  const containerExtraClassName = useMemo(() => {
    const base = 'rounded-2xl';
    if (lobbyType === 'strategic') {
      return (
        `${base} !border-cyan-500/35 !bg-gradient-to-br !from-slate-950 !via-zinc-950 !to-black ` +
        `shadow-[0_22px_48px_-28px_rgba(6,182,212,0.35)] !ring-1 !ring-cyan-400/22`
      );
    }
    if (lobbyType === 'playful') {
      return (
        `${base} !border-amber-500/35 !bg-gradient-to-br !from-zinc-950 !via-zinc-900 !to-black ` +
        `shadow-[0_22px_48px_-28px_rgba(245,158,11,0.28)] !ring-1 !ring-amber-400/18`
      );
    }
    return `${base} !border-white/12 !bg-gradient-to-br !from-slate-950 !to-zinc-950 !ring-1 !ring-white/[0.08]`;
  }, [lobbyType]);

  const accentCheckboxClass = useMemo(() => {
    if (lobbyType === 'strategic') return 'bg-gradient-to-br from-rose-600 to-rose-800';
    if (lobbyType === 'playful') return 'bg-gradient-to-br from-rose-600 to-orange-800';
    return 'bg-gradient-to-br from-rose-600 to-rose-900';
  }, [lobbyType]);

  const rowFocusOutlineClass = useMemo(() => {
    if (lobbyType === 'strategic') return 'focus-visible:outline-cyan-400/55';
    if (lobbyType === 'playful') return 'focus-visible:outline-amber-400/55';
    return 'focus-visible:outline-white/40';
  }, [lobbyType]);

  const titleHairlineClass =
    lobbyType === 'strategic'
      ? 'from-transparent via-cyan-300/40 to-transparent'
      : lobbyType === 'playful'
        ? 'from-transparent via-amber-300/45 to-transparent'
        : 'from-transparent via-white/22 to-transparent';

  const handleToggleGameMode = useCallback((mode: GameMode) => {
    setRejectedGameModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]));
  }, []);

  const handleSaveSettings = () => {
    handlers.handleAction({
      type: 'UPDATE_REJECTION_SETTINGS',
      payload: { rejectedGameModes },
    });
    onClose();
  };

  return (
    <DraggableWindow
      title="대국 거부 설정"
      windowId={GAME_REJECTION_WINDOW_ID}
      onClose={onClose}
      initialWidth={448}
      shrinkHeightToContent
      headerShowTitle
      modal
      closeOnOutsideClick
      isTopmost
      bodyPaddingClassName="p-0"
      bodyScrollable
      containerExtraClassName={containerExtraClassName}
      footerClassName="border-t border-white/[0.08] bg-black/25"
    >
      <div className="relative flex min-h-0 flex-col">
        <div
          className={`pointer-events-none absolute left-4 right-4 top-2 h-px bg-gradient-to-r opacity-90 sm:left-5 sm:right-5 ${titleHairlineClass}`}
        />

        <div className="border-b border-white/[0.07] px-5 pb-3 pt-1 sm:px-6 sm:pb-4">
          <p id="rejection-settings-desc" className="text-sm leading-relaxed text-secondary">
            체크한 모드는 다른 플레이어의 대국 신청을 자동으로 거부합니다.
          </p>
        </div>

        <div className="px-5 py-3 sm:px-6 sm:py-4">
          {gameOptions.length > 0 ? (
            <ul className="flex flex-col gap-1.5 sm:gap-2">
              {gameOptions.map((option, index) => {
                const checked = rejectedGameModes.includes(option.mode);
                return (
                  <li key={`${option.mode}-${index}`}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-describedby="rejection-settings-desc"
                      onClick={() => handleToggleGameMode(option.mode)}
                      className={`sudamr-modal-inner-well group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.07] bg-gradient-to-r from-slate-950/80 via-slate-900/60 to-slate-950/80 px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:border-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:gap-3 sm:px-3.5 sm:py-3 ${rowFocusOutlineClass}`}
                    >
                      <RejectModeCheckboxVisual checked={checked} accentClass={accentCheckboxClass} />
                      <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-primary sm:text-[15px]">
                        {option.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          checked ? 'bg-rose-500/20 text-rose-200' : 'bg-white/5 text-tertiary'
                        }`}
                      >
                        {checked ? '거부' : '허용'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-center text-sm text-tertiary">표시할 게임 모드가 없습니다.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] bg-black/20 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
          <Button onClick={onClose} colorScheme="gray" className="w-full sm:w-auto sm:min-w-[5.5rem]">
            취소
          </Button>
          <Button onClick={handleSaveSettings} colorScheme="green" className="w-full sm:w-auto sm:min-w-[5.5rem]">
            저장
          </Button>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default GameRejectionSettingsModal;
