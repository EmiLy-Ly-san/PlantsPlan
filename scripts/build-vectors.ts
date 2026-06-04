/**
 * Build a local sqlite-vec vector database of French definitions.
 *
 * Source data (downloaded into ./data, see plan):
 *   - data/french_dict.db   Kartmaan/french-dictionary (table `mots`: forme, pos, gender, definitions[JSON])
 *   - data/Lexique383.tsv   Lexique.org frequency list (used to pick the most COMMON words)
 *
 * Output:
 *   - data/dict-vec.db      terms(id, forme, pos, gloss, freq) + vec0 virtual table `vec_items`
 *
 * Run:  pnpm build:vectors   (loads PRIVATE_OPENAI_API_KEY from .env)
 */
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'data');

const SOURCE_DB = join(DATA, 'french_dict.db');
const LEXIQUE = join(DATA, 'Lexique383.tsv');
const OUT_DB = join(DATA, 'dict-vec.db');

const TARGET = Number(process.env.TARGET ?? 50_000); // how many words to embed
const DIMS = 1536; // text-embedding-3-small
const EMBED_BATCH = 256; // values per OpenAI embeddings request
const MAX_GLOSS = 600; // trim very long glosses before embedding

// --- tiny .env loader (this script runs outside SvelteKit) -----------------
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

const apiKey = process.env.PRIVATE_OPENAI_API_KEY;
if (!apiKey) throw new Error('PRIVATE_OPENAI_API_KEY missing (.env)');
const openai = createOpenAI({ apiKey });

// --- 1. frequency map: lemma -> frequency ----------------------------------
// Only keep dictionary lemmas (islem=1) so we rank base words (infinitives,
// singulars) instead of flooding the list with every conjugation of "être".
function loadFrequencies(): Map<string, number> {
	console.log('Loading lemma frequencies from Lexique383...');
	const lines = readFileSync(LEXIQUE, 'utf8').split('\n');
	const header = lines[0].split('\t');
	const iOrtho = header.indexOf('ortho');
	const iLemFilms = header.indexOf('freqlemfilms2');
	const iLemLivres = header.indexOf('freqlemlivres');
	const iIsLem = header.indexOf('islem');
	const freq = new Map<string, number>();
	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split('\t');
		if (cols.length <= iLemLivres) continue;
		if (cols[iIsLem]?.trim() !== '1') continue; // lemmas only
		const ortho = cols[iOrtho]?.trim().toLowerCase();
		if (!ortho) continue;
		const f =
			parseFloat(cols[iLemFilms]?.replace(',', '.') || '0') +
			parseFloat(cols[iLemLivres]?.replace(',', '.') || '0');
		if (!Number.isFinite(f)) continue;
		freq.set(ortho, Math.max(freq.get(ortho) ?? 0, f));
	}
	console.log(`  ${freq.size.toLocaleString()} distinct lemmas`);
	return freq;
}

// --- 2. pick the TARGET most common words that have a real definition ------
type Entry = { forme: string; pos: string | null; gloss: string; freq: number };

// Glosses that just point at another form carry no semantic content.
const POINTER_GLOSS = /^(variante|pluriel|féminin|masculin|participe|forme)\b|orthographique de/i;

function firstGloss(definitionsJson: string): string | null {
	try {
		const defs = JSON.parse(definitionsJson) as Array<{ gloss?: string }>;
		for (const d of defs) {
			const g = d?.gloss?.trim();
			if (g && g !== '.' && g.length > 2 && !POINTER_GLOSS.test(g)) return g.slice(0, MAX_GLOSS);
		}
	} catch {
		/* ignore malformed rows */
	}
	return null;
}

function selectEntries(freq: Map<string, number>): Entry[] {
	console.log('Selecting entries from french_dict.db...');
	const src = new Database(SOURCE_DB, { readonly: true });
	// Exclude inflected forms (pos like "flex-verb"/"flex-adj"); prefer the
	// richest entry (longest definitions blob) for the lemma.
	const lookup = src.prepare(
		"SELECT pos, definitions FROM mots WHERE forme = ? AND pos NOT LIKE 'flex%' ORDER BY length(definitions) DESC LIMIT 1"
	);

	const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]);
	const out: Entry[] = [];
	for (const [forme, f] of ranked) {
		if (out.length >= TARGET) break;
		const row = lookup.get(forme) as { pos: string | null; definitions: string } | undefined;
		if (!row) continue;
		const gloss = firstGloss(row.definitions);
		if (!gloss) continue;
		out.push({ forme, pos: row.pos, gloss, freq: f });
	}
	src.close();
	console.log(
		`  selected ${out.length.toLocaleString()} entries (target ${TARGET.toLocaleString()})`
	);
	return out;
}

// --- 3. embed + write vector db --------------------------------------------
async function embedAll(entries: Entry[]): Promise<Float32Array[]> {
	console.log('Embedding with text-embedding-3-small...');
	const model = openai.embedding('text-embedding-3-small');
	const vectors: Float32Array[] = [];
	for (let i = 0; i < entries.length; i += EMBED_BATCH) {
		const batch = entries.slice(i, i + EMBED_BATCH);
		const { embeddings } = await embedMany({
			model,
			values: batch.map((e) => `${e.forme} : ${e.gloss}`)
		});
		for (const v of embeddings) vectors.push(Float32Array.from(v));
		process.stdout.write(`\r  ${Math.min(i + EMBED_BATCH, entries.length)}/${entries.length}`);
	}
	process.stdout.write('\n');
	return vectors;
}

function writeDb(entries: Entry[], vectors: Float32Array[]) {
	console.log(`Writing ${OUT_DB}...`);
	const db = new Database(OUT_DB);
	sqliteVec.load(db);
	db.exec('DROP TABLE IF EXISTS terms');
	db.exec('DROP TABLE IF EXISTS vec_items');
	db.exec(
		'CREATE TABLE terms (id INTEGER PRIMARY KEY, forme TEXT, pos TEXT, gloss TEXT, freq REAL)'
	);
	db.exec(`CREATE VIRTUAL TABLE vec_items USING vec0(embedding float[${DIMS}])`);

	const insTerm = db.prepare(
		'INSERT INTO terms (id, forme, pos, gloss, freq) VALUES (?, ?, ?, ?, ?)'
	);
	const insVec = db.prepare('INSERT INTO vec_items (rowid, embedding) VALUES (?, ?)');
	const tx = db.transaction(() => {
		for (let i = 0; i < entries.length; i++) {
			const e = entries[i];
			insTerm.run(i, e.forme, e.pos, e.gloss, e.freq);
			insVec.run(BigInt(i), Buffer.from(vectors[i].buffer));
		}
	});
	tx();
	db.close();
	console.log('Done.');
}

async function main() {
	const freq = loadFrequencies();
	const entries = selectEntries(freq);
	if (entries.length === 0) throw new Error('No entries selected');

	// DRYRUN=1 validates selection quality without spending on embeddings.
	if (process.env.DRYRUN) {
		console.log('\n--- top 25 by frequency ---');
		for (const e of entries.slice(0, 25))
			console.log(`${e.forme} [${e.pos}] — ${e.gloss.slice(0, 70)}`);
		console.log('\n--- sample around #25000 ---');
		for (const e of entries.slice(25000, 25010))
			console.log(`${e.forme} [${e.pos}] — ${e.gloss.slice(0, 70)}`);
		console.log(`\nTotal selected: ${entries.length}`);
		return;
	}

	const vectors = await embedAll(entries);
	writeDb(entries, vectors);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
