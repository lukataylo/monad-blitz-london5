import { PrivyUser } from "@privy-io/expo";

export function getAddressForUser(user: PrivyUser | null) {
  const { linked_accounts } = user as any;
  const accounts = linked_accounts.filter(
    (account: any) => account.type === "wallet"
  );
  const address = accounts[0].address;
  return address;
}



export const USDC_ADDRESS = "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea";
export const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];