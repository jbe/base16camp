#!/usr/bin/env bun
/**
 * Sync base16 schemes from tinted-theming/schemes repo
 * Run with: bun sync-schemes.ts
 */

import { parse as parseYaml } from "yaml";

const SCHEMES_REPO = "https://api.github.com/repos/tinted-theming/schemes/contents/base16";
const OUTPUT_FILE = "schemes.json";

interface Scheme {
  name: string;
  author: string;
  variant: "light" | "dark";
  colors: Record<string, string>;
}

async function fetchSchemeList(): Promise<{ name: string; download_url: string }[]> {
  console.log("Fetching scheme list...");
  const response = await fetch(SCHEMES_REPO);
  if (!response.ok) throw new Error(`Failed to fetch scheme list: ${response.status}`);
  return response.json();
}

async function fetchScheme(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch scheme: ${response.status}`);
  return response.text();
}

function parseScheme(yaml: string, filename: string): Scheme {
  const data = parseYaml(yaml);
  
  // Build colors object (base00 - base0f, lowercase)
  const colors: Record<string, string> = {};
  for (let i = 0; i < 16; i++) {
    // Keys in YAML are like base00, base01, ..., base09, base0A, base0B, ..., base0F
    const yamlKey = `base0${i.toString(16).toUpperCase()}`;
    const outputKey = `base0${i.toString(16).toLowerCase()}`;
    
    const value = data.palette?.[yamlKey];
    if (value) {
      // Values already include # prefix in the YAML
      colors[outputKey] = value.startsWith("#") ? value : `#${value}`;
    }
  }
  
  // Validate we have all 16 colors
  if (Object.keys(colors).length !== 16) {
    const missing = 16 - Object.keys(colors).length;
    throw new Error(`missing ${missing} colors`);
  }
  
  return {
    name: data.name || filename,
    author: data.author || "Unknown",
    variant: data.variant || "dark",
    colors,
  };
}

async function main() {
  const files = await fetchSchemeList();
  const yamlFiles = files.filter(f => f.name.endsWith(".yaml"));
  
  console.log(`Found ${yamlFiles.length} scheme files`);
  
  const schemes: Record<string, Scheme> = {};
  const errors: { file: string; error: string }[] = [];
  let processed = 0;
  
  // Process in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < yamlFiles.length; i += batchSize) {
    const batch = yamlFiles.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (file) => {
      const slug = file.name.replace(".yaml", "");
      try {
        const yaml = await fetchScheme(file.download_url);
        schemes[slug] = parseScheme(yaml, slug);
      } catch (e) {
        errors.push({ file: slug, error: String(e) });
      }
      
      processed++;
      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${yamlFiles.length}`);
      }
    }));
    
    // Small delay between batches
    if (i + batchSize < yamlFiles.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  // Report errors and fail if any
  if (errors.length > 0) {
    console.error(`\nFailed to process ${errors.length} schemes:`);
    for (const { file, error } of errors) {
      console.error(`  ${file}: ${error}`);
    }
    process.exit(1);
  }
  
  // Sort by key
  const sorted = Object.fromEntries(
    Object.entries(schemes).sort(([a], [b]) => a.localeCompare(b))
  );
  
  // Write output
  await Bun.write(OUTPUT_FILE, JSON.stringify(sorted, null, 2));
  console.log(`\nWrote ${Object.keys(sorted).length} schemes to ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
