import { rm, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

await rm(".verify", { recursive: true, force: true });
await mkdir(".verify", { recursive: true });

execSync(
  "node_modules\\.bin\\tsc.cmd src/lib/letterboxd.ts src/lib/stats.ts src/lib/utils.ts src/lib/explorer.ts src/lib/savedViews.ts src/lib/viewState.ts src/lib/watchActivity.ts src/lib/dataQuality.ts src/lib/reportSections.ts --module ES2022 --moduleResolution Bundler --target ES2022 --outDir .verify --esModuleInterop --skipLibCheck",
  { stdio: "inherit" },
);

for (const file of await readdir(".verify")) {
  if (!file.endsWith(".js")) {
    continue;
  }
  const fullPath = path.join(".verify", file);
  const source = await readFile(fullPath, "utf8");
  const patched = source
    .replace(/"\.\/utils"/g, "\"./utils.js\"")
    .replace(/"\.\/letterboxd"/g, "\"./letterboxd.js\"")
    .replace(/"\.\/stats"/g, "\"./stats.js\"")
    .replace(/"\.\/explorer"/g, "\"./explorer.js\"")
    .replace(/"\.\/savedViews"/g, "\"./savedViews.js\"")
    .replace(/"\.\/viewState"/g, "\"./viewState.js\"")
    .replace(/"\.\/watchActivity"/g, "\"./watchActivity.js\"")
    .replace(/"\.\/dataQuality"/g, "\"./dataQuality.js\"")
    .replace(/"\.\/reportSections"/g, "\"./reportSections.js\"");
  await writeFile(fullPath, patched);
}
