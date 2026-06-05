// ui/styles/theme.js
// AF51-RBX Design System — Roblox Manufacturing Cockpit
// Version: 3.0.0 — RBX Color Remaster

export var COLORS = {
  // ── Core backgrounds ────────────────────────────
  bg:         '#06080D',
  bg2:        '#0E141B',
  bg3:        '#111820',
  bg4:        '#080C12',
  bgCode:     '#04060A',
  panelBg:    '#0E141B',
  surface:    '#0E141B',
  elevated:   '#111820',
  black:      '#06080D',
  darkBg:     '#0E141B',

  // ── PRIMARY NEON — Lime #A8FF2F ─────────────────
  lime:       '#A8FF2F',
  lime2:      '#8FE020',
  limeDim:    '#3A5A0A',
  limeGlow:   '#A8FF2F22',
  limeGlow2:  '#A8FF2F0A',
  primary:    '#A8FF2F',
  primaryDark:'#8FE020',
  primaryLight:'#A8FF2F22',
  primaryMuted:'#A8FF2F44',

  // ── CYAN — Electric #25D0FF ──────────────────────
  cyan:       '#25D0FF',
  cyanDim:    '#0A4A5A',
  cyanGlow:   '#25D0FF22',

  // ── ROBLOX PINK — #FF2FD1 ───────────────────────
  pink:       '#FF2FD1',
  pinkDim:    '#5A0A4A',
  pinkGlow:   '#FF2FD122',

  // ── PURPLE — #8C52FF ─────────────────────────────
  purple:     '#8C52FF',
  purpleDim:  '#2A1A5A',
  purpleGlow: '#8C52FF22',
  purpleBg:   '#8C52FF15',
  secondary:  '#8C52FF',
  secondaryLight:'#8C52FF20',

  // ── WARNING / ERROR ──────────────────────────────
  amber:      '#FFC83D',
  warning:    '#FFC83D',
  error:      '#FF4D6D',
  red:        '#FF4D6D',

  // ── Text ────────────────────────────────────────
  white:       '#F0F4FF',
  gray:        '#7A8BA8',
  gray2:       '#1E2A3A',
  gray3:       '#131D2A',
  textPrimary: '#F0F4FF',
  textSecondary:'#7A8BA8',
  textMuted:   '#445566',

  // ── Borders ─────────────────────────────────────
  border:      '#1A2535',
  borderLight: '#1A2535',

  // ── Status ──────────────────────────────────────
  status: {
    success:      '#A8FF2F',
    successLight: '#A8FF2F18',
    error:        '#FF4D6D',
    errorLight:   '#FF4D6D18',
    warning:      '#FFC83D',
    warningLight: '#FFC83D18',
    info:         '#25D0FF',
    infoLight:    '#25D0FF18',
  },

  // ── Factory states ───────────────────────────────
  factory: {
    queued:   '#25D0FF',
    building: '#FFC83D',
    testing:  '#8C52FF',
    artifact: '#A8FF2F',
  },

  // ── Syntax highlight ────────────────────────────
  keyword:     '#8C52FF',
  string:      '#A8FF2F',
  comment:     '#334455',
  number:      '#FFC83D',
  function:    '#25D0FF',
  operator:    '#7A8BA8',
  punctuation: '#7A8BA8',
};

export var SIZES = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28,
  fontXs: 10, fontSm: 12, fontBase: 13, fontLg: 15, fontXl: 18,
  radiusSm: 4, radiusMd: 6, radiusLg: 10, radiusFull: 999,
};

export var SHADOWS = {
  sm:    { shadowColor: '#A8FF2F', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,  elevation: 2 },
  md:    { shadowColor: '#A8FF2F', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6,  elevation: 4 },
  glow:  { shadowColor: '#A8FF2F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  cyan:  { shadowColor: '#25D0FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  pink:  { shadowColor: '#FF2FD1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.30, shadowRadius: 10, elevation: 6 },
  purple:{ shadowColor: '#8C52FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.30, shadowRadius: 10, elevation: 6 },
};

export default COLORS;