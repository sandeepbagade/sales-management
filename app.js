const readStored = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`Could not read ${key} from local storage.`, error);
    return fallback;
  }
};
function loadWorkspaceData() {
  const data = {
    leads: readStored('salesdesk-leads', []),
    tasks: readStored('salesdesk-tasks', []),
    deals: readStored('salesdesk-deals', [])
  };
  let shouldClearLegacySamples = false;
  try {
    shouldClearLegacySamples = localStorage.getItem('salesdesk-demo-data-cleared-v1') !== 'true';
  } catch (error) {
    console.warn('Could not check the workspace data migration.', error);
  }
  if (shouldClearLegacySamples) {
    data.leads = Array.isArray(data.leads) ? data.leads.filter((item) => item && ![1, 2, 3, 4, 5, 6].includes(Number(item.id))) : [];
    data.tasks = Array.isArray(data.tasks) ? data.tasks.filter((item) => item && ![1, 2, 3, 4, 5].includes(Number(item.id))) : [];
    data.deals = Array.isArray(data.deals) ? data.deals.filter((item) => item && ![1, 2, 3, 4, 5, 6].includes(Number(item.id))) : [];
    try {
      localStorage.setItem('salesdesk-leads', JSON.stringify(data.leads));
      localStorage.setItem('salesdesk-tasks', JSON.stringify(data.tasks));
      localStorage.setItem('salesdesk-deals', JSON.stringify(data.deals));
      localStorage.setItem('salesdesk-demo-data-cleared-v1', 'true');
    } catch (error) {
      console.warn('Could not clear legacy sample data from this browser.', error);
    }
  }
  return data;
}
const workspaceData = loadWorkspaceData();
let leads = Array.isArray(workspaceData.leads) ? workspaceData.leads : [];
let tasks = Array.isArray(workspaceData.tasks) ? workspaceData.tasks : [];
let deals = Array.isArray(workspaceData.deals) ? workspaceData.deals : [];
let currentPage = 'Overview';
let toastTimer;
const teamName = 'Monarch Team';

const money = (amount) => `₹${(amount / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const initialsFor = (name) => String(name || '').split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
const todayFormatted = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const avatarClass = (index) => ['','pink','blue','gold'][index % 4];
const statusClass = (status) => `status-${String(status).toLowerCase().replace(/[^a-z]+/g, '-')}`;
const persist = () => {
  try {
    localStorage.setItem('salesdesk-leads', JSON.stringify(leads));
    localStorage.setItem('salesdesk-tasks', JSON.stringify(tasks));
    localStorage.setItem('salesdesk-deals', JSON.stringify(deals));
  } catch (error) {
    console.warn('Could not save your workspace changes.', error);
    showToast('Changes could not be saved in this browser.');
  }
};

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function renderLeadRows(list) {
  if (!list.length) return '<tr><td colspan="6"><div class="empty-state">No leads found. Try another search or add your first lead.</div></td></tr>';
  return list.map((lead, index) => `
    <tr>
      <td><div class="person-cell"><span class="person-avatar ${avatarClass(index)}">${esc(lead.initials || initialsFor(lead.name))}</span><span>${esc(lead.name)}</span></div></td>
      <td class="company-cell">${esc(lead.company || '—')}</td>
      <td><span class="source-icon">${lead.source === 'Website' ? '⌘' : lead.source === 'Referral' ? '↗' : lead.source === 'WhatsApp' ? '◌' : '＋'}</span>${esc(lead.source || 'Other')}</td>
      <td><span class="status-pill ${statusClass(lead.status)}">${esc(lead.status)}</span></td>
      <td>${esc(lead.owner || teamName)}</td>
      <td>${esc(lead.date || 'Today')}</td>
    </tr>`).join('');
}

function renderTaskRows(list, compact = false) {
  if (!list.length) return '<div class="empty-state">You’re all caught up. Nice work!</div>';
  return list.map((task) => `
    <div class="task-row ${task.overdue && !task.done ? 'overdue' : ''} ${task.done ? 'done' : ''}" data-task-id="${task.id}">
      <input class="task-check" type="checkbox" aria-label="Mark ${esc(task.title)} complete" ${task.done ? 'checked' : ''} />
      <div class="task-copy"><strong>${esc(task.title)}</strong><small>${esc(task.type)} · ${esc(task.person)}</small></div>
      <span class="task-time">${task.overdue && !task.done ? '<span class="priority-dot"></span>' : ''}${esc(task.done ? 'Done' : task.time)}</span>
    </div>`).join('');
}

function renderOverview() {
  const openValue = deals.filter((deal) => !['Won', 'Lost'].includes(deal.stage)).reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const wonValue = deals.filter((deal) => deal.stage === 'Won').reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const openTasks = tasks.filter((task) => !task.done);
  const newLeads = leads.filter((lead) => lead.status === 'New').length;
  return `
    <div class="page-heading"><div><h1>Welcome, Monarch Team <span aria-hidden="true">✳</span></h1><p>Here’s what’s happening with your sales today.</p></div><div class="heading-actions"><span class="date-pill"><span>▦</span> ${esc(todayFormatted())}</span><button class="button button-primary" data-action="add-lead"><span>＋</span> Add a lead</button></div></div>
    <div class="metric-grid">
      <article class="metric-card"><div class="metric-top">Open pipeline <span class="metric-icon">▱</span></div><div class="metric-value">${money(openValue)}</div><div class="metric-foot">Across active deals</div></article>
      <article class="metric-card"><div class="metric-top">Won deals <span class="metric-icon">↗</span></div><div class="metric-value">${money(wonValue)}</div><div class="metric-foot">Total closed-won value</div></article>
      <article class="metric-card"><div class="metric-top">Tasks to complete <span class="metric-icon">☷</span></div><div class="metric-value">${openTasks.length}</div><div class="metric-foot"><span class="trend-down">${openTasks.filter((task) => task.overdue).length} overdue</span> · Keep the momentum</div></article>
      <article class="metric-card"><div class="metric-top">New leads <span class="metric-icon">⌁</span></div><div class="metric-value">${newLeads}</div><div class="metric-foot">Awaiting first contact</div></article>
    </div>
    <div class="content-grid">
      <section class="panel"><div class="panel-header"><div><h2 class="panel-title">Pipeline overview</h2><p class="panel-subtitle">A snapshot of your active deals</p></div><button class="text-link" data-page="Deals">View pipeline →</button></div>
        <div class="pipeline-total"><span>Total open pipeline</span><strong>${money(openValue)}</strong></div>
        <div class="stage-list">
          ${['New','Qualified','Meeting / Demo','Proposal Sent','Negotiation'].map((stage) => { const matches = deals.filter((deal) => deal.stage === stage); const total = matches.reduce((sum, deal) => sum + Number(deal.value || 0), 0); const pct = openValue ? Math.max(5, Math.round(total / openValue * 100)) : 0; return `<div class="stage-row"><span class="stage-label">${esc(stage)}</span><div class="stage-bar"><div class="stage-fill" style="width:${pct}%"></div></div><span class="stage-amount">${money(total)}</span></div>`; }).join('')}
        </div>
      </section>
      <section class="panel tasks-panel"><div class="panel-header"><div><h2 class="panel-title">Your day</h2><p class="panel-subtitle">${openTasks.length} things on your list</p></div><button class="text-link" data-page="Today">See all →</button></div>
        <p class="task-date-label">UP NEXT</p>${renderTaskRows(openTasks.slice(0, 4))}
      </section>
    </div>
    <section class="table-panel"><div class="panel-header"><div><h2 class="panel-title">Recent leads</h2><p class="panel-subtitle">Stay close to your newest opportunities</p></div><button class="text-link" data-page="Leads">All leads →</button></div>
      <div class="table-wrap"><table><thead><tr><th>CONTACT</th><th>COMPANY</th><th>SOURCE</th><th>STATUS</th><th>OWNER</th><th>ADDED</th></tr></thead><tbody>${renderLeadRows(leads.slice(0, 4))}</tbody></table></div>
    </section>`;
}

function renderLeads() {
  return `<div class="page-heading"><div><h1>Leads</h1><p>Keep new opportunities moving toward a conversation.</p></div><div class="heading-actions"><button class="button button-quiet" data-action="export-leads">↓ Export CSV</button><button class="button button-primary" data-action="add-lead"><span>＋</span> Add a lead</button></div></div>
    <div class="metric-grid">
      <article class="metric-card"><div class="metric-top">All leads <span class="metric-icon">⌁</span></div><div class="metric-value">${leads.length}</div><div class="metric-foot">Across all sources</div></article>
      <article class="metric-card"><div class="metric-top">New to contact <span class="metric-icon">◷</span></div><div class="metric-value">${leads.filter((lead) => lead.status === 'New').length}</div><div class="metric-foot"><span class="trend-down">Needs a first touch</span></div></article>
      <article class="metric-card"><div class="metric-top">Qualified <span class="metric-icon">✓</span></div><div class="metric-value">${leads.filter((lead) => lead.status === 'Qualified').length}</div><div class="metric-foot">Ready for a deal</div></article>
      <article class="metric-card"><div class="metric-top">Recent leads <span class="metric-icon">↗</span></div><div class="metric-value">${leads.filter((lead) => ['Today','Yesterday'].includes(lead.date)).length}</div><div class="metric-foot">Added today or yesterday</div></article>
    </div>
    <section class="table-panel" data-searchable><div class="panel-header"><div><h2 class="panel-title">All leads</h2><p class="panel-subtitle">A little follow-up goes a long way.</p></div><div class="filters-row"><select class="filter-select" id="lead-status-filter" aria-label="Filter leads by status"><option value="">All statuses</option><option>New</option><option>Contacted</option><option>Qualified</option><option>Unqualified</option></select></div></div>
      <div class="table-wrap"><table><thead><tr><th>CONTACT</th><th>COMPANY</th><th>SOURCE</th><th>STATUS</th><th>OWNER</th><th>ADDED</th></tr></thead><tbody id="leads-table-body">${renderLeadRows(leads)}</tbody></table></div><div class="table-footer" id="lead-count">${leads.length} leads in your workspace</div>
    </section>`;
}

function renderCustomers() {
  const unique = [...new Map(leads.map((lead) => [lead.company || lead.name, lead])).values()];
  const activeDeals = deals.filter((deal) => !['Won', 'Lost'].includes(deal.stage)).length;
  return `<div class="page-heading"><div><h1>Customers</h1><p>Your customer relationships, all in one place.</p></div><div class="heading-actions"><button class="button button-quiet" data-action="export-leads">↓ Export CSV</button><button class="button button-primary" data-action="add-lead"><span>＋</span> Add customer</button></div></div>
    <div class="metric-grid">
      <article class="metric-card"><div class="metric-top">Total accounts <span class="metric-icon">♧</span></div><div class="metric-value">${unique.length}</div><div class="metric-foot">Your customer directory</div></article>
      <article class="metric-card"><div class="metric-top">Active opportunities <span class="metric-icon">▱</span></div><div class="metric-value">${activeDeals}</div><div class="metric-foot">Across ${unique.length} accounts</div></article>
      <article class="metric-card"><div class="metric-top">Needs follow-up <span class="metric-icon">◷</span></div><div class="metric-value">${tasks.filter((task) => !task.done).length}</div><div class="metric-foot">Keep every conversation warm</div></article>
      <article class="metric-card"><div class="metric-top">Total contacts <span class="metric-icon">↗</span></div><div class="metric-value">${leads.length}</div><div class="metric-foot">Across all accounts</div></article>
    </div>
    <section class="table-panel"><div class="panel-header"><div><h2 class="panel-title">Accounts & contacts</h2><p class="panel-subtitle">A quick view of your customer book</p></div><button class="text-link" data-action="add-lead">＋ Add contact</button></div><div class="table-wrap"><table><thead><tr><th>CONTACT</th><th>COMPANY</th><th>EMAIL</th><th>PHONE</th><th>LIFECYCLE</th><th>OWNER</th></tr></thead><tbody>${unique.length ? unique.map((lead, i) => `<tr><td><div class="person-cell"><span class="person-avatar ${avatarClass(i)}">${esc(lead.initials || initialsFor(lead.name))}</span><span>${esc(lead.name)}</span></div></td><td class="company-cell">${esc(lead.company || '—')}</td><td>${esc(lead.email || '—')}</td><td>${esc(lead.phone || '—')}</td><td><span class="status-pill ${statusClass(lead.status === 'Qualified' ? 'Customer' : lead.status === 'New' ? 'Lead' : 'Prospect')}">${lead.status === 'Qualified' ? 'Customer' : lead.status === 'New' ? 'Lead' : 'Prospect'}</span></td><td>${esc(lead.owner || teamName)}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">No accounts yet. Add your first customer or lead.</div></td></tr>'}</tbody></table></div><div class="table-footer">${unique.length} accounts shown</div></section>`;
}

function renderDeals() {
  const stages = ['New','Qualified','Meeting / Demo','Proposal Sent','Negotiation'];
  const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'short' });
  const activeDeals = deals.filter((deal) => !['Won', 'Lost'].includes(deal.stage));
  const activeValue = activeDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const wonValue = deals.filter((deal) => deal.stage === 'Won').reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  return `<div class="page-heading"><div><h1>Deals</h1><p>See what’s moving, what’s stuck, and what’s next.</p></div><div class="heading-actions"><span class="date-pill"><span>▱</span> ${activeDeals.length} active deals</span><button class="button button-primary" data-action="add-deal"><span>＋</span> Add a deal</button></div></div>
    <div class="metric-grid"><article class="metric-card"><div class="metric-top">Open pipeline <span class="metric-icon">▱</span></div><div class="metric-value">${money(activeValue)}</div><div class="metric-foot">Across active opportunities</div></article><article class="metric-card"><div class="metric-top">Average deal <span class="metric-icon">↗</span></div><div class="metric-value">${money(activeDeals.length ? activeValue / activeDeals.length : 0)}</div><div class="metric-foot">Across active opportunities</div></article><article class="metric-card"><div class="metric-top">Closing this month <span class="metric-icon">◷</span></div><div class="metric-value">${activeDeals.filter((deal) => String(deal.close).endsWith(currentMonth)).length}</div><div class="metric-foot">Deals with an upcoming close</div></article><article class="metric-card"><div class="metric-top">Won deals <span class="metric-icon">✓</span></div><div class="metric-value">${money(wonValue)}</div><div class="metric-foot">Total closed-won value</div></article></div>
    <div class="deal-board">${stages.map((stage) => { const items = deals.filter((deal) => deal.stage === stage); const amount = items.reduce((sum, deal) => sum + Number(deal.value || 0), 0); return `<section class="deal-column"><div class="deal-column-header"><span>${esc(stage)}</span><small>${items.length}</small></div>${items.length ? items.map((deal) => `<article class="deal-card"><h3>${esc(deal.title)}</h3><p>${esc(deal.company)} · ${esc(deal.owner)}</p><div class="deal-card-foot"><span>${money(deal.value)}</span><span>↗ ${esc(deal.close)}</span></div><label class="sr-only" for="deal-stage-${deal.id}">Move ${esc(deal.title)} to stage</label><select class="deal-stage-select" id="deal-stage-${deal.id}" data-deal-id="${deal.id}">${[...stages,'Won','Lost'].map((option) => `<option ${option === deal.stage ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></article>`).join('') : '<div class="empty-state">No deals here yet</div>'}<div class="deal-column-header"><span>Total</span><span>${money(amount)}</span></div></section>`; }).join('')}</div>`;
}

function renderTasks() {
  const overdue = tasks.filter((task) => task.overdue && !task.done);
  const today = tasks.filter((task) => !task.overdue && !task.done);
  const done = tasks.filter((task) => task.done);
  return `<div class="page-heading"><div><h1>My tasks</h1><p>Every next step, in one simple list.</p></div><div class="heading-actions"><button class="button button-primary" data-action="add-task"><span>＋</span> Add a task</button></div></div>
    <div class="metric-grid"><article class="metric-card"><div class="metric-top">Due today <span class="metric-icon">◷</span></div><div class="metric-value">${today.length}</div><div class="metric-foot">Make today count</div></article><article class="metric-card"><div class="metric-top">Overdue <span class="metric-icon">!</span></div><div class="metric-value">${overdue.length}</div><div class="metric-foot"><span class="trend-down">A quick catch-up helps</span></div></article><article class="metric-card"><div class="metric-top">Completed <span class="metric-icon">✓</span></div><div class="metric-value">${done.length}</div><div class="metric-foot">Nice progress so far</div></article><article class="metric-card"><div class="metric-top">This week <span class="metric-icon">▦</span></div><div class="metric-value">${tasks.length}</div><div class="metric-foot">Planned follow-ups</div></article></div>
    <section class="table-panel"><div class="panel-header"><div><h2 class="panel-title">Your follow-ups</h2><p class="panel-subtitle">Complete a task and keep the customer moving forward.</p></div><select class="filter-select" id="task-filter" aria-label="Filter tasks"><option value="all">All tasks</option><option value="open">Open only</option><option value="done">Completed</option></select></div><div class="task-list" id="task-list">${renderTaskRows(tasks)}</div></section>`;
}

function renderToday() {
  const pending = tasks.filter((task) => !task.done);
  const overdue = pending.filter((task) => task.overdue);
  return `<div class="page-heading"><div><h1>Your day, made clear.</h1><p>Start with what needs attention. You’ve got this.</p></div><div class="heading-actions"><span class="date-pill"><span>▦</span> ${esc(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }))}</span><button class="button button-primary" data-action="add-lead"><span>＋</span> Add a lead</button></div></div>
    <div class="metric-grid"><article class="metric-card"><div class="metric-top">To do today <span class="metric-icon">☷</span></div><div class="metric-value">${pending.length}</div><div class="metric-foot">Your next steps are right here</div></article><article class="metric-card"><div class="metric-top">Overdue <span class="metric-icon">!</span></div><div class="metric-value">${overdue.length}</div><div class="metric-foot"><span class="trend-down">Start here</span> to get back on track</div></article><article class="metric-card"><div class="metric-top">New leads <span class="metric-icon">⌁</span></div><div class="metric-value">${leads.filter((lead) => lead.status === 'New').length}</div><div class="metric-foot">Reach out while it’s fresh</div></article><article class="metric-card"><div class="metric-top">Completed <span class="metric-icon">✓</span></div><div class="metric-value">${tasks.filter((task) => task.done).length}</div><div class="metric-foot">Every touchpoint counts</div></article></div>
    <div class="content-grid"><section class="table-panel"><div class="panel-header"><div><h2 class="panel-title">Your follow-ups</h2><p class="panel-subtitle">A clear next action keeps every deal alive.</p></div><button class="text-link" data-page="Tasks">All tasks →</button></div><div class="task-list">${renderTaskRows(pending)}</div></section>
    <section class="panel"><div class="panel-header"><div><h2 class="panel-title">New leads to contact</h2><p class="panel-subtitle">First response makes a difference.</p></div><button class="text-link" data-page="Leads">All leads →</button></div>${leads.filter((lead) => lead.status === 'New').slice(0, 3).map((lead, i) => `<div class="task-row"><span class="person-avatar ${avatarClass(i)}">${esc(lead.initials || initialsFor(lead.name))}</span><div class="task-copy"><strong>${esc(lead.name)}</strong><small>${esc(lead.company)} · ${esc(lead.source)}</small></div><a class="task-link" href="tel:${esc(lead.phone)}" aria-label="Call ${esc(lead.name)}">Call</a></div>`).join('') || '<div class="empty-state">No new leads to reach out to.</div>'}</section></div>`;
}

function renderReports() {
  const won = deals.filter((deal) => deal.stage === 'Won').reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const pipeline = deals.filter((deal) => !['Won','Lost'].includes(deal.stage)).reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const sources = [...new Set(leads.map((lead) => lead.source || 'Other'))].map((name) => [name, leads.filter((lead) => (lead.source || 'Other') === name).length]);
  return `<div class="page-heading"><div><h1>Reports & insights</h1><p>Keep an eye on the numbers that move your team forward.</p></div><div class="heading-actions"><span class="date-pill"><span>▦</span> All time</span><button class="button button-quiet" data-action="export-leads">↓ Export</button></div></div>
    <div class="report-grid"><article class="report-card"><h3>Revenue won</h3><div class="report-number">${money(won)}</div><p>Total value of closed-won deals</p></article><article class="report-card"><h3>Open pipeline</h3><div class="report-number">${money(pipeline)}</div><p>Across ${deals.filter((deal) => !['Won','Lost'].includes(deal.stage)).length} active opportunities</p></article><article class="report-card"><h3>Leads</h3><div class="report-number">${leads.length}</div><p>Across all sources</p></article></div>
    <div class="content-grid"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Lead sources</h2><p class="panel-subtitle">Leads by source in your workspace</p></div></div>${sources.length ? sources.map(([name, count]) => `<div class="source-row"><span class="source-name">${esc(name)}</span><span class="source-progress"><span style="width:${leads.length ? count / leads.length * 100 : 0}%"></span></span><span class="source-value">${count}</span></div>`).join('') : '<div class="empty-state">Lead source reports will appear when you add leads.</div>'}</section><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Workspace activity</h2><p class="panel-subtitle">Your current follow-up workload</p></div></div><div class="metric-value" style="margin-top:22px">${tasks.filter((task) => !task.done).length} <small style="font:400 11px 'DM Sans';color:#929b95">open tasks</small></div><p class="panel-subtitle">${tasks.filter((task) => task.done).length} completed tasks</p></section></div>`;
}

const renderers = { Overview: renderOverview, Today: renderToday, Leads: renderLeads, Customers: renderCustomers, Deals: renderDeals, Tasks: renderTasks, Reports: renderReports };
function renderAll() {
  Object.entries(renderers).forEach(([page, render]) => {
    const view = document.querySelector(`[data-view="${page}"]`);
    view.innerHTML = render();
  });
  document.querySelector('#today-count').textContent = tasks.filter((task) => !task.done).length;
  document.querySelector('#leads-count').textContent = leads.length;
  document.querySelector('#current-year').textContent = new Date().getFullYear();
  applySearch();
}

function navigate(page) {
  if (!renderers[page]) return;
  currentPage = page;
  document.querySelectorAll('.page-view').forEach((view) => view.classList.toggle('active', view.dataset.view === page));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  document.querySelector('#page-name').textContent = page;
  document.querySelector('#global-search').value = '';
  document.querySelector('#sidebar').classList.remove('open');
  applySearch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applySearch() {
  const active = document.querySelector('.page-view.active');
  if (!active) return;
  const query = document.querySelector('#global-search').value.trim().toLowerCase();
  if (active.dataset.view === 'Leads') {
    const status = active.querySelector('#lead-status-filter')?.value || '';
    const matches = leads.filter((lead) => (!status || lead.status === status) && (!query || `${lead.name} ${lead.company} ${lead.email} ${lead.phone} ${lead.source} ${lead.status} ${lead.owner}`.toLowerCase().includes(query)));
    const body = active.querySelector('#leads-table-body');
    if (body) body.innerHTML = renderLeadRows(matches);
    const count = active.querySelector('#lead-count');
    if (count) count.textContent = `${matches.length} of ${leads.length} leads`;
    return;
  }
  active.querySelectorAll('tbody tr').forEach((row) => {
    row.hidden = query.length > 0 && !row.textContent.toLowerCase().includes(query);
  });
  active.querySelectorAll('.task-row').forEach((row) => {
    row.hidden = query.length > 0 && !row.textContent.toLowerCase().includes(query);
  });
  active.querySelectorAll('.deal-card').forEach((card) => {
    card.hidden = query.length > 0 && !card.textContent.toLowerCase().includes(query);
  });
}

function openLeadModal() {
  const modal = document.querySelector('#lead-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => modal.querySelector('[name="name"]').focus(), 0);
}
function closeLeadModal() {
  const modal = document.querySelector('#lead-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.querySelector('#lead-form').reset();
}
function openEntityModal(type) {
  const modal = document.querySelector('#entity-modal');
  const isTask = type === 'task';
  document.querySelector('#entity-modal-eyebrow').textContent = isTask ? 'NEXT ACTION' : 'NEW OPPORTUNITY';
  document.querySelector('#entity-modal-title').textContent = isTask ? 'Add a task' : 'Add a deal';
  document.querySelector('#entity-modal-intro').textContent = isTask
    ? 'Set a clear next step so no customer follow-up gets missed.'
    : 'Add the opportunity to your pipeline and keep it moving.';
  document.querySelector('#entity-submit').innerHTML = isTask ? 'Save task <span>→</span>' : 'Save deal <span>→</span>';
  document.querySelector('#entity-fields').innerHTML = isTask ? `
    <label class="form-field">Task name <span>*</span><input name="title" required placeholder="Task name" /></label>
    <div class="form-row">
      <label class="form-field">Type<select name="type"><option>Call</option><option>Meeting</option><option>Visit</option><option>Email</option><option>WhatsApp</option><option>Demo</option><option>Other</option></select></label>
      <label class="form-field">Customer or deal<input name="person" placeholder="Customer or deal name" /></label>
    </div>
    <div class="form-row">
      <label class="form-field">Due date<input name="date" type="date" required /></label>
      <label class="form-field">Time<input name="time" type="time" required value="10:00" /></label>
    </div>
  ` : `
    <label class="form-field">Deal name <span>*</span><input name="title" required placeholder="Deal name" /></label>
    <div class="form-row">
      <label class="form-field">Customer or company <span>*</span><input name="company" required placeholder="Company name" /></label>
      <label class="form-field">Deal value (INR) <span>*</span><input name="value" type="number" min="1" step="1" required placeholder="Amount in INR" /></label>
    </div>
    <div class="form-row">
      <label class="form-field">Pipeline stage<select name="stage">${['New','Qualified','Meeting / Demo','Proposal Sent','Negotiation'].map((stage) => `<option>${stage}</option>`).join('')}</select></label>
      <label class="form-field">Expected close<input name="close" type="date" required /></label>
    </div>
  `;
  modal.dataset.entityType = type;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => modal.querySelector('[name="title"]').focus(), 0);
}
function closeEntityModal() {
  const modal = document.querySelector('#entity-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.querySelector('#entity-form').reset();
}
function exportLeads() {
  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['Name','Phone','Email','Company','Source','Status','Owner','Added'], ...leads.map((lead) => [lead.name,lead.phone,lead.email,lead.company,lead.source,lead.status,lead.owner,lead.date])];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'monarch-technologies-leads.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Your leads CSV is ready.');
}

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-page]');
  if (nav) { event.preventDefault(); navigate(nav.dataset.page); return; }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'add-lead') openLeadModal();
  if (action.dataset.action === 'export-leads') exportLeads();
  if (action.dataset.action === 'add-deal') openEntityModal('deal');
  if (action.dataset.action === 'add-task') openEntityModal('task');
});

document.addEventListener('change', (event) => {
  if (event.target.matches('.task-check')) {
    const row = event.target.closest('[data-task-id]');
    const task = tasks.find((item) => item.id === Number(row.dataset.taskId));
    if (task) task.done = event.target.checked;
    persist();
    renderAll();
    showToast(task?.done ? 'Task completed. One less thing to remember.' : 'Task moved back to your list.');
  }
  if (event.target.matches('#lead-status-filter')) applySearch();
  if (event.target.matches('#task-filter')) {
    const view = event.target.closest('[data-view]');
    let filtered = tasks;
    if (event.target.value === 'open') filtered = tasks.filter((task) => !task.done);
    if (event.target.value === 'done') filtered = tasks.filter((task) => task.done);
    view.querySelector('#task-list').innerHTML = renderTaskRows(filtered);
  }
  if (event.target.matches('.deal-stage-select')) {
    const deal = deals.find((item) => item.id === Number(event.target.dataset.dealId));
    if (!deal) return;
    if (event.target.value === 'Lost') {
      const reason = window.prompt(`Why was "${deal.title}" lost? A reason is required.`);
      if (!reason || !reason.trim()) {
        event.target.value = deal.stage;
        return;
      }
      deal.lossReason = reason.trim();
    }
    deal.stage = event.target.value;
    persist();
    renderAll();
    showToast(`Deal moved to ${deal.stage}. Remember to schedule the next follow-up.`);
  }
});

document.querySelector('#lead-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get('name') || '').trim();
  const phone = String(data.get('phone') || '').trim();
  if (!name || !phone) return;
  const email = String(data.get('email') || '').trim();
  const duplicate = leads.find((lead) => lead.phone.replace(/\D/g, '') === phone.replace(/\D/g, '') || (email && lead.email.toLowerCase() === email.toLowerCase()));
  if (duplicate) {
    showToast(`A lead with this ${duplicate.phone.replace(/\D/g, '') === phone.replace(/\D/g, '') ? 'phone number' : 'email'} already exists.`);
    return;
  }
  leads.unshift({ id: Date.now(), name, initials: initialsFor(name), company: String(data.get('company') || '').trim(), email, phone, source: String(data.get('source') || 'Other'), status: 'New', owner: teamName, date: 'Today', requirement: String(data.get('requirement') || '').trim() });
  persist();
  closeLeadModal();
  renderAll();
  showToast('Lead added. Follow up while the conversation is fresh.');
});

document.querySelectorAll('.modal-close').forEach((button) => button.addEventListener('click', closeLeadModal));
document.querySelector('#lead-modal').addEventListener('click', (event) => { if (event.target.id === 'lead-modal') closeLeadModal(); });
document.querySelectorAll('.entity-modal-close').forEach((button) => button.addEventListener('click', closeEntityModal));
document.querySelector('#entity-modal').addEventListener('click', (event) => { if (event.target.id === 'entity-modal') closeEntityModal(); });
document.querySelector('#entity-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  if (!title) return;
  const modal = document.querySelector('#entity-modal');
  if (modal.dataset.entityType === 'task') {
    const date = String(data.get('date'));
    const time = String(data.get('time'));
    const today = new Date();
    const due = new Date(`${date}T${time}`);
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dateLabel = date === localToday ? 'Today' : new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    tasks.unshift({ id: Date.now(), title, person: String(data.get('person') || '').trim() || 'No customer linked', type: String(data.get('type') || 'Other'), time: `${dateLabel} · ${time}`, overdue: due < today, done: false });
    showToast('Task scheduled. Your next step is on the list.');
  } else {
    const closeDate = new Date(`${data.get('close')}T00:00:00`);
    deals.unshift({
      id: Date.now(),
      title,
      company: String(data.get('company') || '').trim(),
      value: Number(data.get('value')),
      stage: String(data.get('stage') || 'New'),
      owner: teamName,
      close: closeDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    });
    showToast('Deal added to your pipeline.');
  }
  persist();
  closeEntityModal();
  renderAll();
});
document.querySelector('#global-search').addEventListener('input', applySearch);
document.querySelector('#mobile-menu').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
document.querySelector('#top-add').addEventListener('click', openLeadModal);
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#global-search').focus();
  }
  if (event.key === 'Escape') { closeLeadModal(); closeEntityModal(); }
});

renderAll();
