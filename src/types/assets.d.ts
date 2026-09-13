// Ambient type declarations for non-TS imports used by the app.
// The "*.css" declaration silences the editor-only ts(2882) hint for
// side-effect CSS imports (e.g. `import "./globals.css"` in layout.tsx).
// The compiler itself already ignores it (tsc exits 0), so this is cosmetic.
declare module "*.css";
