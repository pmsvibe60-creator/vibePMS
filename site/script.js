const promptField = document.querySelector('#setup-prompt');
const choice = document.querySelector('#prompt-choice');
const copyButton = document.querySelector('#copy-prompt');
const claudeLink = document.querySelector('#open-claude');
const downloadLink = document.querySelector('#download-prompt');
const status = document.querySelector('#prompt-status');
let prompts = { setup: promptField.value };
let copyTimer;

function showPrompt() {
  const key = choice.value;
  if (!Object.hasOwn(prompts, key)) return;
  promptField.value = prompts[key];
  const url = new URL('https://claude.ai/code');
  url.searchParams.set('prompt', prompts[key]);
  claudeLink.href = url.href;
  downloadLink.href = `prompts/${key}.txt`;
  clearTimeout(copyTimer);
  copyButton.textContent = 'Copy prompt';
  status.textContent = '';
}

choice.disabled = true;
fetch('prompts.json')
  .then(response => {
    if (!response.ok) throw new Error('Unable to load prompts');
    return response.json();
  })
  .then(data => {
    for (const key of ['setup', 'customize', 'debug', 'manage']) {
      if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error('Invalid prompt library');
    }
    prompts = data;
    choice.disabled = false;
    showPrompt();
  })
  .catch(() => {
    status.textContent = 'The setup prompt is available below. Reload to load the other prompts.';
  });
choice.addEventListener('change', showPrompt);
copyButton.hidden = false;
copyButton.addEventListener('click', async () => {
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(promptField.value);
    copyButton.textContent = 'Copied';
    status.textContent = 'Prompt copied. Paste it into your assistant with your project open.';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copyButton.textContent = 'Copy prompt'; }, 2500);
  } catch {
    promptField.focus();
    promptField.select();
    status.textContent = 'Prompt selected. Use your device’s Copy command, then paste it into your assistant.';
  }
});
