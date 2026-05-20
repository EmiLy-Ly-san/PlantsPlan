import { command, form, getRequestEvent, query } from '$app/server';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';

type Message = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

const SYSTEM_PROMPT: Message = {
	role: 'system',
	content: 'You are a helpful assistant that can answer questions and help with tasks.'
};

const COOKIE_NAME = 'messages';

function readMessages(): Message[] {
	const { cookies } = getRequestEvent();
	const raw = cookies.get(COOKIE_NAME);
	return raw ? (JSON.parse(raw) as Message[]) : [];
}

function writeMessages(messages: Message[]) {
	const { cookies } = getRequestEvent();
	cookies.set(COOKIE_NAME, JSON.stringify(messages), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7
	});
}

export const getChat = query(async () => {
	return readMessages();
});

export const sendMessage = form(
	'unchecked',
	async ({ message }: { message: string }) => {
		const messages = readMessages();
		messages.push({ role: 'user', content: message });

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${PRIVATE_OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-5.4-mini',
				messages: [SYSTEM_PROMPT, ...messages],
				temperature: 0
			})
		});

		const result = await response.json();

		if (!response.ok || !result.choices?.length) {
			throw new Error(result.error?.message ?? 'Unknown API error');
		}

		messages.push({ role: 'assistant', content: result.choices[0].message.content });
		writeMessages(messages);

		await getChat().refresh();
	}
);

export const clearChat = command(async () => {
	writeMessages([]);
	await getChat().refresh();
});
