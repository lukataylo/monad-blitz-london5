import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Account,
  Chain,
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  Transport,
  WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

type ConnectedWalletClient = WalletClient<Transport, Chain, Account>;

// Instant on-device wallet: a private key is generated on first launch and
// kept in the iOS keychain via SecureStore. No login, no external auth
// dependency — "open the app, you already have a wallet".
const WALLET_KEY = "walkthewalk.privateKey";

interface WalletContextType {
  address: `0x${string}` | null;
  publicClient: PublicClient | null;
  walletClient: ConnectedWalletClient | null;
  /** MON native balance in wei */
  balance: bigint;
  refreshBalance: () => Promise<void>;
  signMessage: (message: string) => Promise<string | undefined>;
  isReady: boolean;
  // ---- backwards-compat stubs for template screens (SendSheet, WalletHeader).
  getMONBalance: () => Promise<bigint | undefined>;
  getUSDCBalance: () => Promise<bigint | undefined>;
  sendUSDC: (
    to: `0x${string}`,
    amount: bigint
  ) => Promise<string | { hash: string } | undefined>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [walletClient, setWalletClient] =
    useState<ConnectedWalletClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        let pk = (await SecureStore.getItemAsync(
          WALLET_KEY
        )) as `0x${string}` | null;
        if (!pk) {
          pk = generatePrivateKey();
          await SecureStore.setItemAsync(WALLET_KEY, pk);
        }
        if (cancelled) return;
        const account = privateKeyToAccount(pk);
        const pub = createPublicClient({
          chain: monadTestnet,
          transport: http(),
        });
        const wal = createWalletClient({
          account,
          chain: monadTestnet,
          transport: http(),
        });
        setAddress(account.address);
        setPublicClient(pub);
        setWalletClient(wal);
      } catch (e) {
        console.warn("WalletContext init failed", e);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const bal = await publicClient.getBalance({ address });
      setBalance(bal);
    } catch (e) {
      console.warn("refreshBalance failed", e);
    }
  }, [publicClient, address]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  async function signMessage(message: string) {
    if (walletClient && address) {
      const signature = await walletClient.signMessage({
        account: walletClient.account,
        message,
      });
      return signature;
    }
  }

  // ---- backwards-compat stubs ----
  async function getMONBalance() {
    if (publicClient && address) {
      return publicClient.getBalance({ address });
    }
  }

  async function getUSDCBalance(): Promise<bigint | undefined> {
    return 0n;
  }

  async function sendUSDC(): Promise<string | { hash: string } | undefined> {
    console.warn("sendUSDC is removed — no-op stub");
    return undefined;
  }

  return (
    <WalletContext.Provider
      value={{
        address,
        publicClient,
        walletClient,
        balance,
        refreshBalance,
        signMessage,
        isReady: !!(address && walletClient && publicClient),
        getMONBalance,
        getUSDCBalance,
        sendUSDC,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx)
    throw new Error("useWalletContext must be used within a WalletProvider");
  return ctx;
}
