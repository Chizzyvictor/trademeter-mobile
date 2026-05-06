import { FontAwesome5 } from "@expo/vector-icons";
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

const RANGES = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "All Time", value: "all" }
];

const RANGE_LABELS = {
  today: "Today",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  all: "All Time"
};

const TONE_ICON_COLOR = {
  danger: "#b42318",
  primary: "#176b87",
  warning: "#b7791f",
  success: "#147a3f",
  info: "#14738a",
  slate: "#526174"
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
  const cur = toNumber(current);
  const prev = toNumber(previous);
  if (prev === 0) return cur > 0 ? "New activity" : "No change";
  const pct = ((cur - prev) / prev) * 100;
  const improved = higherIsBetter ? pct >= 0 : pct <= 0;
  return `${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? "up" : "down"}${improved ? "" : " watch"}`;
}

export default function DashboardScreen() {
  const { csrfToken, user } = useAuth();
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
      } else if (mode !== "silent") {
        setLoading(true);
      }

      try {
        const result = await loadDashboardRequest({ range: nextRange, csrfToken });
        setDashboard(result);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message || "Could not load dashboard.");
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
    if (!autoRefresh) return undefined;
    const id = setInterval(() => loadDashboard(range, "silent"), 60000);
    return () => clearInterval(id);
  }, [autoRefresh, loadDashboard, range]);

  const row1 = useMemo(
    () => [
      {
        label: "Total Outstanding",
        tone: "danger",
        icon: "exclamation-circle",
        value: formatCurrency(dashboard?.outstanding),
        badge: toNumber(dashboard?.outstanding) > 0 ? "Needs attention" : "All settled"
      },
      {
        label: "Advance Payments",
        tone: "primary",
        icon: "wallet",
        value: formatCurrency(dashboard?.advancePayment),
        badge: toNumber(dashboard?.advancePayment) > 0 ? "Cash buffer" : "No prepayments"
      },
      {
        label: "Active Debtors",
        tone: "warning",
        icon: "user-clock",
        value: formatCount(dashboard?.activeDebtors),
        badge: toNumber(dashboard?.activeDebtors) > 0 ? "Collections watch" : "No active debtors"
      },
      {
        label: "Active Creditors",
        tone: "success",
        icon: "hand-holding-usd",
        value: formatCount(dashboard?.activeCreditors),
        badge: toNumber(dashboard?.activeCreditors) > 0 ? "Supplier trust" : "No creditors"
      }
    ],
    [dashboard]
  );

  const row2 = useMemo(
    () => [
      {
        label: "Total Sales",
        tone: "success",
        icon: "chart-line",
        value: formatCurrency(dashboard?.totalSales),
        badge:
          range === "all"
            ? "All-time total"
            : trendLabel(dashboard?.trendSummary?.totalSales?.current, dashboard?.trendSummary?.totalSales?.previous)
      },
      {
        label: "Total Purchases",
        tone: "info",
        icon: "shopping-cart",
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
        icon: "calendar-day",
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
        icon: "boxes",
        value: formatCurrency(dashboard?.inventoryValue),
        badge: "Warehouse value"
      },
      {
        label: "Profit",
        tone: toNumber(dashboard?.profit) >= 0 ? "success" : "danger",
        icon: "coins",
        value: formatCurrency(dashboard?.profit),
        badge:
          range === "all"
            ? "All-time margin"
            : trendLabel(dashboard?.trendSummary?.profit?.current, dashboard?.trendSummary?.profit?.previous)
      }
    ],
    [dashboard, range]
  );

  const lastUpdatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(range, "refresh")} />}
      >
        {/* ── HERO PANEL ── */}
        <View style={styles.heroPanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>TradeMeter Command Center</Text>
            <Text style={styles.heroTitle}>Performance Overview</Text>
            <Text style={styles.heroSubtitle}>
              Stay on top of revenue, stock value, debt exposure, and your strongest trading relationships from one premium dashboard.
            </Text>
            <View style={styles.contextList}>
              <ContextPill text={`User: ${displayName} | Role: ${role}`} />
              <ContextPill text={`Showing: ${RANGE_LABELS[range]}`} />
              <ContextPill text={`Last updated: ${lastUpdatedStr}`} />
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroControls}>
            <Text style={styles.controlLabel}>Date Range</Text>
            <View style={styles.rangeTabs}>
              {RANGES.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setRange(item.value)}
                  style={[styles.rangeTab, range === item.value ? styles.rangeTabActive : null]}
                >
                  <Text style={[styles.rangeTabText, range === item.value ? styles.rangeTabTextActive : null]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setAutoRefresh((v) => !v)} style={styles.autoRefreshRow}>
              <View style={[styles.autoDot, autoRefresh ? styles.autoDotOn : null]} />
              <Text style={styles.autoRefreshText}>Auto-refresh (60s)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#176b87" style={styles.loader} /> : null}

        {/* ── SUMMARY CARDS ── */}
        <Text style={styles.gridSectionLabel}>Summary</Text>
        <CardGrid cards={row1} />

        {/* ── PERFORMANCE CARDS ── */}
        <Text style={styles.gridSectionLabel}>Performance</Text>
        <CardGrid cards={row2} />

        {/* ── TOP METRICS TABLES ── */}
        <TopTable
          kicker="High Performers"
          title="Top Selling Products"
          icon="fire"
          iconTone="success"
          rows={dashboard?.top?.products || []}
          nameKey="product_name"
          qtyKey="total_qty"
          amountKey="total_amount"
          nameHeader="Product"
          qtyHeader="Qty"
        />
        <TopTable
          kicker="Supply Network"
          title="Top Suppliers"
          icon="truck"
          iconTone="info"
          rows={dashboard?.top?.suppliers || []}
          nameKey="sName"
          qtyKey="transactions"
          amountKey="total_amount"
          nameHeader="Supplier"
          qtyHeader="Txn"
        />
        <TopTable
          kicker="Customer Momentum"
          title="Top Buyers"
          icon="user-friends"
          iconTone="primary"
          rows={dashboard?.top?.buyers || []}
          nameKey="sName"
          qtyKey="transactions"
          amountKey="total_amount"
          nameHeader="Buyer"
          qtyHeader="Txn"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── SUB-COMPONENTS ── */

function ContextPill({ text }) {
  return (
    <View style={styles.contextPill}>
      <Text style={styles.contextPillText}>{text}</Text>
    </View>
  );
}

function CardGrid({ cards }) {
  const pairs = [];
  for (let i = 0; i < cards.length; i += 2) {
    pairs.push(cards.slice(i, i + 2));
  }
  return (
    <View style={styles.statsGrid}>
      {pairs.map((pair, rowIndex) => (
        <View key={rowIndex} style={styles.cardRow}>
          {pair.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
          {pair.length === 1 ? <View style={styles.cardFill} /> : null}
        </View>
      ))}
    </View>
  );
}

function StatCard({ badge, icon, label, tone, value }) {
  return (
    <View style={[styles.statCard, styles[`statCard_${tone}`]]}>
      <View style={styles.statCardBody}>
        <View style={styles.statCardLeft}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={[styles.statValue, styles[`text_${tone}`]]}>{value}</Text>
          <View style={[styles.trendBadge, styles[`badge_${tone}`]]}>
            <Text style={[styles.trendBadgeText, styles[`badgeText_${tone}`]]}>{badge}</Text>
          </View>
        </View>
        <View style={[styles.iconCircle, styles[`iconCircle_${tone}`]]}>
          <FontAwesome5 name={icon} size={18} color={TONE_ICON_COLOR[tone]} />
        </View>
      </View>
    </View>
  );
}

function TopTable({ amountKey, icon, iconTone, kicker, nameHeader, nameKey, qtyHeader, qtyKey, rows, title }) {
  return (
    <View style={styles.tableCard}>
      <View style={styles.tableCardHead}>
        <View>
          <Text style={styles.tableKicker}>{kicker}</Text>
          <Text style={styles.tableTitle}>{title}</Text>
        </View>
        <View style={[styles.tableHeadIcon, styles[`iconCircle_${iconTone}`]]}>
          <FontAwesome5 name={icon} size={14} color={TONE_ICON_COLOR[iconTone]} />
        </View>
      </View>

      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 3 }]}>{nameHeader}</Text>
        <Text style={[styles.tableHeaderCell, styles.textRight, { flex: 1 }]}>{qtyHeader}</Text>
        <Text style={[styles.tableHeaderCell, styles.textRight, { flex: 2 }]}>Amount</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No data available</Text>
      ) : (
        rows.map((item, index) => (
          <View key={index} style={styles.tableDataRow}>
            <Text style={[styles.tableDataName, { flex: 3 }]} numberOfLines={1}>
              {item[nameKey] || "-"}
            </Text>
            <Text style={[styles.tableDataCell, styles.textRight, { flex: 1 }]}>
              {formatCount(item[qtyKey])}
            </Text>
            <Text style={[styles.tableDataCell, styles.textRight, { flex: 2 }]}>
              {formatCurrency(item[amountKey])}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

/* ── STYLES ── */

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f6f8fb", flex: 1 },
  content: {
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
