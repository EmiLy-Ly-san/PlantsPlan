import { command, form, getRequestEvent, query } from '$app/server';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import systemPrompt from './prompt.md?raw';

// Prompt : qui : quel esl role incarne le bot; qioi: que doit'il faire idéaliement; comment ; ne pas faire

type Message = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	tool_call_id?: string;
};

type Plant = {
	id: string;
	name: string;
	room?: string;
	light?: string;
	potHasDrainage?: boolean;
	createdAt: string;
};

const SYSTEM_PROMPT: Message = {
	role: 'system',
	content: systemPrompt
};

const COOKIE_NAME = 'messages';
const PLANTS_COOKIE_NAME = 'plants';

const tools = [
	{
		type: 'function',
		function: {
			name: 'saveUserPlant',
			description: "Sauvegarde une plante de l'utilisateur dans sa collection de plantes.",
			parameters: {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description: 'Nom de la plante, par exemple monstera, pothos, calathea.'
					},
					room: {
						type: 'string',
						description: 'Pièce où se trouve la plante, par exemple salon, chambre, cuisine.'
					},
				},
				required: ['name'],
				additionalProperties: false
			}
		}
	}
];

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

function readPlants(): Plant[] {
	const { cookies } = getRequestEvent();
	const raw = cookies.get(PLANTS_COOKIE_NAME);
	return raw ? (JSON.parse(raw) as Plant[]) : [];
}

function writePlants(plants: Plant[]) {
	const { cookies } = getRequestEvent();
	cookies.set(PLANTS_COOKIE_NAME, JSON.stringify(plants), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30
	});
}

function saveUserPlant({
	name,
	room,
}: {
	name: string;
	room?: string;
}) {
	const plants = readPlants();

	const newPlant: Plant = {
		id: crypto.randomUUID(),
		name,
		room,
		createdAt: new Date().toISOString()
	};

	plants.push(newPlant);
	writePlants(plants);

	return {
		success: true,
		plant: newPlant,
		message: `${name} a bien été ajoutée aux plantes de l'utilisateur.`
	};
}

export const getChat = query(async () => {
	return readMessages();
});

export const sendMessage = form(
	'unchecked',
	async ({ message }: { message: string }) => {
		const messages = readMessages();
		messages.push({ role: 'user', content: message });

		const openAiMessages = [SYSTEM_PROMPT, ...messages];

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${PRIVATE_OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-5.4-mini',
				messages: openAiMessages,
				tools,
				temperature: 0
			})
		});

		const result = await response.json();

		if (!response.ok || !result.choices?.length) {
			throw new Error(result.error?.message ?? 'Unknown API error');
		}

		const assistantMessage = result.choices[0].message;

		if (assistantMessage.tool_calls?.length) {
			openAiMessages.push(assistantMessage);

			for (const toolCall of assistantMessage.tool_calls) {
				if (toolCall.function.name === 'saveUserPlant') {
					const args = JSON.parse(toolCall.function.arguments);

					const toolResult = saveUserPlant({
						name: args.name,
						room: args.room,
					});

					openAiMessages.push({
						role: 'tool',
						tool_call_id: toolCall.id,
						content: JSON.stringify(toolResult)
					});
				}
			}

			const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${PRIVATE_OPENAI_API_KEY}`
				},
				body: JSON.stringify({
					model: 'gpt-5.4-mini',
					messages: openAiMessages,
					temperature: 0
				})
			});

			const finalResult = await finalResponse.json();

			if (!finalResponse.ok || !finalResult.choices?.length) {
				throw new Error(finalResult.error?.message ?? 'Unknown API error');
			}

			messages.push({
				role: 'assistant',
				content: finalResult.choices[0].message.content
			});
		} else {
			messages.push({
				role: 'assistant',
				content: assistantMessage.content
			});
		}

		writeMessages(messages);

		await getChat().refresh();
	}
);

export const clearChat = command(async () => {
	writeMessages([]);
	await getChat().refresh();
});
