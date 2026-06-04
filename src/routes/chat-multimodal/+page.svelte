<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import { marked } from 'marked';

	const chat = new Chat({
		transport: new DefaultChatTransport({ api: '/api/chat-multimodal' })
	});

	let input = $state('');
	let files = $state<FileList | undefined>();
	let fileInput: HTMLInputElement;

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		chat.sendMessage({ text: input, files: files });
		input = '';
		files = undefined;
		fileInput.value = '';
	}
</script>

<header>
	<h1>Chat (files / multimodal)</h1>
</header>

<main>
	<ul class="messages">
		{#each chat.messages as message (message.id)}
			<li class="message {message.role} prose">
				{#each message.parts as part, i (i)}
					{#if part.type === 'text'}
						{@html marked.parse(part.text)}
					{:else if part.type === 'file' && part.mediaType?.startsWith('image/')}
						<img src={part.url} alt={part.filename} />
					{/if}
				{/each}
			</li>
		{/each}
	</ul>

	<form onsubmit={handleSubmit}>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			multiple
			onchange={(e) => (files = e.currentTarget.files ?? undefined)}
		/>
		<input
			bind:value={input}
			name="message"
			type="text"
			placeholder={chat.status !== 'ready' ? `${chat.status}…` : 'Ask me anything…'}
			required
			minlength="1"
			autocomplete="off"
		/>
		<button disabled={chat.status !== 'ready'}>Send</button>
		<button type="button" onclick={() => (chat.messages = [])}>Clear</button>
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
		padding: 1rem 1rem 0 1rem;
		margin: 0 auto;
		flex: 1;
		width: 100%;
		max-width: 960px;
		justify-content: stretch;
	}

	ul.messages {
		list-style: none;
		width: 100%;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;

		li {
			padding: 1rem;
			border-radius: 0.5rem;
			background-color: white;
			max-width: min(65ch, 80%);

			&.user {
				background-color: #f0f0f0;
				align-self: flex-end;
			}

			img {
				max-width: 100%;
				border-radius: 0.25rem;
			}
		}
	}

	form {
		display: grid;
		width: 100%;
		grid-template-columns: auto 1fr auto auto;
		gap: 1rem;
		position: sticky;
		bottom: 0;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border-top: 1px solid rgba(255, 255, 255, 0.2);
	}
</style>
