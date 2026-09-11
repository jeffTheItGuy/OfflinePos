import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { useMenuStore } from "../store/menuStore";
import { useAuthStore } from "../store/authStore";
import { BASE_URL } from "../api/client";

// Manager-only, online-only. Reads from the same local menu cache the
// ordering screen uses. Writes go to the server with the X-Staff-Id header
// the backend's require_manager dependency expects.
export function MenuAdminScreen() {
  const items = useMenuStore((s) => s.items);
  const reload = useMenuStore((s) => s.reload);
  const staff = useAuthStore((s) => s.staff);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    reload();
  }, []);

  if (staff?.role !== "manager") {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>Managers only</Text>
      </View>
    );
  }

  async function create() {
    const cents = Math.round(parseFloat(price) * 100);
    if (!name || !cents) return;
    try {
      const res = await fetch(`${BASE_URL}/menu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Staff-Id": staff!.id,
        },
        body: JSON.stringify({
          name,
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
    <View style={styles.wrap}>
      <Text style={styles.h1}>Menu (manager)</Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="Item name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="9.50"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
        />
        <TouchableOpacity style={styles.addBtn} onPress={create}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={{ flex: 1, fontWeight: "600" }}>{item.name}</Text>
            <Text>${(item.price_cents / 100).toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: "#f8fafc" },
  h1: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  addBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 8,
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
});
