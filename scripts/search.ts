/**
 * Quick CLI to test semantic search against data/dict-vec.db.
 * Usage:  pnpm search "félin domestique"
 */
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = join(ROOT, 'data', 'dict-vec.db');

function loadEnv() {
	if (process.env.PRIVATE_OPENAI_API_KEY) return;
	const envPath = join(ROOT, '.env');
	if (!existsSync(envPath)) return;
	for (const line of readFileSync(envPath, 'utf8').split('\n')) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
		if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
	}
}
loadEnv();

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
	console.error('Usage: pnpm search "your query"');
	process.exit(1);
}

const openai = createOpenAI({ apiKey: process.env.PRIVATE_OPENAI_API_KEY! });

const { embedding } = await embed({
	model: openai.embedding('text-embedding-3-small'),
	value: query
});

const db = new Database(DB_PATH, { readonly: true });
sqliteVec.load(db);

const rows = db
	.prepare(
		`SELECT t.forme, t.pos, t.gloss, m.distance
		 FROM (SELECT rowid, distance FROM vec_items WHERE embedding MATCH ? ORDER BY distance LIMIT 10) m
		 JOIN terms t ON t.id = m.rowid
		 ORDER BY m.distance`
	)
	.all(Buffer.from(Float32Array.from(embedding).buffer)) as Array<{
	forme: string;
	pos: string | null;
	gloss: string;
	distance: number;
}>;

console.log(`\nQuery: "${query}"\n`);
for (const [i, r] of rows.entries()) {
	const sim = Math.round(Math.max(0, 1 - (r.distance * r.distance) / 2) * 100);
	console.log(`${String(i + 1).padStart(2)}. ${sim}%  ${r.forme} [${r.pos ?? '?'}]`);
	console.log(`        ${r.gloss.slice(0, 90)}`);
}
db.close();
