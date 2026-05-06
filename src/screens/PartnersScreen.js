import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  addDebtRequest,
  addPartnerRequest,
  deletePartnerRequest,
  editPartnerRequest,
  loadPartnerDetailsRequest,
  loadPartnersRequest,
  payDebtRequest
} from "../api/client";
import { useAuth } from "../context/AuthContext";

const filters = [
  { label: "All", action: "loadAllPartners" },
  { label: "Debtors", action: "loadActivePartnerDebtors" },
  { label: "Creditors", action: "loadActivePartnerCreditors" }
];

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(toNumber(value));
}

export default function PartnersScreen() {
  const { csrfToken } = useAuth();
  const [activeFilter, setActiveFilter] = useState("loadAllPartners");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [detail, setDetail] = useState(null);
  const [formMode, setFormMode] = useState("add");
  const [partnerForm, setPartnerForm] = useState({ aName: "", aEmail: "", aPhone: "", aAddress: "" });
  const [debtAmount, setDebtAmount] = useState("");
  const [debtNote, setDebtNote] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const load = useCallback(
    async (nextFilter = activeFilter, mode = "load", shouldKeepSelected = true) => {
      setError("");
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await loadPartnersRequest({ action: nextFilter, csrfToken });
        const nextRows = Array.isArray(response.data) ? response.data : [];
        setRows(nextRows);

        if (shouldKeepSelected && selectedPartner) {
          const updated = nextRows.find((item) => Number(item.sid) === Number(selectedPartner.sid));
          if (updated) {
            setSelectedPartner(updated);
          }
        }
      } catch (requestError) {
        setError(requestError.message || "Could not load partners.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeFilter, csrfToken, selectedPartner]
  );

  useEffect(() => {
    load(activeFilter);
  }, [activeFilter, load]);

  const loadDetails = useCallback(
    async (partner) => {
      setError("");
      setSelectedPartner(partner);
      try {
        const response = await loadPartnerDetailsRequest({ id: partner.sid, csrfToken });
        setDetail(response);
        setPartnerForm({
          aName: partner.sName || "",
          aEmail: partner.sEmail || "",
          aPhone: partner.sPhone || "",
          aAddress: partner.sAddress || ""
        });
        setFormMode("edit");
      } catch (requestError) {
        setError(requestError.message || "Could not load partner details.");
      }
    },
    [csrfToken]
  );

  const summary = useMemo(() => {
    const totals = rows.reduce(
      (acc, item) => {
        acc.outstanding += toNumber(item.outstanding);
        acc.advance += toNumber(item.advancePayment);
        return acc;
      },
      { outstanding: 0, advance: 0 }
    );

    return {
      count: rows.length,
      outstanding: totals.outstanding,
      advance: totals.advance
    };
  }, [rows]);

  async function handleSavePartner() {
    setError("");
    const name = String(partnerForm.aName || "").trim();
    if (!name) {
      setError("Partner name required.");
      return;
    }

    setSaving(true);
    try {
      if (formMode === "edit" && selectedPartner?.sid) {
        await editPartnerRequest({
          id: selectedPartner.sid,
          aName: name,
          aEmail: String(partnerForm.aEmail || "").trim(),
          aPhone: String(partnerForm.aPhone || "").trim(),
          aAddress: String(partnerForm.aAddress || "").trim(),
          csrfToken
        });
      } else {
        await addPartnerRequest({
          aName: name,
          aEmail: String(partnerForm.aEmail || "").trim(),
          aPhone: String(partnerForm.aPhone || "").trim(),
          aAddress: String(partnerForm.aAddress || "").trim(),
          csrfToken
        });
      }

      await load(activeFilter, "load", true);
      if (selectedPartner?.sid && formMode === "edit") {
        const updated = rows.find((item) => Number(item.sid) === Number(selectedPartner.sid));
        if (updated) {
          await loadDetails(updated);
        }
      }
      if (formMode === "add") {
        setPartnerForm({ aName: "", aEmail: "", aPhone: "", aAddress: "" });
      }
    } catch (requestError) {
      setError(requestError.message || "Could not save partner.");
    } finally {
      setSaving(false);
    }
  }

  function askDeletePartner() {
    if (!selectedPartner?.sid) return;

    Alert.alert("Delete partner", "Delete this partner? This follows the web rule and requires delete permission.", [
      { style: "cancel", text: "Cancel" },
      {
        style: "destructive",
        text: "Delete",
        onPress: async () => {
          setSaving(true);
          try {
            await deletePartnerRequest({ id: selectedPartner.sid, csrfToken });
            setDetail(null);
            setSelectedPartner(null);
            setFormMode("add");
            setPartnerForm({ aName: "", aEmail: "", aPhone: "", aAddress: "" });
            await load(activeFilter, "load", false);
          } catch (requestError) {
            setError(requestError.message || "Could not delete partner.");
          } finally {
            setSaving(false);
          }
        }
      }
    ]);
  }

  async function handleDebt(kind) {
    if (!selectedPartner?.sid) {
      setError("Select a partner first.");
      return;
    }

    const amountText = kind === "add" ? debtAmount : payAmount;
    const note = kind === "add" ? debtNote : payNote;
    const amount = Number(amountText);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    setSaving(true);
    try {
      if (kind === "add") {
        await addDebtRequest({ id: selectedPartner.sid, amount, debtDesc: String(note || "").trim(), csrfToken });
        setDebtAmount("");
        setDebtNote("");
      } else {
        await payDebtRequest({ id: selectedPartner.sid, amount, payDesc: String(note || "").trim(), csrfToken });
        setPayAmount("");
        setPayNote("");
      }

      await load(activeFilter, "load", true);
      await loadDetails(selectedPartner);
    } catch (requestError) {
      setError(requestError.message || "Partner balance update failed.");
    } finally {
      setSaving(false);
    }
  }

  function startAddMode() {
    setSelectedPartner(null);
    setDetail(null);
    setFormMode("add");
    setPartnerForm({ aName: "", aEmail: "", aPhone: "", aAddress: "" });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(activeFilter, "refresh")} />}
      >
        <Text style={styles.title}>Partners</Text>
        <Text style={styles.subtitle}>Manage debtors, creditors, and partner balances</Text>

        <View style={styles.filters}>
          {filters.map((item) => (
            <TouchableOpacity
              key={item.action}
              onPress={() => setActiveFilter(item.action)}
              style={[styles.filterButton, activeFilter === item.action ? styles.filterButtonActive : null]}
            >
              <Text style={[styles.filterText, activeFilter === item.action ? styles.filterTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.summaryRow}>
          <StatCard label="Partners" value={String(summary.count)} />
          <StatCard label="Outstanding" value={formatCurrency(summary.outstanding)} />
          <StatCard label="Advance" value={formatCurrency(summary.advance)} />
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.sectionTitle}>{formMode === "edit" ? "Edit Partner" : "Add Partner"}</Text>
            <TouchableOpacity onPress={startAddMode} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>New</Text>
            </TouchableOpacity>
          </View>

          <Input label="Name" onChangeText={(value) => setPartnerForm((prev) => ({ ...prev, aName: value }))} value={partnerForm.aName} />
          <Input label="Email" onChangeText={(value) => setPartnerForm((prev) => ({ ...prev, aEmail: value }))} value={partnerForm.aEmail} />
          <Input label="Phone" onChangeText={(value) => setPartnerForm((prev) => ({ ...prev, aPhone: value }))} value={partnerForm.aPhone} />
          <Input
            label="Address"
            multiline
            onChangeText={(value) => setPartnerForm((prev) => ({ ...prev, aAddress: value }))}
            value={partnerForm.aAddress}
          />

          <View style={styles.rowGap}>
            <TouchableOpacity disabled={saving} onPress={handleSavePartner} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{saving ? "Saving..." : formMode === "edit" ? "Save changes" : "Add partner"}</Text>
            </TouchableOpacity>

            {formMode === "edit" ? (
              <TouchableOpacity disabled={saving} onPress={askDeletePartner} style={styles.dangerBtn}>
                <Text style={styles.dangerBtnText}>Delete partner</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={styles.loader} color="#176b87" /> : null}

        {rows.map((item, index) => (
          <TouchableOpacity key={`${item.sid || "p"}-${index}`} onPress={() => loadDetails(item)} style={styles.item}>
            <Text style={styles.itemName}>{item.sName || "Unnamed partner"}</Text>
            <Text style={styles.itemMeta}>{item.sEmail || "No email"}</Text>
            <Text style={styles.itemMeta}>{item.sPhone || "No phone"}</Text>
            <Text style={styles.itemBalance}>Outstanding: {formatCurrency(item.outstanding)}</Text>
            <Text style={styles.itemBalance}>Advance: {formatCurrency(item.advancePayment)}</Text>
          </TouchableOpacity>
        ))}

        {selectedPartner && detail ? (
          <View style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Partner Details</Text>
            <Text style={styles.itemMeta}>Ledger entries: {Array.isArray(detail.partner_ledger) ? detail.partner_ledger.length : 0}</Text>
            <Text style={styles.itemMeta}>Transactions: {Array.isArray(detail.purchases) ? detail.purchases.length : 0}</Text>

            <View style={styles.balanceActions}>
              <View style={styles.actionBox}>
                <Text style={styles.actionTitle}>Add Debt</Text>
                <Input label="Amount" keyboardType="decimal-pad" onChangeText={setDebtAmount} value={debtAmount} />
                <Input label="Note" onChangeText={setDebtNote} value={debtNote} />
                <TouchableOpacity disabled={saving} onPress={() => handleDebt("add")} style={styles.warningBtn}>
                  <Text style={styles.warningBtnText}>{saving ? "Please wait..." : "Add debt"}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionBox}>
                <Text style={styles.actionTitle}>Pay Debt</Text>
                <Input label="Amount" keyboardType="decimal-pad" onChangeText={setPayAmount} value={payAmount} />
                <Input label="Note" onChangeText={setPayNote} value={payNote} />
                <TouchableOpacity disabled={saving} onPress={() => handleDebt("pay")} style={styles.successBtn}>
                  <Text style={styles.successBtnText}>{saving ? "Please wait..." : "Record payment"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {!loading && rows.length === 0 ? <Text style={styles.empty}>No partners found.</Text> : null}
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

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f6f8fb", flex: 1 },
  content: { gap: 12, padding: 18, paddingBottom: 36 },
  title: { color: "#102033", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#5f6e82", fontSize: 13, fontWeight: "600" },
  filters: { backgroundColor: "#e8eef5", borderRadius: 8, flexDirection: "row", padding: 4 },
  filterButton: { alignItems: "center", borderRadius: 6, flex: 1, justifyContent: "center", minHeight: 38 },
  filterButtonActive: { backgroundColor: "#ffffff" },
  filterText: { color: "#526174", fontSize: 13, fontWeight: "700" },
  filterTextActive: { color: "#102033" },
  summaryRow: { flexDirection: "row", gap: 8 },
  statCard: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 8, borderWidth: 1, flex: 1, padding: 10 },
  statLabel: { color: "#6d7b8e", fontSize: 11, fontWeight: "700" },
  statValue: { color: "#102033", fontSize: 13, fontWeight: "800", marginTop: 4 },
  formCard: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, padding: 12 },
  formHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  sectionTitle: { color: "#102033", fontSize: 15, fontWeight: "800" },
  ghostBtn: { borderColor: "#d2dce8", borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  ghostBtnText: { color: "#34465c", fontSize: 12, fontWeight: "800" },
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
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  rowGap: { gap: 8, marginTop: 10 },
  primaryBtn: { alignItems: "center", backgroundColor: "#176b87", borderRadius: 8, minHeight: 42, justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  dangerBtn: { alignItems: "center", backgroundColor: "#b3261e", borderRadius: 8, minHeight: 40, justifyContent: "center" },
  dangerBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  loader: { marginVertical: 12 },
  item: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, padding: 12 },
  itemName: { color: "#102033", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  itemMeta: { color: "#5f6e82", fontSize: 12, fontWeight: "600" },
  itemBalance: { color: "#1c2f45", fontSize: 12, fontWeight: "700", marginTop: 4 },
  detailCard: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, gap: 8, padding: 12 },
  balanceActions: { gap: 10 },
  actionBox: { backgroundColor: "#f8fbff", borderColor: "#d9e3ef", borderRadius: 8, borderWidth: 1, padding: 10 },
  actionTitle: { color: "#102033", fontSize: 14, fontWeight: "800" },
  warningBtn: { alignItems: "center", backgroundColor: "#a15a00", borderRadius: 8, minHeight: 40, justifyContent: "center", marginTop: 10 },
  warningBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  successBtn: { alignItems: "center", backgroundColor: "#0f7f4f", borderRadius: 8, minHeight: 40, justifyContent: "center", marginTop: 10 },
  successBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  empty: { color: "#6d7b8e", fontSize: 13, textAlign: "center" },
  error: { color: "#b3261e", fontSize: 13, fontWeight: "700" }
});
