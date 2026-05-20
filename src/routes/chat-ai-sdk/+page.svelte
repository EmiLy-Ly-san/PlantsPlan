<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';

	const chat = new Chat({});
	let input = $state('');

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		chat.sendMessage({ text: input });
		input = '';
	}
</script>

<h1>Chat (AI SDK)</h1>

<pre>{JSON.stringify(chat.status, null, 2)}</pre>

{#each chat.messages as message (message.id)}
	<details>
		<summary>Message #{message.id}</summary>
		<pre>{JSON.stringify(message, null, 2)}</pre>
	</details>
	<div>
		<span>{message.role}</span>
		{#each message.parts as part, i (i)}
			{#if part.type === 'text'}
				<p>{part.text}</p>
			{/if}
		{/each}
	</div>
{/each}

<form onsubmit={handleSubmit}>
	<label>
		Message
		<input bind:value={input} type="text" required minlength="1" autocomplete="off" />
	</label>
	<button>Send</button>
</form>

<button onclick={() => (chat.messages = [])}>Clear</button>
