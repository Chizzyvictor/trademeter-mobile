import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadMessagingRequest, loadUserProfileRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function UserProfileScreen() {
  const { csrfToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({});
  const [messages, setMessages] = useState({});

  const load = useCallback(
    async (mode = "load") => {
      setError("");
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [profileRes, messagesRes] = await Promise.all([
          loadUserProfileRequest({ csrfToken }),
          loadMessagingRequest({ csrfToken })
        ]);

        setProfile(profileRes.data || profileRes.user || {});
        setMessages(messagesRes.data || {});
      } catch (requestError) {
        setError(requestError.message || "Could not load profile.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [csrfToken]
  );

  useEffect(() => {
    load();
  }, [load]);

  const displayName = profile.full_name || profile.name || user?.name || "User";
  const role = profile.role_name || profile.role || user?.role || "user";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        <Text style={styles.title}>User Profile</Text>
        <Text style={styles.subtitle}>Identity and messaging overview</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={styles.loader} color="#176b87" /> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{displayName}</Text>

          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{String(role).toUpperCase()}</Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile.email || "-"}</Text>

          <Text style={styles.label}>Company</Text>
          <Text style={styles.value}>{profile.company_name || user?.company || "-"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Unread Messages</Text>
          <Text style={styles.value}>{String(Number(messages.unread_count || 0))}</Text>

          <Text style={styles.label}>Total Messages</Text>
          <Text style={styles.value}>{String(Number(messages.total_count || 0))}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f6f8fb", flex: 1 },
  content: { gap: 12, padding: 18, paddingBottom: 36 },
  title: { color: "#102033", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#5f6e82", fontSize: 13, fontWeight: "600" },
  loader: { marginVertical: 12 },
  card: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, gap: 4, padding: 12 },
  label: { color: "#6d7b8e", fontSize: 11, fontWeight: "700", marginTop: 4 },
  value: { color: "#102033", fontSize: 14, fontWeight: "800" },
  error: { color: "#b3261e", fontSize: 13, fontWeight: "700" }
});
