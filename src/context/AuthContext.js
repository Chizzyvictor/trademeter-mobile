import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUserContextRequest, loginRequest, logoutRequest } from "../api/client";

const TOKEN_KEY = "trademeter.auth.token";
const USER_KEY = "trademeter.auth.user";
const CSRF_KEY = "trademeter.auth.csrf";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    async function restoreSession() {
      try {
        const [savedToken, savedUser, savedCsrfToken] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(CSRF_KEY)
        ]);

        setUserToken(savedToken);
        setUser(savedUser ? JSON.parse(savedUser) : null);
        setCsrfToken(savedCsrfToken || "");
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      userToken,
      user,
      csrfToken,
      demoSignIn: async () => {
        const nextUser = {
          name: "Demo Trader",
          role: "demo"
        };

        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, "demo-token"),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser))
        ]);

        setUserToken("demo-token");
        setUser(nextUser);
      },
      signIn: async ({ companyEmail, email, password, remember }) => {
        const data = await loginRequest({ companyEmail, email, password, remember });
        const token = data.token || data.session_token || `session-${Date.now()}`;
        const nextCsrfToken = data.csrf_token || data.csrfToken || "";
        const primaryRole = Array.isArray(data.roles) && data.roles.length > 0 ? data.roles[0] : "user";
        const nextUserDraft =
          data.user && typeof data.user === "object"
            ? data.user
            : {
                name: data.user || data.name || email,
                company: data.company || companyEmail,
                role: primaryRole,
                roles: data.roles || []
              };

        let currentContext = null;
        try {
          currentContext = await getCurrentUserContextRequest();
        } catch {
          currentContext = null;
        }

        const nextUser = {
          ...nextUserDraft,
          userId: data.user_id || nextUserDraft.userId || null,
          company: data.company || nextUserDraft.company || companyEmail,
          permissions: data.permissions || nextUserDraft.permissions || [],
          role: nextUserDraft.role || primaryRole,
          roles: data.roles || nextUserDraft.roles || [],
          ...(currentContext?.user || {})
        };

        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, token),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser)),
          AsyncStorage.setItem(CSRF_KEY, nextCsrfToken)
        ]);

        setUserToken(token);
        setUser(nextUser);
        setCsrfToken(nextCsrfToken);
      },
      signOut: async () => {
        const currentCsrf = csrfToken;
        if (currentCsrf) {
          try {
            await logoutRequest({ csrfToken: currentCsrf });
          } catch {
            // Continue local cleanup even when backend logout cannot be reached.
          }
        }

        await Promise.all([
          AsyncStorage.removeItem(TOKEN_KEY),
          AsyncStorage.removeItem(USER_KEY),
          AsyncStorage.removeItem(CSRF_KEY)
        ]);

        setUserToken(null);
        setUser(null);
        setCsrfToken("");
      }
    }),
    [csrfToken, isLoading, user, userToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
