import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import AttendanceScreen from "./src/screens/AttendanceScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import InventoryScreen from "./src/screens/InventoryScreen";
import LoginScreen from "./src/screens/LoginScreen";
import PartnersScreen from "./src/screens/PartnersScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import TransactionsScreen from "./src/screens/TransactionsScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";

function RootScreen() {
  const { isLoading, user, userToken, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const hasPermission = (permission) => permissions.length === 0 || permissions.includes(permission);
  const primaryRole = String(user?.role || user?.role_name || "").toLowerCase();
  const canViewAttendance = ["owner", "manager"].includes(primaryRole) || hasPermission("manage_users");

  const tabs = useMemo(
    () =>
      [
      hasPermission("view_reports") ? { key: "dashboard", label: "Dashboard", component: <DashboardScreen /> } : null,
      { key: "partners", label: "Partners", component: <PartnersScreen /> },
      { key: "inventory", label: "Inventory", component: <InventoryScreen /> },
      { key: "transactions", label: "Transactions", component: <TransactionsScreen /> },
      canViewAttendance ? { key: "attendance", label: "Attendance", component: <AttendanceScreen /> } : null,
      { key: "profile", label: "Profile", component: <UserProfileScreen /> },
      hasPermission("manage_users") ? { key: "settings", label: "Settings", component: <SettingsScreen /> } : null
    ].filter(Boolean),
    [canViewAttendance, permissions, primaryRole]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#176b87" />
      </View>
    );
  }

  if (!userToken) {
    return <LoginScreen />;
  }

  const active = tabs.find((item) => item.key === activeTab) || tabs[0];

  return (
    <View style={styles.appShell}>
      <View style={styles.shellHeader}>
        <View>
          <Text style={styles.shellBrand}>TradeMeter</Text>
          <Text style={styles.shellMeta}>{user?.company || "Mobile workspace"}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Role: {user?.role || "User"}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutBtnText}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.contentArea}>{active.component}</View>
      <View style={styles.tabBarWrap}>
        <ScrollView contentContainerStyle={styles.tabBar} horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabButton, active.key === tab.key ? styles.tabButtonActive : null]}
            >
              <Text style={[styles.tabLabel, active.key === tab.key ? styles.tabLabelActive : null]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootScreen />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    backgroundColor: "#f6f8fb",
    flex: 1
  },
  contentArea: {
    flex: 1
  },
  shellHeader: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#dce5ef",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10
  },
  shellBrand: {
    color: "#102033",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0
  },
  shellMeta: {
    color: "#526174",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  roleBadge: {
    backgroundColor: "#e6f0f5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  roleBadgeText: {
    color: "#176b87",
    fontSize: 12,
    fontWeight: "800"
  },
  signOutBtn: {
    borderColor: "#cbd6e2",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  signOutBtnText: {
    color: "#526174",
    fontSize: 12,
    fontWeight: "800"
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: "#f6f8fb",
    flex: 1,
    justifyContent: "center"
  },
  tabBarWrap: {
    backgroundColor: "#ffffff",
    borderTopColor: "#dce5ef",
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8
  },
  tabBar: {
    gap: 8,
    paddingHorizontal: 10
  },
  tabButton: {
    alignItems: "center",
    backgroundColor: "#edf2f8",
    borderRadius: 999,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  tabButtonActive: {
    backgroundColor: "#176b87"
  },
  tabLabel: {
    color: "#274057",
    fontSize: 12,
    fontWeight: "800"
  },
  tabLabelActive: {
    color: "#ffffff"
  }
});
