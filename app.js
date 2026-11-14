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
    deals: readStored('salesdesk-deals', []),
    customers: readStored('salesdesk-customers', null),
    products: readStored('salesdesk-products', [])
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
  if (!Array.isArray(data.customers)) {
    const existingLeads = Array.isArray(data.leads) ? data.leads.filter((lead) => lead && typeof lead === 'object') : [];
    data.customers = [...new Map(existingLeads.map((lead) => [
      lead.company || lead.name,
      { ...lead, status: lead.status === 'Qualified' ? 'Customer' : 'Prospect' }
    ])).values()];
    try {
      localStorage.setItem('salesdesk-customers', JSON.stringify(data.customers));
    } catch (error) {
      console.warn('Could not migrate existing contacts to the customer directory.', error);
    }
  }
  return data;
}
const workspaceData = loadWorkspaceData();
let leads = Array.isArray(workspaceData.leads) ? workspaceData.leads : [];
let tasks = Array.isArray(workspaceData.tasks) ? workspaceData.tasks : [];
let deals = Array.isArray(workspaceData.deals) ? workspaceData.deals : [];
let customers = Array.isArray(workspaceData.customers) ? workspaceData.customers : [];
let products = Array.isArray(workspaceData.products) ? workspaceData.products : [];
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
    localStorage.setItem('salesdesk-customers', JSON.stringify(customers));
    localStorage.setItem('salesdesk-products', JSON.stringify(products));
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

function entityInput(label, name, value = '', type = 'text', attributes = '') {
  return `<label class="form-field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attributes} /></label>`;
}
function entitySelect(label, name, value, options) {
  return `<label class="form-field">${label}<select name="${name}">${options.map((option) => `<option value="${esc(option)}" ${option === value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
}
function entityTextarea(label, name, value = '') {
  return `<label class="form-field">${label}<textarea name="${name}" rows="3">${esc(value)}</textarea></label>`;
}
function entityCheckbox(label, name, checked) {
  return `<label class="form-check"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''} />${label}</label>`;
}
function renderLeadRows(list, editable = false) {
  if (!list.length) return `<tr><td colspan="${editable ? 7 : 6}"><div class="empty-state">No leads found. Try another search or add your first lead.</div></td></tr>`;
  return list.map((lead, index) => `
    <tr>
      <td><div class="person-cell"><span class="person-avatar ${avatarClass(index)}">${esc(lead.initials || initialsFor(lead.name))}</span><span>${esc(lead.name)}</span></div></td>
      <td class="company-cell">${esc(lead.company || '—')}</td>
      <td><span class="source-icon">${lead.source === 'Website' ? '⌘' : lead.source === 'Referral' ? '↗' : lead.source === 'WhatsApp' ? '◌' : '＋'}</span>${esc(lead.source || 'Other')}</td>
      <td><span class="status-pill ${statusClass(lead.status)}">${esc(lead.status)}</span></td>
      <td>${esc(lead.owner || teamName)}</td>
      <td>${esc(lead.date || 'Today')}</td>
      ${editable ? `<td><button class="button button-quiet table-edit" type="button" data-action="edit-record" data-type="lead" data-id="${esc(lead.id)}">Edit</button></td>` : ''}
    </tr>`).join('');
}

function renderTaskRows(list, compact = false) {
  if (!list.length) return '<div class="empty-state">You’re all caught up. Nice work!</div>';
  return list.map((task) => `
    <div class="task-row ${task.overdue && !task.done ? 'overdue' : ''} ${task.done ? 'done' : ''}" data-task-id="${task.id}">
      <input class="task-check" type="checkbox" aria-label="Mark ${esc(task.title)} complete" ${task.done ? 'checked' : ''} />
      <div class="task-copy"><strong>${esc(task.title)}</strong><small>${esc(task.type)} · ${esc(task.person)}</small></div>
      <span class="task-time">${task.overdue && !task.done ? '<span class="priority-dot"></span>' : ''}${esc(task.done ? 'Done' : task.time)}</span>
      <button class="task-edit" type="button" data-action="edit-record" data-type="task" data-id="${esc(task.id)}" aria-label="Edit ${esc(task.title)}">Edit</button>
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
      <div class="table-wrap"><table><thead><tr><th>CONTACT</th><th>COMPANY</th><th>SOURCE</th><th>STATUS</th><th>OWNER</th><th>ADDED</th><th></th></tr></thead><tbody id="leads-table-body">${renderLeadRows(leads, true)}</tbody></table></div><div class="table-footer" id="lead-count">${leads.length} leads in your workspace</div>
    </section>`;
}

function renderCustomers() {
  const activeDeals = deals.filter((deal) => !['Won', 'Lost'].includes(deal.stage)).length;
  return `<div class="page-heading"><div><h1>Customers</h1><p>Your customer relationships, all in one place.</p></div><div class="heading-actions"><button class="button button-primary" data-action="add-customer"><span>＋</span> Add customer</button></div></div>
    <div class="metric-grid">
      <article class="metric-card"><div class="metric-top">Total accounts <span class="metric-icon">♧</span></div><div class="metric-value">${customers.length}</div><div class="metric-foot">Your customer directory</div></article>
      <article class="metric-card"><div class="metric-top">Active opportunities <span class="metric-icon">▱</span></div><div class="metric-value">${activeDeals}</div><div class="metric-foot">Across your workspace</div></article>
      <article class="metric-card"><div class="metric-top">Needs follow-up <span class="metric-icon">◷</span></div><div class="metric-value">${tasks.filter((task) => !task.done).length}</div><div class="metric-foot">Keep every conversation warm</div></article>
      <article class="metric-card"><div class="metric-top">Total contacts <span class="metric-icon">↗</span></div><div class="metric-value">${customers.length}</div><div class="metric-foot">In your customer directory</div></article>
    </div>
    <section class="table-panel"><div class="panel-header"><div><h2 class="panel-title">Accounts & contacts</h2><p class="panel-subtitle">A quick view of your customer book</p></div><button class="button button-primary" data-action="add-customer"><span>＋</span> Add customer</button></div><div class="table-wrap"><table><thead><tr><th>CONTACT</th><th>COMPANY</th><th>EMAIL</th><th>PHONE</th><th>STATUS</th><th>OWNER</th><th></th></tr></thead><tbody>${customers.length ? customers.map((customer, i) => `<tr><td><div class="person-cell"><span class="person-avatar ${avatarClass(i)}">${esc(customer.initials || initialsFor(customer.name))}</span><span>${esc(customer.name)}</span></div></td><td class="company-cell">${esc(customer.company || '—')}</td><td>${esc(customer.email || '—')}</td><td>${esc(customer.phone || '—')}</td><td><span class="status-pill ${statusClass(customer.status)}">${esc(customer.status || 'Customer')}</span></td><td>${esc(customer.owner || teamName)}</td><td><button class="button button-quiet table-edit" type="button" data-action="edit-record" data-type="customer" data-id="${esc(customer.id)}">Edit</button></td></tr>`).join('') : '<tr><td colspan="7"><div class="empty-state">No accounts yet. Add your first customer.</div></td></tr>'}</tbody></table></div><div class="table-footer">${customers.length} accounts shown</div></section>`;
}

function renderProducts() {
  return `<div class="page-heading"><div><h1>Products</h1><p>Manage your product catalog and pricing.</p></div><div class="heading-actions"><span class="date-pill">${products.length} products</span><button class="button button-primary" data-action="add-product"><span>＋</span> Add a product</button></div></div>
    <section class="table-panel"><div class="panel-header"><div><h2 class="panel-title">Product catalog</h2><p class="panel-subtitle">Products saved in your workspace</p></div></div><div class="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>DESCRIPTION</th><th>PRICE (INR)</th><th>STOCK QUANTITY</th><th></th></tr></thead><tbody>${products.length ? products.map((product) => `<tr><td>${esc(product.name)}</td><td>${esc(product.sku)}</td><td>${esc(product.description || '—')}</td><td>${Number(product.price || 0).toLocaleString('en-IN')}</td><td>${esc(product.stock ?? 0)}</td><td><button class="button button-quiet table-edit" type="button" data-action="edit-record" data-type="product" data-id="${esc(product.id)}">Edit</button></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">No products yet. Add your first product to the catalog.</div></td></tr>'}</tbody></table></div><div class="table-footer">${products.length} products shown</div></section>`;
}

function renderDeals() {
  const stages = ['New','Qualified','Meeting / Demo','Proposal Sent','Negotiation'];
  const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'short' });
  const activeDeals = deals.filter((deal) => !['Won', 'Lost'].includes(deal.stage));
  const closedDeals = deals.filter((deal) => ['Won', 'Lost'].includes(deal.stage));
  const activeValue = activeDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const wonValue = deals.filter((deal) => deal.stage === 'Won').reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  return `<div class="page-heading"><div><h1>Deals</h1><p>See what’s moving, what’s stuck, and what’s next.</p></div><div class="heading-actions"><span class="date-pill"><span>▱</span> ${activeDeals.length} active deals</span><button class="button button-primary" data-action="add-deal"><span>＋</span> Add a deal</button></div></div>
    <div class="metric-grid"><article class="metric-card"><div class="metric-top">Open pipeline <span class="metric-icon">▱</span></div><div class="metric-value">${money(activeValue)}</div><div class="metric-foot">Across active opportunities</div></article><article class="metric-card"><div class="metric-top">Average deal <span class="metric-icon">↗</span></div><div class="metric-value">${money(activeDeals.length ? activeValue / activeDeals.length : 0)}</div><div class="metric-foot">Across active opportunities</div></article><article class="metric-card"><div class="metric-top">Closing this month <span class="metric-icon">◷</span></div><div class="metric-value">${activeDeals.filter((deal) => String(deal.close).endsWith(currentMonth)).length}</div><div class="metric-foot">Deals with an upcoming close</div></article><article class="metric-card"><div class="metric-top">Won deals <span class="metric-icon">✓</span></div><div class="metric-value">${money(wonValue)}</div><div class="metric-foot">Total closed-won value</div></article></div>
    <div class="deal-board">${stages.map((stage) => { const items = deals.filter((deal) => deal.stage === stage); const amount = items.reduce((sum, deal) => sum + Number(deal.value || 0), 0); return `<section class="deal-column"><div class="deal-column-header"><span>${esc(stage)}</span><small>${items.length}</small></div>${items.length ? items.map((deal) => `<article class="deal-card"><h3>${esc(deal.title)}</h3><p>${esc(deal.company)} · ${esc(deal.owner)}</p><div class="deal-card-foot"><span>${money(deal.value)}</span><span>↗ ${esc(deal.close)}</span></div><button class="button button-quiet table-edit" type="button" data-action="edit-record" data-type="deal" data-id="${esc(deal.id)}">Edit deal</button><label class="sr-only" for="deal-stage-${deal.id}">Move ${esc(deal.title)} to stage</label><select class="deal-stage-select" id="deal-stage-${deal.id}" data-deal-id="${deal.id}">${[...stages,'Won','Lost'].map((option) => `<option ${option === deal.stage ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></article>`).join('') : '<div class="empty-state">No deals here yet</div>'}<div class="deal-column-header"><span>Total</span><span>${money(amount)}</span></div></section>`; }).join('')}</div>
    ${closedDeals.length ? `<section class="table-panel"><div class="panel-header"><div><h2 class="panel-title">Closed deals</h2><p class="panel-subtitle">Won and lost opportunities</p></div></div><div class="table-wrap"><table><thead><tr><th>DEAL</th><th>COMPANY</th><th>VALUE (INR)</th><th>STAGE</th><th>EXPECTED CLOSE</th><th>OWNER</th><th></th></tr></thead><tbody>${closedDeals.map((deal) => `<tr><td>${esc(deal.title)}</td><td>${esc(deal.company)}</td><td>${Number(deal.value || 0).toLocaleString('en-IN')}</td><td>${esc(deal.stage)}</td><td>${esc(deal.close)}</td><td>${esc(deal.owner || teamName)}</td><td><button class="button button-quiet table-edit" type="button" data-action="edit-record" data-type="deal" data-id="${esc(deal.id)}">Edit</button></td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
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

const renderers = { Overview: renderOverview, Today: renderToday, Leads: renderLeads, Customers: renderCustomers, Products: renderProducts, Deals: renderDeals, Tasks: renderTasks, Reports: renderReports };
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
    if (body) body.innerHTML = renderLeadRows(matches, true);
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
function openEntityModal(type, recordId = '') {
  const modal = document.querySelector('#entity-modal');
  const collections = { lead: leads, customer: customers, deal: deals, task: tasks, product: products };
  const record = recordId ? collections[type].find((item) => String(item.id) === String(recordId)) : null;
  if (recordId && !record) {
    showToast('This record could not be found.');
    return;
  }
  const editing = Boolean(record);
  const labels = { lead: 'lead', customer: 'customer', deal: 'deal', task: 'task', product: 'product' };
  const label = labels[type];
  const fieldValue = (name, fallback = '') => record ? record[name] ?? fallback : fallback;
  let fields = '';
  if (type === 'lead') {
    fields = `<div class="form-row">${entityInput('Full name <span>*</span>', 'name', fieldValue('name'), 'text', 'required')}${entityInput('Phone number <span>*</span>', 'phone', fieldValue('phone'), 'tel', 'required')}</div>
      <div class="form-row">${entityInput('Email address', 'email', fieldValue('email'), 'email')}${entityInput('Company', 'company', fieldValue('company'))}</div>
      <div class="form-row">${entitySelect('Lead source', 'source', fieldValue('source', 'Website'), ['Website', 'Referral', 'WhatsApp', 'IndiaMART', 'Walk-in', 'Event', 'Other'])}${entitySelect('Status', 'status', fieldValue('status', 'New'), ['New', 'Contacted', 'Qualified', 'Unqualified'])}</div>
      <div class="form-row">${entityInput('Owner', 'owner', fieldValue('owner', teamName))}${entityInput('Added date', 'date', fieldValue('date', 'Today'))}</div>
      ${entityTextarea('Requirement', 'requirement', fieldValue('requirement'))}`;
  } else if (type === 'customer') {
    fields = `<div class="form-row">${entityInput('Full name <span>*</span>', 'name', fieldValue('name'), 'text', 'required')}${entityInput('Company', 'company', fieldValue('company'))}</div>
      <div class="form-row">${entityInput('Email address', 'email', fieldValue('email'), 'email')}${entityInput('Phone number', 'phone', fieldValue('phone'), 'tel')}</div>
      <div class="form-row">${entitySelect('Status', 'status', fieldValue('status', 'Customer'), ['Customer', 'Prospect'])}${entityInput('Owner', 'owner', fieldValue('owner', teamName))}</div>`;
  } else if (type === 'product') {
    fields = `<div class="form-row">${entityInput('Product name <span>*</span>', 'name', fieldValue('name'), 'text', 'required')}${entityInput('SKU <span>*</span>', 'sku', fieldValue('sku'), 'text', 'required')}</div>
      ${entityTextarea('Description', 'description', fieldValue('description'))}
      <div class="form-row">${entityInput('Price (INR) <span>*</span>', 'price', fieldValue('price'), 'number', 'min="0" step="0.01" required')}${entityInput('Stock quantity <span>*</span>', 'stock', fieldValue('stock', 0), 'number', 'min="0" step="1" required')}</div>`;
  } else if (type === 'deal') {
    fields = `${entityInput('Deal name <span>*</span>', 'title', fieldValue('title'), 'text', 'required')}
      <div class="form-row">${entityInput('Customer or company <span>*</span>', 'company', fieldValue('company'), 'text', 'required')}${entityInput('Deal value (INR) <span>*</span>', 'value', fieldValue('value'), 'number', 'min="1" step="1" required')}</div>
      <div class="form-row">${entitySelect('Pipeline stage', 'stage', fieldValue('stage', 'New'), ['New', 'Qualified', 'Meeting / Demo', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'])}${entityInput('Expected close', 'close', fieldValue('close'), editing ? 'text' : 'date', 'required')}</div>
      <div class="form-row">${entityInput('Owner', 'owner', fieldValue('owner', teamName))}${entityInput('Loss reason', 'lossReason', fieldValue('lossReason'))}</div>`;
  } else {
    fields = `${entityInput('Task name <span>*</span>', 'title', fieldValue('title'), 'text', 'required')}
      <div class="form-row">${entitySelect('Type', 'type', fieldValue('type', 'Call'), ['Call', 'Meeting', 'Visit', 'Email', 'WhatsApp', 'Demo', 'Other'])}${entityInput('Customer or deal', 'person', fieldValue('person'))}</div>
      ${editing
        ? `${entityInput('Due date and time', 'time', fieldValue('time'), 'text', 'required')}<div class="form-check-row">${entityCheckbox('Overdue', 'overdue', record.overdue)}${entityCheckbox('Completed', 'done', record.done)}</div>`
        : `<div class="form-row">${entityInput('Due date <span>*</span>', 'date', '', 'date', 'required')}${entityInput('Time <span>*</span>', 'time', '10:00', 'time', 'required')}</div>`}`;
  }
  document.querySelector('#entity-modal-eyebrow').textContent = editing ? `EDIT ${label.toUpperCase()}` : `NEW ${label.toUpperCase()}`;
  document.querySelector('#entity-modal-title').textContent = `${editing ? 'Edit' : 'Add'} ${label}`;
  document.querySelector('#entity-modal-intro').textContent = editing ? `Update the ${label} details.` : `Enter the details for this ${label}.`;
  document.querySelector('#entity-submit').textContent = editing ? 'Save changes' : `Add ${label}`;
  document.querySelector('#entity-fields').innerHTML = fields;
  modal.dataset.entityType = type;
  modal.dataset.recordId = record ? record.id : '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => modal.querySelector('input:not([type="checkbox"]), textarea').focus(), 0);
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
  if (action.dataset.action === 'add-customer') openEntityModal('customer');
  if (action.dataset.action === 'add-product') openEntityModal('product');
  if (action.dataset.action === 'add-deal') openEntityModal('deal');
  if (action.dataset.action === 'add-task') openEntityModal('task');
  if (action.dataset.action === 'edit-record') openEntityModal(action.dataset.type, action.dataset.id);
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
  const phoneDigits = phone.replace(/\D/g, '');
  const duplicate = leads.find((lead) => (
    (phoneDigits && String(lead.phone || '').replace(/\D/g, '') === phoneDigits) ||
    (email && String(lead.email || '').toLowerCase() === email.toLowerCase())
  ));
  if (duplicate) {
    showToast(`A lead with this ${String(duplicate.phone || '').replace(/\D/g, '') === phoneDigits ? 'phone number' : 'email'} already exists.`);
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
  const modal = document.querySelector('#entity-modal');
  const type = modal.dataset.entityType;
  const recordId = modal.dataset.recordId;
  const isEditing = Boolean(recordId);
  const collection = { lead: leads, customer: customers, deal: deals, task: tasks, product: products }[type];
  const record = isEditing ? collection.find((item) => String(item.id) === recordId) : null;
  if (isEditing && !record) {
    showToast('This record could not be found.');
    return;
  }
  const value = (name) => String(data.get(name) || '').trim();
  const save = (list, fields) => {
    if (record) Object.assign(record, fields);
    else list.unshift({ id: Date.now(), ...fields });
  };
  if (type === 'lead') {
    const name = value('name');
    const phone = value('phone');
    const email = value('email');
    const phoneDigits = phone.replace(/\D/g, '');
    const duplicate = leads.find((lead) => lead.id !== record?.id && (
      (phoneDigits && String(lead.phone || '').replace(/\D/g, '') === phoneDigits) ||
      (email && String(lead.email || '').toLowerCase() === email.toLowerCase())
    ));
    if (duplicate) {
      showToast(`A lead with this ${String(duplicate.phone || '').replace(/\D/g, '') === phoneDigits ? 'phone number' : 'email'} already exists.`);
      return;
    }
    save(leads, {
      name, initials: initialsFor(name), phone, email, company: value('company'),
      source: value('source'), status: value('status'), owner: value('owner'),
      date: value('date'), requirement: value('requirement')
    });
  } else if (type === 'customer') {
    const name = value('name');
    save(customers, {
      name, initials: initialsFor(name), company: value('company'), email: value('email'),
      phone: value('phone'), status: value('status'), owner: value('owner')
    });
  } else if (type === 'product') {
    const sku = value('sku');
    const duplicate = products.find((product) => product.id !== record?.id && String(product.sku || '').toLowerCase() === sku.toLowerCase());
    if (duplicate) {
      showToast('A product with this SKU already exists.');
      return;
    }
    save(products, {
      name: value('name'), sku, description: value('description'),
      price: Number(data.get('price')), stock: Number(data.get('stock'))
    });
  } else if (type === 'task' && isEditing) {
    save(tasks, {
      title: value('title'), type: value('type'), person: value('person') || 'No customer linked',
      time: value('time'), overdue: data.get('overdue') === 'on', done: data.get('done') === 'on'
    });
  } else if (type === 'task') {
    const date = value('date');
    const time = value('time');
    const today = new Date();
    const due = new Date(`${date}T${time}`);
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dateLabel = date === localToday ? 'Today' : new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    save(tasks, { title: value('title'), person: value('person') || 'No customer linked', type: value('type'), time: `${dateLabel} · ${time}`, overdue: due < today, done: false });
  } else if (type === 'deal') {
    const stage = value('stage');
    const lossReason = value('lossReason');
    if (stage === 'Lost' && !lossReason) {
      showToast('Add a loss reason before saving a lost deal.');
      return;
    }
    const close = value('close');
    save(deals, {
      title: value('title'), company: value('company'), value: Number(data.get('value')),
      stage, owner: value('owner'), close: isEditing ? close : new Date(`${close}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      lossReason
    });
  } else {
    showToast('This record type cannot be saved.');
    return;
  }
  persist();
  closeEntityModal();
  renderAll();
  showToast(`${isEditing ? 'Changes saved for this' : 'Added'} ${type}.`);
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
