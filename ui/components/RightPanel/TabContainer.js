// factory-ui/components/RightPanel/TabContainer.js
// Tab container for right panel

import React from "react";
import { COLORS, SIZES } from "../../styles/theme.js";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%"
  },
  
  tabs: {
    display: "flex",
    borderBottom: `1px solid ${COLORS.gray700}`,
    backgroundColor: COLORS.blackMatte,
    overflowX: "auto"
  },
  
  tab: {
    padding: `${SIZES.spacing.sm} ${SIZES.spacing.md}`,
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: COLORS.gray400,
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    whiteSpace: "nowrap"
  },
  
  tabActive: {
    color: COLORS.lime,
    borderBottomColor: COLORS.lime
  },
  
  content: {
    flex: 1,
    overflow: "hidden"
  }
};

export function TabContainer({ tabs, activeTab, onTabChange, children }) {
  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div style={styles.content}>
        {children}
      </div>
    </div>
  );
}

export default TabContainer;