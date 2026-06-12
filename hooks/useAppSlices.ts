import { useContext, type Context } from 'react';
import {
    AppUserSliceContext,
    AppRouteSliceContext,
    AppGameStoreSliceContext,
    AppUiSliceContext,
    AppRealtimeSliceContext,
} from '../contexts/slices/AppSliceContexts.js';
import type {
    AppUserSlice,
    AppRouteSlice,
    AppGameStoreSlice,
    AppUiSlice,
    AppRealtimeSlice,
} from '../contexts/slices/types.js';

function useSliceContext<T>(context: Context<T | undefined>, name: string): T {
    const value = useContext(context);
    if (value === undefined) {
        throw new Error(`${name} must be used within AppProvider`);
    }
    return value;
}

export const useAppUserSlice = (): AppUserSlice =>
    useSliceContext(AppUserSliceContext, 'useAppUserSlice');

export const useAppRouteSlice = (): AppRouteSlice =>
    useSliceContext(AppRouteSliceContext, 'useAppRouteSlice');

export const useAppGameStoreSlice = (): AppGameStoreSlice =>
    useSliceContext(AppGameStoreSliceContext, 'useAppGameStoreSlice');

export const useAppUiSlice = (): AppUiSlice =>
    useSliceContext(AppUiSliceContext, 'useAppUiSlice');

export const useAppRealtimeSlice = (): AppRealtimeSlice =>
    useSliceContext(AppRealtimeSliceContext, 'useAppRealtimeSlice');
