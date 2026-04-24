import React, {
    createContext,
    useContext,
    ReactNode,
    Component,
    ErrorInfo,
    ReactNode as ReactNodeType,
} from 'react';
import { useApp } from '../hooks/useApp.js';

// Infer the type of the context from the hook's return value
type AppContextType = ReturnType<typeof useApp>;

// Create the context with a default undefined value
export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        console.error('[useAppContext] Context is undefined. This usually means:');
        console.error('1. AppProvider is not wrapping the component');
        console.error('2. useApp() hook threw an error during initialization');
        console.error('3. There is a circular dependency or import issue');
        console.error('Stack trace:', new Error().stack);
        throw new Error('useAppContext must be used within an AppProvider. Check console for details.');
    }
    return context;
};

// Error Boundary Component
class AppErrorBoundary extends Component<{ children: ReactNodeType }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNodeType }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[AppProvider] Error caught by boundary:', error);
        // ErrorInfo는 객체이라 콘솔에 "Object"만 보이기 쉬움 — 스택은 문자열로 따로 출력
        if (errorInfo?.componentStack) {
            console.error('[AppProvider] React component stack:', errorInfo.componentStack);
        }
        if (import.meta.env.DEV && errorInfo && typeof errorInfo === 'object') {
            console.error('[AppProvider] ErrorInfo (dev):', { ...errorInfo });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-screen bg-tertiary text-primary">
                    <div className="text-center p-8">
                        <h1 className="text-2xl font-bold mb-4">초기화 오류</h1>
                        <p className="text-red-400 mb-4">{this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}</p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="px-4 py-2 bg-primary text-tertiary rounded-lg hover:bg-opacity-80"
                        >
                            페이지 새로고침
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Create the provider component
const AppProviderInner: React.FC<{ children: ReactNode }> = ({ children }) => {
    // useApp must be called at the top level (React hooks rule)
    // Wrap in try-catch to handle initialization errors gracefully
    let appData: AppContextType;
    try {
        appData = useApp();
    } catch (error) {
        console.error('[AppProvider] Error in useApp hook:', error);
        // Re-throw to be caught by error boundary
        throw error;
    }
    
    return (
        <AppContext.Provider value={appData}>
            {children}
        </AppContext.Provider>
    );
};

// Export wrapped provider with error boundary
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <AppErrorBoundary>
            <AppProviderInner>
                {children}
            </AppProviderInner>
        </AppErrorBoundary>
    );
};
