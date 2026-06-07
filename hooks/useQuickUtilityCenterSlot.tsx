import { type ReactNode } from 'react';
import QuickUtilityCenterSlot from '../components/quick-panel/QuickUtilityCenterSlot.js';

/** @deprecated QuickUtilityCenterSlot 컴포넌트 사용 권장 */
export function useQuickUtilityCenterSlot(nativeCenter: ReactNode): ReactNode {
    return <QuickUtilityCenterSlot>{nativeCenter}</QuickUtilityCenterSlot>;
}
