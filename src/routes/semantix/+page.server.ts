import { fail } from '@sveltejs/kit';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { join } from 'node:path';
import type { Actions, PageServerLoad } from './$types';

const DB_PATH = join(process.cwd(), 'data', 'dict-vec.db');
const TOP_K = 15;

const openai = createOpenAI({ apiKey: PRIVATE_OPENAI_API_KEY });

type DB = import('better-sqlite3').Database;
let db: DB | undefined;

function getDb(): DB {
	if (!db) {
		db = new Database(DB_PATH, { readonly: true });
		sqliteVec.load(db);
	}
	return db;
}

type Result = { forme: string; pos: string | null; gloss: string; similarity: number };

export const load: PageServerLoad = () => {
	const { count } = getDb().prepare('SELECT count(*) AS count FROM terms').get() as {
		count: number;
	};
	return { count };
};

export const actions: Actions = {
	search: async ({ request }) => {
		const data = await request.formData();
		const query = String(data.get('query') ?? '').trim();
		if (!query) return fail(400, { error: 'Entrez un mot ou une définition.' });

		const { embedding } = await embed({
			model: openai.embedding('text-embedding-3-small'),
			value: query
		});
		const queryVec = Buffer.from(Float32Array.from(embedding).buffer);

		const rows = getDb()
			.prepare(
				`SELECT t.forme, t.pos, t.gloss, m.distance
				 FROM (
				   SELECT rowid, distance FROM vec_items
				   WHERE embedding MATCH ? ORDER BY distance LIMIT ?
				 ) m
				 JOIN terms t ON t.id = m.rowid
				 ORDER BY m.distance`
			)
			.all(queryVec, TOP_K) as Array<{
			forme: string;
			pos: string | null;
			gloss: string;
			distance: number;
		}>;

		// OpenAI embeddings are unit-normalized, so cosine = 1 - L2^2 / 2.
		const results: Result[] = rows.map((r) => ({
			forme: r.forme,
			pos: r.pos,
			gloss: r.gloss,
			similarity: Math.max(0, 1 - (r.distance * r.distance) / 2)
		}));

		return { query, results };
	}
};
