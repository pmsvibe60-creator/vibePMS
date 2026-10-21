# Set up with your AI assistant

Start with the [interactive prompt picker](https://pmsvibe60-creator.github.io/vibePMS/#start).
You can describe what you need in plain English and have your assistant work on the
code. Account access, hosting costs, local requirements and checking the result
remain the owner's responsibility. The current preview may need troubleshooting.

1. Fork the repository to your own GitHub account.
2. Sign in to Codex or Claude Code with an eligible subscription and connect your
   fork, or open a local copy. Check your plan's usage limits.
3. Paste [the Railway setup prompt](../site/prompts/setup.txt). The assistant should
   read `deploy/railway/README.md` before provisioning anything.
4. Confirm the services and costs before creating resources; enter credentials
   directly in the relevant service settings.
5. Test with fictional records and sandbox payments. Keep an explicit record of
   what passed and what remains unverified.

Other prompts: [customize](../site/prompts/customize.txt) and
[troubleshoot/report a bug](../site/prompts/debug.txt). Check for duplicate issues;
report reproducible project bugs with versions, steps and sanitized logs. Security
vulnerabilities go through the private reporting channel in `SECURITY.md`.

## Launch links

The landing page uses Anthropic's documented `https://claude.ai/code?prompt=...`
prefill link. It opens a web session form; the visitor still signs in, selects their
own fork and sends the task. It does not provision Railway or automatically submit
the prompt. The copy button also works with local Claude Code and Codex.

For Codex, the page links to the official app entry point and provides a copyable
prompt; it does not claim an undocumented prompt-prefill link.

References, checked 2026-10-21:
- [Codex plan access and limits](https://developers.openai.com/codex/pricing/)
- [Claude Code subscription access](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan)
- [Claude Code prefilled sessions](https://code.claude.com/docs/en/web-quickstart#pre-fill-sessions)
- [Railway hosting pricing](https://railway.com/pricing)
