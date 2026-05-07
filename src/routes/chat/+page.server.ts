import { fail } from '@sveltejs/kit';
import { PRIVATE_OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const message = data.get('message');

		if (!message) {
			return fail(400, { missing: true });
		}

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${PRIVATE_OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-5.4-mini',
				messages: [{ role: 'user', content: message }]
			})
		});

		const result = await response.json();
		return { result };
	}
};
