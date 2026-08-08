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
    fallback,
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
// "open the page, you already have a wallet". Onboarding (create account /
// log in) may REPLACE this key with one derived from email+password, then
// call reloadWallet() to pick it up without a page refresh.
export const WALLET_KEY = "walkthewalk.pk";

// 15s (was 10s): trimmed alongside other poll cadences after production hit
// public-RPC 429s with several devices connected at once. Post-drip and
// post-write paths call refreshBalance() directly, so funding moments still
// unlock fast.
const BALANCE_POLL_MS = 15_000;

// The primary public RPC caps at 15 req/s PER IP — a venue full of phones
// behind one NAT shares that budget. Each device picks a random first
// provider so the fleet spreads across endpoints instead of stampeding one.
// drpc stays last: it has an eth_call quirk ("gas exceeds provider limit")
// that makes it a poor primary but a fine last resort.
const RPC_ROTATION = (() => {
    const primaries = [
        "https://testnet-rpc.monad.xyz",
        "https://10143.rpc.thirdweb.com",
    ];
    const start = Math.floor(Math.random() * primaries.length);
    return [
        primaries[start],
        primaries[(start + 1) % primaries.length],
        "https://monad-testnet.drpc.org",
    ];
})();

interface WalletContextType {
    address: `0x${string}` | null;
    publicClient: PublicClient | null;
    walletClient: ConnectedWalletClient | null;
    /** MON native balance in wei */
    balance: bigint;
    refreshBalance: () => Promise<void>;
    /**
     * Re-read the private key from localStorage and rebuild the account +
     * clients. Cheap (no page reload): onboarding calls this right after
     * swapping "walkthewalk.pk" for a derived key.
     */
    reloadWallet: () => void;
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

    const reloadWallet = useCallback(() => {
        try {
            let pk = localStorage.getItem(WALLET_KEY) as `0x${string}` | null;
            if (!pk) {
                pk = generatePrivateKey();
                localStorage.setItem(WALLET_KEY, pk);
            }
            const account = privateKeyToAccount(pk);
            const pub = createPublicClient({
                chain: monadTestnet,
                transport: fallback(RPC_ROTATION.map((u) => http(u))),
            });
            const wal = createWalletClient({
                account,
                chain: monadTestnet,
                transport: fallback(RPC_ROTATION.map((u) => http(u))),
            });
            setAddress(account.address);
            setPublicClient(pub);
            setWalletClient(wal);
            setBalance(0n); // stale balance belongs to the old address
        } catch (e) {
            console.warn("WalletContext init failed", e);
        }
    }, []);

    useEffect(() => {
        reloadWallet();
    }, [reloadWallet]);

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
                reloadWallet,
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
