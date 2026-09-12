import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { useMenuStore } from "../store/menuStore";
import { useAuthStore } from "../store/authStore";
import { BASE_URL } from "../api/client";

export function MenuAdminScreen() {
  const items = useMenuStore((s) => s.items);
  const reload = useMenuStore((s) => s.reload);
  const staff = useAuthStore((s) => s.staff);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const { width } = useWindowDimensions();
  const isNarrow = width < 640;

  useEffect(() => {
    reload();
  }, [reload]);

  if (!staff || staff.role !== "manager") {
    return (
      <View style={styles.center}>
        <Text style={styles.h1}>Managers only</Text>
      </View>
    );
  }

  const manager = staff;

  async function create() {
    const cleanName = name.trim();
    const parsedPrice = parseFloat(price.replace(",", "."));
    const cents = Math.round(parsedPrice * 100);

    if (!cleanName || !Number.isFinite(parsedPrice) || cents <= 0) {
      Alert.alert("Invalid item", "Enter an item name and a valid price.");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/menu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Staff-Id": manager.id,
        },
        body: JSON.stringify({
          name: cleanName,
          price_cents: cents,
          category: "general",
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      setName("");
      setPrice("");

      await reload();
    } catch (e) {
      Alert.alert("Create failed", (e as Error).message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.wrap}>
        <Text style={styles.h1}>Menu (manager)</Text>

        <View style={[styles.form, isNarrow && styles.formColumn]}>
          <TextInput
            style={[styles.input, isNarrow ? styles.inputFull : styles.inputName]}
            placeholder="Item name"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={[styles.input, isNarrow ? styles.inputFull : styles.inputPrice]}
            placeholder="9.50"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />

          <TouchableOpacity
            style={[styles.addBtn, isNarrow && styles.addBtnFull]}
            onPress={create}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowPrice}>
                ${(item.price_cents / 100).toFixed(2)}
              </Text>
            </View>
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  wrap: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafc",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },

  h1: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },

  form: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  formColumn: {
    flexDirection: "column",
  },

  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },

  inputName: {
    flex: 2,
  },

  inputPrice: {
    flex: 1,
  },

  inputFull: {
    width: "100%",
  },

  addBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 8,
  },

  addBtnFull: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },

  addBtnText: {
    color: "#fff",
    fontWeight: "800",
  },

  list: {
    flex: 1,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 6,
  },

  rowName: {
    flex: 1,
    fontWeight: "600",
    marginRight: 12,
  },

  rowPrice: {
    fontWeight: "700",
  },
});