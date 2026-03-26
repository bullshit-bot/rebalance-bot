/**
 * Knowledge ingestion script for ChromaDB.
 * Reads all markdown files from openclaw-skills/knowledge/, splits into chunks,
 * and outputs a JSON array suitable for ChromaDB collection ingestion.
 *
 * Usage: bun run scripts/ingest-knowledge.ts [--output path/to/output.json]
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, relative, extname, basename } from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const KNOWLEDGE_DIR = join(import.meta.dir, "../openclaw-skills/knowledge");
const DEFAULT_OUTPUT = join(import.meta.dir, "../openclaw-skills/knowledge-chunks.json");
const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 50; // characters overlap between chunks

// ── Types ─────────────────────────────────────────────────────────────────────

interface KnowledgeChunk {
  id: string;
  document: string;
  metadata: {
    source: string;
    category: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

// ── File discovery ────────────────────────────────────────────────────────────

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(fullPath);
      files.push(...nested);
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      files.push(fullPath);
    }
  }

  return files;
}

// ── Chunking ──────────────────────────────────────────────────────────────────

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start = end - CHUNK_OVERLAP;
  }

  // Filter out empty or whitespace-only chunks
  return chunks.filter((c) => c.length > 10);
}

// ── Category derivation ───────────────────────────────────────────────────────

function deriveCategory(filePath: string): string {
  const rel = relative(KNOWLEDGE_DIR, filePath);
  const parts = rel.split("/");
  // Use the subdirectory name as category, fallback to "general"
  return parts.length > 1 ? parts[0] : "general";
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf("--output");
  const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : DEFAULT_OUTPUT;

  console.log(`Reading knowledge files from: ${KNOWLEDGE_DIR}`);

  let files: string[];
  try {
    files = await collectMarkdownFiles(KNOWLEDGE_DIR);
  } catch (err) {
    console.error(`Failed to read knowledge directory: ${err}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.warn("No markdown files found in knowledge directory.");
    process.exit(0);
  }

  console.log(`Found ${files.length} markdown file(s)`);

  const allChunks: KnowledgeChunk[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const category = deriveCategory(filePath);
    const source = relative(KNOWLEDGE_DIR, filePath);
    const fileSlug = basename(filePath, ".md");
    const chunks = splitIntoChunks(content);

    for (let i = 0; i < chunks.length; i++) {
      allChunks.push({
        id: `${fileSlug}-chunk-${i}`,
        document: chunks[i],
        metadata: {
          source,
          category,
          chunkIndex: i,
          totalChunks: chunks.length,
        },
      });
    }

    console.log(`  ${source}: ${chunks.length} chunk(s)`);
  }

  const output = JSON.stringify(allChunks, null, 2);
  await writeFile(outputPath, output, "utf-8");

  console.log(`\nIngestion complete: ${allChunks.length} chunks written to ${outputPath}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
