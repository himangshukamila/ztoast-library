import { defineConfig } from "tsup";

// dual esm + cjs build with typescript declarations
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: "es2020",
  // note: do not enable `treeshake` here. it pipes the bundle through rollup,
  // which strips module level directives and silently drops the "use client"
  // banner below. esbuild already tree-shakes, and "sideEffects": false lets
  // the consumer's bundler drop whatever it does not import.
  // react/react-dom are peer dependencies and must never be inlined into the
  // bundle: a second copy of react in a consumer app breaks hooks and context
  external: ["react", "react-dom", "react/jsx-runtime"],
  // the library is built on hooks and portals, so every entry point is a client
  // component. without this banner, importing <Toaster /> from a next.js
  // app-router server component fails at build time.
  banner: { js: '"use client";' },
});
