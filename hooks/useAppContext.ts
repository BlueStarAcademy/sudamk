/** Provider와 동일 모듈의 Context를 쓰도록 재export (Vite에서 경로/확장자 불일치 시 이중 createContext 방지) */
export { useAppContext, AppContext } from '../contexts/AppContext.js';
