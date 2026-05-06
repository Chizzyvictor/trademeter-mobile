const API_BASE_URL = "https://trademeter-app-3e1889251956.herokuapp.com";
const AUTH_ENDPOINT = `${API_BASE_URL}/apiAuthentications.php`;
const DASHBOARD_ENDPOINT = `${API_BASE_URL}/apiRequest.php`;
const PARTNERS_ENDPOINT = `${API_BASE_URL}/apiPartners.php`;
const INVENTORY_ENDPOINT = `${API_BASE_URL}/apiInventory.php`;
const TRANSACTIONS_ENDPOINT = `${API_BASE_URL}/apiTransactions.php`;
const ATTENDANCE_ENDPOINT = `${API_BASE_URL}/apiEmployeeAttendance.php`;
const SETTINGS_ENDPOINT = `${API_BASE_URL}/apiSettings.php`;
const PROFILE_ENDPOINT = `${API_BASE_URL}/apiUserProfile.php`;

function isResponseSuccess(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (typeof payload.ok === "boolean") {
    return payload.ok;
  }

  return String(payload.status || "").toLowerCase() === "success";
}

function getResponseMessage(payload, fallback = "Request failed.") {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  return payload.message || payload.text || fallback;
}

async function postForm(url, action, fields = {}, csrfToken = "") {
  const formData = new URLSearchParams();
  formData.append("action", action);

  if (csrfToken) {
    formData.append("csrf_token", csrfToken);
  }

  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value == null ? "" : String(value));
  });

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString()
  });

  const text = await response.text();
  let data;

  if (response.status === 404) {
    throw new Error("Authentication API not found on Heroku.");
  }

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The server did not return valid JSON.");
  }

  if (!response.ok || !isResponseSuccess(data)) {
    throw new Error(getResponseMessage(data, "Request failed. Please try again."));
  }

  return data;
}

async function authRequest(action, fields = {}) {
  return postForm(AUTH_ENDPOINT, action, fields);
}

export async function loginRequest({ companyEmail, email, password, remember }) {
  return authRequest("login", {
    companyEmail,
    email,
    pass: password,
    remember: remember ? "1" : "0"
  });
}

export async function signupRequest({ companyName, companyEmail, fullName, password }) {
  return authRequest("signup", {
    cName: companyName,
    cEmail: companyEmail,
    fullName,
    cPass: password
  });
}

export async function requestPasswordReset({ company, email }) {
  return authRequest("requestPasswordReset", {
    company,
    email
  });
}

export async function loadCompaniesRequest() {
  return authRequest("loadCompanies");
}

export async function loadDashboardRequest({ range = "all", csrfToken = "" }) {
  return postForm(DASHBOARD_ENDPOINT, "loadDashboard", { range }, csrfToken);
}

export async function getCurrentUserContextRequest() {
  return authRequest("getCurrentUserContext");
}

export async function logoutRequest({ csrfToken = "" }) {
  return postForm(AUTH_ENDPOINT, "logout", {}, csrfToken);
}

export async function loadPartnersRequest({ action = "loadAllPartners", csrfToken = "" } = {}) {
  return postForm(PARTNERS_ENDPOINT, action, {}, csrfToken);
}

export async function loadPartnerDetailsRequest({ id, csrfToken = "" }) {
  return postForm(PARTNERS_ENDPOINT, "loadPartnerDetails", { id }, csrfToken);
}

export async function addPartnerRequest({ aName, aEmail, aPhone, aAddress, csrfToken = "" }) {
  return postForm(PARTNERS_ENDPOINT, "addPartner", { aName, aEmail, aPhone, aAddress }, csrfToken);
}

export async function editPartnerRequest({ id, aName, aEmail, aPhone, aAddress, csrfToken = "" }) {
  return postForm(PARTNERS_ENDPOINT, "editPartner", { id, aName, aEmail, aPhone, aAddress }, csrfToken);
}

export async function deletePartnerRequest({ id, csrfToken = "" }) {
  return postForm(PARTNERS_ENDPOINT, "deletePartner", { id }, csrfToken);
}

export async function addDebtRequest({ id, amount, debtDesc, csrfToken = "" }) {
  return postForm(PARTNERS_ENDPOINT, "addDebt", { id, amount, debtDesc }, csrfToken);
}

export async function payDebtRequest({ id, amount, payDesc, csrfToken = "" }) {
  return postForm(PARTNERS_ENDPOINT, "payDebt", { id, amount, payDesc }, csrfToken);
}

export async function loadInventoryRequest({ csrfToken = "" } = {}) {
  return postForm(INVENTORY_ENDPOINT, "loadInventory", {}, csrfToken);
}

export async function loadCategoriesRequest({ csrfToken = "" } = {}) {
  return postForm(INVENTORY_ENDPOINT, "loadCategories", {}, csrfToken);
}

export async function createCategoryRequest({ category_name, category_description, csrfToken = "" }) {
  return postForm(INVENTORY_ENDPOINT, "createCategory", { category_name, category_description }, csrfToken);
}

export async function createProductRequest({
  product_name,
  category_id,
  product_unit,
  cost_price,
  selling_price,
  reorder_level,
  opening_qty,
  csrfToken = ""
}) {
  return postForm(
    INVENTORY_ENDPOINT,
    "createProduct",
    { product_name, category_id, product_unit, cost_price, selling_price, reorder_level, opening_qty },
    csrfToken
  );
}

export async function restockProductRequest({ product_id, quantity, csrfToken = "" }) {
  return postForm(INVENTORY_ENDPOINT, "restockProduct", { product_id, quantity }, csrfToken);
}

export async function loadLowStockRequest({ csrfToken = "" } = {}) {
  return postForm(INVENTORY_ENDPOINT, "loadLowStock", {}, csrfToken);
}

export async function loadProductDetailsRequest({ product_id, csrfToken = "" }) {
  return postForm(INVENTORY_ENDPOINT, "loadProductDetails", { product_id }, csrfToken);
}

export async function loadTransactionsRequest({ csrfToken = "" } = {}) {
  return postForm(TRANSACTIONS_ENDPOINT, "loadPurchases", {}, csrfToken);
}

export async function loadTransactionProductsRequest({ csrfToken = "" } = {}) {
  return postForm(TRANSACTIONS_ENDPOINT, "loadProducts", {}, csrfToken);
}

export async function createPurchaseRequest({ partner_id, amountPaid = 0, transaction_date, items, csrfToken = "" }) {
  return postForm(
    TRANSACTIONS_ENDPOINT,
    "createPurchase",
    {
      partner_id,
      transaction_type: "buy",
      amountPaid,
      transaction_date,
      items: JSON.stringify(items || [])
    },
    csrfToken
  );
}

export async function createSaleRequest({ partner_id, amountPaid = 0, transaction_date, items, csrfToken = "" }) {
  return postForm(
    TRANSACTIONS_ENDPOINT,
    "createSale",
    {
      partner_id,
      transaction_type: "sell",
      amountPaid,
      transaction_date,
      items: JSON.stringify(items || [])
    },
    csrfToken
  );
}

export async function payPurchaseRequest({ purchase_id, amount, csrfToken = "" }) {
  return postForm(TRANSACTIONS_ENDPOINT, "payPurchase", { purchase_id, amount }, csrfToken);
}

export async function loadAttendanceOverviewRequest({ csrfToken = "" } = {}) {
  return postForm(ATTENDANCE_ENDPOINT, "loadEmployeeOverview", {}, csrfToken);
}

export async function loadEmployeesRequest({ csrfToken = "" } = {}) {
  return postForm(ATTENDANCE_ENDPOINT, "loadEmployees", {}, csrfToken);
}

export async function loadAttendancePolicyRequest({ csrfToken = "" } = {}) {
  return postForm(ATTENDANCE_ENDPOINT, "loadAttendancePolicy", {}, csrfToken);
}

export async function saveAttendancePolicyRequest({
  resumption_time,
  fine_0_15,
  fine_15_60,
  fine_60_plus,
  csrfToken = ""
}) {
  return postForm(
    ATTENDANCE_ENDPOINT,
    "saveAttendancePolicy",
    { resumption_time, fine_0_15, fine_15_60, fine_60_plus },
    csrfToken
  );
}

export async function saveShiftRuleRequest({
  user_id,
  shift_start,
  shift_end,
  grace_minutes,
  is_active = 1,
  csrfToken = ""
}) {
  return postForm(
    ATTENDANCE_ENDPOINT,
    "saveShiftRule",
    { user_id, shift_start, shift_end, grace_minutes, is_active },
    csrfToken
  );
}

export async function signOutEmployeeRequest({ user_id, csrfToken = "" }) {
  return postForm(ATTENDANCE_ENDPOINT, "signOutEmployee", { user_id }, csrfToken);
}

export async function runAutoAbsenceRequest({ date, csrfToken = "" }) {
  return postForm(ATTENDANCE_ENDPOINT, "runAutoAbsence", { date }, csrfToken);
}

export async function loadCorrectionRequestsRequest({ status = "pending", csrfToken = "" } = {}) {
  return postForm(ATTENDANCE_ENDPOINT, "loadCorrectionRequests", { status }, csrfToken);
}

export async function reviewCorrectionRequest({ correction_id, decision, review_note = "", csrfToken = "" }) {
  return postForm(ATTENDANCE_ENDPOINT, "reviewCorrection", { correction_id, decision, review_note }, csrfToken);
}

export async function requestCorrectionRequest({
  user_id,
  attendance_date,
  proposed_signin_at = "",
  proposed_signout_at = "",
  reason,
  csrfToken = ""
}) {
  return postForm(
    ATTENDANCE_ENDPOINT,
    "requestCorrection",
    { user_id, attendance_date, proposed_signin_at, proposed_signout_at, reason },
    csrfToken
  );
}

export async function loadSettingsRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "loadSettings", {}, csrfToken);
}

export async function updateProfileRequest({ cName, cEmail, csrfToken = "" }) {
  return postForm(SETTINGS_ENDPOINT, "updateProfile", { cName, cEmail }, csrfToken);
}

export async function loadRolesRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "loadRoles", {}, csrfToken);
}

export async function loadUsersRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "loadUsers", {}, csrfToken);
}

export async function createUserRequest({ full_name, email, password, role_id, csrfToken = "" }) {
  return postForm(SETTINGS_ENDPOINT, "createUser", { full_name, email, password, role_id }, csrfToken);
}

export async function updateUserRoleRequest({ user_id, role_id, csrfToken = "" }) {
  return postForm(SETTINGS_ENDPOINT, "updateUserRole", { user_id, role_id }, csrfToken);
}

export async function toggleUserStatusRequest({ user_id, is_active, csrfToken = "" }) {
  return postForm(SETTINGS_ENDPOINT, "toggleUserStatus", { user_id, is_active }, csrfToken);
}

export async function loadRememberAuditRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "loadRememberAudit", {}, csrfToken);
}

export async function loadActiveSessionsRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "loadActiveSessions", {}, csrfToken);
}

export async function revokeSessionRequest({ session_id, csrfToken = "" }) {
  return postForm(SETTINGS_ENDPOINT, "revokeSession", { session_id }, csrfToken);
}

export async function loadLoginLogsRequest({ status = "all", csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "loadLoginLogs", { status }, csrfToken);
}

export async function getBackupCapabilityRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "getBackupCapability", {}, csrfToken);
}

export async function createBackupRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "createBackup", {}, csrfToken);
}

export async function loadBackupsRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "loadBackups", {}, csrfToken);
}

export async function loadBackupAuditRequest({ csrfToken = "" } = {}) {
  return postForm(SETTINGS_ENDPOINT, "loadBackupAudit", {}, csrfToken);
}

export async function loadUserProfileRequest({ csrfToken = "" } = {}) {
  return postForm(PROFILE_ENDPOINT, "getUserProfile", {}, csrfToken);
}

export async function loadMessagingRequest({ csrfToken = "" } = {}) {
  return postForm(PROFILE_ENDPOINT, "loadMessagingData", {}, csrfToken);
}
