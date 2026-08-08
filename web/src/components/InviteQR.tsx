import QRCode from "qrcode";
import { useEffect, useRef } from "react";

/**
 * Invite QR — renders the invite link into a canvas so a second phone can
 * join by scanning instead of typing. Deliberately black-on-white inside a
 * white card in every theme: QR contrast beats theming for scannability.
 * qrcode draws locally into the canvas — no network involved at runtime.
 */
export function InviteQR({
    link,
    size = 200,
    label,
}: {
    link: string;
    size?: number;
    label?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        QRCode.toCanvas(canvas, link, {
            width: size,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#111111", light: "#ffffff" },
        }).catch(() => {
            /* canvas render failed — the copyable link below still works */
        });
    }, [link, size]);

    // Caption defaults to the challenge id parsed from the ?c= param.
    const caption =
        label ??
        (() => {
            try {
                const id = new URL(link).searchParams.get("c");
                return id != null && id !== ""
                    ? `Scan to join · #${id}`
                    : "Scan to join";
            } catch {
                return "Scan to join";
            }
        })();

    return (
        <div className="invite-qr">
            <canvas ref={canvasRef} width={size} height={size} />
            <div className="invite-qr-caption">{caption}</div>
        </div>
    );
}
