// The mascots, drawn as inline SVG so they inherit the card background and
// stay crisp at any size. WalkArt/SquatArt/JumpArt replace the old emoji
// glyphs in the "What kind of challenge?" picker; CheerArt signs off the
// results screen. Palette matches index.css: lime, pink, lavender bodies with
// black rounded limbs.

type Props = { className?: string };

const INK = "#111111";

// Shared limb/stroke defaults: chunky, rounded, no fill.
const limb = {
    fill: "none",
    stroke: INK,
    strokeWidth: 5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

export function WalkArt({ className }: Props) {
    return (
        <svg
            className={className}
            viewBox="0 0 120 120"
            role="img"
            aria-hidden="true"
        >
            <g className="ka-bob">
                {/* arms — back arm swings behind, front arm lifts. Limbs pivot
                    at the shoulder/hip, each phased against its opposite. */}
                <path
                    {...limb}
                    className="ka-arm-l"
                    d="M38 56C26 62 20 73 24 83"
                />
                <path
                    {...limb}
                    className="ka-arm-r"
                    d="M85 56C95 56 100 63 96 72"
                />
                {/* legs — mid-stride */}
                <path
                    {...limb}
                    className="ka-leg-l"
                    d="M53 80C48 90 42 98 34 103"
                />
                <path
                    {...limb}
                    className="ka-leg-r"
                    d="M68 80C70 91 74 99 82 104"
                />
                {/* body */}
                <path
                    fill="var(--art-lime, #d9e856)"
                    d="M60 22c16 0 26 10 27 26 1 12-1 22-7 28-6 6-34 6-40 0-6-6-8-16-7-28 1-16 11-26 27-26Z"
                />
                {/* curl */}
                <path
                    {...limb}
                    strokeWidth={4}
                    d="M52 26c-3-9 5-16 11-12 5 4 1 11-4 8"
                />
                {/* face */}
                <ellipse cx="54" cy="47" rx="3.4" ry="4.4" fill={INK} />
                <ellipse cx="69" cy="47" rx="3.4" ry="4.4" fill={INK} />
                <path {...limb} strokeWidth={3.6} d="M54 58q7.5 8 15 0" />
            </g>
        </svg>
    );
}

export function SquatArt({ className }: Props) {
    return (
        <svg
            className={className}
            viewBox="0 0 120 120"
            role="img"
            aria-hidden="true"
        >
            {/* the whole character sinks and springs back from the feet, so
                the squat reads without redrawing the legs */}
            <g className="ka-squat">
                {/* legs — bent into the squat */}
                <path {...limb} d="M50 76c-5 8-10 14-12 21-1 4-3 6-6 6" />
                <path {...limb} d="M70 76c5 8 10 14 12 21 1 4 3 6 6 6" />
                {/* body, with the bite out of the top-right */}
                <path
                    fill="var(--pink, #f6c8d8)"
                    d="M60 18a30 30 0 0 1 26 22c-5 2-9 5-7 10a30 30 0 1 1-19-32Z"
                />
                {/* face — one eye winks */}
                <ellipse cx="52" cy="47" rx="3.4" ry="4.4" fill={INK} />
                <path {...limb} strokeWidth={3.6} d="M66 48q4-5 8 0" />
                <path {...limb} strokeWidth={3.6} d="M50 58q7 7 14 0" />
                {/* arms — dropped low, meeting in front */}
                <path {...limb} d="M36 68c6 10 15 12 20 3 5 9 14 7 20-3" />
            </g>
        </svg>
    );
}

export function JumpArt({ className }: Props) {
    return (
        <svg
            className={className}
            viewBox="0 0 120 120"
            role="img"
            aria-hidden="true"
        >
            {/* hop cycle: crouch, launch, hang, land */}
            <g className="ka-jump">
                {/* arms up, legs tucked */}
                <path {...limb} d="M40 60C30 53 27 42 31 33" />
                <path {...limb} d="M91 60c10-7 13-18 9-27" />
                <path {...limb} className="ka-tuck" d="M54 84c-4 9-10 11-8 19" />
                <path {...limb} className="ka-tuck" d="M74 84c-4 9-10 11-8 19" />
                {/* body — teardrop, leaning into the hop */}
                <path
                    fill="var(--lavender, #c8bdf4)"
                    d="M68 14c18 20 26 32 26 46a29 29 0 1 1-58 0c0-15 15-27 32-46Z"
                />
                {/* face — squeezed-shut happy eyes + open grin */}
                <path {...limb} strokeWidth={3.6} d="M50 54q5-6 10 0" />
                <path {...limb} strokeWidth={3.6} d="M72 54q5-6 10 0" />
                <path fill={INK} d="M56 63h22q-3 13-11 13T56 63Z" />
            </g>
            {/* motion ticks — only visible on the way up */}
            <path
                className="ka-ticks"
                fill="none"
                stroke="var(--lavender, #c8bdf4)"
                strokeWidth={5}
                strokeLinecap="round"
                d="M25 33 22 25M36 26l1-8"
            />
        </svg>
    );
}

// Results-screen sign-off: the lime character giving a thumbs up. Its raised
// arm is part of the silhouette (same lime, overlapping strokes), so the fist
// and body read as one shape.
export function CheerArt({ className }: Props) {
    return (
        <svg
            className={className}
            viewBox="0 0 120 120"
            role="img"
            aria-hidden="true"
        >
            <g className="ka-cheer-arm">
                {/* forearm, fist and thumb */}
                <path
                    fill="none"
                    stroke="var(--lime, #d9e856)"
                    strokeWidth={15}
                    strokeLinecap="round"
                    d="M48 66 36 44"
                />
                <rect
                    x="22"
                    y="30"
                    width="24"
                    height="24"
                    rx="9"
                    fill="var(--lime, #d9e856)"
                />
                <path
                    fill="none"
                    stroke="var(--lime, #d9e856)"
                    strokeWidth={13}
                    strokeLinecap="round"
                    d="M40 36 42 22"
                />
                {/* curled fingers */}
                <g
                    fill="none"
                    stroke={INK}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                >
                    <path d="M26 38h11" />
                    <path d="M26 44h11" />
                    <path d="M27 50h9" />
                    <path d="M37 34c4 2 4 20 0 22" />
                </g>
            </g>
            {/* body — a rounded triangle, with the hip and hand bumps */}
            <path
                fill="var(--lime, #d9e856)"
                d="M72 16c5 0 9 4 12 11 7 16 15 33 18 44 3 10-3 19-13 19H42c-10 0-16-8-12-17 6-13 22-42 30-53 3-3 7-4 12-4Z"
            />
            <circle cx="99" cy="72" r="11" fill="var(--lime, #d9e856)" />
            <circle cx="97" cy="86" r="6" fill="var(--lime, #d9e856)" />
            {/* face — closed happy eyes, big grin */}
            <g
                fill="none"
                stroke={INK}
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M59 56q6-8 12 0" />
                <path d="M81 56q6-8 12 0" />
                <path d="M59 64c4 14 24 14 30-2" />
            </g>
            {/* resting arm down the right flank */}
            <path
                fill="none"
                stroke={INK}
                strokeWidth={3}
                strokeLinecap="round"
                d="M96 60c4 8 4 18 2 24"
            />
            {/* legs */}
            <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
                <path d="M54 90 46 113c-1 3-4 5-8 5" />
                <path d="M78 90 85 113c1 3 4 5 8 5" />
            </g>
        </svg>
    );
}
