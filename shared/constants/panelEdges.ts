import { PanelEdgeStyle } from '../types/index.js';

type EdgeImages = { topLeft: string | null; topRight: string | null; bottomLeft: string | null; bottomRight: string | null };

export const PANEL_EDGE_IMAGE_MAP: Record<PanelEdgeStyle, EdgeImages> = {
    none: { topLeft: null, topRight: null, bottomLeft: null, bottomRight: null },
    default: {
        topLeft: 'url("/images/panel/panel_top_left.webp")',
        topRight: 'url("/images/panel/panel_top_right.webp")',
        bottomLeft: 'url("/images/panel/panel_bottom_left.webp")',
        bottomRight: 'url("/images/panel/panel_bottom_right.webp")',
    },
    style1: {
        topLeft: 'url("/images/panel/panel_top_left1.webp")',
        topRight: 'url("/images/panel/panel_top_right1.webp")',
        bottomLeft: 'url("/images/panel/panel_bottom_left1.webp")',
        bottomRight: 'url("/images/panel/panel_bottom_right1.webp")',
    },
    style2: {
        topLeft: 'url("/images/panel/panel_top_left2.webp")',
        topRight: 'url("/images/panel/panel_top_right2.webp")',
        bottomLeft: 'url("/images/panel/panel_bottom_left2.webp")',
        bottomRight: 'url("/images/panel/panel_bottom_right2.webp")',
    },
    style3: {
        topLeft: 'url("/images/panel/panel_top_left3.webp")',
        topRight: 'url("/images/panel/panel_top_right3.webp")',
        bottomLeft: 'url("/images/panel/panel_bottom_left3.webp")',
        bottomRight: 'url("/images/panel/panel_bottom_right3.webp")',
    },
    style4: {
        topLeft: 'url("/images/panel/panel_top_left4.webp")',
        topRight: 'url("/images/panel/panel_top_right4.webp")',
        bottomLeft: 'url("/images/panel/panel_bottom_left4.webp")',
        bottomRight: 'url("/images/panel/panel_bottom_right4.webp")',
    },
    style5: {
        topLeft: 'url("/images/panel/panel_top_left5.webp")',
        topRight: 'url("/images/panel/panel_top_right5.webp")',
        bottomLeft: 'url("/images/panel/panel_bottom_left5.webp")',
        bottomRight: 'url("/images/panel/panel_bottom_right5.webp")',
    },
};

export const getPanelEdgeImages = (style: PanelEdgeStyle): EdgeImages => {
    return PANEL_EDGE_IMAGE_MAP[style] || PANEL_EDGE_IMAGE_MAP.default;
};


