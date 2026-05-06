import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  changeEmailRequest,
  changePasswordRequest,
  heartbeatPresenceRequest,
  loadMessagingRequest,
  loadPerformanceSummaryRequest,
  loadUserProfileRequest,
  markMessageReadRequest,
  markMessagesReadRequest,
  sendMessageRequest
} from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function UserProfileScreen() {
  const { csrfToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({});
  const [messages, setMessages] = useState({});
  const [performance, setPerformance] = useState({});
  const [emailForm, setEmailForm] = useState({ email: "", password: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [composeForm, setComposeForm] = useState({ recipient_user_id: "", category: "info", subject: "", body: "" });

  const load = useCallback(
    async (mode = "load") => {
      setError("");
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [profileRes, messagesRes, performanceRes] = await Promise.all([
          loadUserProfileRequest({ csrfToken }),
          loadMessagingRequest({ csrfToken }),
          loadPerformanceSummaryRequest({ csrfToken })
        ]);

        const profileRow = profileRes.data || profileRes.user || {};
        setProfile(profileRow);
        setMessages(messagesRes.data || {});
        setPerformance(performanceRes.data || {});
        setEmailForm((prev) => ({
          ...prev,
          email: String(profileRow.email || "")
        }));
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

  useEffect(() => {
    const timer = setInterval(() => {
      heartbeatPresenceRequest({ csrfToken }).catch(() => {});
    }, 20000);
    return () => clearInterval(timer);
  }, [csrfToken]);

  const displayName = profile.full_name || profile.name || user?.name || "User";
  const role = profile.role_name || profile.role || user?.role || "user";
  const inbox = Array.isArray(messages.inbox) ? messages.inbox : [];
  const peers = Array.isArray(messages.users) ? messages.users : [];
  const selectedRecipient = peers.find((item) => String(item.user_id) === String(composeForm.recipient_user_id || ""));

  async function saveEmail() {
    setError("");
    if (!String(emailForm.email || "").trim() || !emailForm.password) {
      setError("Email and current password are required.");
      return;
    }

    setSaving(true);
    try {
      await changeEmailRequest({ email: emailForm.email.trim(), password: emailForm.password, csrfToken });
      setEmailForm((prev) => ({ ...prev, password: "" }));
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not change email.");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    setError("");
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError("Complete all password fields.");
      return;
    }

    setSaving(true);
    try {
      await changePasswordRequest({ ...passwordForm, csrfToken });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (requestError) {
      setError(requestError.message || "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  async function sendMessage() {
    setError("");
    const recipient = Number(composeForm.recipient_user_id || 0);
    if (recipient <= 0 || !composeForm.subject.trim() || !composeForm.body.trim()) {
      setError("Recipient, subject, and message body are required.");
      return;
    }

    setSaving(true);
    try {
      await sendMessageRequest({
        recipient_user_id: recipient,
        category: composeForm.category,
        subject: composeForm.subject.trim(),
        body: composeForm.body.trim(),
        csrfToken
      });
      setComposeForm((prev) => ({ ...prev, subject: "", body: "" }));
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not send message.");
    } finally {
      setSaving(false);
    }
  }

  async function markAsRead(messageId) {
    setSaving(true);
    try {
      await markMessageReadRequest({ message_id: messageId, csrfToken });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not update message status.");
    } finally {
      setSaving(false);
    }
  }

  async function markAllUnreadAsRead() {
    const unreadIds = inbox.filter((item) => Number(item.is_read || 0) === 0).map((item) => Number(item.message_id || 0));
    if (unreadIds.length === 0) {
      return;
    }

    setSaving(true);
    try {
      await markMessagesReadRequest({ message_ids: unreadIds, csrfToken });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not mark messages as read.");
    } finally {
      setSaving(false);
    }
  }

  function fmtEpoch(epoch) {
    const ts = Number(epoch || 0);
    if (!ts) return "-";
    return new Date(ts * 1000).toLocaleString();
  }

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
          <Text style={styles.sectionTitle}>Account Security</Text>
          <Text style={styles.label}>Change Email</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(value) => setEmailForm((prev) => ({ ...prev, email: value }))}
            placeholder="New email"
            placeholderTextColor="#8a97a8"
            style={styles.input}
            value={emailForm.email}
          />
          <TextInput
            onChangeText={(value) => setEmailForm((prev) => ({ ...prev, password: value }))}
            placeholder="Current password"
            placeholderTextColor="#8a97a8"
            secureTextEntry
            style={styles.input}
            value={emailForm.password}
          />
          <TouchableOpacity disabled={saving} onPress={saveEmail} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Update email"}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Change Password</Text>
          <TextInput
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))}
            placeholder="Current password"
            placeholderTextColor="#8a97a8"
            secureTextEntry
            style={styles.input}
            value={passwordForm.currentPassword}
          />
          <TextInput
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
            placeholder="New password"
            placeholderTextColor="#8a97a8"
            secureTextEntry
            style={styles.input}
            value={passwordForm.newPassword}
          />
          <TextInput
            onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
            placeholder="Confirm new password"
            placeholderTextColor="#8a97a8"
            secureTextEntry
            style={styles.input}
            value={passwordForm.confirmPassword}
          />
          <TouchableOpacity disabled={saving} onPress={savePassword} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{saving ? "Please wait..." : "Update password"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Performance</Text>
          {performance?.can_view === false ? (
            <Text style={styles.value}>{performance.message || "Performance summary is not available."}</Text>
          ) : (
            <>
              <Text style={styles.label}>GPI</Text>
              <Text style={styles.value}>{String(performance?.summary?.gpi ?? "-")}</Text>
              <Text style={styles.label}>Attendance Days</Text>
              <Text style={styles.value}>{String(performance?.summary?.attendance_days ?? 0)}</Text>
              <Text style={styles.label}>Late Days</Text>
              <Text style={styles.value}>{String(performance?.summary?.late_days ?? 0)}</Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Messaging</Text>
          <Text style={styles.label}>Unread Messages</Text>
          <Text style={styles.value}>{String(Number(messages.unread_count || 0))}</Text>

          <Text style={styles.label}>Compose Message</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={(value) => setComposeForm((prev) => ({ ...prev, recipient_user_id: value }))}
            placeholder="Recipient user ID"
            placeholderTextColor="#8a97a8"
            style={styles.input}
            value={composeForm.recipient_user_id}
          />
          <Text style={styles.pickHint}>Tap a teammate chip or type an ID.</Text>
          <View style={styles.quickPickWrap}>
            <Text style={styles.quickPickTitle}>Quick pick teammate</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickPickRow}>
                {peers.slice(0, 15).map((item) => {
                  const id = String(item.user_id || "");
                  const active = String(composeForm.recipient_user_id || "") === id;
                  return (
                    <TouchableOpacity
                      key={`peer-${id}`}
                      onPress={() => setComposeForm((prev) => ({ ...prev, recipient_user_id: id }))}
                      style={[styles.quickPickChip, active ? styles.quickPickChipActive : null]}
                    >
                      <Text style={[styles.quickPickChipText, active ? styles.quickPickChipTextActive : null]}>
                        #{id} {item.full_name || "User"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          {selectedRecipient ? <Text style={styles.selectedMeta}>Selected: {selectedRecipient.full_name} ({selectedRecipient.email || "-"})</Text> : null}
          <Text style={styles.helper}>Team users: {peers.map((item) => `${item.user_id}:${item.full_name}`).slice(0, 8).join(" | ") || "none"}</Text>
          <View style={styles.filterRow}>
            {["info", "report", "suggestion"].map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setComposeForm((prev) => ({ ...prev, category: item }))}
                style={[styles.filterBtn, composeForm.category === item ? styles.filterBtnActive : null]}
              >
                <Text style={[styles.filterBtnText, composeForm.category === item ? styles.filterBtnTextActive : null]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            onChangeText={(value) => setComposeForm((prev) => ({ ...prev, subject: value }))}
            placeholder="Subject"
            placeholderTextColor="#8a97a8"
            style={styles.input}
            value={composeForm.subject}
          />
          <TextInput
            multiline
            onChangeText={(value) => setComposeForm((prev) => ({ ...prev, body: value }))}
            placeholder="Message body"
            placeholderTextColor="#8a97a8"
            style={[styles.input, styles.textArea]}
            value={composeForm.body}
          />
          <TouchableOpacity disabled={saving} onPress={sendMessage} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Send message"}</Text>
          </TouchableOpacity>

          <TouchableOpacity disabled={saving} onPress={markAllUnreadAsRead} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Mark all unread as read</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Inbox ({inbox.length})</Text>
          {inbox.slice(0, 10).map((item) => (
            <View key={`msg-${item.message_id}`} style={styles.messageItem}>
              <Text style={styles.value}>{item.subject || "(No subject)"}</Text>
              <Text style={styles.meta}>From: {item.sender_name || "-"}</Text>
              <Text style={styles.meta}>{fmtEpoch(item.created_at)}</Text>
              <Text style={styles.meta}>{item.body || ""}</Text>
              {Number(item.is_read || 0) === 0 ? (
                <TouchableOpacity disabled={saving} onPress={() => markAsRead(item.message_id)} style={styles.inlineBtn}>
                  <Text style={styles.inlineBtnText}>Mark read</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.readTag}>Read</Text>
              )}
            </View>
          ))}
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
  sectionTitle: { color: "#102033", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  label: { color: "#6d7b8e", fontSize: 11, fontWeight: "700", marginTop: 4 },
  value: { color: "#102033", fontSize: 14, fontWeight: "800" },
  meta: { color: "#5f6e82", fontSize: 12, fontWeight: "600" },
  error: { color: "#b3261e", fontSize: 13, fontWeight: "700" },
  helper: { color: "#5f6e82", fontSize: 11, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#d5e0ec",
    borderRadius: 8,
    borderWidth: 1,
    color: "#102033",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top"
  },
  primaryBtn: {
    alignItems: "center",
    backgroundColor: "#176b87",
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 10
  },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  secondaryBtn: {
    alignItems: "center",
    backgroundColor: "#e8eef5",
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 10
  },
  secondaryBtnText: { color: "#2b435b", fontSize: 13, fontWeight: "800" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  filterBtn: { backgroundColor: "#edf2f8", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  filterBtnActive: { backgroundColor: "#176b87" },
  filterBtnText: { color: "#355066", fontSize: 11, fontWeight: "700" },
  filterBtnTextActive: { color: "#fff" },
  messageItem: { borderColor: "#e2eaf2", borderTopWidth: 1, gap: 3, marginTop: 10, paddingTop: 8 },
  inlineBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#e9f5f9",
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  inlineBtnText: { color: "#176b87", fontSize: 11, fontWeight: "800" },
  readTag: { color: "#2d7f55", fontSize: 11, fontWeight: "800", marginTop: 4 },
  quickPickWrap: { marginTop: 8 },
  quickPickTitle: { color: "#55667b", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  quickPickRow: { flexDirection: "row", gap: 6, paddingRight: 12 },
  quickPickChip: {
    backgroundColor: "#edf2f8",
    borderColor: "#d6e2ee",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  quickPickChipActive: { backgroundColor: "#176b87", borderColor: "#176b87" },
  quickPickChipText: { color: "#355066", fontSize: 11, fontWeight: "700" },
  quickPickChipTextActive: { color: "#fff" },
  selectedMeta: { color: "#355066", fontSize: 11, fontWeight: "700", marginTop: 6 },
  pickHint: { color: "#63758a", fontSize: 11, fontWeight: "600", marginTop: 4 }
});
