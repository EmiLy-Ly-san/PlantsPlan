<svelte:options runes={false} />

<script>
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';

	let messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that can answer questions and help with tasks.'
    }
  ];


	onMount(() => {
    messages = JSON.parse(localStorage.getItem('messages') ?? '[]');
	});
</script>

<h1>Chat</h1>

<form method="POST" use:enhance={({ formData }) => {
  // When the use sends a message
  console.log({formData});
  const newUserMessage = formData.get('message');
  console.log({newUserMessage});

  messages.push({role: 'user', content: newUserMessage});

  localStorage.setItem('messages', JSON.stringify(messages));

  messages = messages
	
  return async ({ result }) => {
    // When the LLM is done
    console.log({result});

    messages.push({role: 'assistant', content: result.data.reply});

    localStorage.setItem('messages', JSON.stringify(messages));
    
    messages = messages
	};
}}>
	<label>
		Message
		<input name="message" type="text" required minlength="1" autocomplete="off" />
    <input type="hidden" name="messages" value={JSON.stringify(messages)} />
	</label>
	<button>Send</button>
</form>

<pre>{JSON.stringify(messages, null, 2)}</pre>

<button onclick={() => {
  localStorage.removeItem('messages');
  messages = [];
}}>Clear</button>