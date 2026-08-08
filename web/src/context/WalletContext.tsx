import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import {
    createPublicClient,
    createWalletClient,
    http,
    type Account,
    type Chain,
    type PublicClient,
    type Transport,
    type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

type ConnectedWalletClient = WalletClient<Transport, Chain, Account>;

// Instant in-browser wallet: a private key is generated on first visit and
// kept in localStorage. No login, no external auth dependency —
// "open the page, you already have a wallet".
const WALLET_KEY = "walkthewalk.pk";

const BALANCE_POLL_MS = 10_000;

interface WalletContextType {
    address: `0x${string}` | null;
    publicClient: PublicClient | null;
    walletClient: ConnectedWalletClient | null;
    /** MON native balance in wei */
    balance: bigint;
    refreshBalance: () => Promise<void>;
    isReady: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [address, setAddress] = useState<`0x${string}` | null>(null);
    const [walletClient, setWalletClient] =
        useState<ConnectedWalletClient | null>(null);
    const [publicClient, setPublicClient] = useState<PublicClient | null>(
        null
    );
    const [balance, setBalance] = useState<bigint>(0n);

    useEffect(() => {
        try {
            let pk = localStorage.getItem(WALLET_KEY) as `0x${string}` | null;
            if (!pk) {
                pk = generatePrivateKey();
                localStorage.setItem(WALLET_KEY, pk);
            }
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
        const interval = setInterval(refreshBalance, BALANCE_POLL_MS);
        return () => clearInterval(interval);
    }, [refreshBalance]);

    return (
        <WalletContext.Provider
            value={{
                address,
                publicClient,
                walletClient,
                balance,
                refreshBalance,
                isReady: !!(address && walletClient && publicClient),
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWalletContext() {
    const ctx = useContext(WalletContext);
    if (!ctx)
        throw new Error(
            "useWalletContext must be used within a WalletProvider"
        );
    return ctx;
}
