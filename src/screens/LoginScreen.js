import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadCompaniesRequest, requestPasswordReset, signupRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

const REMEMBER_KEY = "trademeter.remember.login";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const companyNameRegex = /^[a-zA-Z0-9 .,'&()-]{2,100}$/;

function isCompanyIdentifierValid(value) {
  const trimmed = value.trim();
  return emailRegex.test(trimmed) || companyNameRegex.test(trimmed);
}

function getPasswordStrength(password) {
  const score =
    Number(password.length >= 6) +
    Number(password.length >= 10) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));

  return ["Very weak", "Weak", "Medium", "Strong", "Very strong"][Math.max(0, score - 1)] || "";
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [companyEmail, setCompanyEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const [signupCompanyName, setSignupCompanyName] = useState("");
  const [signupCompanyEmail, setSignupCompanyEmail] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [agree, setAgree] = useState(true);

  const [resetCompany, setResetCompany] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  const [companiesVisible, setCompaniesVisible] = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companies, setCompanies] = useState([]);

  const signupStrength = useMemo(() => getPasswordStrength(signupPassword), [signupPassword]);

  useEffect(() => {
    async function restoreRememberedLogin() {
      const saved = await AsyncStorage.getItem(REMEMBER_KEY);
      if (!saved) {
        return;
      }

      try {
        const parsed = JSON.parse(saved);
        setCompanyEmail(parsed.companyEmail || "");
        setEmail(parsed.email || "");
        setRemember(Boolean(parsed.companyEmail && parsed.email));
      } catch {
        await AsyncStorage.removeItem(REMEMBER_KEY);
      }
    }

    restoreRememberedLogin();
  }, []);

  function clearMessages() {
    setError("");
    setSuccess("");
    setStatus("");
  }

  function showTab(tabName) {
    clearMessages();
    setActiveTab(tabName);
  }

  async function handleLogin() {
    clearMessages();

    if (!isCompanyIdentifierValid(companyEmail)) {
      setError("Enter a valid company email or company name.");
      return;
    }

    if (!emailRegex.test(email.trim())) {
      setError("Enter a valid user email.");
      return;
    }

    if (!password) {
      setError("Please fill in the password.");
      return;
    }

    try {
      setSubmitting(true);
      setStatus("Checking your details...");
      await signIn({
        companyEmail: companyEmail.trim(),
        email: email.trim(),
        password,
        remember
      });

      if (remember) {
        await AsyncStorage.setItem(
          REMEMBER_KEY,
          JSON.stringify({ companyEmail: companyEmail.trim(), email: email.trim() })
        );
      } else {
        await AsyncStorage.removeItem(REMEMBER_KEY);
      }
    } catch (loginError) {
      setStatus("");
      setError(loginError.message || "Connection failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignup() {
    clearMessages();

    if (!companyNameRegex.test(signupCompanyName.trim())) {
      setError("Company name is required.");
      return;
    }

    if (!emailRegex.test(signupCompanyEmail.trim())) {
      setError("Your email must be valid.");
      return;
    }

    if (signupFullName.trim().length < 2) {
      setError("Full name is required.");
      return;
    }

    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agree) {
      setError("Check the box to confirm you have read the terms and conditions.");
      return;
    }

    try {
      setSubmitting(true);
      setStatus("Creating your account...");
      const result = await signupRequest({
        companyName: signupCompanyName.trim(),
        companyEmail: signupCompanyEmail.trim(),
        fullName: signupFullName.trim(),
        password: signupPassword
      });

      setStatus("");
      setSuccess(result.text || "Account created. Please log in.");
      setCompanyEmail(signupCompanyName.trim());
      setEmail(signupCompanyEmail.trim());
      setActiveTab("login");
    } catch (signupError) {
      setStatus("");
      setError(signupError.message || "Signup failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    clearMessages();

    if (!isCompanyIdentifierValid(resetCompany)) {
      setError("Enter a valid company email or company name.");
      return;
    }

    if (!emailRegex.test(resetEmail.trim())) {
      setError("Your email must be valid.");
      return;
    }

    try {
      setSubmitting(true);
      setStatus("Sending reset link...");
      const result = await requestPasswordReset({
        company: resetCompany.trim(),
        email: resetEmail.trim()
      });

      setStatus("");
      setSuccess(result.text || "Check your email for the reset link.");
      setActiveTab("login");
    } catch (resetError) {
      setStatus("");
      setError(resetError.message || "Could not send reset link.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadCompanies() {
    clearMessages();
    const nextVisible = !companiesVisible;
    setCompaniesVisible(nextVisible);

    if (!nextVisible || companies.length > 0) {
      return;
    }

    try {
      setCompaniesLoading(true);
      const result = await loadCompaniesRequest();
      setCompanies(Array.isArray(result.data) ? result.data : []);
    } catch (companiesError) {
      setError(companiesError.message || "Could not load companies.");
    } finally {
      setCompaniesLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.brand}>TradeMeter</Text>
            <Text style={styles.title}>{activeTab === "login" ? "Login" : activeTab === "signup" ? "Signup" : "Forgotten password?"}</Text>
            <Text style={styles.subtitle}>
              {activeTab === "login"
                ? "Access your company workspace."
                : activeTab === "signup"
                  ? "Create your company and owner account."
                  : "Receive a password reset link by email."}
            </Text>
          </View>

          <View style={styles.tabs}>
            <TabButton active={activeTab === "login"} label="Login" onPress={() => showTab("login")} />
            <TabButton active={activeTab === "signup"} label="Sign Up" onPress={() => showTab("signup")} />
            <TabButton active={activeTab === "forgot"} label="Reset" onPress={() => showTab("forgot")} />
          </View>

          {status ? <Text style={styles.status}>{status}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {activeTab === "login" ? (
            <View style={styles.form}>
              <LabeledInput label="Company email or name" value={companyEmail} onChangeText={setCompanyEmail} placeholder="acme@company.com or Acme Ltd" />
              <LabeledInput label="User email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <LabeledInput label="Password" value={password} onChangeText={setPassword} placeholder="Enter password" secureTextEntry />

              <CheckRow checked={remember} label="Remember me for 30 days" onPress={() => setRemember((current) => !current)} />

              <PrimaryButton disabled={submitting} loading={submitting} label="Login" onPress={handleLogin} />

              <TouchableOpacity onPress={() => showTab("forgot")} style={styles.textLinkButton}>
                <Text style={styles.textLink}>Forgotten password?</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLoadCompanies} style={styles.textLinkButton}>
                <Text style={styles.textLink}>{companiesVisible ? "Hide companies" : "View other companies"}</Text>
              </TouchableOpacity>

              {companiesVisible ? (
                <View style={styles.companyList}>
                  {companiesLoading ? <ActivityIndicator color="#176b87" /> : null}
                  {companies.slice(0, 8).map((company) => (
                    <TouchableOpacity
                      key={`${company.cid}-${company.cEmail}`}
                      onPress={() => setCompanyEmail(company.cEmail || company.cName || "")}
                      style={styles.companyItem}
                    >
                      <Text style={styles.companyName}>{company.cName || "Company"}</Text>
                      <Text style={styles.companyEmail}>{company.cEmail || ""}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {activeTab === "signup" ? (
            <View style={styles.form}>
              <LabeledInput label="Company name" value={signupCompanyName} onChangeText={setSignupCompanyName} placeholder="Miracle Ventures Ltd" />
              <LabeledInput label="Email" value={signupCompanyEmail} onChangeText={setSignupCompanyEmail} placeholder="miracle@gmail.com" keyboardType="email-address" />
              <LabeledInput label="Your full name" value={signupFullName} onChangeText={setSignupFullName} placeholder="John Doe" />
              <LabeledInput label="Password" value={signupPassword} onChangeText={setSignupPassword} placeholder="Enter password" secureTextEntry />
              {signupPassword ? <Text style={styles.helper}>Password strength: {signupStrength}</Text> : null}
              <LabeledInput label="Confirm password" value={signupConfirmPassword} onChangeText={setSignupConfirmPassword} placeholder="Enter password again" secureTextEntry />

              <CheckRow checked={agree} label="I have read and agreed to the terms and conditions" onPress={() => setAgree((current) => !current)} />
              <PrimaryButton disabled={submitting} loading={submitting} label="Sign Up" onPress={handleSignup} />

              <TouchableOpacity onPress={() => showTab("login")} style={styles.textLinkButton}>
                <Text style={styles.textLink}>Already have an account? Login</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {activeTab === "forgot" ? (
            <View style={styles.form}>
              <LabeledInput label="Company email or name" value={resetCompany} onChangeText={setResetCompany} placeholder="acme@company.com or Acme Ltd" />
              <LabeledInput label="Your email" value={resetEmail} onChangeText={setResetEmail} placeholder="you@example.com" keyboardType="email-address" />
              <PrimaryButton disabled={submitting} loading={submitting} label="Send Reset Link" onPress={handlePasswordReset} />

              <TouchableOpacity onPress={() => showTab("login")} style={styles.textLinkButton}>
                <Text style={styles.textLink}>Back to login</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LabeledInput({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#8a97a8"
        returnKeyType="next"
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function PrimaryButton({ disabled, label, loading, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.82} disabled={disabled} onPress={onPress} style={[styles.button, disabled ? styles.buttonDisabled : null]}>
      {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function TabButton({ active, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabButton, active ? styles.tabButtonActive : null]}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CheckRow({ checked, label, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.checkRow}>
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
        {checked ? <Text style={styles.checkboxMark}>X</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f6f8fb",
    flex: 1
  },
  keyboardArea: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 36
  },
  header: {
    marginBottom: 22
  },
  brand: {
    color: "#176b87",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 18
  },
  title: {
    color: "#102033",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 8
  },
  subtitle: {
    color: "#526174",
    fontSize: 16,
    lineHeight: 23
  },
  tabs: {
    backgroundColor: "#e8eef5",
    borderRadius: 8,
    flexDirection: "row",
    marginBottom: 18,
    padding: 4
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 42,
    justifyContent: "center"
  },
  tabButtonActive: {
    backgroundColor: "#ffffff"
  },
  tabText: {
    color: "#526174",
    fontSize: 14,
    fontWeight: "800"
  },
  tabTextActive: {
    color: "#176b87"
  },
  form: {
    gap: 16
  },
  field: {
    gap: 8
  },
  label: {
    color: "#2a3747",
    fontSize: 14,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e1ea",
    borderRadius: 8,
    borderWidth: 1,
    color: "#102033",
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16
  },
  helper: {
    color: "#526174",
    fontSize: 13
  },
  status: {
    color: "#176b87",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 12
  },
  success: {
    color: "#147a3f",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 12
  },
  error: {
    color: "#b42318",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 12
  },
  button: {
    alignItems: "center",
    backgroundColor: "#176b87",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 54
  },
  buttonDisabled: {
    opacity: 0.75
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  textLinkButton: {
    alignItems: "center",
    minHeight: 38,
    justifyContent: "center"
  },
  textLink: {
    color: "#176b87",
    fontSize: 15,
    fontWeight: "800"
  },
  checkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 34
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#b8c7d8",
    borderRadius: 5,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  checkboxChecked: {
    backgroundColor: "#176b87",
    borderColor: "#176b87"
  },
  checkboxMark: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  checkLabel: {
    color: "#526174",
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  companyList: {
    gap: 10
  },
  companyItem: {
    backgroundColor: "#ffffff",
    borderColor: "#e1e8f0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  companyName: {
    color: "#102033",
    fontSize: 15,
    fontWeight: "800"
  },
  companyEmail: {
    color: "#526174",
    fontSize: 13,
    marginTop: 3
  }
});
