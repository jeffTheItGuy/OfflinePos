import React, { useState } from "react";
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

import { api } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { setMeta } from "../db/migrations";

export function SetupScreen() {
  const setDevice = useAuthStore((s) => s.setDevice);

  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("T1");
  const [busy, setBusy] = useState(false);

  async function register() {
    const cleanName = name.trim();
    const cleanPrefix = prefix.trim().toUpperCase();

    if (!cleanName || !cleanPrefix) {
      Alert.alert("Missing info", "Enter a device name and prefix.");
      return;
    }

    setBusy(true);

    try {
      const d = await api.registerDevice(cleanName, cleanPrefix);

      setDevice(d);

      await setMeta("device_id", d.id);
      await setMeta("device_name", d.name);
      await setMeta("device_prefix", d.order_no_prefix);

      await setMeta(
        "device_salt",
        Math.random().toString(36).slice(2) + Date.now(),
      );
    } catch (e) {
      Alert.alert("Registration failed", (e as Error).message);
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
          <Text style={styles.h1}>Set up this device</Text>

          <Text style={styles.p}>
            Give this tablet a name and a unique order-number prefix (e.g. T1,
            T2, Patio).
          </Text>

          <Text style={styles.label}>Device name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Tablet 1"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Order prefix</Text>
          <TextInput
            style={styles.input}
            value={prefix}
            onChangeText={setPrefix}
            autoCapitalize="characters"
            maxLength={6}
          />

          <TouchableOpacity
            style={[styles.btn, busy && { opacity: 0.6 }]}
            onPress={register}
            disabled={busy}
          >
            <Text style={styles.btnText}>
              {busy ? "Registering…" : "Register device"}
            </Text>
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
    maxWidth: 520,
  },

  h1: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },

  p: {
    color: "#475569",
    marginBottom: 24,
  },

  label: {
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    backgroundColor: "#fff",
  },

  btn: {
    marginTop: 32,
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