import { useEmbeddedEthereumWallet } from "@privy-io/expo";
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
  custom,
  PublicClient,
  Transport,
  WalletClient,
} from "viem";
import { monadTestnet } from "viem/chains";

type ConnectedWalletClient = WalletClient<Transport, Chain, Account>;

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
  // USDC support was removed; coordinator can prune these + their consumers.
  getMONBalance: () => Promise<bigint | undefined>;
  getUSDCBalance: () => Promise<bigint | undefined>;
  sendUSDC: (
    to: `0x${string}`,
    amount: bigint
  ) => Promise<string | { hash: string } | undefined>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { wallets } = useEmbeddedEthereumWallet();
  const wallet = wallets[0];
  const address = (wallet?.address as `0x${string}` | undefined) ?? null;
  const [walletClient, setWalletClient] =
    useState<ConnectedWalletClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!wallet) return;
      try {
        const provider = await wallet.getProvider();
        if (cancelled) return;
        const pub = createPublicClient({
          chain: monadTestnet,
          transport: custom(provider),
        });
        const wal = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: monadTestnet,
          transport: custom(provider),
        });
        setPublicClient(pub);
        setWalletClient(wal);
      } catch (e) {
        console.warn("WalletContext init failed", e);
      }
    }
    init();
    return () => {
      cancelled = true;
      setWalletClient(null);
      setPublicClient(null);
    };
  }, [wallet]);

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
    // USDC support removed — stubbed for template screens.
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
        isReady: !!(wallet && walletClient && publicClient),
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
