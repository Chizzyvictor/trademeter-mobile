import { useCallback, useEffect, useMemo, useState } from "react";
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
  loadAttendanceOverviewRequest,
  loadAttendancePolicyRequest,
  loadCorrectionRequestsRequest,
  loadEmployeesRequest,
  requestCorrectionRequest,
  reviewCorrectionRequest,
  runAutoAbsenceRequest,
  saveAttendancePolicyRequest,
  saveShiftRuleRequest,
  signOutEmployeeRequest
} from "../api/client";
import { useAuth } from "../context/AuthContext";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceScreen() {
  const { csrfToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState({});
  const [employees, setEmployees] = useState([]);
  const [policy, setPolicy] = useState({ resumption_time: "09:00", fine_0_15: "200", fine_15_60: "500", fine_60_plus: "1000" });
  const [shiftForm, setShiftForm] = useState({ user_id: "", shift_start: "09:00", shift_end: "17:00", grace_minutes: "0", is_active: "1" });
  const [autoAbsenceDate, setAutoAbsenceDate] = useState(todayDate());
  const [corrections, setCorrections] = useState([]);
  const [correctionStatus, setCorrectionStatus] = useState("pending");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [reviewNote, setReviewNote] = useState({});
  const [correctionForm, setCorrectionForm] = useState({
    user_id: "",
    attendance_date: todayDate(),
    proposed_signin_at: "",
    proposed_signout_at: "",
    reason: ""
  });

  const load = useCallback(
    async (mode = "load") => {
      setError("");
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [overviewRes, employeesRes, policyRes, correctionsRes] = await Promise.all([
          loadAttendanceOverviewRequest({ csrfToken }),
          loadEmployeesRequest({ csrfToken }),
          loadAttendancePolicyRequest({ csrfToken }),
          loadCorrectionRequestsRequest({ status: correctionStatus, csrfToken })
        ]);

        setOverview(overviewRes.summary || overviewRes.data || {});
        setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
        setPolicy({
          resumption_time: String(policyRes?.data?.resumption_time || "09:00"),
          fine_0_15: String(policyRes?.data?.fine_0_15 ?? "200"),
          fine_15_60: String(policyRes?.data?.fine_15_60 ?? "500"),
          fine_60_plus: String(policyRes?.data?.fine_60_plus ?? "1000")
        });
        setCorrections(Array.isArray(correctionsRes.data) ? correctionsRes.data : []);
      } catch (requestError) {
        setError(requestError.message || "Could not load attendance.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [correctionStatus, csrfToken]
  );

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => [
      { label: "Employees", value: String(employees.length) },
      { label: "Signed In", value: String(Number(overview.signed_in_today || overview.signedInToday || 0)) },
      { label: "Absent", value: String(Number(overview.absent_today || overview.absentToday || 0)) }
    ],
    [employees.length, overview.absent_today, overview.signed_in_today, overview.absentToday, overview.signedInToday]
  );

  async function savePolicy() {
    setError("");
    setSaving(true);
    try {
      await saveAttendancePolicyRequest({
        ...policy,
        csrfToken
      });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not save policy.");
    } finally {
      setSaving(false);
    }
  }

  async function saveShift() {
    setError("");
    if (!shiftForm.user_id) {
      setError("Employee user_id is required for shift rule.");
      return;
    }

    setSaving(true);
    try {
      await saveShiftRuleRequest({
        user_id: Number(shiftForm.user_id),
        shift_start: shiftForm.shift_start,
        shift_end: shiftForm.shift_end,
        grace_minutes: Number(shiftForm.grace_minutes || 0),
        is_active: Number(shiftForm.is_active || 1),
        csrfToken
      });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not save shift.");
    } finally {
      setSaving(false);
    }
  }

  async function signOutEmployee(userId) {
    setError("");
    setSaving(true);
    try {
      await signOutEmployeeRequest({ user_id: Number(userId), csrfToken });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not sign out employee.");
    } finally {
      setSaving(false);
    }
  }

  async function runAutoAbsence() {
    setError("");
    setSaving(true);
    try {
      await runAutoAbsenceRequest({ date: autoAbsenceDate, csrfToken });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not run auto-absence.");
    } finally {
      setSaving(false);
    }
  }

  async function requestCorrection() {
    setError("");
    if (!correctionForm.user_id || !correctionForm.attendance_date || !correctionForm.reason.trim()) {
      setError("Correction requires user_id, attendance date, and reason.");
      return;
    }

    setSaving(true);
    try {
      await requestCorrectionRequest({ ...correctionForm, user_id: Number(correctionForm.user_id), csrfToken });
      setCorrectionForm({ user_id: "", attendance_date: todayDate(), proposed_signin_at: "", proposed_signout_at: "", reason: "" });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not submit correction.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewCorrection(correctionId, decision) {
    setError("");
    setSaving(true);
    try {
      await reviewCorrectionRequest({
        correction_id: Number(correctionId),
        decision,
        review_note: reviewNote[correctionId] || "",
        csrfToken
      });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not review correction.");
    } finally {
      setSaving(false);
    }
  }

  function pickEmployee(userId) {
    const value = String(userId || "");
    setSelectedEmployeeId(value);
    setShiftForm((prev) => ({ ...prev, user_id: value }));
    setCorrectionForm((prev) => ({ ...prev, user_id: value }));
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        <Text style={styles.title}>Employee Attendance</Text>
        <Text style={styles.subtitle}>Shift visibility and daily attendance status</Text>

        <View style={styles.statsRow}>
          {stats.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Attendance Policy</Text>
          <Input label="Resumption time (HH:MM)" value={policy.resumption_time} onChangeText={(value) => setPolicy((prev) => ({ ...prev, resumption_time: value }))} />
          <Input label="Fine 0-15" keyboardType="decimal-pad" value={policy.fine_0_15} onChangeText={(value) => setPolicy((prev) => ({ ...prev, fine_0_15: value }))} />
          <Input label="Fine 15-60" keyboardType="decimal-pad" value={policy.fine_15_60} onChangeText={(value) => setPolicy((prev) => ({ ...prev, fine_15_60: value }))} />
          <Input label="Fine 60+" keyboardType="decimal-pad" value={policy.fine_60_plus} onChangeText={(value) => setPolicy((prev) => ({ ...prev, fine_60_plus: value }))} />
          <TouchableOpacity disabled={saving} onPress={savePolicy} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Save policy"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Shift Rule</Text>
          <Input label="User ID" keyboardType="number-pad" value={shiftForm.user_id} onChangeText={(value) => setShiftForm((prev) => ({ ...prev, user_id: value }))} />
          <Input label="Shift start" value={shiftForm.shift_start} onChangeText={(value) => setShiftForm((prev) => ({ ...prev, shift_start: value }))} />
          <Input label="Shift end" value={shiftForm.shift_end} onChangeText={(value) => setShiftForm((prev) => ({ ...prev, shift_end: value }))} />
          <Input label="Grace minutes" keyboardType="number-pad" value={shiftForm.grace_minutes} onChangeText={(value) => setShiftForm((prev) => ({ ...prev, grace_minutes: value }))} />
          <TouchableOpacity disabled={saving} onPress={saveShift} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Save shift"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Auto Absence</Text>
          <Input label="Date (YYYY-MM-DD)" value={autoAbsenceDate} onChangeText={setAutoAbsenceDate} />
          <TouchableOpacity disabled={saving} onPress={runAutoAbsence} style={styles.warningBtn}>
            <Text style={styles.warningBtnText}>{saving ? "Please wait..." : "Run auto-absence"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Request Correction</Text>
          <Input label="User ID" keyboardType="number-pad" value={correctionForm.user_id} onChangeText={(value) => setCorrectionForm((prev) => ({ ...prev, user_id: value }))} />
          <Input label="Attendance date" value={correctionForm.attendance_date} onChangeText={(value) => setCorrectionForm((prev) => ({ ...prev, attendance_date: value }))} />
          <Input label="Proposed sign in" value={correctionForm.proposed_signin_at} onChangeText={(value) => setCorrectionForm((prev) => ({ ...prev, proposed_signin_at: value }))} />
          <Input label="Proposed sign out" value={correctionForm.proposed_signout_at} onChangeText={(value) => setCorrectionForm((prev) => ({ ...prev, proposed_signout_at: value }))} />
          <Input label="Reason" value={correctionForm.reason} onChangeText={(value) => setCorrectionForm((prev) => ({ ...prev, reason: value }))} multiline />
          <TouchableOpacity disabled={saving} onPress={requestCorrection} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Submit correction"}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={styles.loader} color="#176b87" /> : null}

        {employees.map((employee, index) => (
          <View key={`e-${employee.user_id || index}`} style={styles.item}>
            <Text style={styles.itemName}>{employee.full_name || employee.name || "Employee"}</Text>
            <Text style={styles.itemMeta}>Role: {employee.role_name || employee.role || "-"}</Text>
            <Text style={styles.itemMeta}>Email: {employee.email || "-"}</Text>
            <Text style={styles.itemMeta}>Status: {Number(employee.is_active || 0) === 1 ? "Active" : "Inactive"}</Text>
            <Text style={styles.itemMeta}>Shift: {employee.shift_start || "--:--"} - {employee.shift_end || "--:--"}</Text>
            <TouchableOpacity disabled={saving} onPress={() => pickEmployee(employee.user_id)} style={[styles.pickBtn, String(selectedEmployeeId) === String(employee.user_id) ? styles.pickBtnActive : null]}>
              <Text style={[styles.pickBtnText, String(selectedEmployeeId) === String(employee.user_id) ? styles.pickBtnTextActive : null]}>Use for forms</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={saving} onPress={() => signOutEmployee(employee.user_id)} style={styles.inlineBtn}>
              <Text style={styles.inlineBtnText}>Sign out employee</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Corrections ({corrections.length})</Text>
          <View style={styles.filterRow}>
            {[
              { key: "pending", label: "Pending" },
              { key: "approved", label: "Approved" },
              { key: "rejected", label: "Rejected" }
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => setCorrectionStatus(item.key)}
                style={[styles.filterBtn, correctionStatus === item.key ? styles.filterBtnActive : null]}
              >
                <Text style={[styles.filterBtnText, correctionStatus === item.key ? styles.filterBtnTextActive : null]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {corrections.map((item) => (
            <View key={`c-${item.correction_id}`} style={styles.correctionRow}>
              <Text style={styles.itemName}>{item.full_name || "Employee"}</Text>
              <Text style={styles.itemMeta}>Date: {item.attendance_date || "-"}</Text>
              <Text style={styles.itemMeta}>Reason: {item.reason || "-"}</Text>
              <Input
                label="Review note"
                value={reviewNote[item.correction_id] || ""}
                onChangeText={(value) => setReviewNote((prev) => ({ ...prev, [item.correction_id]: value }))}
              />
              <View style={styles.rowActions}>
                <TouchableOpacity disabled={saving} onPress={() => reviewCorrection(item.correction_id, "approve")} style={styles.successBtn}>
                  <Text style={styles.successBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={saving} onPress={() => reviewCorrection(item.correction_id, "reject")} style={styles.dangerBtn}>
                  <Text style={styles.dangerBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {!loading && corrections.length === 0 ? <Text style={styles.empty}>No pending corrections.</Text> : null}
        </View>

        {!loading && employees.length === 0 ? <Text style={styles.empty}>No employees found.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({ label, ...props }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput placeholderTextColor="#8a97a8" style={[styles.input, props.multiline ? styles.inputMultiline : null]} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f6f8fb", flex: 1 },
  content: { gap: 12, padding: 18, paddingBottom: 36 },
  title: { color: "#102033", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#5f6e82", fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 8, borderWidth: 1, flex: 1, padding: 10 },
  statLabel: { color: "#6d7b8e", fontSize: 11, fontWeight: "700" },
  statValue: { color: "#102033", fontSize: 13, fontWeight: "800", marginTop: 4 },
  card: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, padding: 12 },
  sectionTitle: { color: "#102033", fontSize: 15, fontWeight: "800" },
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
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  primaryBtn: { alignItems: "center", backgroundColor: "#176b87", borderRadius: 8, minHeight: 42, justifyContent: "center", marginTop: 10 },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  warningBtn: { alignItems: "center", backgroundColor: "#a15a00", borderRadius: 8, minHeight: 42, justifyContent: "center", marginTop: 10 },
  warningBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  loader: { marginVertical: 12 },
  item: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, padding: 12 },
  itemName: { color: "#102033", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  itemMeta: { color: "#5f6e82", fontSize: 12, fontWeight: "600" },
  inlineBtn: { alignItems: "center", backgroundColor: "#176b87", borderRadius: 8, justifyContent: "center", marginTop: 8, minHeight: 36, paddingHorizontal: 12, alignSelf: "flex-start" },
  inlineBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  pickBtn: { alignItems: "center", borderColor: "#176b87", borderRadius: 8, borderWidth: 1, justifyContent: "center", marginTop: 8, minHeight: 34, paddingHorizontal: 12, alignSelf: "flex-start" },
  pickBtnActive: { backgroundColor: "#176b87" },
  pickBtnText: { color: "#176b87", fontSize: 12, fontWeight: "800" },
  pickBtnTextActive: { color: "#fff" },
  correctionRow: { borderTopColor: "#edf2f7", borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  rowActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  filterBtn: { alignItems: "center", backgroundColor: "#edf2f8", borderRadius: 999, justifyContent: "center", minHeight: 32, paddingHorizontal: 12 },
  filterBtnActive: { backgroundColor: "#176b87" },
  filterBtnText: { color: "#274057", fontSize: 11, fontWeight: "800" },
  filterBtnTextActive: { color: "#fff" },
  successBtn: { alignItems: "center", backgroundColor: "#0f7f4f", borderRadius: 8, flex: 1, justifyContent: "center", minHeight: 38 },
  successBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  dangerBtn: { alignItems: "center", backgroundColor: "#b3261e", borderRadius: 8, flex: 1, justifyContent: "center", minHeight: 38 },
  dangerBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empty: { color: "#6d7b8e", fontSize: 13, textAlign: "center" },
  error: { color: "#b3261e", fontSize: 13, fontWeight: "700" }
});
