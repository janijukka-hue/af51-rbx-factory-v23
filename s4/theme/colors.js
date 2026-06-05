// s4/theme/colors.js
// AF51-RBX Design System — Roblox Manufacturing Cockpit
// Version: 3.0.0 — RBX Color Remaster
// Synced with ui/styles/theme.js

export var COLORS = {
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

  lime:       '#A8FF2F',
  lime2:      '#8FE020',
  limeDim:    '#3A5A0A',
  limeGlow:   '#A8FF2F22',
  limeGlow2:  '#A8FF2F0A',
  primary:    '#A8FF2F',
  primaryDark:'#8FE020',
  primaryLight:'#A8FF2F22',
  primaryMuted:'#A8FF2F44',

  cyan:       '#25D0FF',
  cyanDim:    '#0A4A5A',
  cyanGlow:   '#25D0FF22',

  pink:       '#FF2FD1',
  pinkDim:    '#5A0A4A',
  pinkGlow:   '#FF2FD122',

  purple:     '#8C52FF',
  purpleDim:  '#2A1A5A',
  purpleGlow: '#8C52FF22',
  purpleBg:   '#8C52FF15',
  secondary:  '#8C52FF',
  secondaryLight:'#8C52FF20',

  amber:      '#FFC83D',
  warning:    '#FFC83D',
  error:      '#FF4D6D',
  red:        '#FF4D6D',

  white:       '#F0F4FF',
  gray:        '#7A8BA8',
  gray2:       '#1E2A3A',
  gray3:       '#131D2A',
  textPrimary: '#F0F4FF',
  textSecondary:'#7A8BA8',
  textMuted:   '#445566',

  border:      '#1A2535',
  borderLight: '#1A2535',

  text: {
    primary:   '#F0F4FF',
    secondary: '#7A8BA8',
    muted:     '#445566',
    accent:    '#A8FF2F',
    error:     '#FF4D6D',
    warning:   '#FFC83D',
    disabled:  '#1E2A3A',
    inverse:   '#06080D',
  },

  bg: {
    base:     '#06080D',
    elevated: '#0E141B',
    surface:  '#111820',
    input:    '#080C12',
    overlay:  'rgba(0,0,0,0.75)',
  },

  border: {
    default: '#1A2535',
    subtle:  '#111C2A',
    focus:   '#A8FF2F',
  },

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

  factory: {
    queued:   '#25D0FF',
    building: '#FFC83D',
    testing:  '#8C52FF',
    artifact: '#A8FF2F',
  },

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
};

export var SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24,
};

export var RADIUS = {
  none: 0, sm: 4, md: 6, lg: 10, full: 999,
};

export var FONTS = {
  mono: "'Courier New', monospace",
};

export default COLORS;