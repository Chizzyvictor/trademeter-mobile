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
  createCategoryRequest,
  createProductRequest,
  deleteCategoryRequest,
  deleteProductRequest,
  editCategoryRequest,
  editProductRequest,
  getReorderSuggestionsRequest,
  loadCategoriesRequest,
  loadInventoryRequest,
  loadLowStockRequest,
  loadProductDetailsRequest,
  loadStockLedgerRequest,
  restockProductRequest
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

export default function InventoryScreen() {
  const { csrfToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);
  const [lowStockRows, setLowStockRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ category_name: "", category_description: "" });
  const [productForm, setProductForm] = useState({
    product_name: "",
    category_id: "",
    product_unit: "pcs",
    cost_price: "",
    selling_price: "",
    reorder_level: "",
    opening_qty: ""
  });
  const [categoryEditForm, setCategoryEditForm] = useState({ category_id: "", category_name: "", category_description: "", status: "1" });
  const [productEditForm, setProductEditForm] = useState({
    product_id: "",
    product_name: "",
    category_id: "",
    product_unit: "pcs",
    cost_price: "",
    selling_price: "",
    reorder_level: "",
    status: "1"
  });
  const [deleteCategoryId, setDeleteCategoryId] = useState("");
  const [deleteProductId, setDeleteProductId] = useState("");
  const [restockQty, setRestockQty] = useState({});
  const [detailsByProduct, setDetailsByProduct] = useState({});
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerProductId, setLedgerProductId] = useState("");

  const load = useCallback(
    async (mode = "load") => {
      setError("");
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [inventoryRes, lowStockRes, categoriesRes, reorderRes, ledgerRes] = await Promise.all([
          loadInventoryRequest({ csrfToken }),
          loadLowStockRequest({ csrfToken }),
          loadCategoriesRequest({ csrfToken }),
          getReorderSuggestionsRequest({ csrfToken }),
          loadStockLedgerRequest({ csrfToken })
        ]);

        setProducts(Array.isArray(inventoryRes.data) ? inventoryRes.data : []);
        setLowStockRows(Array.isArray(lowStockRes.data) ? lowStockRes.data : []);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
        setReorderSuggestions(Array.isArray(reorderRes.data) ? reorderRes.data : []);
        setLedgerRows(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
      } catch (requestError) {
        setError(requestError.message || "Could not load inventory.");
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

  const stats = useMemo(() => {
    const totalValue = products.reduce((sum, item) => {
      const qty = toNumber(item.quantity || item.qty);
      const unitCost = toNumber(item.cost_price || item.costPrice);
      return sum + qty * unitCost;
    }, 0);

    return {
      categoryCount: categories.length,
      count: products.length,
      lowStockCount: lowStockRows.length,
      totalValue
    };
  }, [categories.length, lowStockRows.length, products]);

  async function handleCreateCategory() {
    setError("");
    const name = String(categoryForm.category_name || "").trim();
    if (!name) {
      setError("Category name required.");
      return;
    }

    setSaving(true);
    try {
      await createCategoryRequest({
        category_name: name,
        category_description: String(categoryForm.category_description || "").trim(),
        csrfToken
      });
      setCategoryForm({ category_name: "", category_description: "" });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not create category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateProduct() {
    setError("");
    const name = String(productForm.product_name || "").trim();
    if (!name) {
      setError("Product name required.");
      return;
    }

    setSaving(true);
    try {
      await createProductRequest({
        product_name: name,
        category_id: Number(productForm.category_id || 0),
        product_unit: String(productForm.product_unit || "pcs").trim() || "pcs",
        cost_price: Number(productForm.cost_price || 0),
        selling_price: Number(productForm.selling_price || 0),
        reorder_level: Number(productForm.reorder_level || 0),
        opening_qty: Number(productForm.opening_qty || 0),
        csrfToken
      });

      setProductForm({
        product_name: "",
        category_id: "",
        product_unit: "pcs",
        cost_price: "",
        selling_price: "",
        reorder_level: "",
        opening_qty: ""
      });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not create product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestock(product) {
    setError("");
    const qty = Number(restockQty[product.product_id] || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a valid restock quantity.");
      return;
    }

    setSaving(true);
    try {
      await restockProductRequest({ product_id: product.product_id, quantity: qty, csrfToken });
      setRestockQty((prev) => ({ ...prev, [product.product_id]: "" }));
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not restock product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditCategory() {
    setError("");
    const categoryId = Number(categoryEditForm.category_id || 0);
    const categoryName = String(categoryEditForm.category_name || "").trim();
    if (categoryId <= 0 || !categoryName) {
      setError("Category ID and category name are required.");
      return;
    }

    setSaving(true);
    try {
      await editCategoryRequest({
        category_id: categoryId,
        category_name: categoryName,
        category_description: String(categoryEditForm.category_description || "").trim(),
        status: Number(categoryEditForm.status || 1),
        csrfToken
      });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not edit category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory() {
    setError("");
    const categoryId = Number(deleteCategoryId || 0);
    if (categoryId <= 0) {
      setError("Enter a valid category ID to delete.");
      return;
    }

    setSaving(true);
    try {
      await deleteCategoryRequest({ category_id: categoryId, csrfToken });
      setDeleteCategoryId("");
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not delete category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditProduct() {
    setError("");
    const productId = Number(productEditForm.product_id || 0);
    const productName = String(productEditForm.product_name || "").trim();
    if (productId <= 0 || !productName) {
      setError("Product ID and product name are required.");
      return;
    }

    setSaving(true);
    try {
      await editProductRequest({
        product_id: productId,
        product_name: productName,
        category_id: Number(productEditForm.category_id || 0),
        product_unit: String(productEditForm.product_unit || "pcs").trim() || "pcs",
        cost_price: Number(productEditForm.cost_price || 0),
        selling_price: Number(productEditForm.selling_price || 0),
        reorder_level: Number(productEditForm.reorder_level || 0),
        status: Number(productEditForm.status || 1),
        csrfToken
      });
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not edit product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct() {
    setError("");
    const productId = Number(deleteProductId || 0);
    if (productId <= 0) {
      setError("Enter a valid product ID to delete.");
      return;
    }

    setSaving(true);
    try {
      await deleteProductRequest({ product_id: productId, csrfToken });
      setDeleteProductId("");
      await load("load");
    } catch (requestError) {
      setError(requestError.message || "Could not delete product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadLedger() {
    setError("");
    setSaving(true);
    try {
      const response = await loadStockLedgerRequest({ product_id: ledgerProductId, csrfToken });
      setLedgerRows(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.message || "Could not load stock ledger.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadDetails(product) {
    setError("");
    setSaving(true);
    try {
      const response = await loadProductDetailsRequest({ product_id: product.product_id, csrfToken });
      setDetailsByProduct((prev) => ({
        ...prev,
        [product.product_id]: response.data || {}
      }));
    } catch (requestError) {
      setError(requestError.message || "Could not load product details.");
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
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>Products, stock position, and low-stock alerts</Text>

        <View style={styles.statsRow}>
          <StatCard label="Categories" value={String(stats.categoryCount)} />
          <StatCard label="Products" value={String(stats.count)} />
          <StatCard label="Low Stock" value={String(stats.lowStockCount)} />
          <StatCard label="Est. Value" value={formatCurrency(stats.totalValue)} />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Create Category</Text>
          <Input
            label="Category name"
            onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, category_name: value }))}
            value={categoryForm.category_name}
          />
          <Input
            label="Description"
            onChangeText={(value) => setCategoryForm((prev) => ({ ...prev, category_description: value }))}
            value={categoryForm.category_description}
          />
          <TouchableOpacity disabled={saving} onPress={handleCreateCategory} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Create category"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Create Product</Text>
          <Input
            label="Product name"
            onChangeText={(value) => setProductForm((prev) => ({ ...prev, product_name: value }))}
            value={productForm.product_name}
          />
          <Input
            label="Category ID"
            keyboardType="number-pad"
            onChangeText={(value) => setProductForm((prev) => ({ ...prev, category_id: value }))}
            value={productForm.category_id}
          />
          <Text style={styles.helper}>Available categories: {categories.map((item) => `${item.category_id}:${item.category_name}`).join(" | ") || "none"}</Text>
          <Input
            label="Unit (pcs/yard/size/etc)"
            onChangeText={(value) => setProductForm((prev) => ({ ...prev, product_unit: value }))}
            value={productForm.product_unit}
          />
          <Input
            label="Cost price"
            keyboardType="decimal-pad"
            onChangeText={(value) => setProductForm((prev) => ({ ...prev, cost_price: value }))}
            value={productForm.cost_price}
          />
          <Input
            label="Selling price"
            keyboardType="decimal-pad"
            onChangeText={(value) => setProductForm((prev) => ({ ...prev, selling_price: value }))}
            value={productForm.selling_price}
          />
          <Input
            label="Reorder level"
            keyboardType="number-pad"
            onChangeText={(value) => setProductForm((prev) => ({ ...prev, reorder_level: value }))}
            value={productForm.reorder_level}
          />
          <Input
            label="Opening quantity"
            keyboardType="number-pad"
            onChangeText={(value) => setProductForm((prev) => ({ ...prev, opening_qty: value }))}
            value={productForm.opening_qty}
          />
          <TouchableOpacity disabled={saving} onPress={handleCreateProduct} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Create product"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Edit Category</Text>
          <Input
            label="Category ID"
            keyboardType="number-pad"
            onChangeText={(value) => setCategoryEditForm((prev) => ({ ...prev, category_id: value }))}
            value={categoryEditForm.category_id}
          />
          <Input
            label="Category name"
            onChangeText={(value) => setCategoryEditForm((prev) => ({ ...prev, category_name: value }))}
            value={categoryEditForm.category_name}
          />
          <Input
            label="Description"
            onChangeText={(value) => setCategoryEditForm((prev) => ({ ...prev, category_description: value }))}
            value={categoryEditForm.category_description}
          />
          <Input
            label="Status (1 active, 0 inactive)"
            keyboardType="number-pad"
            onChangeText={(value) => setCategoryEditForm((prev) => ({ ...prev, status: value }))}
            value={categoryEditForm.status}
          />
          <Text style={styles.pickHint}>Tap a chip or type an ID.</Text>
          <View style={styles.quickPickWrap}>
            <Text style={styles.quickPickTitle}>Quick pick category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickPickRow}>
                {categories.slice(0, 15).map((item) => {
                  const id = String(item.category_id || "");
                  const active = String(categoryEditForm.category_id || "") === id;
                  return (
                    <TouchableOpacity
                      key={`cat-${id}`}
                      onPress={() =>
                        setCategoryEditForm((prev) => ({
                          ...prev,
                          category_id: id,
                          category_name: String(item.category_name || ""),
                          category_description: String(item.category_description || "")
                        }))
                      }
                      style={[styles.quickPickChip, active ? styles.quickPickChipActive : null]}
                    >
                      <Text style={[styles.quickPickChipText, active ? styles.quickPickChipTextActive : null]}>
                        #{id} {item.category_name || "Category"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          <TouchableOpacity disabled={saving} onPress={handleEditCategory} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Save category edits"}</Text>
          </TouchableOpacity>
          <Input
            label="Delete category ID"
            keyboardType="number-pad"
            onChangeText={setDeleteCategoryId}
            value={deleteCategoryId}
          />
          <Text style={styles.pickHint}>Tap a delete chip or type an ID.</Text>
          <View style={styles.quickPickWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickPickRow}>
                {categories.slice(0, 12).map((item) => {
                  const id = String(item.category_id || "");
                  const active = String(deleteCategoryId || "") === id;
                  return (
                    <TouchableOpacity
                      key={`del-cat-${id}`}
                      onPress={() => setDeleteCategoryId(id)}
                      style={[styles.quickPickChip, active ? styles.quickPickDangerActive : null]}
                    >
                      <Text style={[styles.quickPickChipText, active ? styles.quickPickChipTextActive : null]}>Delete #{id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          <TouchableOpacity disabled={saving} onPress={handleDeleteCategory} style={styles.dangerBtn}>
            <Text style={styles.dangerBtnText}>{saving ? "Please wait..." : "Delete category"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Edit Product</Text>
          <Input
            label="Product ID"
            keyboardType="number-pad"
            onChangeText={(value) => setProductEditForm((prev) => ({ ...prev, product_id: value }))}
            value={productEditForm.product_id}
          />
          <Input
            label="Product name"
            onChangeText={(value) => setProductEditForm((prev) => ({ ...prev, product_name: value }))}
            value={productEditForm.product_name}
          />
          <Input
            label="Category ID"
            keyboardType="number-pad"
            onChangeText={(value) => setProductEditForm((prev) => ({ ...prev, category_id: value }))}
            value={productEditForm.category_id}
          />
          <Input
            label="Unit"
            onChangeText={(value) => setProductEditForm((prev) => ({ ...prev, product_unit: value }))}
            value={productEditForm.product_unit}
          />
          <Input
            label="Cost price"
            keyboardType="decimal-pad"
            onChangeText={(value) => setProductEditForm((prev) => ({ ...prev, cost_price: value }))}
            value={productEditForm.cost_price}
          />
          <Input
            label="Selling price"
            keyboardType="decimal-pad"
            onChangeText={(value) => setProductEditForm((prev) => ({ ...prev, selling_price: value }))}
            value={productEditForm.selling_price}
          />
          <Input
            label="Reorder level"
            keyboardType="number-pad"
            onChangeText={(value) => setProductEditForm((prev) => ({ ...prev, reorder_level: value }))}
            value={productEditForm.reorder_level}
          />
          <Input
            label="Status (1 active, 0 inactive)"
            keyboardType="number-pad"
            onChangeText={(value) => setProductEditForm((prev) => ({ ...prev, status: value }))}
            value={productEditForm.status}
          />
          <Text style={styles.pickHint}>Tap a chip or type an ID.</Text>
          <View style={styles.quickPickWrap}>
            <Text style={styles.quickPickTitle}>Quick pick product</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickPickRow}>
                {products.slice(0, 15).map((item) => {
                  const id = String(item.product_id || "");
                  const active = String(productEditForm.product_id || "") === id;
                  return (
                    <TouchableOpacity
                      key={`prod-${id}`}
                      onPress={() =>
                        setProductEditForm((prev) => ({
                          ...prev,
                          product_id: id,
                          product_name: String(item.product_name || ""),
                          category_id: String(item.category_id || ""),
                          product_unit: String(item.product_unit || "pcs"),
                          cost_price: String(toNumber(item.cost_price, 0)),
                          selling_price: String(toNumber(item.selling_price, 0)),
                          reorder_level: String(toNumber(item.reorder_level, 0))
                        }))
                      }
                      style={[styles.quickPickChip, active ? styles.quickPickChipActive : null]}
                    >
                      <Text style={[styles.quickPickChipText, active ? styles.quickPickChipTextActive : null]}>
                        #{id} {item.product_name || "Product"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          <TouchableOpacity disabled={saving} onPress={handleEditProduct} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Save product edits"}</Text>
          </TouchableOpacity>
          <Input
            label="Delete product ID"
            keyboardType="number-pad"
            onChangeText={setDeleteProductId}
            value={deleteProductId}
          />
          <Text style={styles.pickHint}>Tap a delete chip or type an ID.</Text>
          <View style={styles.quickPickWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickPickRow}>
                {products.slice(0, 12).map((item) => {
                  const id = String(item.product_id || "");
                  const active = String(deleteProductId || "") === id;
                  return (
                    <TouchableOpacity
                      key={`del-prod-${id}`}
                      onPress={() => setDeleteProductId(id)}
                      style={[styles.quickPickChip, active ? styles.quickPickDangerActive : null]}
                    >
                      <Text style={[styles.quickPickChipText, active ? styles.quickPickChipTextActive : null]}>Delete #{id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          <TouchableOpacity disabled={saving} onPress={handleDeleteProduct} style={styles.dangerBtn}>
            <Text style={styles.dangerBtnText}>{saving ? "Please wait..." : "Delete product"}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={styles.loader} color="#176b87" /> : null}

        <Text style={styles.sectionTitle}>Low Stock</Text>
        {lowStockRows.map((item, index) => (
          <View key={`ls-${item.product_id || index}`} style={styles.lowItem}>
            <Text style={styles.itemName}>{item.product_name || "Unnamed product"}</Text>
            <Text style={styles.itemMeta}>Qty: {toNumber(item.quantity || item.qty)}</Text>
            <Text style={styles.itemMeta}>Reorder: {toNumber(item.reorder_level || item.reorderLevel)}</Text>
          </View>
        ))}
        {!loading && lowStockRows.length === 0 ? <Text style={styles.empty}>No low-stock products.</Text> : null}

        <Text style={styles.sectionTitle}>Reorder Suggestions</Text>
        {reorderSuggestions.map((item, index) => (
          <View key={`rs-${item.product_id || index}`} style={styles.lowItem}>
            <Text style={styles.itemName}>{item.product_name || "Unnamed product"}</Text>
            <Text style={styles.itemMeta}>Qty: {toNumber(item.quantity)}</Text>
            <Text style={styles.itemMeta}>Suggested reorder: {toNumber(item.suggested_qty)}</Text>
            <Text style={styles.itemMeta}>Days left: {toNumber(item.days_left)}</Text>
          </View>
        ))}
        {!loading && reorderSuggestions.length === 0 ? <Text style={styles.empty}>No reorder suggestions.</Text> : null}

        <Text style={styles.sectionTitle}>Products</Text>
        {products.map((item, index) => (
          <View key={`p-${item.product_id || index}`} style={styles.item}>
            <Text style={styles.itemName}>{item.product_name || "Unnamed product"}</Text>
            <Text style={styles.itemMeta}>Category: {item.category_name || item.category || "-"}</Text>
            <Text style={styles.itemMeta}>Stock: {toNumber(item.quantity || item.qty)}</Text>
            <Text style={styles.itemMeta}>Cost: {formatCurrency(item.cost_price || item.costPrice)}</Text>
            <TouchableOpacity disabled={saving} onPress={() => handleLoadDetails(item)} style={styles.detailBtn}>
              <Text style={styles.detailBtnText}>Load details</Text>
            </TouchableOpacity>
            {detailsByProduct[item.product_id] ? (
              <View style={styles.detailsBox}>
                <Text style={styles.itemMeta}>Unit: {detailsByProduct[item.product_id].product_unit || item.product_unit || "-"}</Text>
                <Text style={styles.itemMeta}>Selling: {formatCurrency(detailsByProduct[item.product_id].selling_price || item.selling_price)}</Text>
                <Text style={styles.itemMeta}>Reorder: {toNumber(detailsByProduct[item.product_id].reorder_level || item.reorder_level)}</Text>
                <Text style={styles.itemMeta}>Updated: {detailsByProduct[item.product_id].updated_at || "-"}</Text>
              </View>
            ) : null}
            <View style={styles.restockRow}>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setRestockQty((prev) => ({
                    ...prev,
                    [item.product_id]: value
                  }))
                }
                placeholder="Restock qty"
                placeholderTextColor="#8a97a8"
                style={styles.restockInput}
                value={String(restockQty[item.product_id] || "")}
              />
              <TouchableOpacity disabled={saving} onPress={() => handleRestock(item)} style={styles.restockBtn}>
                <Text style={styles.restockBtnText}>Restock</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {!loading && products.length === 0 ? <Text style={styles.empty}>No products found.</Text> : null}

        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Stock Ledger</Text>
          <Input
            label="Filter by Product ID (optional)"
            keyboardType="number-pad"
            onChangeText={setLedgerProductId}
            value={ledgerProductId}
          />
          <TouchableOpacity disabled={saving} onPress={handleLoadLedger} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{saving ? "Please wait..." : "Load stock ledger"}</Text>
          </TouchableOpacity>

          {ledgerRows.slice(0, 20).map((row) => (
            <View key={`ledger-${row.ledger_id}`} style={styles.ledgerRow}>
              <Text style={styles.itemName}>{row.product_name || `Product #${row.product_id || "-"}`}</Text>
              <Text style={styles.itemMeta}>Type: {row.reference_type || "-"}</Text>
              <Text style={styles.itemMeta}>IN: {toNumber(row.qty_in)} | OUT: {toNumber(row.qty_out)}</Text>
              <Text style={styles.itemMeta}>Balance: {toNumber(row.balance_after)}</Text>
              <Text style={styles.itemMeta}>At: {row.created_at || "-"}</Text>
            </View>
          ))}
          {!loading && ledgerRows.length === 0 ? <Text style={styles.empty}>No stock ledger entries found.</Text> : null}
        </View>
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
  formSectionTitle: { color: "#102033", fontSize: 15, fontWeight: "800", marginBottom: 2 },
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
  dangerBtn: { alignItems: "center", backgroundColor: "#a12f2f", borderRadius: 8, minHeight: 42, justifyContent: "center", marginTop: 8 },
  dangerBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
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
  quickPickDangerActive: { backgroundColor: "#a12f2f", borderColor: "#a12f2f" },
  quickPickChipText: { color: "#355066", fontSize: 11, fontWeight: "700" },
  quickPickChipTextActive: { color: "#fff" },
  pickHint: { color: "#63758a", fontSize: 11, fontWeight: "600", marginTop: 4 },
  loader: { marginVertical: 12 },
  sectionTitle: { color: "#102033", fontSize: 16, fontWeight: "800", marginTop: 4 },
  lowItem: { backgroundColor: "#fff6f2", borderColor: "#ffd8cb", borderRadius: 10, borderWidth: 1, padding: 12 },
  item: { backgroundColor: "#fff", borderColor: "#e2eaf2", borderRadius: 10, borderWidth: 1, padding: 12 },
  itemName: { color: "#102033", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  itemMeta: { color: "#5f6e82", fontSize: 12, fontWeight: "600" },
  detailBtn: { alignItems: "center", backgroundColor: "#176b87", borderRadius: 8, justifyContent: "center", marginTop: 8, minHeight: 34, paddingHorizontal: 12, alignSelf: "flex-start" },
  detailBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  detailsBox: { backgroundColor: "#f4f8ff", borderColor: "#dbe7fa", borderRadius: 8, borderWidth: 1, marginTop: 8, padding: 8 },
  restockRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  restockInput: {
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
  restockBtn: { alignItems: "center", backgroundColor: "#0f7f4f", borderRadius: 8, justifyContent: "center", minHeight: 38, paddingHorizontal: 14 },
  restockBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  ledgerRow: { borderTopColor: "#edf2f7", borderTopWidth: 1, marginTop: 8, paddingTop: 8 },
  empty: { color: "#6d7b8e", fontSize: 13, textAlign: "center" },
  error: { color: "#b3261e", fontSize: 13, fontWeight: "700" }
});
