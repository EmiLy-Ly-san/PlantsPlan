<script lang="ts">
	import { getChat, sendMessage, clearChat } from './chat.remote';

	const chat = getChat();

  const messages = $derived(await chat);
</script>

<h1>Chat</h1>

{#each messages as message}
  <div>
    <span>{message.role}</span>
    <p>{message.content}</p>
  </div>
{/each}

<form {...sendMessage.enhance(async (instance) => {
	const userMessage = { role: 'user' as const, content: instance.data.message };
	instance.form.reset();
	await instance.submit().updates(
		chat.withOverride((messages) => [...messages, userMessage])
	);
})}>
	<label>
		Message
		<input name="message" type="text" required minlength="1" autocomplete="off" />
	</label>
	<button>Send</button>
</form>

<button onclick={() => clearChat()}>Clear</button>
