const button = document.querySelector('#copy-command');
const status = document.querySelector('#copy-status');
if (button && navigator.clipboard && window.isSecureContext) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('git clone https://github.com/pmsvibe60-creator/vibePMS.git');
      button.textContent = 'Copied';
      status.textContent = 'Clone command copied to clipboard.';
      setTimeout(() => { button.textContent = 'Copy'; }, 2500);
    } catch {
      status.textContent = 'Copy unavailable. Select the command in the code block to copy it manually.';
      button.textContent = 'Select to copy';
    }
  });
}
