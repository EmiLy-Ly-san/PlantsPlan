<svelte:options runes={false} />

<script>
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';

	let messages = [];

	onMount(() => {
	});
</script>

<h1>Chat</h1>

<form method="POST" use:enhance={({ formData }) => {

	return async ({ result }) => {
	};
}}>
	<label>
		Message
		<input name="message" type="text" required minlength="1" autocomplete="off" />
	</label>
	<button>Send</button>
</form>
