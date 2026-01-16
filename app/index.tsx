import { Redirect } from "expo-router";

export default function Index() {
  // @ts-ignore - Expo Router group routes
  return <Redirect href="/(tabs)" />;
}
