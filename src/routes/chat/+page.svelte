<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<h1>Chat</h1>

<form method="POST">
	<label>
		Message
		<input name="message" type="text" required minlength="1" autocomplete="off" />
	</label>
	<button>Send</button>
</form>

{#if form?.result}
	<pre>{JSON.stringify(form.result, null, 2)}</pre>
{/if}
