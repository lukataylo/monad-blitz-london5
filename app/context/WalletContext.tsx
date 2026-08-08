import { ERC20_ABI, USDC_ADDRESS } from "@/utils";
import { useEmbeddedEthereumWallet } from "@privy-io/expo";
import { createContext, useContext, useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, publicActions, PublicClient, WalletClient } from "viem";
import { monadTestnet } from "viem/chains";

interface WalletContextType {
  address: string | null;
  getUSDCBalance: () => Promise<bigint | undefined>;
  getMONBalance: () => Promise<bigint | undefined>;
  sendUSDC: (to: `0x${string}`, amount: bigint) => Promise<any>;
  signMessage: (message: string) => Promise<string | undefined>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { wallets } = useEmbeddedEthereumWallet();
  const wallet = wallets[0];
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);

  useEffect(() => {
    async function init() {
      if (wallet) {
        const provider = await wallet.getProvider();
        const publicClient = createPublicClient({
          chain: monadTestnet,
          transport: custom(provider),
        });
        const walletClient = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: monadTestnet,
          transport: custom(provider),
        }).extend(publicActions);
        setWalletClient(walletClient);
        setPublicClient(publicClient);
      }
    }
    init();
    return () => {
      setWalletClient(null);
      setPublicClient(null);
    };
  }, [wallet]);

  async function getMONBalance() {
    if (publicClient && wallet) {
      const balance = publicClient.getBalance({
        address: wallet.address as `0x${string}`,
      });
      return balance;
    }
  }

  async function getUSDCBalance() {
    if (publicClient && wallet) {
      const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet.address as `0x${string}`],
      });
      return balance as bigint;
    }
  }

  async function sendUSDC(to: `0x${string}`, amount: bigint) {
    if (walletClient && wallet) {
      const provider = await wallet.getProvider();
      const tx = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet.address as `0x${string}`,
            to: USDC_ADDRESS,
            value: 0n,
            functionName: "transfer",
            data:
              "0xa9059cbb" +
              to.slice(2).padStart(64, "0") +
              amount.toString(16).padStart(64, "0"),
            chain: monadTestnet,
          },
        ],
      });
      return tx;
    }
  }

  async function signMessage(message: string) {
    if (walletClient && wallet) {
      const signature = await walletClient.signMessage({
        account: wallet.address as `0x${string}`,
        message,
      });
      return signature;
    }
  }

  return (
    <WalletContext.Provider
      value={{
        address: wallet?.address ?? null,
        getUSDCBalance,
        sendUSDC,
        signMessage,
        getMONBalance,
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
