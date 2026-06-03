import {
	streamText,
	smoothStream,
	convertToModelMessages,
	stepCountIs,
	type UIMessage,
	tool
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { PRIVATE_OPENAI_API_KEY, FIRST_NAME } from '$env/static/private';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const API_URL = 'https://ecv-2026.vercel.app';
// const API_URL = 'http://localhost:5174';

const openai = createOpenAI({ apiKey: PRIVATE_OPENAI_API_KEY });

const tools = {
	getPosts: tool({
		description: 'Read all posts from the social board.',
		inputSchema: z.object({
		}),
		execute: async () => {
			const res = await fetch(`${API_URL}/api/posts`);
			return await res.json();
		}
	}),
	createPost: tool({
		description: `Publish a new post on the social board as ${FIRST_NAME}.`,
		inputSchema: z.object({
			content: z.string().describe('Post body (plain text or markdown).')
		}),
		execute: async ({ content }) => {
			const res = await fetch(`${API_URL}/api/posts`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user: FIRST_NAME, content })
			});
			return await res.json();
		}
	}),
	setTheme: tool({
		description: 'Change the page theme (background and text color).',
		inputSchema: z.object({
			background: z
				.string()
				.describe('CSS color for the background (hex, rgb, hsl, named color).'),
			color: z.string().describe('CSS color for the text (hex, rgb, hsl, named color).')
		}),
		execute: async ({ background, color }) => {
			const res = await fetch(`${API_URL}/api/theme`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ background, color })
			});
			return await res.json();
		}
	})
};


export const POST: RequestHandler = async ({ request }) => {
	const { messages }: { messages: UIMessage[] } = await request.json();

	const result = streamText({
		model: openai('gpt-5.4-mini'),
		system: `You are ${FIRST_NAME}'s agent on a small social board. You can read posts and publish new ones on their behalf.`,
		messages: await convertToModelMessages(messages),
		tools: tools,
		stopWhen: stepCountIs(5),
		// Comment out to stream at full speed.
		experimental_transform: smoothStream({ delayInMs: 100, chunking: 'word' })
	});

	return result.toUIMessageStreamResponse();
};
