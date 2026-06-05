// s4/navigation/AppNavigator.js
// AF51 Product Edition Navigator
// Scope: visible navigation cleanup only. Backend / factory pipeline untouched.

import React, { useState } from "react";
import { OllamaChatScreen } from '../screens/OllamaChat/index.js';
import { useAppState } from "../state/AppContext.js";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { ROUTES, TAB_CONFIG_PRODUCT } from "./routes.js";
import { PublishCenterScreen } from "../screens/PublishCenter/index.js";
import { MasterRoomUI } from "../../ui/MasterRoomUI.js";
import { RbxProductionCockpit } from "../screens/Cockpit/RbxProductionCockpit.js";

var Tab = createBottomTabNavigator();

function OfflineBanner() {
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerText}>⚠ Offline — cached data visible</Text>
    </View>
  );
}

function CustomTabBar(props) {
  var state = props.state;
  var descriptors = props.descriptors;
  var navigation = props.navigation;

  return (
    <View style={styles.tabBar}>
      {state.routes.map(function(route, index) {
        var descriptor = descriptors[route.key];
        var options = descriptor.options;
        var isFocused = state.index === index;
        var tabConfig = TAB_CONFIG_PRODUCT.find(function(t) { return t.name === route.name; }) || { label: route.name, icon: "●", iconFocused: "●" };

        function onPress() {
          var event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        }

        function onLongPress() {
          navigation.emit({ type: "tabLongPress", target: route.key });
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.tab, isFocused && styles.tabFocused]}
          >
            <Text style={[styles.tabIcon, isFocused && styles.tabIconFocused]}>{isFocused ? tabConfig.iconFocused : tabConfig.icon}</Text>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>{tabConfig.label}</Text>
            {isFocused ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function AppNavigator(props) {
  var orchestrator = props.orchestrator;
  var factory = props.factory;
  var screenProps = { orchestrator: orchestrator, factory: factory };

  var sharedPreviewState = useState(null);
  var sharedPreviewCode = sharedPreviewState[0];
  var setSharedPreviewCode = sharedPreviewState[1];

  var appState = useAppState();
  var isOffline = appState && appState.connectionStatus === "offline";

  return (
    <NavigationContainer>
      {isOffline ? <OfflineBanner /> : null}
      <Tab.Navigator
        initialRouteName={ROUTES.MASTER_ROOM}
        tabBar={function(tabProps) { return <CustomTabBar {...tabProps} />; }}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name={ROUTES.MASTER_ROOM}>
          {function(navProps) {
            return (
              <MasterRoomUI
                {...navProps}
                orchestrator={orchestrator}
                sharedPreviewCode={sharedPreviewCode}
                onNavigateToPreview={function(source) {
                  setSharedPreviewCode(source);
                }}
              />
            );
          }}
        </Tab.Screen>

        <Tab.Screen name={ROUTES.COCKPIT}>
          {function() { return <RbxProductionCockpit />; }}
        </Tab.Screen>

        <Tab.Screen name={ROUTES.PUBLISH_CENTER}>
          {function() { return <PublishCenterScreen />; }}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

var styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#050806",
    borderTopWidth: 1,
    borderTopColor: "rgba(142,255,102,0.18)",
    paddingBottom: 16,
    paddingTop: 8,
    paddingHorizontal: 8
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 12,
    position: "relative"
  },
  tabFocused: {
    backgroundColor: "rgba(87,255,104,0.10)"
  },
  tabIcon: {
    fontSize: 17,
    color: "#728474",
    marginBottom: 2
  },
  tabIconFocused: {
    color: "#8bd85f"
  },
  tabLabel: {
    color: "#728474",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  tabLabelFocused: {
    color: "#dfffdc"
  },
  tabIndicator: {
    position: "absolute",
    top: -8,
    width: 24,
    height: 3,
    backgroundColor: "#8bd85f",
    borderRadius: 2
  },
  offlineBanner: {
    backgroundColor: "#7f1d1d",
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  offlineBannerText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "700"
  }
});

export { AppNavigator };
export default AppNavigator;