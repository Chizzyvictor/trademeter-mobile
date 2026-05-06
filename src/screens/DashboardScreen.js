import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadDashboardRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

const ranges = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "All", value: "all" }
];

const rangeLabels = {
  today: "Today",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  all: "All Time"
};

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

function formatCount(value) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(toNumber(value));
}

function trendLabel(current, previous, higherIsBetter = true) {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (previousValue === 0) {
    return currentValue > 0 ? "New activity" : "No change";
  }

  const growth = ((currentValue - previousValue) / previousValue) * 100;
  const improved = higherIsBetter ? growth >= 0 : growth <= 0;
  const direction = growth >= 0 ? "up" : "down";
  return `${Math.abs(growth).toFixed(1)}% ${direction}${improved ? "" : " watch"}`;
}

export default function DashboardScreen() {
  const { csrfToken, signOut, user } = useAuth();
  const [range, setRange] = useState("all");
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const role = user?.role || "user";
  const displayName = user?.name || "Trader";

  const loadDashboard = useCallback(
    async (nextRange = range, mode = "load") => {
      setError("");
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await loadDashboardRequest({ range: nextRange, csrfToken });
        setDashboard(result);
        setLastUpdated(new Date());
      } catch (dashboardError) {
        setError(dashboardError.message || "Could not load dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [csrfToken, range]
  );

  useEffect(() => {
    loadDashboard(range);
  }, [loadDashboard, range]);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }

    const id = setInterval(() => {
      loadDashboard(range, "silent");
    }, 60000);

    return () => clearInterval(id);
  }, [autoRefresh, loadDashboard, range]);

  const cards = useMemo(
    () => [
      {
        label: "Total Outstanding",
        tone: "danger",
        value: formatCurrency(dashboard?.outstanding),
        badge: toNumber(dashboard?.outstanding) > 0 ? "Needs attention" : "All settled"
      },
      {
        label: "Advance Payments",
        tone: "primary",
        value: formatCurrency(dashboard?.advancePayment),
        badge: toNumber(dashboard?.advancePayment) > 0 ? "Cash buffer active" : "No prepayments"
      },
      {
        label: "Active Debtors",
        tone: "warning",
        value: formatCount(dashboard?.activeDebtors),
        badge: toNumber(dashboard?.activeDebtors) > 0 ? "Collections watch" : "No active debtors"
      },
      {
        label: "Active Creditors",
        tone: "success",
        value: formatCount(dashboard?.activeCreditors),
        badge: toNumber(dashboard?.activeCreditors) > 0 ? "Supplier credit lines" : "No active creditors"
      },
      {
        label: "Total Sales",
        tone: "success",
        value: formatCurrency(dashboard?.totalSales),
        badge:
          range === "all"
            ? "All-time total"
            : trendLabel(dashboard?.trendSummary?.totalSales?.current, dashboard?.trendSummary?.totalSales?.previous)
      },
      {
        label: "Total Purchases",
        tone: "info",
        value: formatCurrency(dashboard?.totalPurchases),
        badge:
          range === "all"
            ? "All-time total"
            : trendLabel(
                dashboard?.trendSummary?.totalPurchases?.current,
                dashboard?.trendSummary?.totalPurchases?.previous,
                false
              )
      },
      {
        label: "Transactions",
        tone: "primary",
        value: formatCount(dashboard?.rangeTransactions),
        badge:
          range === "all"
            ? "All-time activity"
            : trendLabel(
                dashboard?.trendSummary?.rangeTransactions?.current,
                dashboard?.trendSummary?.rangeTransactions?.previous
              )
      },
      {
        label: "Inventory Value",
        tone: "slate",
        value: formatCurrency(dashboard?.inventoryValue),
        badge: toNumber(dashboard?.inventoryValue) > 0 ? "Warehouse value secured" : "No inventory value"
      },
      {
        label: "Profit",
        tone: toNumber(dashboard?.profit) >= 0 ? "success" : "danger",
        value: formatCurrency(dashboard?.profit),
        badge:
          range === "all"
            ? "All-time margin"
            : trendLabel(dashboard?.trendSummary?.profit?.current, dashboard?.trendSummary?.profit?.previous)
      }
    ],
    [dashboard, range]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(range, "refresh")} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>TradeMeter Command Center</Text>
            <Text style={styles.title}>Performance Overview</Text>
          </View>

          <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contextBar}>
          <Text style={styles.contextText}>User: {displayName}</Text>
          <Text style={styles.contextText}>Role: {role}</Text>
          <Text style={styles.contextText}>Showing: {rangeLabels[range]}</Text>
          <Text style={styles.contextText}>
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
          </Text>
        </View>

        <View style={styles.controls}>
          <View style={styles.rangeTabs}>
            {ranges.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => setRange(item.value)}
                style={[styles.rangeButton, range === item.value ? styles.rangeButtonActive : null]}
              >
                <Text style={[styles.rangeText, range === item.value ? styles.rangeTextActive : null]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => setAutoRefresh((current) => !current)} style={styles.autoRefreshButton}>
            <View style={[styles.autoDot, autoRefresh ? styles.autoDotOn : null]} />
            <Text style={styles.autoRefreshText}>Auto-refresh 60s</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#176b87" style={styles.loader} /> : null}

        <View style={styles.cardGrid}>
          {cards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </View>

        <TopList
          amountKey="total_amount"
          emptyText="No products found"
          nameKey="product_name"
          qtyKey="total_qty"
          rows={dashboard?.top?.products || []}
          title="Top Selling Products"
        />
        <TopList
          amountKey="total_amount"
          emptyText="No suppliers found"
          nameKey="sName"
          qtyKey="transactions"
          rows={dashboard?.top?.suppliers || []}
          title="Top Suppliers"
        />
        <TopList
          amountKey="total_amount"
          emptyText="No buyers found"
          nameKey="sName"
          qtyKey="transactions"
          rows={dashboard?.top?.buyers || []}
          title="Top Buyers"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ badge, label, tone, value }) {
  return (
    <View style={[styles.metric, styles[`metric_${tone}`]]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, styles[`text_${tone}`]]}>{value}</Text>
      <Text style={[styles.badge, styles[`badge_${tone}`]]}>{badge}</Text>
    </View>
  );
}

function TopList({ amountKey, emptyText, nameKey, qtyKey, rows, title }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
      {rows.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.listRow}>
          <View style={styles.rank}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          <View style={styles.listMain}>
            <Text style={styles.listName}>{item[nameKey] || "-"}</Text>
            <Text style={styles.listMeta}>Qty/Txn: {formatCount(item[qtyKey])}</Text>
          </View>
          <Text style={styles.listAmount}>{formatCurrency(item[amountKey])}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f6f8fb",
    flex: 1
  },
  content: {
    padding: 20,
    paddingBottom: 34
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18
  },
  kicker: {
    color: "#176b87",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 5
  },
  title: {
    color: "#102033",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0
  },
  signOutButton: {
    borderColor: "#cbd6e2",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  signOutText: {
    color: "#2a3747",
    fontSize: 13,
    fontWeight: "800"
  },
  contextBar: {
    backgroundColor: "#ffffff",
    borderColor: "#e1e8f0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginBottom: 14,
    padding: 14
  },
  contextText: {
    color: "#526174",
    fontSize: 13,
    fontWeight: "700"
  },
  controls: {
    gap: 12,
    marginBottom: 16
  },
  rangeTabs: {
    backgroundColor: "#e8eef5",
    borderRadius: 8,
    flexDirection: "row",
    padding: 4
  },
  rangeButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 40,
    justifyContent: "center"
  },
  rangeButtonActive: {
    backgroundColor: "#ffffff"
  },
  rangeText: {
    color: "#526174",
    fontSize: 13,
    fontWeight: "800"
  },
  rangeTextActive: {
    color: "#176b87"
  },
  autoRefreshButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 34
  },
  autoDot: {
    backgroundColor: "#aab7c5",
    borderRadius: 6,
    height: 12,
    width: 12
  },
  autoDotOn: {
    backgroundColor: "#147a3f"
  },
  autoRefreshText: {
    color: "#526174",
    fontSize: 13,
    fontWeight: "700"
  },
  loader: {
    marginVertical: 14
  },
  error: {
    color: "#b42318",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 12
  },
  cardGrid: {
    gap: 12,
    marginBottom: 18
  },
  metric: {
    backgroundColor: "#ffffff",
    borderLeftWidth: 4,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  metric_danger: {
    borderColor: "#f3c6c2",
    borderLeftColor: "#b42318"
  },
  metric_primary: {
    borderColor: "#c7d8ee",
    borderLeftColor: "#176b87"
  },
  metric_warning: {
    borderColor: "#f4d7a6",
    borderLeftColor: "#b7791f"
  },
  metric_success: {
    borderColor: "#bfe4cd",
    borderLeftColor: "#147a3f"
  },
  metric_info: {
    borderColor: "#bfe3ee",
    borderLeftColor: "#14738a"
  },
  metric_slate: {
    borderColor: "#d7dee8",
    borderLeftColor: "#526174"
  },
  metricLabel: {
    color: "#526174",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8
  },
  metricValue: {
    color: "#102033",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 10
  },
  text_danger: {
    color: "#b42318"
  },
  text_primary: {
    color: "#176b87"
  },
  text_warning: {
    color: "#b7791f"
  },
  text_success: {
    color: "#147a3f"
  },
  text_info: {
    color: "#14738a"
  },
  text_slate: {
    color: "#2a3747"
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  badge_danger: {
    backgroundColor: "#fde8e6",
    color: "#b42318"
  },
  badge_primary: {
    backgroundColor: "#e6f0f5",
    color: "#176b87"
  },
  badge_warning: {
    backgroundColor: "#fff3d8",
    color: "#8a5a12"
  },
  badge_success: {
    backgroundColor: "#e3f5e9",
    color: "#147a3f"
  },
  badge_info: {
    backgroundColor: "#e1f3f7",
    color: "#14738a"
  },
  badge_slate: {
    backgroundColor: "#eef2f6",
    color: "#526174"
  },
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#e1e8f0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14
  },
  sectionTitle: {
    color: "#102033",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 12
  },
  emptyText: {
    color: "#7b8794",
    fontSize: 14
  },
  listRow: {
    alignItems: "center",
    borderTopColor: "#edf2f7",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 11
  },
  rank: {
    alignItems: "center",
    backgroundColor: "#e8eef5",
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  rankText: {
    color: "#176b87",
    fontSize: 13,
    fontWeight: "900"
  },
  listMain: {
    flex: 1
  },
  listName: {
    color: "#102033",
    fontSize: 14,
    fontWeight: "800"
  },
  listMeta: {
    color: "#526174",
    fontSize: 12,
    marginTop: 3
  },
  listAmount: {
    color: "#102033",
    fontSize: 13,
    fontWeight: "900"
  }
});
