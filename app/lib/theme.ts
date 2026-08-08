// Forfit design tokens — from the reference mockup.
// Cream canvas, black ink, lime/lavender/pink "sticker" blobs, black pill CTAs.
export const theme = {
    colors: {
        cream: "#F7F2E5", // app background
        ink: "#111111", // primary text + black pills
        lime: "#D9E856", // hero blobs, winner highlight, progress
        lavender: "#C8BDF4", // stake card, "you" row
        pink: "#F6C8D8", // accents, 2nd place
        ochre: "#E8B84B", // crown / 3rd accents
        white: "#FFFFFF", // cards
        muted: "#8A8577", // secondary text on cream
        green: "#7A8F4C", // bar chart alt
        danger: "#D9534F",
    },
    radius: {
        card: 24,
        pill: 999,
        blob: 32,
    },
    font: {
        // loaded in app/_layout.tsx
        black: "SF-Pro-Rounded-Black",
        heavy: "SF-Pro-Rounded-Heavy",
        bold: "SF-Pro-Rounded-Bold",
        semibold: "SF-Pro-Rounded-Semibold",
        medium: "SF-Pro-Rounded-Medium",
        regular: "SF-Pro-Rounded-Regular",
    },
    spacing: (n: number) => n * 4,
} as const;
