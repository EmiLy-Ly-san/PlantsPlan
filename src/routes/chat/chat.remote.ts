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

//  si le message évoque un risque suicidaire ou d’automutilation
const SELF_HARM_RESPONSE =
	"Je suis vraiment désolé que tu ressentes ça. Si tu es en danger immédiat ou si tu penses pouvoir te faire du mal, appelle les urgences ou une personne de confiance près de toi tout de suite. En France, tu peux aussi appeler le 3114, disponible 24h/24 et 7j/7. Tu n’as pas à gérer ça seul·e.";

//  si le message contient du contenu sexuel
const SEXUAL_RESPONSE =
	"Je ne peux pas répondre à ce type de demande. Je peux par contre t’aider avec une plante, un diagnostic ou des conseils d’entretien.";

//  si l’utilisateur insulte le bot
const INSULT_RESPONSE =
	"Je peux t’aider, mais je vais rester sur un échange respectueux. Si tu veux, décris-moi le souci avec ta plante et je t’aide à trouver une solution.";

// Tool disponible pour l'IA
//  seulement la sauvegarde d'une plante
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

// Sauvegarde la collectiones dans les cookies
function writePlants(plants: Plant[]) {
	const { cookies } = getRequestEvent();

	cookies.set(PLANTS_COOKIE_NAME, JSON.stringify(plants), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30
	});
}

// Détection  de messages sensibles

function detectSensitiveMessage(message: string) {
	const lower = message.toLowerCase();

	const selfHarmWords = [
		'je veux mourir',
		'me suicider',
		'suicide',
		'envie de mourir',
		'me faire du mal'
	];

	const sexualWords = [
		'sexe',
		'porno',
		'nude',
		'nudes',
		'sexuel',
		'sexuelle'
	];

	const insultWords = [
		'connard',
		'connasse',
		'pute',
		'abruti',
		'débile',
		'ferme ta gueule',
		'ta gueule'
	];

	if (selfHarmWords.some((word) => lower.includes(word))) {
		return SELF_HARM_RESPONSE;
	}

	if (sexualWords.some((word) => lower.includes(word))) {
		return SEXUAL_RESPONSE;
	}

	if (insultWords.some((word) => lower.includes(word))) {
		return INSULT_RESPONSE;
	}

	return null;
}

// Nettoie les textes avant de les sauvegarder dans les cookies
function sanitizeText(value?: string) {
	if (!value) return undefined;

	return value
		.trim()
		.slice(0, 80)
		.replace(/[<>]/g, '');
}

// Fonction appelée par le tool saveUserPlant
function saveUserPlant({ name, room }: { name: string; room?: string }) {
	const plants = readPlants();

	const cleanName = sanitizeText(name);
	const cleanRoom = sanitizeText(room);

	if (!cleanName) {
		return {
			success: false,
			message: 'Le nom de la plante est obligatoire.'
		};
	}

	const newPlant: Plant = {
		id: crypto.randomUUID(),
		name: cleanName,
		room: cleanRoom,
		createdAt: new Date().toISOString()
	};

	plants.push(newPlant);
	writePlants(plants);

	return {
		success: true,
		plant: newPlant,
		message: `${cleanName} a bien été ajoutée aux plantes de l'utilisateur.`
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

		// On vérifie les cas sensibles avant d'appeler l'IA
		const sensitiveResponse = detectSensitiveMessage(cleanMessage);

		if (sensitiveResponse) {
			return {
				assistantMessage: sensitiveResponse
			};
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
