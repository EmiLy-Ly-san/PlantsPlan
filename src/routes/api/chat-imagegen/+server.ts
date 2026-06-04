import { streamText, convertToModelMessages, type InferUITools, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const openai = createOpenAI({ apiKey: PRIVATE_OPENAI_API_KEY });

const tools = { 
	image_generation: openai.tools.imageGeneration()
 };
export type ChatTools = InferUITools<typeof tools>;

export const POST: RequestHandler = async ({ request }) => {
	const { messages }: { messages: UIMessage[] } = await request.json();

	const result = streamText({
		model: openai('gpt-5.4-mini'),
		messages: await convertToModelMessages(messages),
		tools
	});

	return result.toUIMessageStreamResponse();
};
