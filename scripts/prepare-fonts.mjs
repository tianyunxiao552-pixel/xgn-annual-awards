import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const faces = [];
const licenses = path.join(root, "public/fonts/licenses");
await mkdir(licenses, { recursive: true });
for (const [family, weights] of [
  ["noto-serif-sc", [400, 600, 900]],
  ["noto-sans-sc", [400, 600]],
  ["bodoni-moda", [400, 600, 900]],
]) {
  await copyFile(
    path.join(root, "node_modules/@fontsource", family, "LICENSE"),
    path.join(licenses, `${family}.txt`),
  );
  for (const weight of weights) {
    const css = await readFile(
      path.join(
        root,
        "node_modules/@fontsource",
        family,
        `${family === "bodoni-moda" ? "latin-" : ""}${weight}.css`,
      ),
      "utf8",
    );
    for (const match of css.matchAll(/@font-face\s*\{[^}]+\}/g)) {
      let face = match[0].replace(/src:[^;]+;/, (src) => {
        const woff2 = src
          .match(/url\(([^)]+\.woff2)\)/)[1]
          .replace(/^\.\//, "");
        return `src: url('../node_modules/@fontsource/${family}/${woff2}') format('woff2');`;
      });
      if (family === "bodoni-moda") {
        face = face.replace(
          /font-family:[^;]+;/,
          "font-family: 'XGN Numerals';",
        );
        face = face.replace(
          /\}$/,
          "  unicode-range: U+0030-0039, U+0025, U+002B-002F, U+003A;\n}",
        );
      }
      faces.push(face);
    }
  }
}
await writeFile(
  path.join(root, "src/font-faces.css"),
  "/* Generated from Fontsource. WOFF2 only; Unicode shards load as needed. */\n" +
    faces.join("\n"),
);
console.log(`Prepared ${faces.length} self-hosted font faces.`);
