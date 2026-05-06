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
  const { isLoading, userToken } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabs = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", component: <DashboardScreen /> },
      { key: "partners", label: "Partners", component: <PartnersScreen /> },
      { key: "inventory", label: "Inventory", component: <InventoryScreen /> },
      { key: "transactions", label: "Transactions", component: <TransactionsScreen /> },
      { key: "attendance", label: "Attendance", component: <AttendanceScreen /> },
      { key: "profile", label: "Profile", component: <UserProfileScreen /> },
      { key: "settings", label: "Settings", component: <SettingsScreen /> }
    ],
    []
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
