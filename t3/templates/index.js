// t3/templates/index.js

import { EXPO_APP_TEMPLATE  } from "./expo-app/index.js";
import { WEB_REACT_TEMPLATE } from "./web-react/index.js";
import { ROBLOX_RBX_TEMPLATE } from "./roblox-rbx/index.js";

export var TEMPLATES = {
  "expo-app":   EXPO_APP_TEMPLATE,
  "web-react":  WEB_REACT_TEMPLATE,
  "roblox-rbx": ROBLOX_RBX_TEMPLATE,
};

export function getTemplate(target) {
  var t = TEMPLATES[target];
  if (!t) throw new Error(
    'Tuntematon template-target: "' + target + '". Saatavilla: ' + Object.keys(TEMPLATES).join(", ")
  );
  return t;
}

export { EXPO_APP_TEMPLATE, WEB_REACT_TEMPLATE, ROBLOX_RBX_TEMPLATE };
export default TEMPLATES;