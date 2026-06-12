import { createContext } from 'react';
import type {
    AppUserSlice,
    AppRouteSlice,
    AppGameStoreSlice,
    AppUiSlice,
    AppRealtimeSlice,
} from './types.js';

export const AppUserSliceContext = createContext<AppUserSlice | undefined>(undefined);
export const AppRouteSliceContext = createContext<AppRouteSlice | undefined>(undefined);
export const AppGameStoreSliceContext = createContext<AppGameStoreSlice | undefined>(undefined);
export const AppUiSliceContext = createContext<AppUiSlice | undefined>(undefined);
export const AppRealtimeSliceContext = createContext<AppRealtimeSlice | undefined>(undefined);
