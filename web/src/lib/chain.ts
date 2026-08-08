import { isAddress } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";

// Validate the env var instead of trusting it: a typo'd/quoted/whitespace
// address would otherwise flip the app into "live" mode where every read
// throws — a silent dead app. Anything invalid falls back to demo mode.
const raw = (
    (import.meta.env.VITE_WALKPOOL_ADDRESS as string | undefined) ?? ""
).trim();

export const WALKPOOL_ADDRESS = (
    isAddress(raw) ? raw : ZERO
) as `0x${string}`;

export const isContractConfigured = WALKPOOL_ADDRESS !== ZERO;

if (raw !== "" && !isAddress(raw)) {
    console.warn(
        `VITE_WALKPOOL_ADDRESS is set but not a valid address ("${raw}") — falling back to demo mode`
    );
}
