import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const openai = createOpenAI({ apiKey: PRIVATE_OPENAI_API_KEY });

export const POST: RequestHandler = async ({ request }) => {
	const { messages }: { messages: UIMessage[] } = await request.json();

	const result = streamText({
		model: openai('gpt-5.4-mini'),
		messages: await convertToModelMessages(messages)
	});

	return result.toUIMessageStreamResponse();
};
