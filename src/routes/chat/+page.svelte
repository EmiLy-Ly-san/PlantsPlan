<script lang="ts">
	import { getChat, sendMessage, clearChat } from './chat.remote';
  import { marked } from 'marked';

	const chat = getChat();

  const messages = $derived(await chat);
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

  </ul>
  
  <form {...sendMessage.enhance(async (instance) => {
    const userMessage = { role: 'user' as const, content: instance.data.message };
    instance.form.reset();
    await instance.submit().updates(
      chat.withOverride((messages) => [...messages, userMessage])
    );
  })}>
      <input name="message" type="text" placeholder="Ask me anything..." required minlength="1" autocomplete="off" />
    <button>Send</button>
    <button onclick={() => clearChat()}>Clear</button>
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
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 960px;
    margin: 0 auto;

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

</style>