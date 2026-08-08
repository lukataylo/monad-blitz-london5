import BottomSheet from "@gorhom/bottom-sheet";
import React, { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import BottomSheets from "./BottomSheets";
import WalletActions from "./WalletActions";
import WalletHeader from "./WalletHeader";

export default function Home() {
  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [sheetType, setSheetType] = useState<
    "send" | "receive" | "sign" | null
  >(null);

  const openSheet = useCallback((type: "send" | "receive" | "sign") => {
    setSheetType(type);
    bottomSheetRef.current?.expand();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 100,
      }}
    >
      <WalletHeader />
      <WalletActions openSheet={openSheet} />
      <View style={{ height: 24 }} />
      <BottomSheets
        sheetType={sheetType}
        setSheetType={setSheetType}
        bottomSheetRef={bottomSheetRef}
      />
    </View>
  );
}
