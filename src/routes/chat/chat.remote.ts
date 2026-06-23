import { command, getRequestEvent } from '$app/server';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import systemPrompt from './prompt.md?raw';

// Message envoyé à OpenAI
type Message = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	tool_call_id?: string;
};

// Message stocké dans le localStorage
type ChatMessage = {
	role: 'user' | 'assistant';
	content: string;
};

// Plante sauvegardée dans la collection du user
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

const PLANTS_COOKIE_NAME = 'plants';
const MAX_MESSAGE_LENGTH = 1000;

// Tool disponible pour l'IA
// Pour l'instant, on garde seulement la sauvegarde d'une plante
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
					}
				},
				required: ['name'],
				additionalProperties: false
			}
		}
	}
];

// Lit la collection de plantes depuis les cookies
function readPlants(): Plant[] {
	const { cookies } = getRequestEvent();
	const raw = cookies.get(PLANTS_COOKIE_NAME);

	return raw ? (JSON.parse(raw) as Plant[]) : [];
}

// Sauvegarde la collection de plantes dans les cookies
function writePlants(plants: Plant[]) {
	const { cookies } = getRequestEvent();

	cookies.set(PLANTS_COOKIE_NAME, JSON.stringify(plants), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30
	});
}

// Fonction appelée par le tool saveUserPlant
function saveUserPlant({ name, room }: { name: string; room?: string }) {
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

// Appel serveur utilisé par le front
// Les messages du chat ne sont plus lus depuis les cookie
// Lefront envoie le message actuel + un  historic depuis le localStorag
export const sendMessage = command(
	'unchecked',
	async ({
		message,
		history
	}: {
		message: string;
		history: ChatMessage[];
	}) => {
		const cleanMessage = message.trim();

		// On ignore les messages vides
		if (!cleanMessage) {
			return {
				assistantMessage: ''
			};
		}

		// On bloque les messages trop longs
		if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
			throw new Error('Message too long');
		}

		// On garde seulement les derniers messages utiles envoyés par le localStorage
		const contextMessages: Message[] = history
			.filter((message) => message.role === 'user' || message.role === 'assistant')
			.slice(-8)
			.map((message) => ({
				role: message.role,
				content: message.content
			}));

		const openAiMessages: Message[] = [
			SYSTEM_PROMPT,
			...contextMessages,
			{ role: 'user', content: cleanMessage }
		];

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

		// Si l'IA demande à utiliser un tool
		if (assistantMessage.tool_calls?.length) {
			openAiMessages.push(assistantMessage);

			for (const toolCall of assistantMessage.tool_calls) {
				if (toolCall.function.name === 'saveUserPlant') {
					const args = JSON.parse(toolCall.function.arguments);

					const toolResult = saveUserPlant({
						name: args.name,
						room: args.room
					});

					// On renvoie le résultat du tool à l'IA
					openAiMessages.push({
						role: 'tool',
						tool_call_id: toolCall.id,
						content: JSON.stringify(toolResult)
					});
				}
			}

			// Deuxième appel à l'IA pour formuler une réponse après le tool
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

			return {
				assistantMessage: finalResult.choices[0].message.content
			};
		}

		return {
			assistantMessage: assistantMessage.content
		};
	}
);
