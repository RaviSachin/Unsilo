# AI usage

| Where | Tool | How it was used |
| --- | --- | --- |
| Writing code | Claude (Anthropic) | Drafted modules step by step during the event from our plan; the team reviewed, ran and tested each part |
| Runtime analysis | Google Gemini (`GEMINI_MODEL`) | Email team labels, attachment criticality, Drive categories, WhatsApp summaries, and grounded answers |

## Guard rails in the runtime AI

- The model only sees retrieved records, numbered `[S1]…[Sn]`, and must cite them. Code drops any citation that
  was not shown; an answer with no valid citation becomes "I don't know, that is not in the data".
- Every AI step has a keyword-rule fallback, so outputs are produced even with no key or a failed call.
- Responses are requested as JSON against a fixed schema and validated before use.
- No secrets or full mailboxes are sent: only the trimmed text of the records needed for the task.
