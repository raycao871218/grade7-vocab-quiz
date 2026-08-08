import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

type VocabItem = {
  id: number;
  english: string;
  chinese: string;
  bonus: boolean;
};

function parseRows(markdown: string, heading: string, nextHeading?: string, bonus = false): VocabItem[] {
  const start = markdown.indexOf(heading);
  if (start < 0) return [];
  const end = nextHeading ? markdown.indexOf(nextHeading, start + heading.length) : -1;
  const block = markdown.slice(start, end > start ? end : undefined);
  const rows: VocabItem[] = [];

  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (!match) continue;
    rows.push({
      id: Number(match[1]),
      english: match[2].trim(),
      chinese: match[3].trim(),
      bonus
    });
  }

  return rows;
}

function parseMarkdownVocab(markdown: string): VocabItem[] {
  const core = parseRows(markdown, "## 完整表", "## 加测", false);
  const bonus = parseRows(markdown, "## 加测", undefined, true);
  return [...core, ...bonus];
}

async function loadVocabulary(sourcePath: string): Promise<VocabItem[]> {
  const absolutePath = path.resolve(sourcePath);
  const raw = await fs.readFile(absolutePath, "utf-8");

  if (absolutePath.endsWith(".json")) {
    const parsed = JSON.parse(raw) as Array<{ id?: number; english: string; chinese: string; bonus?: boolean }>;
    return parsed.map((item, index) => ({
      id: item.id ?? index + 1,
      english: item.english,
      chinese: item.chinese,
      bonus: Boolean(item.bonus)
    }));
  }

  return parseMarkdownVocab(raw);
}

function vocabApiPlugin(sourcePath: string): Plugin {
  const handler = async (_req: unknown, res: { statusCode: number; setHeader: (key: string, value: string) => void; end: (body: string) => void }) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    if (!sourcePath) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "缺少环境变量 VOCAB_SOURCE_PATH" }));
      return;
    }

    try {
      const words = await loadVocabulary(sourcePath);
      res.end(JSON.stringify({ sourcePath, words }));
    } catch (error) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "读取词表失败",
          sourcePath
        })
      );
    }
  };

  return {
    name: "local-vocab-api",
    configureServer(server) {
      server.middlewares.use("/api/vocab", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/vocab", handler);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), vocabApiPlugin(env.VOCAB_SOURCE_PATH ?? "")],
    server: {
      port: 5173
    },
    preview: {
      port: 4173
    }
  };
});
