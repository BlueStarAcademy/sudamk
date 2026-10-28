import React from 'react';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useMobileKeyboardBottomInset } from '../../hooks/useMobileKeyboardBottomInset.js';

type Props = {
    children: React.ReactNode;
    className?: string;
    /**
     * false면 키보드 회피 비활성(부모가 DraggableWindow 등에서 이미 처리하는 경우).
     * 기본: 핸드헬드·네이티브 모바일에서만 활성.
     */
    enabled?: boolean;
    /** 외부에서 강제로 모바일로 취급 */
    forceMobile?: boolean;
};

/**
 * 모바일 채팅 패널 공통: 키보드가 열리면 패널 전체를 키보드 위로 올리고,
 * 닫히면 원래 위치로 되돌린다.
 */
const MobileKeyboardAvoidingChatShell: React.FC<Props> = ({
    children,
    className,
    enabled,
    forceMobile = false,
}) => {
    const isHandheld = useIsHandheldDevice(1024);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = forceMobile || isHandheld || isNativeMobile;
    const active = enabled ?? isMobile;
    const { insetPx, visualViewportHeightPx, isOpen } = useMobileKeyboardBottomInset(active);

    // 패널 전체를 키보드 높이만큼 올려 입력줄이 가려지지 않게 한다. 닫히면 translate 0으로 복귀.
    const style: React.CSSProperties | undefined =
        active && isOpen
            ? {
                  transform: `translate3d(0, -${insetPx}px, 0)`,
                  // 부모 overflow에 잘려도 입력줄 쪽을 우선 보이게 — 상단은 메시지 스크롤로 보완
                  maxHeight:
                      visualViewportHeightPx > 0
                          ? `${Math.max(180, visualViewportHeightPx - 8)}px`
                          : undefined,
                  transition: 'transform 180ms ease-out',
                  willChange: 'transform',
                  position: 'relative',
                  zIndex: 40,
              }
            : active
              ? {
                    transform: 'translate3d(0, 0, 0)',
                    transition: 'transform 180ms ease-out',
                }
              : undefined;

    return (
        <div
            className={className}
            data-mobile-keyboard-avoiding-chat={active ? (isOpen ? 'open' : 'ready') : 'off'}
            style={style}
        >
            {children}
        </div>
    );
};

export default MobileKeyboardAvoidingChatShell;
