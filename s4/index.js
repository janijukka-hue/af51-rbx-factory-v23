// s4/index.js
// ALX Factory - S4 Studio Layer Entry Point
// Version: 2.3.0
//
// S4 is the UI/Studio layer. It communicates ONLY with m2 (Orchestrator).
// S4 does NOT access t3 (Factory) directly.
//
// Architecture: s4 → m2 → k1 → t3

// ===== NAVIGATION =====
export { AppNavigator } from "./navigation/AppNavigator.js";
export { ROUTES, TAB_CONFIG, STACK_CONFIG } from "./navigation/routes.js";

// ===== SCREENS =====
export { CommandCenterScreen } from "./screens/CommandCenter/index.js";
export { JobsQueueScreen } from "./screens/JobsQueue/index.js";
export { JobDetailsScreen } from "./screens/JobDetails/index.js";
export { PreviewScreen } from "./screens/Preview/index.js";
export { ArtifactBrowserScreen } from "./screens/ArtifactBrowser/index.js";
export { ArtifactDetailsScreen } from "./screens/ArtifactDetails/index.js";
export { FileViewerScreen } from "./screens/FileViewer/index.js";
export { LogStreamScreen } from "./screens/LogStream/index.js";
export { SettingsScreen } from "./screens/Settings/index.js";
export { BuildWizardScreen } from "./screens/BuildWizard/index.js";
export { ReportsScreen } from "./screens/Reports/index.js";

// ===== COMPONENTS: COMMON =====
export {
  Button, BUTTON_VARIANT, BUTTON_SIZE,
  Card, CardSection, CardDivider, CARD_VARIANT,
  Badge, CountBadge, BADGE_VARIANT, BADGE_SIZE,
  ProgressBar, SegmentedProgress, PROGRESS_VARIANT, PROGRESS_SIZE,
  StatusIndicator, StatusBadge, FactoryStatus, STATUS, STATUS_SIZE,
  Input, TextArea, SearchInput, INPUT_SIZE,
  Modal, ConfirmDialog, AlertDialog, MODAL_SIZE,
  Toast, ToastProvider, useToast, TOAST_VARIANT, TOAST_POSITION
} from "./components/common/index.js";

// ===== COMPONENTS: LAYOUT =====
export { Header, HeaderAction, BottomSheet } from "./components/layout/index.js";

// ===== COMPONENTS: DATA =====
export { FileTree, CodeBlock, SYNTAX_COLORS } from "./components/data/index.js";

// ===== COMPONENTS: FACTORY =====
export {
  PipelineProgress, PIPELINE_STAGES, STAGE_STATUS,
  EnergyMeter, CircularEnergyMeter
} from "./components/factory/index.js";

// ===== COMPONENTS: LOGS =====
export {
  LogFilter, LEVEL_CONFIG, SOURCE_CONFIG,
  LogSearch,
  LogEntryCard, LogEntryList
} from "./components/logs/index.js";

// ===== COMPONENTS: ARTIFACTS =====
export {
  ArtifactCard, ArtifactCardSkeleton, TYPE_COLORS,
  ArtifactMetadata, MetadataRow, MetadataTable,
  ArtifactActions, ActionIconButton, ExportOptionsModal,
  FileList, FileListItem, FileListHeader, GroupedFileList
} from "./components/artifacts/index.js";

// ===== COMPONENTS: BUILD =====
export {
  TemplateCard, TemplateCardSkeleton,
  TemplateSelector,
  BuildConfigForm, LANGUAGES,
  BuildConfigModal,
  PatchEditor, NewPatchForm, OPERATION_CONFIG,
  PatchList, PatchPreview, PatchSummary,
  DependencyManager, DependencyItem, DependencyList
} from "./components/build/index.js";

// ===== HOOKS =====
export {
  useOrchestrator,
  useFactory, FACTORY_STATE,
  useEventBus, useBuildEvents, FACTORY_EVENTS,
  useLogStream, LOG_LEVEL, LOG_SOURCE,
  useBuildConfig
} from "./hooks/index.js";

// ===== STATE =====
export {
  AppContext, AppProvider,
  useAppContext, useAppState, useAppActions,
  ACTION
} from "./state/index.js";

// ===== SERVICES =====
export {
  API,
  createLogService,
  createArtifactService, ARTIFACT_TYPE, FILE_TYPE, FILE_EXTENSIONS,
  createBuildService, BUILD_TEMPLATE, TEMPLATE_DEFINITIONS, PATCH_OPERATION
} from "./services/index.js";

// ===== THEME =====
export {
  COLORS, withOpacity, getStatusColor, getEnergyColor,
  TYPOGRAPHY, FONT_FAMILY, FONT_SIZE, LINE_HEIGHT, FONT_WEIGHT,
  SPACING, RADIUS, ICON_SIZE, AVATAR_SIZE, Z_INDEX, DURATION, BREAKPOINT,
  SHADOWS, GLOW_DEFINITIONS, getShadow, getGlow,
  THEME
} from "./theme/index.js";

// ===== UTILS =====
export {
  formatBytes, formatDuration, formatRelativeTime,
  formatISODate, formatTime, truncate,
  formatNumber, formatPercent, capitalize, camelToTitle
} from "./utils/index.js";