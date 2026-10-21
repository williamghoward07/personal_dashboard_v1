# Alexa reminder skill

- `/api/alexa` is public in `proxy.ts`. It must verify the Amazon signature and timestamp (`verify.ts`), then check the skill id and Amazon user id against env.
- Writes use the service-role client with the owner's stored Microsoft connection (`ALEXA_OWNER_USER_ID`).
- Re-ask vague dates or times. Never guess them.
- Setup and caveats: `docs/alexa-skill-setup.md`.
