<script lang="ts">
	import { getChat, sendMessage, clearChat } from './chat.remote';
	import { marked } from 'marked';

	const chat = getChat();

	const messages = $derived(await chat);
</script>

<div class="min-h-screen bg-[#0D1624] px-10 py-8 pb-40 text-white">
	<h1 class="mb-8 text-4xl font-bold tracking-tight text-white">Chat</h1>

	{#each messages as message}
		<div class={`mb-5 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
			<div
				class={`max-w-[620] rounded-2xl pb-2 pr-3 pl-3 shadow-lg ${
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
						{@html marked(message.content)}
					</div>
				{:else}
					<p class="leading-relaxed">
						{message.content}
					</p>
				{/if}
			</div>
		</div>
	{/each}

	<form
		class="fixed right-10 bottom-8 left-10 z-10 flex gap-3 rounded-2xl bg-[#111C2D] p-4"
		{...sendMessage.enhance(async (instance) => {
			const userMessage = { role: 'user' as const, content: instance.data.message };
			instance.form.reset();
			await instance.submit().updates(
				chat.withOverride((messages) => [...messages, userMessage])
			);
		})}
	>
		<label class="flex flex-1 flex-col gap-2">
			<span class="text-sm font-medium text-slate-300">Message</span>

			<input
				class="rounded-xl border border-white/10 bg-[#0B1220] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
				name="message"
				type="text"
				required
				minlength="1"
				autocomplete="off"
				placeholder="Écris ton message ici..."
			/>
		</label>

		<button
			class="mt-7 rounded-xl bg-[#00949d] px-6 py-3 font-semibold text-white shadow-lg shadow-[#72d3cf]/25 hover:bg-[#00849a]"
		>
			Send
		</button>

		<button
			class="mt-7 w-fit rounded-lg px-3 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-300"
			onclick={() => clearChat()}
		>
			Clear
		</button>
	</form>
</div>