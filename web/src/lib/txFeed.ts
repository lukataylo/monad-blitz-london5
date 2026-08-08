/**
 * Tiny dependency-free pub/sub for "transaction landed" events.
 * Writers (ChallengeContext) emit after a SUCCESSFUL receipt; the
 * TxToasts overlay subscribes and flashes a "Live on Monad" toast so
 * judges can see the chain working in real time.
 */

export interface TxEvent {
    hash: `0x${string}`;
    /** e.g. "Score synced", "Challenge created" */
    label: string;
    /** milliseconds from send to receipt (omit if unknown) */
    ms?: number;
}

type Listener = (e: TxEvent) => void;

const listeners = new Set<Listener>();

export function emitTx(e: TxEvent): void {
    for (const fn of listeners) {
        try {
            fn(e);
        } catch (err) {
            // A broken subscriber must never take down a tx flow.
            console.warn("txFeed listener failed", err);
        }
    }
}

export function subscribeTx(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}
