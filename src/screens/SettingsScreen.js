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
  createUserRequest,
  createBackupRequest,
  getBackupCapabilityRequest,
  loadActiveSessionsRequest,
  loadBackupAuditRequest,
  loadBackupsRequest,
  loadLoginLogsRequest,
  loadRememberAuditRequest,
  loadRolesRequest,
  loadSettingsRequest,
  loadUsersRequest,
  revokeSessionRequest,
  restoreBackupRequest,
  seedDemoUsersRequest,
  toggleUserStatusRequest,
  updateProfileRequest,
  updateUserRoleRequest
} from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function SettingsScreen() {
  const { csrfToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({});
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [profileForm, setProfileForm] = useState({ cName: "", cEmail: "" });
  const [createUserForm, setCreateUserForm] = useState({ full_name: "", email: "", password: "", role_id: "" });
  const [roleDraft, setRoleDraft] = useState({});
  const [rememberAudit, setRememberAudit] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [loginStatusFilter, setLoginStatusFilter] = useState("all");
  const [backupCapability, setBackupCapability] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupAudit, setBackupAudit] = useState([]);
  const [restoreFilename, setRestoreFilename] = useState("");
  const [seededUsers, setSeededUsers] = useState([]);
  const [confirmId, setConfirmId] = useState("");

  const isOwner = String(user?.role || "").toLowerCase() === "owner";

  const load = useCallback(
    async (mode = "load") => {
      setError("");
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [settingsRes, usersRes, rolesRes] = await Promise.all([
          loadSettingsRequest({ csrfToken }),
          loadUsersRequest({ csrfToken }),
          loadRolesRequest({ csrfToken })
        ]);

        const settingsRow = settingsRes.data || {};
        const usersRows = Array.isArray(usersRes.data) ? usersRes.data : [];
        const roleRows = Array.isArray(rolesRes.data) ? rolesRes.data : [];

        setSettings(settingsRow);
        setUsers(usersRows);
        setRoles(roleRows);
        setProfileForm({
          cName: String(settingsRow.cName || ""),
          cEmail: String(settingsRow.cEmail || "")
        });

        const [rememberRes, sessionsRes, logsRes, capabilityRes, backupsRes, backupAuditRes] = await Promise.allSettled([
          loadRememberAuditRequest({ csrfToken }),
          loadActiveSessionsRequest({ csrfToken }),
          loadLoginLogsRequest({ status: loginStatusFilter, csrfToken }),
          getBackupCapabilityRequest({ csrfToken }),
          loadBackupsRequest({ csrfToken }),
          loadBackupAuditRequest({ csrfToken })
        ]);

        setRememberAudit(rememberRes.status === "fulfilled" && Array.isArray(rememberRes.value?.data) ? rememberRes.value.data : []);
        setSessions(sessionsRes.status === "fulfilled" && Array.isArray(sessionsRes.value?.data) ? sessionsRes.value.data : []);
        setLoginLogs(logsRes.status === "fulfilled" && Array.isArray(logsRes.value?.data) ? logsRes.value.data : []);
        setBackupCapability(capabilityRes.status === "fulfilled" ? capabilityRes.value?.data || null : null);
        setBackups(backupsRes.status === "fulfilled" && Array.isArray(backupsRes.value?.data) ? backupsRes.value.data : []);
        setBackupAudit(backupAuditRes.status === "fulfilled" && Array.isArray(backupAuditRes.value?.data) ? backupAuditRes.value.data : []);
      } catch (requestError) {
        setError(requestError.message || "Could not load settings.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [csrfToken, loginStatusFilter]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile() {
    setError("");
    if (!profileForm.cName.trim() || !profileForm.cEmail.trim()) {
      setError("Company name and email are required.");
      return;
    }

    setSaving(true);
    try {
      await updateProfileRequest({ ...profileForm, csrfToken });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function createUser() {
    setError("");
    if (!createUserForm.full_name.trim() || !createUserForm.email.trim() || !createUserForm.password || !createUserForm.role_id) {
      setError("Full name, email, password, and role_id are required.");
      return;
    }

    setSaving(true);
    try {
      await createUserRequest({ ...createUserForm, role_id: Number(createUserForm.role_id), csrfToken });
      setCreateUserForm({ full_name: "", email: "", password: "", role_id: "" });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRole(user) {
    const roleId = Number(roleDraft[user.user_id] || user.role_id || 0);
    if (!roleId) {
      setError("Select a valid role ID.");
      return;
    }

    setSaving(true);
    try {
      await updateUserRoleRequest({ user_id: user.user_id, role_id: roleId, csrfToken });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not update user role.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(userRow) {
    const willDeactivate = Number(userRow.is_active || 0) === 1;
    const key = `toggle-${userRow.user_id}`;
    if (willDeactivate && confirmId !== key) {
      setConfirmId(key);
      return;
    }
    setConfirmId("");
    setSaving(true);
    try {
      await toggleUserStatusRequest({
        user_id: userRow.user_id,
        is_active: willDeactivate ? 0 : 1,
        csrfToken
      });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not toggle user status.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeSession(sessionId) {
    const key = `revoke-${sessionId}`;
    if (confirmId !== key) {
      setConfirmId(key);
      return;
    }
    setConfirmId("");
    setSaving(true);
    try {
      await revokeSessionRequest({ session_id: sessionId, csrfToken });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not revoke session.");
    } finally {
      setSaving(false);
    }
  }

  async function createBackup() {
    setSaving(true);
    try {
      await createBackupRequest({ csrfToken });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not create backup.");
    } finally {
      setSaving(false);
    }
  }

  async function seedDemoUsers() {
    setError("");
    setSaving(true);
    try {
      const response = await seedDemoUsersRequest({ csrfToken });
      setSeededUsers(Array.isArray(response?.data) ? response.data : []);
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not seed demo users.");
    } finally {
      setSaving(false);
    }
  }

  async function restoreBackup() {
    setError("");
    const filename = String(restoreFilename || "").trim();
    if (!filename) {
      setError("Enter a backup filename to restore.");
      return;
    }

    const key = `restore-${filename}`;
    if (confirmId !== key) {
      setConfirmId(key);
      return;
    }
    setConfirmId("");
    setSaving(true);
    try {
      await restoreBackupRequest({ filename, csrfToken });
      setRestoreFilename("");
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not restore backup.");
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
        <Text style={styles.title}>Settings & Admin</Text>
        <Text style={styles.subtitle}>Company profile and user management snapshot</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={styles.loader} color="#176b87" /> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Company Profile</Text>
          <Input label="Company Name" value={profileForm.cName} onChangeText={(value) => setProfileForm((prev) => ({ ...prev, cName: value }))} />
          <Input label="Company Email" value={profileForm.cEmail} onChangeText={(value) => setProfileForm((prev) => ({ ...prev, cEmail: value }))} />
          <TouchableOpacity disabled={saving} onPress={saveProfile} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Save profile"}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Company Name</Text>
          <Text style={styles.value}>{settings.cName || settings.company_name || "-"}</Text>
          <Text style={styles.label}>Company Email</Text>
          <Text style={styles.value}>{settings.cEmail || settings.company_email || "-"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create User</Text>
          <Input label="Full Name" value={createUserForm.full_name} onChangeText={(value) => setCreateUserForm((prev) => ({ ...prev, full_name: value }))} />
          <Input label="Email" value={createUserForm.email} onChangeText={(value) => setCreateUserForm((prev) => ({ ...prev, email: value }))} />
          <Input label="Password" value={createUserForm.password} onChangeText={(value) => setCreateUserForm((prev) => ({ ...prev, password: value }))} secureTextEntry />
          <Input label="Role ID" keyboardType="number-pad" value={createUserForm.role_id} onChangeText={(value) => setCreateUserForm((prev) => ({ ...prev, role_id: value }))} />
          <Text style={styles.helper}>Roles: {roles.map((item) => `${item.role_id}:${item.role_name}`).join(" | ") || "none"}</Text>
          <TouchableOpacity disabled={saving} onPress={createUser} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Create user"}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={saving} onPress={seedDemoUsers} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{saving ? "Please wait..." : "Seed demo users"}</Text>
          </TouchableOpacity>
          {seededUsers.length > 0 ? (
            <View style={styles.seedBox}>
              <Text style={styles.seedTitle}>Demo accounts</Text>
              {seededUsers.map((item, index) => (
                <Text key={`seed-${index}`} style={styles.seedText}>
                  {item.email || "-"} | {item.password || "-"}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Users ({users.length})</Text>
          {users.map((user, index) => (
            <View key={`u-${user.user_id || index}`} style={styles.userRow}>
              <Text style={styles.userName}>{user.full_name || user.name || "User"}</Text>
              <Text style={styles.userMeta}>{user.role_name || user.role || "-"}</Text>
              <Text style={styles.userMeta}>{Number(user.is_active || 0) === 1 ? "Active" : "Inactive"}</Text>
              <Input
                label="Role ID"
                keyboardType="number-pad"
                value={String(roleDraft[user.user_id] || user.role_id || "")}
                onChangeText={(value) => setRoleDraft((prev) => ({ ...prev, [user.user_id]: value }))}
              />
              <View style={styles.rowActions}>
                <TouchableOpacity disabled={saving} onPress={() => saveRole(user)} style={styles.inlineBtn}>
                  <Text style={styles.inlineBtnText}>Save role</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={saving}
                  onPress={() => toggleUser(user)}
                  style={[
                    styles.statusBtn,
                    Number(user.is_active || 0) === 1 && confirmId === `toggle-${user.user_id}` ? styles.statusBtnPending : null
                  ]}
                >
                  <Text style={styles.statusBtnText}>
                    {Number(user.is_active || 0) === 1
                      ? confirmId === `toggle-${user.user_id}` ? "Confirm deactivate" : "Deactivate"
                      : "Activate"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {!loading && users.length === 0 ? <Text style={styles.empty}>No users found.</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Remember Audit ({rememberAudit.length})</Text>
          {rememberAudit.slice(0, 8).map((row) => (
            <View key={`ra-${row.id}`} style={styles.userRow}>
              <Text style={styles.userName}>{row.full_name || "-"}</Text>
              <Text style={styles.userMeta}>{row.event_type || "-"}</Text>
              <Text style={styles.userMeta}>{fmtEpoch(row.created_at)}</Text>
            </View>
          ))}
          {!loading && rememberAudit.length === 0 ? <Text style={styles.empty}>No remember-token audit logs.</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Active Sessions ({sessions.length})</Text>
          {sessions.slice(0, 10).map((row) => (
            <View key={`s-${row.session_id || row.id}`} style={styles.userRow}>
              <Text style={styles.userName}>{row.full_name || "-"}</Text>
              <Text style={styles.userMeta}>{row.email || "-"}</Text>
              <Text style={styles.userMeta}>Last active: {fmtEpoch(row.last_activity)}</Text>
              <Text style={styles.userMeta}>{row.is_current ? "Current session" : "Remote session"}</Text>
              {!row.is_current ? (
                <TouchableOpacity
                  disabled={saving}
                  onPress={() => revokeSession(row.session_id)}
                  style={[styles.inlineBtn, confirmId === `revoke-${row.session_id}` ? styles.inlineBtnPending : null]}
                >
                  <Text style={styles.inlineBtnText}>
                    {confirmId === `revoke-${row.session_id}` ? "Confirm revoke" : "Revoke session"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {!loading && sessions.length === 0 ? <Text style={styles.empty}>No active sessions found.</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Login Logs ({loginLogs.length})</Text>
          <View style={styles.filterRow}>
            {[
              { key: "all", label: "All" },
              { key: "success", label: "Success" },
              { key: "failed", label: "Failed" },
              { key: "blocked", label: "Blocked" }
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => setLoginStatusFilter(item.key)}
                style={[styles.filterBtn, loginStatusFilter === item.key ? styles.filterBtnActive : null]}
              >
                <Text style={[styles.filterBtnText, loginStatusFilter === item.key ? styles.filterBtnTextActive : null]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {loginLogs.slice(0, 12).map((row) => (
            <View key={`ll-${row.id}`} style={styles.userRow}>
              <Text style={styles.userName}>{row.full_name || "-"}</Text>
              <Text style={styles.userMeta}>{row.status || "-"}</Text>
              <Text style={styles.userMeta}>{fmtEpoch(row.login_time)}</Text>
            </View>
          ))}
          {!loading && loginLogs.length === 0 ? <Text style={styles.empty}>No login logs for selected status.</Text> : null}
        </View>

        {isOwner ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Backup Center</Text>
            <Text style={styles.userMeta}>{backupCapability?.message || "Backup capability unavailable."}</Text>
            <Text style={styles.userMeta}>Retention days: {backupCapability?.retention_days || "-"}</Text>
            <Text style={styles.userMeta}>Scheduler hint: {backupCapability?.scheduler_hint || "-"}</Text>
            {backupCapability?.supported ? (
              <TouchableOpacity disabled={saving} onPress={createBackup} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Create backup"}</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.label}>Backup files ({backups.length})</Text>
            {backups.slice(0, 8).map((row) => (
              <View key={`b-${row.filename}`} style={styles.userRow}>
                <Text style={styles.userName}>{row.filename || "-"}</Text>
                <Text style={styles.userMeta}>Created: {fmtEpoch(row.created_at)}</Text>
                <Text style={styles.userMeta}>Size: {Number(row.size || 0)} bytes</Text>
                <TouchableOpacity disabled={saving} onPress={() => setRestoreFilename(String(row.filename || ""))} style={styles.inlineBtn}>
                  <Text style={styles.inlineBtnText}>Use filename</Text>
                </TouchableOpacity>
              </View>
            ))}

            <Input
              label="Restore filename"
              onChangeText={(value) => setRestoreFilename(value)}
              value={restoreFilename}
            />
            <TouchableOpacity
              disabled={saving}
              onPress={restoreBackup}
              style={[styles.secondaryBtn, confirmId === `restore-${restoreFilename.trim()}` ? styles.secondaryBtnPending : null]}
            >
              <Text style={styles.secondaryBtnText}>
                {saving ? "Please wait..." : confirmId === `restore-${restoreFilename.trim()}` ? "Tap again to confirm restore" : "Restore selected backup"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Backup audit ({backupAudit.length})</Text>
            {backupAudit.slice(0, 8).map((row) => (
              <View key={`ba-${row.id}`} style={styles.userRow}>
                <Text style={styles.userName}>{row.event_type || "-"}</Text>
                <Text style={styles.userMeta}>{row.filename || "-"}</Text>
                <Text style={styles.userMeta}>{fmtEpoch(row.created_at)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({ label, ...props }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput placeholderTextColor="#8a97a8" style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f6f8fb", flex: 1 },
  content: { gap: 12, padding: 18, paddingBottom: 36 },
  title: { color: "#102033", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#5f6e82", fontSize: 13, fontWeight: "600" },
  loader: { marginVertical: 12 },
  card: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, gap: 4, padding: 12 },
  sectionTitle: { color: "#102033", fontSize: 15, fontWeight: "800" },
  label: { color: "#6d7b8e", fontSize: 11, fontWeight: "700", marginTop: 4 },
  value: { color: "#102033", fontSize: 14, fontWeight: "800" },
  inputWrap: { marginTop: 8 },
  inputLabel: { color: "#55667b", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  input: {
    backgroundColor: "#f8fbff",
    borderColor: "#d9e3ef",
    borderRadius: 8,
    borderWidth: 1,
    color: "#102033",
    fontSize: 14,
    fontWeight: "600",
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  helper: { color: "#63758a", fontSize: 11, fontWeight: "600", marginTop: 6 },
  primaryBtn: { alignItems: "center", backgroundColor: "#176b87", borderRadius: 8, minHeight: 42, justifyContent: "center", marginTop: 10 },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  secondaryBtn: { alignItems: "center", backgroundColor: "#e8eef5", borderRadius: 8, minHeight: 42, justifyContent: "center", marginTop: 8 },
  secondaryBtnPending: { backgroundColor: "#f5e0dc", borderColor: "#c0392b", borderWidth: 2 },
  secondaryBtnText: { color: "#2b435b", fontSize: 13, fontWeight: "800" },
  userRow: { borderTopColor: "#edf2f7", borderTopWidth: 1, marginTop: 8, paddingTop: 8 },
  userName: { color: "#102033", fontSize: 13, fontWeight: "800" },
  userMeta: { color: "#5f6e82", fontSize: 12, fontWeight: "600" },
  rowActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  inlineBtn: { alignItems: "center", backgroundColor: "#176b87", borderRadius: 8, flex: 1, justifyContent: "center", minHeight: 36 },
  inlineBtnPending: { backgroundColor: "#a12f2f" },
  inlineBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  statusBtn: { alignItems: "center", backgroundColor: "#0f7f4f", borderRadius: 8, flex: 1, justifyContent: "center", minHeight: 36 },
  statusBtnPending: { backgroundColor: "#a12f2f" },
  statusBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  filterBtn: { alignItems: "center", backgroundColor: "#edf2f8", borderRadius: 999, justifyContent: "center", minHeight: 32, paddingHorizontal: 12 },
  filterBtnActive: { backgroundColor: "#176b87" },
  filterBtnText: { color: "#274057", fontSize: 11, fontWeight: "800" },
  filterBtnTextActive: { color: "#fff" },
  seedBox: { backgroundColor: "#f3f8fd", borderColor: "#dce7f2", borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 10 },
  seedTitle: { color: "#2b435b", fontSize: 12, fontWeight: "800", marginBottom: 4 },
  seedText: { color: "#3e556d", fontSize: 12, fontWeight: "600" },
  empty: { color: "#6d7b8e", fontSize: 13, textAlign: "center" },
  error: { color: "#b3261e", fontSize: 13, fontWeight: "700" }
});
