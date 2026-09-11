import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
    if (!name.trim() || !prefix.trim()) return;
    setBusy(true);
    try {
      const d = await api.registerDevice(
        name.trim(),
        prefix.trim().toUpperCase(),
      );
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
    <View style={styles.wrap}>
      <Text style={styles.h1}>Set up this device</Text>
      <Text style={styles.p}>
        Give this tablet a name and a unique order-number prefix
        (e.g. T1, T2, Patio).
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

      <TouchableOpacity style={styles.btn} onPress={register} disabled={busy}>
        <Text style={styles.btnText}>
          {busy ? "Registering…" : "Register device"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  h1: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  p: { color: "#475569", marginBottom: 24 },
  label: { fontWeight: "700", marginTop: 16, marginBottom: 6 },
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
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
