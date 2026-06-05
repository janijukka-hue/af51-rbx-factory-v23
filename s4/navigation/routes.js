// s4/navigation/routes.js
// ALX Factory - Route Definitions
// Version: 1.6.0 - Basic/Power User tab modes

var ROUTES = {
  // Main tabs
  COMMAND_CENTER:   "CommandCenter",
  JOBS_QUEUE:       "JobsQueue",
  PREVIEW:          "Preview",
  ARTIFACT_BROWSER: "ArtifactBrowser",
  LOG_STREAM:       "LogStream",
  REPORTS:          "Reports",
  MASTER_ROOM:      "MasterRoom",
  COCKPIT:          "Cockpit",
  OLLAMA_CHAT:      "OllamaChat",
  PUBLISH_CENTER:   "PublishCenter",
  WORK_VAULT:       "WorkVault",
  DEBUG:            "Debug",
  SETTINGS:         "Settings",

  // Stack screens (within tabs)
  JOB_DETAILS:      "JobDetails",
  ARTIFACT_DETAILS: "ArtifactDetails",
  FILE_VIEWER:      "FileViewer",

  // Build screens
  BUILD_WIZARD:     "BuildWizard",

  // Modals
  BUILD_CONFIG:     "BuildConfig",
  LLM_CONFIG:       "LLMConfig"
};

// BASIC MODE — 5 tärkeintä tabbia, ei teknistä hälyä
var TAB_CONFIG_BASIC = [
  { name: ROUTES.MASTER_ROOM,      label: "Builder",   icon: "🏭", iconFocused: "🏭" },
  { name: ROUTES.BUILD_WIZARD,     label: "Build",     icon: "⚡", iconFocused: "⚡" },
  { name: ROUTES.PREVIEW,          label: "Preview",   icon: "▶",  iconFocused: "▶"  },
  { name: ROUTES.ARTIFACT_BROWSER, label: "Varasto",   icon: "📦", iconFocused: "📦" },
  { name: ROUTES.WORK_VAULT,       label: "Työt",      icon: "💼", iconFocused: "💼" },
  { name: ROUTES.PUBLISH_CENTER,   label: "Julkaisut", icon: "🚀", iconFocused: "🚀" },
  { name: ROUTES.SETTINGS,         label: "Settings",  icon: "⚙",  iconFocused: "⚙"  },
];

// POWER USER MODE — kaikki tabit näkyvissä
var TAB_CONFIG_POWER = [
  { name: ROUTES.MASTER_ROOM,      label: "ALX",       icon: "🤖", iconFocused: "🤖" },
  { name: ROUTES.COMMAND_CENTER,   label: "Command",   icon: "⌘",  iconFocused: "⌘"  },
  { name: ROUTES.BUILD_WIZARD,     label: "Build",     icon: "⚡", iconFocused: "⚡" },
  { name: ROUTES.PREVIEW,          label: "Preview",   icon: "▶",  iconFocused: "▶"  },
  { name: ROUTES.ARTIFACT_BROWSER, label: "Artifacts", icon: "📦", iconFocused: "📦" },
  { name: ROUTES.JOBS_QUEUE,       label: "Jobs",      icon: "☰",  iconFocused: "☰"  },
  { name: ROUTES.REPORTS,          label: "Reports",   icon: "📊", iconFocused: "📊" },
  { name: ROUTES.LOG_STREAM,       label: "Logs",      icon: "☷",  iconFocused: "☷"  },
  { name: ROUTES.DEBUG,            label: "Debug",     icon: "🐛", iconFocused: "🐛" },
  { name: ROUTES.SETTINGS,         label: "Settings",  icon: "⚙",  iconFocused: "⚙"  }
];

// PRODUCT MODE — public builder + essential production controls
var TAB_CONFIG_PRODUCT = [
  { name: ROUTES.MASTER_ROOM,    label: "Builder",  icon: "🏭", iconFocused: "🏭" },
  { name: ROUTES.COCKPIT,        label: "Cockpit",  icon: "🎬", iconFocused: "🎬" },
  { name: ROUTES.PREVIEW,        label: "Preview",  icon: "▶",  iconFocused: "▶"  },
  { name: ROUTES.WORK_VAULT,     label: "Vault",    icon: "📦", iconFocused: "📦" },
  { name: ROUTES.PUBLISH_CENTER, label: "ZIP",      icon: "🚀", iconFocused: "🚀" },
  { name: ROUTES.SETTINGS,       label: "Settings", icon: "⚙",  iconFocused: "⚙"  }
];

// Oletus (backward compat)
var TAB_CONFIG = TAB_CONFIG_BASIC;

var STACK_CONFIG = {
  JOBS: [
    { name: ROUTES.JOBS_QUEUE,   component: "JobsQueueScreen"  },
    { name: ROUTES.JOB_DETAILS,  component: "JobDetailsScreen" }
  ],
  ARTIFACTS: [
    { name: ROUTES.ARTIFACT_BROWSER, component: "ArtifactBrowserScreen"  },
    { name: ROUTES.ARTIFACT_DETAILS, component: "ArtifactDetailsScreen"  },
    { name: ROUTES.FILE_VIEWER,      component: "FileViewerScreen"        }
  ],
  BUILD: [
    { name: ROUTES.BUILD_WIZARD, component: "BuildWizardScreen" }
  ]
};

export { ROUTES, TAB_CONFIG, TAB_CONFIG_BASIC, TAB_CONFIG_POWER, TAB_CONFIG_PRODUCT, STACK_CONFIG };
export default ROUTES;