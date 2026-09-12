import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { api, ApiError } from "../api/client";
import { cacheStaffList, offlineLogin, seedVerifier } from "../db/staff";
import { useAuthStore } from "../store/authStore";
import { useSyncStore } from "../store/syncStore";

export function PinLoginScreen() {
  const setStaff = useAuthStore((s) => s.setStaff);
  const online = useSyncStore((s) => s.online);

  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!online) return;

    api
      .listStaff()
      .then(cacheStaffList)
      .catch(() => {
        // Offline or server down — cached list is fine.
      });
  }, [online]);

  async function attempt() {
    if (pin.length < 4) return;

    setBusy(true);

    try {
      if (online) {
        try {
          const staff = await api.login(pin);

          // Successful online login seeds the offline verifier for next time.
          await seedVerifier(staff.id, pin);

          setStaff(staff);
          setPin("");

          return;
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 401)) throw e;

          // Wrong PIN online: don't fall back — it's wrong offline too.
          Alert.alert("Invalid PIN");
          setPin("");

          return;
        }
      }

      // Offline path.
      const staff = await offlineLogin(pin);

      if (!staff) {
        Alert.alert(
          "Offline login unavailable",
          "This PIN hasn't been used on this device while online yet.",
        );

        setPin("");
        return;
      }

      setStaff(staff);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.h1}>Enter PIN</Text>

          <Text style={styles.sub}>
            {online ? "Online" : "Offline — cached PINs only"}
          </Text>

          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={12}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.btn, busy && { opacity: 0.6 }]}
            onPress={attempt}
            disabled={busy}
          >
            <Text style={styles.btnText}>{busy ? "…" : "Log in"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  wrap: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },

  card: {
    width: "100%",
    maxWidth: 480,
  },

  h1: {
    fontSize: 28,
    fontWeight: "800",
  },

  sub: {
    color: "#64748b",
    marginBottom: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 16,
    fontSize: 26,
    textAlign: "center",
    letterSpacing: 8,
    backgroundColor: "#fff",
  },

  btn: {
    marginTop: 24,
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },

  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});