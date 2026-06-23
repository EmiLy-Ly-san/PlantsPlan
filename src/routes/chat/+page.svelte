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

<div class="min-h-screen bg-[#0D1624] px-10 py-8 pb-40 text-white">
	<h1 class="mb-8 text-4xl font-bold tracking-tight text-white">Chat</h1>

	{#each messages as message}
		<div class={`mb-5 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
			<div
				class={`max-w-155 rounded-2xl pb-2 pr-3 pl-3 shadow-lg ${
					message.role === 'user'
						? 'bg-[#245a9b] text-white'
						: 'bg-[#172234] text-slate-100'
				}`}
			>
				<span
					class={`mb-2 block text-xs font-semibold uppercase tracking-wider ${
						message.role === 'user' ? 'text-blue-100' : 'text-blue-300'
					}`}
				>
				</span>

				{#if message.role === 'assistant'}
					<div class="prose prose-invert max-w-none leading-relaxed">
						{@html marked.parse(message.content)}
					</div>
				{:else}
					<p class="leading-relaxed">
						{message.content}
					</p>
				{/if}
			</div>
		</div>
	{/each}

	{#if isLoading}
		<div class="mb-5 flex justify-start">
			<div class="max-w-155 rounded-2xl bg-[#172234] px-3 pb-2 text-slate-100 shadow-lg">
				<p class="leading-relaxed">Je réfléchis...</p>
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<p class="fixed right-10 bottom-28 left-10 z-10 rounded-xl bg-red-500/10 px-4 py-3 text-red-300">
			{errorMessage}
		</p>
	{/if}

	<form
		class="fixed right-10 bottom-8 left-10 z-10 flex gap-3 rounded-2xl bg-[#111C2D] p-4"
		onsubmit={handleSubmit}
	>
		<label class="flex flex-1 flex-col gap-2">
			<span class="text-sm font-medium text-slate-300">Message</span>

			<input
				class="rounded-xl border border-white/10 bg-[#0B1220] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
				bind:value={message}
				name="message"
				type="text"
				required
				minlength="1"
				autocomplete="off"
				placeholder="Écris ton message ici..."
			/>
		</label>

		<button
			class="mt-7 rounded-xl bg-[#00949d] px-6 py-3 font-semibold text-white shadow-lg shadow-[#72d3cf]/25 hover:bg-[#00849a] disabled:cursor-not-allowed disabled:opacity-50"
			type="submit"
			disabled={isLoading}
		>
			{isLoading ? 'Sending...' : 'Send'}
		</button>

		<button
			class="mt-7 w-fit rounded-lg px-3 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-300"
			type="button"
			onclick={clearChat}
		>
			Clear
		</button>
	</form>
</div>