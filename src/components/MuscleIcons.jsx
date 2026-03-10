import React from 'react';

// Minimalist SVG icons for muscle groups — 20x20, monochrome, stroke-based

export const ChestIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 4C8 4 4 6 4 10c0 3 2 5 4 6l2 1h4l2-1c2-1 4-3 4-6 0-4-4-6-8-6z" />
        <line x1="12" y1="4" x2="12" y2="17" />
    </svg>
);

export const BackIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2v20" />
        <path d="M8 6c-2 2-3 5-3 8s1 4 3 4" />
        <path d="M16 6c2 2 3 5 3 8s-1 4-3 4" />
    </svg>
);

export const LegsIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M8 2v6c0 2-1 4-2 6l-1 4v4" />
        <path d="M16 2v6c0 2 1 4 2 6l1 4v4" />
        <path d="M7 8h4" />
        <path d="M13 8h4" />
    </svg>
);

export const ShouldersIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 12c0-4 3-7 8-7s8 3 8 7" />
        <path d="M8 12v5" />
        <path d="M16 12v5" />
        <circle cx="12" cy="5" r="2" />
    </svg>
);

export const BicepsIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M6 18V8c0-2 1-4 3-5" />
        <path d="M6 8c0 0-1-2 1-3s4 0 5 2c1 1.5 0 4-1 5" />
        <path d="M11 12c1 1 3 1 4 0" />
        <path d="M18 7v11" />
    </svg>
);

export const TricepsIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M7 4v16" />
        <path d="M7 8c2-1 4-1 5 1s0 4-1 5" />
        <path d="M17 4c0 0 1 3 0 6s-3 5-5 6" />
        <path d="M17 4v12" />
    </svg>
);

export const CoreIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <line x1="6" y1="9" x2="18" y2="9" />
        <line x1="6" y1="15" x2="18" y2="15" />
        <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
);

export const CardioIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0L12 5.34l-.77-.76a5.4 5.4 0 0 0-7.65 0 5.4 5.4 0 0 0 0 7.65L12 20.65l8.42-8.42a5.4 5.4 0 0 0 0-7.65z" />
        <path d="M3 12h4l2-3 3 6 2-3h7" />
    </svg>
);

export const NeckIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="6" r="4" />
        <path d="M9 10v8c0 2 1 3 3 3s3-1 3-3v-8" />
    </svg>
);

export const ForearmsIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M8 3l-2 10c-.5 2 0 4 2 5h8c2-1 2.5-3 2-5L16 3" />
        <path d="M10 18v3" />
        <path d="M14 18v3" />
    </svg>
);

// Map category keys to icon components
export const CATEGORY_ICON_MAP = {
    CHEST: ChestIcon,
    BACK: BackIcon,
    LEGS: LegsIcon,
    SHOULDERS: ShouldersIcon,
    BICEPS: BicepsIcon,
    TRICEPS: TricepsIcon,
    CORE: CoreIcon,
    CARDIO: CardioIcon,
    NECK: NeckIcon,
    FOREARMS: ForearmsIcon,
};
