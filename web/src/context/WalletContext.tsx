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
//
// The "walkthewalk." storage prefix predates the rename to Forfit and is kept
// deliberately: this key holds a real private key, so renaming it would strand
// the funds of anyone who already has a wallet in localStorage. Same for the
// other "walkthewalk.*" keys across the app.
export const WALLET_KEY = "walkthewalk.pk";

const BALANCE_POLL_MS = 10_000;

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
                transport: fallback([
                    http("https://testnet-rpc.monad.xyz"),
                    http("https://monad-testnet.drpc.org"),
                    http("https://10143.rpc.thirdweb.com"),
                ]),
            });
            const wal = createWalletClient({
                account,
                chain: monadTestnet,
                transport: fallback([
                    http("https://testnet-rpc.monad.xyz"),
                    http("https://monad-testnet.drpc.org"),
                    http("https://10143.rpc.thirdweb.com"),
                ]),
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
