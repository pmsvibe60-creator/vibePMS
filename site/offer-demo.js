(() => {
  if (!document.querySelector('#offer-play')) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const conversations = [];
  function conversation(prefix, request, onApprove, readyMessage) {
    const get = suffix => document.querySelector(`#${prefix}-${suffix}`);
    const start = get('play'), skip = get('skip'), typed = get('typed');
    const result = get('result'), review = get('review'), approve = get('approve');
    const status = get('demo-status');
    const approveLabel = approve.textContent;
    let timer, position = 0, phase = 'idle';
    function finishTyping() {
      clearTimeout(timer);
      typed.textContent = request;
      phase = 'review'; review.hidden = false; skip.hidden = true;
      start.textContent = 'Replay typing';
      status.textContent = 'Example prepared. Review the details before approving the preview.';
    }
    function pause() {
      if (phase !== 'typing') return;
      clearTimeout(timer); phase = 'paused';
      start.textContent = 'Resume typing'; status.textContent = 'Typing paused.';
    }
    function tick() {
      if (phase !== 'typing') return;
      position = Math.min(position + 3, request.length);
      typed.textContent = request.slice(0, position);
      if (position >= request.length) return finishTyping();
      timer = setTimeout(tick, 38);
    }
    start.addEventListener('click', () => {
      if (phase === 'typing') return pause();
      clearTimeout(timer);
      if (phase !== 'paused') {
        position = 0; typed.textContent = ''; result.hidden = true; review.hidden = true;
        approve.disabled = false; approve.textContent = approveLabel;
      }
      phase = 'typing'; start.textContent = 'Pause typing'; skip.hidden = false;
      status.textContent = 'Playing a scripted example. No AI service is connected.';
      if (reduced.matches) finishTyping(); else tick();
    });
    skip.addEventListener('click', finishTyping);
    approve.addEventListener('click', () => {
      if (phase !== 'review') return;
      phase = 'ready'; result.hidden = false; approve.disabled = true;
      approve.textContent = 'Preview ready'; status.textContent = readyMessage;
      onApprove();
    });
    conversations.push({ pause });
  }
  conversation('offer', 'Prepare a private rental offer for Flat 4, 24 Willow Mews, London, UK. Start 1 September 2027, end 31 August 2028. Rent £1,450/month, deposit £1,450. Use Willow & Co branding. Show me the terms before creating the link.', () => {
    const frame = document.querySelector('#offer-frame');
    if (!frame.hasAttribute('src')) frame.src = 'offer-demo.html';
    document.querySelector('#offer-open').focus({ preventScroll: true });
  }, 'Example link ready. Open the tenant page below or explore its embedded preview.');
  conversation('recurring', 'Prepare monthly rent invoices for Alex Morgan at Flat 4, 24 Willow Mews. £1,450 per month, September 2027 through August 2028, due on the first. Show me the full schedule before activating anything.', () => {
    const grid = document.querySelector('#recurring-months');
    grid.replaceChildren();
    for (let i = 0; i < 12; i++) {
      const date = new Date(Date.UTC(2027, 8 + i, 1));
      const card = document.createElement('div');
      const month = document.createElement('span');
      month.textContent = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      const amount = document.createElement('strong'); amount.textContent = '£1,450';
      const due = document.createElement('small'); due.textContent = 'Due on the 1st · preview';
      card.append(month, amount, due); grid.append(card);
    }
  }, 'Twelve example invoices shown below. Nothing has been activated or sent.');
  conversation('upload', 'Read this maintenance bill and match it to Flat 4, 24 Willow Mews. Extract the supplier, invoice number, dates and total. Prepare a repairs expense for my review. Keep it as an owner expense; do not charge the tenant.', () => {}, 'Example expense draft shown below. No file was uploaded and no record was saved.');
  const tabs = [...document.querySelectorAll('[data-demo-tab]')];
  function selectTab(tab, focus = false) {
    conversations.forEach(item => item.pause());
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
      document.querySelector(`#demo-${item.dataset.demoTab}`).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  function openLinkedDemo() {
    if (window.location.hash !== '#finance') return;
    const tab = tabs.find(item => item.dataset.demoTab === 'finance');
    if (tab) { selectTab(tab); document.querySelector('#offer-demo').scrollIntoView({ block: 'start' }); }
  }
  window.addEventListener('hashchange', openLinkedDemo);
  openLinkedDemo();
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target === undefined) return;
      event.preventDefault(); selectTab(tabs[target], true);
    });
  });
})();
