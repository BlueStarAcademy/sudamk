import { createContext } from 'react';

/**
 * Context 객체는 반드시 이 파일 한 곳에서만 생성합니다.
 * `AppContext.tsx`가 `useApp`을 import하는 동안 동일 모듈이 재진입되면
 * `createContext`가 중복 실행되어 Provider와 소비자가 서로 다른 Context를 쓰는 문제가 생길 수 있습니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AppContext = createContext<any>(undefined);
