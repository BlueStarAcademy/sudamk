import React, { createContext, useContext } from 'react';

/** true: 대국 화면 안에서 연 모달 — 바둑판 패널 크기 상한·위치 보정 적용 */
const InGameModalLayoutContext = createContext(false);

export const InGameModalLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <InGameModalLayoutContext.Provider value={true}>{children}</InGameModalLayoutContext.Provider>
);

export function useInGameModalLayout(): boolean {
    return useContext(InGameModalLayoutContext);
}

export default InGameModalLayoutContext;
