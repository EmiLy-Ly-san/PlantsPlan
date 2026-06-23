<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import { sendMessage } from './chat.remote';

	type ChatMessage = {
		role: 'user' | 'assistant';
		content: string;
	};

	const STORAGE_KEY = 'plant-chat-messages';

	let messages = $state<ChatMessage[]>([]);
	let message = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');

	// Au chargement de la page, on récupère l'historique stocké dans le navigateur
	onMount(() => {
		const storedMessages = localStorage.getItem(STORAGE_KEY);

		if (storedMessages) {
			messages = JSON.parse(storedMessages);
		}
	});

	// Met à jour les messages dans l'interface et dans le localStorage
	function saveMessages(nextMessages: ChatMessage[]) {
		messages = nextMessages;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMessages));
	}

	// Envoie le message utilisateur au serveur
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		const cleanMessage = message.trim();

		// On évite les messages vides et les doubles envois
		if (!cleanMessage || isLoading) {
			return;
		}

		errorMessage = '';

		const userMessage: ChatMessage = {
			role: 'user',
			content: cleanMessage
		};

		const previousMessages = messages;

		// On affiche directement le message utilisateur
		saveMessages([...previousMessages, userMessage]);

		message = '';
		isLoading = true;

		try {
			const result = (await sendMessage({
				message: cleanMessage,

				// On envoie seulement les derniers messages au serveur
				// pour donner un peu de contexte à l'IA sans tout stocker en cookie
				history: previousMessages.slice(-8)
			})) as { assistantMessage: string };

			if (result.assistantMessage) {
				const assistantMessage: ChatMessage = {
					role: 'assistant',
					content: result.assistantMessage
				};

				saveMessages([...previousMessages, userMessage, assistantMessage]);
			}
		} catch (error) {
			errorMessage = "Une erreur est survenue pendant l'envoi du message.";
			console.error(error);
		} finally {
			isLoading = false;
		}
	}

	// Vide uniquement l'historique local du navigateur
	function clearChat() {
		saveMessages([]);
		errorMessage = '';
	}
</script>

<header>
	<h1>ECV Chat</h1>
</header>

<main>
	<ul class="messages">
		{#each messages as message}
			<li class="message {message.role} prose">
				{@html marked.parse(message.content)}
			</li>
		{/each}

		{#if isLoading}
			<li class="message assistant prose">
				<p>Je réfléchis...</p>
			</li>
		{/if}
	</ul>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	<form onsubmit={handleSubmit}>
		<input
			bind:value={message}
			name="message"
			type="text"
			placeholder="Ask me anything..."
			required
			minlength="1"
			autocomplete="off"
		/>

		<button type="submit" disabled={isLoading}>
			{isLoading ? 'Sending...' : 'Send'}
		</button>

		<button type="button" onclick={clearChat}>
			Clear
		</button>
	</form>
</main>

<style>
	header {
		padding: 1rem;
		background-color: black;
		color: white;
	}

	main {
		display: grid;
		grid-template-rows: 1fr auto;
		gap: 1rem;
		padding: 1rem;
		flex: 1;
		justify-content: stretch;
	}

	ul.messages {
		list-style: none;
		padding: 0;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 960px;
		width: 100%;

		li {
			padding: 1rem;
			border-radius: 0.5rem;
			background-color: white;
			max-width: min(65ch, 80%);

			&.user {
				background-color: #f0f0f0;
				align-self: flex-end;
			}
		}
	}

	form {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 1rem;
		position: sticky;
		bottom: 0;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border-top: 1px solid rgba(255, 255, 255, 0.2);
	}

	.error {
		max-width: 960px;
		margin: 0 auto;
		color: crimson;
	}
</style>