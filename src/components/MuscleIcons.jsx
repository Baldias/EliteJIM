import React from 'react';
import {
    GiMuscularTorso,
    GiLeg,
    GiWeightLiftingUp,
    GiBiceps,
    GiArm,
    GiAbdominalArmor,
    GiFist,
    GiBodyHeight
} from 'react-icons/gi';
import { FaHeartbeat, FaUserAlt } from 'react-icons/fa';

// We wrap react-icons to accept 'size' and 'color' props to match the previous API, 
// ensuring they drop in perfectly without breaking other components.

export const ChestIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <GiMuscularTorso size={size} color={color} {...props} />
);

// For Back, we use the Torso icon but flipped horizontally to suggest the posterior chain
export const BackIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <div style={{ display: 'inline-flex', transform: 'scaleX(-1)' }} {...props}>
        <GiMuscularTorso size={size} color={color} />
    </div>
);

export const LegsIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <GiLeg size={size} color={color} {...props} />
);

export const ShouldersIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <GiWeightLiftingUp size={size} color={color} {...props} />
);

export const BicepsIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <GiBiceps size={size} color={color} {...props} />
);

export const TricepsIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <GiArm size={size} color={color} {...props} />
);

export const CoreIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <GiAbdominalArmor size={size} color={color} {...props} />
);

export const CardioIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <FaHeartbeat size={size} color={color} {...props} />
);

export const NeckIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <FaUserAlt size={size} color={color} {...props} />
);

export const ForearmsIcon = ({ size = 20, color = 'currentColor', ...props }) => (
    <GiFist size={size} color={color} {...props} />
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
