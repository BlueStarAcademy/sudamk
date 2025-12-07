
import React, { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DraggableWindowProps {

    title: string;

    windowId: string;

    onClose?: () => void;

    children: ReactNode;

    initialWidth?: number;

    initialHeight?: number; // Added

    modal?: boolean;

    closeOnOutsideClick?: boolean;

    isTopmost?: boolean;

    headerContent?: ReactNode;

    zIndex?: number;

    variant?: 'default' | 'store';

}



const SETTINGS_KEY = 'draggableWindowSettings';



const DraggableWindow: React.FC<DraggableWindowProps> = ({ title, windowId, onClose, children, initialWidth = 800, initialHeight, modal = true, closeOnOutsideClick = true, isTopmost = true, headerContent, zIndex = 9999, variant = 'default' }) => {

    const [position, setPosition] = useState({ x: 0, y: 0 });

    const [isDragging, setIsDragging] = useState(false);

    const dragStartPos = useRef({ x: 0, y: 0 });

    const initialWindowPos = useRef({ x: 0, y: 0 });

    const [isInitialized, setIsInitialized] = useState(false);

    const positionRef = useRef(position);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const [rememberPosition, setRememberPosition] = useState(true);

    

    const [scale, setScale] = useState(1);

    

    const windowRef = useRef<HTMLDivElement>(null);



    const handleClickOutside = useCallback((event: MouseEvent) => {

        if (onClose && closeOnOutsideClick && isTopmost && windowRef.current && !windowRef.current.contains(event.target as Node)) {

            onClose();

        }

    }, [onClose, closeOnOutsideClick, isTopmost]);



    useEffect(() => {

        if (modal && onClose) {

            document.addEventListener('mousedown', handleClickOutside);

            return () => {

                document.removeEventListener('mousedown', handleClickOutside);

            };

        }

    }, [modal, onClose, handleClickOutside]);



    useEffect(() => {
        const checkIsMobile = () => {
            const newIsMobile = window.innerWidth < 768;
            setIsMobile(newIsMobile);
            if (newIsMobile) {
                // 모바일일 때 position을 { x: 0, y: 0 }으로 설정
                setPosition({ x: 0, y: 0 });
                // 모바일일 때 저장된 위치 정보 삭제
                try {
                    const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');
                    delete savedPositions[windowId];
                    localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));
                } catch (e) {
                    console.error("Failed to clear mobile position", e);
                }
            }
        };

        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            setWindowHeight(window.innerHeight);
            checkIsMobile();
        };

        window.addEventListener('resize', handleResize);
        checkIsMobile();

        return () => window.removeEventListener('resize', handleResize);
    }, [windowId]);



    // 브라우저 크기에 따라 창 크기를 비례적으로 조정
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [windowHeight, setWindowHeight] = useState(window.innerHeight);
    
    const calculatedWidth = useMemo(() => {
        if (!initialWidth) return undefined;
        
        // 모바일이 아닐 때는 initialWidth를 최소값으로 보장 (데스크톱에서는 고정 크기 사용)
        if (!isMobile) {
            // 데스크톱: initialWidth를 최대한 보장하되, 화면이 너무 작으면 화면 크기에 맞춤
            const minWidth = Math.min(initialWidth, windowWidth - 40); // 화면에서 40px 여유 공간
            // initialWidth를 최소한 95% 이상 보장 (90%에서 95%로 증가)
            return Math.max(initialWidth * 0.95, minWidth);
        }
        
        // 모바일: 화면 크기에 맞춤
        const baseWidth = initialWidth;
        const viewportRatio = windowWidth / 1920; // 기준 해상도 1920px
        const adjustedWidth = Math.max(400, Math.min(baseWidth, baseWidth * viewportRatio));
        return adjustedWidth;
    }, [initialWidth, windowWidth, isMobile]);
    
    const calculatedHeight = useMemo(() => {
        if (!initialHeight) return undefined;
        
        // 모바일이 아닐 때는 initialHeight를 최소값으로 보장 (데스크톱에서는 고정 크기 사용)
        if (!isMobile) {
            // 데스크톱: initialHeight를 최소값으로 보장하되, 화면이 너무 작으면 화면 크기에 맞춤
            const minHeight = Math.min(initialHeight, windowHeight - 40); // 화면에서 40px 여유 공간
            return Math.max(initialHeight * 0.9, minHeight); // initialHeight의 90% 이상 보장
        }
        
        // 모바일: 화면 크기에 맞춤
        const baseHeight = initialHeight;
        const viewportRatio = windowHeight / 1080; // 기준 해상도 1080px
        const adjustedHeight = Math.max(300, Math.min(baseHeight, baseHeight * viewportRatio));
        return adjustedHeight;
    }, [initialHeight, windowHeight, isMobile]);

    // 모바일에서 PC 모달 구조를 그대로 사용하고 전체적으로 축소하는 스케일 팩터 계산
    const mobileScaleFactor = useMemo(() => {
        if (!isMobile) return 1.0;
        
        // PC 모달 크기를 그대로 사용
        const baseWidth = initialWidth || 800;
        const baseHeight = initialHeight || 600;
        
        // 화면 크기에서 여유 공간 제외 (좌우 10px씩, 상하 20px씩)
        const availableWidth = windowWidth - 20;
        const availableHeight = windowHeight - 40;
        
        // 가로/세로 비율에 맞춰서 스케일 계산
        const scaleX = availableWidth / baseWidth;
        const scaleY = availableHeight / baseHeight;
        
        // 더 작은 스케일을 사용하여 화면 안에 완전히 들어오도록 보장
        const scale = Math.min(scaleX, scaleY);
        
        // 최소/최대 스케일 제한 (너무 작거나 크지 않도록)
        return Math.max(0.25, Math.min(0.95, scale));
    }, [isMobile, windowWidth, windowHeight, initialWidth, initialHeight]);




    useEffect(() => {

        positionRef.current = position;

    }, [position]);



     useEffect(() => {

        try {

            const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

            const shouldRemember = settings.rememberPosition ?? true;

            setRememberPosition(shouldRemember);



            if (shouldRemember && !isMobile) {

                const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                if (savedPositions[windowId]) {

                    setPosition(savedPositions[windowId]);

                } else {

                    setPosition({ x: 0, y: 0 });

                }

            } else {

                setPosition({ x: 0, y: 0 });

            }

        } catch (e) {

            console.error("Failed to load window settings from localStorage", e);

            setPosition({ x: 0, y: 0 });

        }

        setIsInitialized(true);

    }, [windowId, isMobile]);





    const handleDragStart = useCallback((clientX: number, clientY: number) => {

        setIsDragging(true);

        dragStartPos.current = { x: clientX, y: clientY };

        initialWindowPos.current = positionRef.current;

    }, []);



    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {

        if (!isTopmost || e.button !== 0) return;

        handleDragStart(e.clientX, e.clientY);

    }, [handleDragStart, isTopmost]);



    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {

        if (!isTopmost) return;

        const touch = e.touches[0];

        handleDragStart(touch.clientX, touch.clientY);

    }, [handleDragStart, isTopmost]);

    

    const handleDragMove = useCallback((clientX: number, clientY: number) => {

        if (!isDragging || !windowRef.current) return;



        const dx = clientX - dragStartPos.current.x;

        const dy = clientY - dragStartPos.current.y;



        let newX = initialWindowPos.current.x + dx;

        let newY = initialWindowPos.current.y + dy;

        

        const { offsetWidth, offsetHeight } = windowRef.current;

        const { innerWidth, innerHeight } = window;



        const halfW = offsetWidth / 2;

        const halfH = offsetHeight / 2;

        

        // Horizontal constraints (keep window fully inside)

        const minX = -(innerWidth / 2) + halfW;

        const maxX = (innerWidth / 2) - halfW;

        

        // Vertical constraints (keep header visible)

        const headerHeight = 50; // Approximate header height for safety margin

        let minY, maxY;



        if (offsetHeight <= innerHeight) {

            // Window is shorter than or same height as viewport

            // Keep it fully inside the viewport

            minY = -(innerHeight / 2) + halfH;

            maxY = (innerHeight / 2) - halfH;

        } else {

            // Window is taller than viewport

            // Allow vertical scrolling, but always keep the header visible

            minY = -(innerHeight / 2) - halfH + headerHeight; // Allow top to go off-screen, but keep header visible

            maxY = (innerHeight / 2) + halfH - headerHeight; // Allow bottom to go off-screen, but keep header visible

        }



        newX = Math.max(minX, Math.min(newX, maxX));

        newY = Math.max(minY, Math.min(newY, maxY));



        setPosition({ x: newX, y: newY });

    }, [isDragging]);



    const handleMouseMove = useCallback((e: MouseEvent) => {

        handleDragMove(e.clientX, e.clientY);

    }, [handleDragMove]);



    const handleTouchMove = useCallback((e: TouchEvent) => {

        if (isDragging) {

             const touch = e.touches[0];

             handleDragMove(touch.clientX, touch.clientY);

        }

    }, [isDragging, handleDragMove]);





    const handleDragEnd = useCallback(() => {

        if (isDragging) {

            setIsDragging(false);

            if (rememberPosition && !isMobile) {

                try {

                    const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                    savedPositions[windowId] = positionRef.current;

                    localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));

                } catch (e) {

                    console.error("Failed to save window position to localStorage", e);

                }

            }

        }

    }, [isDragging, windowId, rememberPosition, isMobile]);



    useEffect(() => {

        if (isDragging) {

            window.addEventListener('mousemove', handleMouseMove);

            window.addEventListener('mouseup', handleDragEnd);

            window.addEventListener('touchmove', handleTouchMove);

            window.addEventListener('touchend', handleDragEnd);

        }

        return () => {

            window.removeEventListener('mousemove', handleMouseMove);

            window.removeEventListener('mouseup', handleDragEnd);

            window.removeEventListener('touchmove', handleTouchMove);

            window.removeEventListener('touchend', handleDragEnd);

        };

    }, [isDragging, handleMouseMove, handleTouchMove, handleDragEnd]);

    

    const handleRememberChange = (e: React.ChangeEvent<HTMLInputElement>) => {

        const isChecked = e.target.checked;

        setRememberPosition(isChecked);

        try {

            const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

            settings.rememberPosition = isChecked;

            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

            if (!isChecked) {

                // If unchecked, reset position immediately and clear saved data

                setPosition({ x: 0, y: 0 });

                const savedPositions = JSON.parse(localStorage.getItem('draggableWindowPositions') || '{}');

                delete savedPositions[windowId];

                localStorage.setItem('draggableWindowPositions', JSON.stringify(savedPositions));

            }

        } catch (error) {

            console.error("Failed to save remember position setting", error);

        }

    };





    const transformStyle = `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${isDragging ? scale * 1.02 : scale})`;



    if (!isInitialized) return null;

    

    const headerCursor = isTopmost ? 'cursor-move' : '';
    const isStoreVariant = variant === 'store';
    const containerBaseClass = 'fixed top-1/2 left-1/2 rounded-xl flex flex-col transition-shadow duration-200';
    const containerVariantClass = isStoreVariant
        ? 'text-slate-100 bg-gradient-to-br from-[#1f2239] via-[#101a34] to-[#060b12] border border-cyan-300/40 shadow-[0_40px_100px_-45px_rgba(34,211,238,0.65)]'
        : 'text-on-panel bg-primary border border-color shadow-2xl';
    const headerVariantClass = isStoreVariant
        ? 'bg-gradient-to-r from-[#1b2645] via-[#15203b] to-[#1b2645] border-b border-cyan-300/30 text-cyan-100'
        : 'bg-secondary text-secondary';
    const footerVariantClass = isStoreVariant
        ? 'bg-[#111a32] border-t border-cyan-300/30 text-cyan-200'
        : 'bg-secondary border-color text-tertiary';
    const bodyPaddingClass = isStoreVariant ? 'p-5' : 'p-4';
    const closeButtonClass = isStoreVariant
        ? 'w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-rose-500/85 via-rose-500/75 to-rose-600/85 hover:from-rose-400 hover:via-rose-500 hover:to-rose-600 transition-colors shadow-[0_18px_38px_-24px_rgba(244,63,94,0.75)]'
        : 'w-10 h-10 flex items-center justify-center rounded-full bg-tertiary hover:bg-danger transition-colors';

    const modalContent = (
        <>
            {modal && (
                 <div className={`fixed inset-0 bg-black/50 ${!isTopmost ? 'backdrop-blur-sm' : ''}`} style={{ zIndex: zIndex - 1 }} />
            )}
            <div
                ref={windowRef}
                className={`${containerBaseClass} ${containerVariantClass}`}
                style={{
                    width: isMobile 
                        ? (initialWidth ? `${initialWidth}px` : '800px')
                        : (calculatedWidth ? `${calculatedWidth}px` : (initialWidth ? `${initialWidth}px` : undefined)),
                    minWidth: isMobile 
                        ? (initialWidth ? `${initialWidth}px` : '800px')
                        : (calculatedWidth ? `${calculatedWidth}px` : (initialWidth ? `${Math.max(600, initialWidth)}px` : '600px')),
                    maxWidth: isMobile ? undefined : 'calc(100vw - 40px)',
                    height: isMobile 
                        ? (initialHeight ? `${initialHeight}px` : '600px')
                        : (calculatedHeight ? `${calculatedHeight}px` : (initialHeight ? `${initialHeight}px` : undefined)),
                    maxHeight: isMobile ? undefined : '90vh',
                    transform: isMobile 
                        ? `translate(-50%, -50%) scale(${mobileScaleFactor})`
                        : transformStyle,
                    transformOrigin: 'center',
                    boxShadow: !isStoreVariant && isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : undefined,
                    zIndex: zIndex,
                }}
            >
                {!isTopmost && (
                    <div className="absolute inset-0 bg-black/30 z-20 rounded-xl cursor-not-allowed" />
                )}
                <div
                    className={`${headerVariantClass} p-3 rounded-t-xl flex justify-between items-center ${headerCursor}`}
                    style={{ touchAction: 'none' }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    <h2 className="text-lg font-bold select-none">{title}</h2>
                    <div className="flex items-center gap-2">
                        {headerContent}
                        {onClose && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }} 
                                className={`${closeButtonClass} z-30`}
                                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                            >
                                <span className="text-white font-bold text-lg">✕</span>
                            </button>
                        )}
                    </div>
                </div>
                <div 
                    className={`flex-grow h-full overflow-hidden flex flex-col ${bodyPaddingClass}`}
                >
                    {children}
                </div>
                <div className={`flex-shrink-0 p-2 flex justify-end items-center rounded-b-xl ${footerVariantClass}`}>
                    <label className="flex items-center text-xs gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={rememberPosition}
                            onChange={handleRememberChange}
                            className="w-4 h-4 bg-tertiary border-color rounded focus:ring-accent"
                        />
                        창 위치 기억하기
                    </label>
                </div>
            </div>
        </>
    );

    // Portal을 사용하여 body에 직접 렌더링 (z-index 문제 해결)
    return createPortal(modalContent, document.body);

};



export default DraggableWindow;
