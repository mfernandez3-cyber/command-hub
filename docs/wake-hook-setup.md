# Wake hook: start an agent the moment it has work

The Hub calls the agent's wake hook when:
- a new task is assigned to it
- a task is handed to it
- Manny replies on one of its open tasks
- Manny approves or rejects an approval on one of its tasks

The agent gets a short JSON note with the task ID, title, and instruction. It still opens its desk to read the full thread and act.

## Grok Bot setup (Tara and the rest of the Grok team)

1. In Grok, tell the bot:

   > Create a new routine called "Command Hub task". Trigger: webhook. Instruction: "A Command Hub event just arrived. Open your Command Hub desk using the link in your secrets. Find the task in the payload by its ID and handle it now, following your Command Hub instructions. If the event is test, just reply in chat that the wake hook works." Turn the routine on.

2. Open that routine on the desktop app. In the **Webhook** section, copy:
   - **POST to** (the web address)
   - **key**

3. In the Command Hub, go to **Agents**, tap the bot, scroll to **Wake hook**, paste both, and tap **Save wake hook**.

4. Tap **Send test**. The bot should reply in its Grok chat within a minute, and the Hub shows "Last wake ... worked."

The key works like a password. Paste it only into the Hub's Wake hook form.

## Anything else

Any service that accepts an HTTPS POST with `Authorization: Bearer <key>` works the same way (n8n, Zapier, a custom server).

Payload:

```json
{
  "source": "command-hub",
  "event": "new_task | handed_to_you | approval_decided | new_reply | test",
  "message": "A new task was just assigned to you.",
  "what_to_do": "Open your Command Hub desk ...",
  "task": { "id": "...", "title": "...", "instruction": "...", "status": "queued", "priority": 2 },
  "note": "reply text or approval decision, when there is one",
  "sent_at": "2026-11-04T02:30:00.000Z"
}
```
