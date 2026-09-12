import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import NetInfo from "@react-native-community/netinfo";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { runMigrations, getMeta, setMeta } from "./src/db/migrations";
import { startNetworkWatcher } from "./src/sync/network";
import { runSync } from "./src/sync/engine";
import { useAuthStore } from "./src/store/authStore";
import { useSyncStore } from "./src/store/syncStore";

import { SetupScreen } from "./src/screens/SetupScreen";
import { PinLoginScreen } from "./src/screens/PinLoginScreen";
import { MenuScreen } from "./src/screens/MenuScreen";
import { OrdersScreen } from "./src/screens/OrdersScreen";
import { PaymentScreen } from "./src/screens/PaymentScreen";
import { MenuAdminScreen } from "./src/screens/MenuAdminScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

type Tab = "menu" | "orders" | "settings";

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("menu");
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const { staff, setDevice, deviceId } = useAuthStore();
  const setOnline = useSyncStore((s) => s.setOnline);

  useEffect(() => {
    (async () => {
      await runMigrations();

      const savedId = await getMeta("device_id");
      if (savedId) {
        setDevice({
          id: savedId,
          name: (await getMeta("device_name")) ?? "Device",
          order_no_prefix: (await getMeta("device_prefix")) ?? "T1",
        });
      }

      if (!(await getMeta("device_salt"))) {
        await setMeta(
          "device_salt",
          Math.random().toString(36).slice(2) + Date.now(),
        );
      }

      startNetworkWatcher();

      const net = await NetInfo.fetch();
      const isOnline = !!net.isConnected && net.isInternetReachable !== false;
      setOnline(isOnline);

      if (isOnline) runSync("boot");

      setReady(true);
    })();

    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });

    return unsub;
  }, []);

  useEffect(() => {
    const onBack = () => {
      if (paymentOrderId) {
        setPaymentOrderId(null);
        setTab("orders");
        return true;
      }

      if (showAdmin) {
        setShowAdmin(false);
        return true;
      }

      if (tab !== "menu") {
        setTab("menu");
        return true;
      }

      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [paymentOrderId, showAdmin, tab]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!deviceId) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <SetupScreen />
      </SafeAreaView>
    );
  }

  if (!staff) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <PinLoginScreen />
      </SafeAreaView>
    );
  }

  if (paymentOrderId) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <PaymentScreen
          orderId={paymentOrderId}
          onDone={() => {
            setPaymentOrderId(null);
            setTab("orders");
          }}
        />
      </SafeAreaView>
    );
  }

  if (showAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <MenuAdminScreen />

        <TouchableOpacity
          style={[styles.back, { bottom: 16 + insets.bottom }]}
          onPress={() => setShowAdmin(false)}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <StatusBar style="dark" />

      <SafeAreaView
        style={{ flex: 1 }}
        edges={["top", "left", "right"]}
      >
        <View style={{ flex: 1 }}>
          {tab === "menu" && (
            <MenuScreen onCheckout={(id) => setPaymentOrderId(id)} />
          )}
          {tab === "orders" && <OrdersScreen />}
          {tab === "settings" && <SettingsScreen />}
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.tabbar,
          {
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <TabBtn
          label="Menu"
          active={tab === "menu"}
          onPress={() => setTab("menu")}
        />
        <TabBtn
          label="Orders"
          active={tab === "orders"}
          onPress={() => setTab("orders")}
        />
        <TabBtn
          label="Settings"
          active={tab === "settings"}
          onPress={() => setTab("settings")}
        />

        {staff?.role === "manager" && (
          <TabBtn
            label="Admin"
            active={false}
            onPress={() => setShowAdmin(true)}
          />
        )}
      </View>
    </View>
  );
}

function TabBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && { color: "#fff" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabbar: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#0f172a",
  },
  tabText: {
    fontWeight: "700",
    color: "#334155",
  },
  back: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#0f172a",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
});