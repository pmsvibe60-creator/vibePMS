(() => {
  const next = document.querySelector('#tenant-next');
  const reset = document.querySelector('#tenant-reset');
  const stage = document.querySelector('#tenant-stage');
  const status = document.querySelector('#tenant-status');
  const initial = stage.innerHTML;
  let step = 0;
  const stages = [
    { title: 'Review your example agreement.', text: 'Alex Morgan · Flat 4, 24 Willow Mews. 1 September 2027–31 August 2028. Rent £1,450/month; deposit £1,450; utilities excluded.', note: 'Summary only—not a tenancy agreement or legal template.', button: 'Continue to demo signing →' },
    { title: 'One clear place to sign.', text: 'In the proposed product, the tenant would review the complete agreement and use the configured signing method here.', note: 'This button simulates signing. It does not create a signature or binding agreement.', button: 'Simulate signature →' },
    { title: 'Everything ready for move-in.', text: 'First month’s rent: £1,450. Security deposit: £1,450. Example total: £2,900.', note: 'A real offer would open its configured payment provider. This demo requests no card details and charges nothing.', button: 'Simulate £2,900 payment →' },
    { title: 'And that’s the journey.', text: 'Demo complete: details reviewed, signature simulated, and payment simulated. All in one place.', note: 'No property reserved, agreement signed, or money collected. Real confirmation must depend on verified signing and payment events.', button: '' },
  ];
  function progress() {
    document.querySelectorAll('[data-step]').forEach((item, i) => {
      item.classList.toggle('complete', i < step);
      if (i === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
  }
  next.addEventListener('click', () => {
    if (step >= stages.length) return;
    const content = stages[step++];
    stage.replaceChildren();
    for (const [tag, text] of [['h3', content.title], ['p', content.text], ['p', content.note]]) {
      const element = document.createElement(tag);
      element.textContent = text;
      stage.append(element);
    }
    next.textContent = content.button;
    next.hidden = !content.button;
    reset.hidden = false;
    status.textContent = content.title + ' ' + content.note;
    progress();
    if (!content.button) reset.focus({ preventScroll: true });
  });
  reset.addEventListener('click', () => {
    step = 0;
    stage.innerHTML = initial;
    next.textContent = 'Use demo details →';
    next.hidden = false;
    reset.hidden = true;
    status.textContent = 'Demo restarted with fictional tenant details.';
    progress();
    next.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-theme]').forEach(button => {
    button.addEventListener('click', () => {
      document.body.dataset.theme = button.dataset.theme;
      document.querySelectorAll('[data-theme]').forEach(item => {
        if (item.tagName === 'BUTTON') item.setAttribute('aria-pressed', String(item === button));
      });
    });
  });
})();
