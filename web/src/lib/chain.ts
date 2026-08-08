export const WALKPOOL_ADDRESS = ((import.meta.env
    .VITE_WALKPOOL_ADDRESS as string | undefined) ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const isContractConfigured =
    WALKPOOL_ADDRESS !== "0x0000000000000000000000000000000000000000";
