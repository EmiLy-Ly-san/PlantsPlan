import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// better-sqlite3 is a native module and sqlite-vec resolves its binary at
	// runtime via import.meta.resolve; keep both out of Vite's SSR bundling.
	ssr: { external: ['better-sqlite3', 'sqlite-vec'] },
	optimizeDeps: { exclude: ['better-sqlite3', 'sqlite-vec'] }
});
