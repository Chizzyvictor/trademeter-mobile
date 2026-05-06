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
  createPurchaseRequest,
  createSaleRequest,
  loadPartnersRequest,
  loadTransactionProductsRequest,
  loadTransactionsRequest,
  payPurchaseRequest
} from "../api/client";
import { useAuth } from "../context/AuthContext";

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

export default function TransactionsScreen() {
  const { csrfToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseForm, setPurchaseForm] = useState({ partner_id: "", product_id: "", qty: "", costPrice: "", amountPaid: "" });
  const [saleForm, setSaleForm] = useState({ partner_id: "", product_id: "", qty: "", costPrice: "", amountPaid: "" });
  const [payAmount, setPayAmount] = useState({});

  const load = useCallback(
    async (mode = "load") => {
      setError("");
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [txRes, partnersRes, productsRes] = await Promise.all([
          loadTransactionsRequest({ csrfToken }),
          loadPartnersRequest({ action: "loadAllPartners", csrfToken }),
          loadTransactionProductsRequest({ csrfToken })
        ]);

        const txRows = Array.isArray(txRes.data) ? txRes.data : [];
        const partnerRows = Array.isArray(partnersRes.data) ? partnersRes.data : [];
        const productRows = Array.isArray(productsRes.data) ? productsRes.data : [];

        setRows(txRows);
        setPartners(partnerRows);
        setProducts(productRows);
      } catch (requestError) {
        setError(requestError.message || "Could not load transactions.");
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

  const summary = useMemo(() => {
    const total = rows.reduce((sum, item) => sum + toNumber(item.totalAmount || item.total_amount), 0);
    const paid = rows.reduce((sum, item) => sum + toNumber(item.amountPaid || item.amount_paid), 0);
    return {
      count: rows.length,
      total,
      balance: total - paid
    };
  }, [rows]);

  function resolveCost(productId, fallbackPrice = "") {
    const match = products.find((item) => Number(item.product_id) === Number(productId));
    if (!match) return Number(fallbackPrice || 0);
    return toNumber(fallbackPrice || match.cost_price || match.selling_price, 0);
  }

  async function handleCreate(kind) {
    setError("");

    const form = kind === "buy" ? purchaseForm : saleForm;
    const partnerId = Number(form.partner_id || 0);
    const productId = Number(form.product_id || 0);
    const qty = Number(form.qty || 0);
    const costPrice = Number(resolveCost(productId, form.costPrice));
    const amountPaid = Number(form.amountPaid || 0);

    if (partnerId <= 0 || productId <= 0 || qty <= 0) {
      setError("Partner ID, Product ID, and quantity are required.");
      return;
    }

    const payload = {
      partner_id: partnerId,
      amountPaid,
      transaction_date: new Date().toISOString().slice(0, 10),
      items: [{ product_id: productId, qty, costPrice }],
      csrfToken
    };

    setSaving(true);
    try {
      if (kind === "buy") {
        await createPurchaseRequest(payload);
        setPurchaseForm({ partner_id: "", product_id: "", qty: "", costPrice: "", amountPaid: "" });
      } else {
        await createSaleRequest(payload);
        setSaleForm({ partner_id: "", product_id: "", qty: "", costPrice: "", amountPaid: "" });
      }
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not create transaction.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(row) {
    setError("");
    const amount = Number(payAmount[row.purchase_id] || 0);
    if (amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    setSaving(true);
    try {
      await payPurchaseRequest({ purchase_id: row.purchase_id, amount, csrfToken });
      setPayAmount((prev) => ({ ...prev, [row.purchase_id]: "" }));
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not apply payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} />}
      >
        <Text style={styles.title}>Transactions</Text>
        <Text style={styles.subtitle}>Recent purchases and payment status</Text>

        <View style={styles.statsRow}>
          <StatCard label="Records" value={String(summary.count)} />
          <StatCard label="Total" value={formatCurrency(summary.total)} />
          <StatCard label="Balance" value={formatCurrency(summary.balance)} />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Create Purchase</Text>
          <Input label="Partner ID" keyboardType="number-pad" onChangeText={(value) => setPurchaseForm((p) => ({ ...p, partner_id: value }))} value={purchaseForm.partner_id} />
          <Input label="Product ID" keyboardType="number-pad" onChangeText={(value) => setPurchaseForm((p) => ({ ...p, product_id: value }))} value={purchaseForm.product_id} />
          <Input label="Quantity" keyboardType="decimal-pad" onChangeText={(value) => setPurchaseForm((p) => ({ ...p, qty: value }))} value={purchaseForm.qty} />
          <Input label="Cost Price (optional override)" keyboardType="decimal-pad" onChangeText={(value) => setPurchaseForm((p) => ({ ...p, costPrice: value }))} value={purchaseForm.costPrice} />
          <Input label="Amount Paid" keyboardType="decimal-pad" onChangeText={(value) => setPurchaseForm((p) => ({ ...p, amountPaid: value }))} value={purchaseForm.amountPaid} />
          <Text style={styles.helper}>Partners: {partners.map((item) => `${item.sid}:${item.sName}`).slice(0, 8).join(" | ") || "none"}</Text>
          <Text style={styles.helper}>Products: {products.map((item) => `${item.product_id}:${item.product_name}`).slice(0, 8).join(" | ") || "none"}</Text>
          <TouchableOpacity disabled={saving} onPress={() => handleCreate("buy")} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Create purchase"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Create Sale</Text>
          <Input label="Partner ID" keyboardType="number-pad" onChangeText={(value) => setSaleForm((p) => ({ ...p, partner_id: value }))} value={saleForm.partner_id} />
          <Input label="Product ID" keyboardType="number-pad" onChangeText={(value) => setSaleForm((p) => ({ ...p, product_id: value }))} value={saleForm.product_id} />
          <Input label="Quantity" keyboardType="decimal-pad" onChangeText={(value) => setSaleForm((p) => ({ ...p, qty: value }))} value={saleForm.qty} />
          <Input label="Selling Price (optional override)" keyboardType="decimal-pad" onChangeText={(value) => setSaleForm((p) => ({ ...p, costPrice: value }))} value={saleForm.costPrice} />
          <Input label="Amount Paid" keyboardType="decimal-pad" onChangeText={(value) => setSaleForm((p) => ({ ...p, amountPaid: value }))} value={saleForm.amountPaid} />
          <TouchableOpacity disabled={saving} onPress={() => handleCreate("sell")} style={styles.successBtn}>
            <Text style={styles.successBtnText}>{saving ? "Please wait..." : "Create sale"}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={styles.loader} color="#176b87" /> : null}

        {rows.map((item, index) => {
          const totalAmount = toNumber(item.totalAmount || item.total_amount);
          const amountPaid = toNumber(item.amountPaid || item.amount_paid);
          const balance = Math.max(0, totalAmount - amountPaid);

          return (
            <View key={`t-${item.purchase_id || index}`} style={styles.item}>
              <Text style={styles.itemTitle}>Purchase #{item.purchase_id || "-"}</Text>
              <Text style={styles.itemMeta}>Partner: {item.sName || item.partner_name || "-"}</Text>
              <Text style={styles.itemMeta}>Total: {formatCurrency(totalAmount)}</Text>
              <Text style={styles.itemMeta}>Paid: {formatCurrency(amountPaid)}</Text>
              <Text style={styles.itemMeta}>Balance: {formatCurrency(balance)}</Text>
              <Text style={styles.itemStatus}>Status: {String(item.status || "unknown").toUpperCase()}</Text>
              <View style={styles.payRow}>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    setPayAmount((prev) => ({
                      ...prev,
                      [item.purchase_id]: value
                    }))
                  }
                  placeholder="Pay amount"
                  placeholderTextColor="#8a97a8"
                  style={styles.payInput}
                  value={String(payAmount[item.purchase_id] || "")}
                />
                <TouchableOpacity disabled={saving} onPress={() => handlePay(item)} style={styles.payBtn}>
                  <Text style={styles.payBtnText}>Pay</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {!loading && rows.length === 0 ? <Text style={styles.empty}>No transactions found.</Text> : null}
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
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 8, borderWidth: 1, flex: 1, padding: 10 },
  statLabel: { color: "#6d7b8e", fontSize: 11, fontWeight: "700" },
  statValue: { color: "#102033", fontSize: 13, fontWeight: "800", marginTop: 4 },
  formCard: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, padding: 12 },
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
  helper: { color: "#63758a", fontSize: 11, fontWeight: "600", marginTop: 6 },
  primaryBtn: { alignItems: "center", backgroundColor: "#176b87", borderRadius: 8, minHeight: 42, justifyContent: "center", marginTop: 10 },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  successBtn: { alignItems: "center", backgroundColor: "#0f7f4f", borderRadius: 8, minHeight: 42, justifyContent: "center", marginTop: 10 },
  successBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  loader: { marginVertical: 12 },
  item: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, padding: 12 },
  itemTitle: { color: "#102033", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  itemMeta: { color: "#5f6e82", fontSize: 12, fontWeight: "600" },
  itemStatus: { color: "#1c2f45", fontSize: 12, fontWeight: "800", marginTop: 4 },
  payRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  payInput: {
    backgroundColor: "#f8fbff",
    borderColor: "#d9e3ef",
    borderRadius: 8,
    borderWidth: 1,
    color: "#102033",
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  payBtn: { alignItems: "center", backgroundColor: "#176b87", borderRadius: 8, justifyContent: "center", minHeight: 38, paddingHorizontal: 14 },
  payBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  empty: { color: "#6d7b8e", fontSize: 13, textAlign: "center" },
  error: { color: "#b3261e", fontSize: 13, fontWeight: "700" }
});
