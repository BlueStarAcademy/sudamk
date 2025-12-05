import { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        // 더 자세한 에러 메시지로 디버깅 도움
        console.error('[useAppContext] Context is undefined. This usually means:');
        console.error('1. AppProvider is not wrapping the component');
        console.error('2. useApp() hook threw an error during initialization');
        console.error('3. There is a circular dependency or import issue');
        console.error('Stack trace:', new Error().stack);
        throw new Error('useAppContext must be used within an AppProvider. Check console for details.');
    }
    return context;
};
