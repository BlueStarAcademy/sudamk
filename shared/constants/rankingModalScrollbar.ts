/**
 * 랭킹 퀵 모달·지난 랭킹·티어 안내 등 랭킹 UI 공용 — 얇은 세로 스크롤 (Firefox scrollbar-width + WebKit).
 */
export const RANKING_MODAL_SLIM_SCROLL_Y =
    '[scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.34)_rgba(0,0,0,0.14)] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-black/25 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/30 hover:[&::-webkit-scrollbar-thumb]:bg-amber-300/48';

/** 탭 바 등 가로 스크롤용 */
export const RANKING_MODAL_SLIM_SCROLL_X =
    '[scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.34)_transparent] [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-black/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/28 hover:[&::-webkit-scrollbar-thumb]:bg-amber-300/42';
