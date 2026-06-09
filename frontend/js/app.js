const API = "http://localhost:3000/api";

const state = {
  token: localStorage.getItem("patafeliz_token"),
  user: JSON.parse(localStorage.getItem("patafeliz_user") || "null"),
  view: "dashboard",
  calendarDate: new Date(),
  selectedAppointment: null,
  selectedAnimal: null,
  selectedClient: null,
  editingAnimal: null,
  editingClient: null,
  editingVet: null,
  editingProcedure: null,
  profile: null,
  showProfile: false,
  showNotifications: false,
  agendaFilters: {
    veterinarian: "",
    day: "",
    status: ""
  },
  searchQuery: "",
  data: {
    dashboard: null,
    clientes: [],
    animais: [],
    veterinarios: [],
    procedimentos: [],
    atendimentos: [],
    prontuarios: [],
    lembretes: []
  }
};

const app = document.getElementById("app");

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${state.token}`
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(state.token ? authHeaders() : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.erro || body.detalhes || "Erro na requisicao");
  }

  return body;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function dateOnly(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR");
}

function searchMatch(record, query, fields) {
  if (!query) return true;
  const text = fields.map(field => String(record[field] || "")).join(" ").toLowerCase();
  return text.includes(query);
}

function filterList(items, query, fields) {
  if (!query) return items;
  const normalized = query.trim().toLowerCase();
  return items.filter(item => searchMatch(item, normalized, fields));
}

function timeOnly(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(status) {
  const labels = {
    aguardando_confirmacao: "Aguardando confirmacao",
    confirmado: "Confirmado",
    cancelado: "Cancelado",
    realizado: "Realizado",
    finalizado: "Finalizado",
    nao_compareceu: "Nao compareceu"
  };
  return labels[status] || status;
}

function roleLabel(role) {
  return {
    admin: "Administrador",
    veterinario: "Veterinario",
    cliente: "Tutor"
  }[role] || role;
}

function initials(name) {
  return (name || "PF")
    .split(" ")
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

function canSee(view) {
  const role = state.user?.tipo_usuario;
  const permissions = {
    dashboard: ["admin", "veterinario", "cliente"],
    agenda: ["admin", "veterinario", "cliente"],
    animais: ["admin", "veterinario", "cliente"],
    clientes: ["admin", "veterinario"],
    veterinarios: ["admin", "cliente"],
    procedimentos: ["admin", "veterinario", "cliente"],
    prontuarios: ["admin", "veterinario", "cliente"],
    lembretes: ["admin", "veterinario", "cliente"],
    relatorios: ["admin", "veterinario"]
  };

  return permissions[view]?.includes(role);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.target);

  try {
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        login: form.get("login"),
        senha: form.get("senha")
      })
    });

    state.token = result.token;
    state.user = result.usuario;
    localStorage.setItem("patafeliz_token", state.token);
    localStorage.setItem("patafeliz_user", JSON.stringify(state.user));
    state.view = "dashboard";
    await loadAll();
    render();
  } catch (error) {
    alert(error.message);
  }
}

function logout() {
  localStorage.removeItem("patafeliz_token");
  localStorage.removeItem("patafeliz_user");
  state.token = null;
  state.user = null;
  state.view = "dashboard";
  renderLogin();
}

async function loadAll() {
  if (!state.token) return;

  const tasks = [
    api("/dashboard").then(data => state.data.dashboard = data),
    api("/animais").then(data => state.data.animais = data),
    api("/veterinarios").then(data => state.data.veterinarios = data),
    api("/procedimentos").then(data => state.data.procedimentos = data),
    api("/atendimentos").then(data => state.data.atendimentos = data),
    api("/prontuarios").then(data => state.data.prontuarios = data)
  ];

  if (["admin", "veterinario"].includes(state.user.tipo_usuario)) {
    tasks.push(api("/clientes").then(data => state.data.clientes = data));
  }

  if (["admin", "veterinario", "cliente"].includes(state.user.tipo_usuario)) {
    tasks.push(api("/lembretes").then(data => state.data.lembretes = data));
  }

  await Promise.all(tasks);
}

function navItems() {
  return [
    ["dashboard", "Dashboard"],
    ["agenda", "Agenda"],
    ["animais", "Animais"],
    ["clientes", "Clientes"],
    ["veterinarios", "Veterinarios"],
    ["procedimentos", "Procedimentos"],
    ["prontuarios", "Prontuarios"],
    ["lembretes", "Lembretes"],
    ["relatorios", "Relatorios"]
  ].filter(([id]) => canSee(id));
}

function setView(view) {
  state.view = view;
  render();
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-panel">
        <div class="brand-mark">PF</div>
        <h1>Pata Feliz</h1>
        <p>Portal da clinica veterinaria</p>

        <form onsubmit="handleLogin(event)" class="login-form">
          <label>Login</label>
          <input class="form-control" name="login" value="admin@patafeliz.local" required />

          <label>Senha</label>
          <input class="form-control" name="senha" type="password" value="123456" required />

          <button class="btn-primary-app" type="submit">Entrar</button>
        </form>

        <div class="login-help">
          <strong>Usuarios de teste</strong>
          <span>admin@patafeliz.local</span>
          <span>ana.ribeiro@patafeliz.local</span>
          <span>mariana.costa@email.local</span>
          <span>Senha: 123456</span>
        </div>
      </section>
      <section class="login-art">
        <div>
          <span class="eyebrow">Agenda, prontuarios e vacinas</span>
          <h2>Cuidado organizado para tutores, veterinarios e administracao.</h2>
        </div>
      </section>
    </main>
  `;
}

function render() {
  if (!state.token || !state.user) {
    renderLogin();
    return;
  }

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <button class="brand profile-brand" onclick="openProfile()" type="button">
          <div class="brand-mark small">PF</div>
          <div>
            <strong>${state.user.nome}</strong>
            <span>${roleLabel(state.user.tipo_usuario)}</span>
          </div>
        </button>
        <nav>
          ${navItems().map(([id, label]) => `
            <button class="${state.view === id ? "active" : ""}" onclick="setView('${id}')">${label}</button>
          `).join("")}
        </nav>
        <footer class="clinic-info">
          <strong>Clínica Veterinária Pata Feliz Ltda.</strong>
          <span>CNPJ: 12.345.678/0001-90</span>
          <span>Rua da Glória, 245, Centro</span>
          <span>Diamantina - MG, 39100-000</span>
          <span>(38) 3531-2045</span>
          <span>contato@patafelizvet.com.br</span>
        </footer>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div>
            <h1>${navItems().find(([id]) => id === state.view)?.[1] || "Pata Feliz"}</h1>
            <p>${state.user.nome} - ${roleLabel(state.user.tipo_usuario)}</p>
          </div>
          <div class="profile">
            ${renderNotificationButton()}
            <div class="avatar">${initials(state.user.nome)}</div>
            <button class="btn-ghost" onclick="logout()">Sair</button>
          </div>
        </header>
        <section class="content">
          ${renderPageToolbar()}
          ${renderView()}
        </section>
        ${renderProfileModal()}
      </main>
    </div>
  `;
}

async function openProfile() {
  try {
    state.profile = await api("/perfil");
    state.showProfile = true;
    render();
  } catch (error) {
    alert(error.message);
  }
}

function closeProfile() {
  state.showProfile = false;
  state.profile = null;
  render();
}

function renderProfileModal() {
  if (!state.showProfile || !state.profile) return "";
  const p = state.profile;
  const isTutor = state.user.tipo_usuario === "cliente";
  const isVet = state.user.tipo_usuario === "veterinario";

  return `
    <div class="modal-backdrop-app" onclick="closeProfile()">
      <article class="appointment-modal" onclick="event.stopPropagation()">
        <div class="modal-title">
          <div>
            <span class="eyebrow-dark">Meu perfil</span>
            <h2>${p.nome}</h2>
          </div>
          <button class="btn-ghost" onclick="closeProfile()">Fechar</button>
        </div>

        <form class="form-grid" onsubmit="saveProfile(event)">
          <label>Nome<input name="nome" class="form-control" value="${p.nome || ""}" required /></label>
          <label>Email<input name="email" type="email" class="form-control" value="${p.email || ""}" required /></label>
          <label>CPF<input name="cpf" class="form-control" value="${p.cpf || ""}" /></label>
          ${isTutor ? `
            <label>Telefone<input name="telefone" class="form-control" value="${p.telefone || ""}" /></label>
            <label>Telefone secundario<input name="telefone_secundario" class="form-control" value="${p.telefone_secundario || ""}" /></label>
            <label>Rua<input name="rua" class="form-control" value="${p.rua || ""}" /></label>
            <label>Numero<input name="numero" class="form-control" value="${p.numero || ""}" /></label>
            <label>Bairro<input name="bairro" class="form-control" value="${p.bairro || ""}" /></label>
            <label>Cidade<input name="cidade" class="form-control" value="${p.cidade || ""}" /></label>
            <label>Estado<input name="estado" class="form-control" value="${p.estado || ""}" /></label>
            <label>CEP<input name="cep" class="form-control" value="${p.cep || ""}" /></label>
          ` : ""}
          ${isVet ? `
            <label>Telefone<input name="telefone" class="form-control" value="${p.telefone || ""}" /></label>
            <label>Especialidade<input name="especialidade" class="form-control" value="${p.especialidade || ""}" /></label>
            <label>CRMV<input class="form-control" value="${p.crmv || ""}" disabled /></label>
          ` : ""}
          <button class="btn-primary-app" type="submit">Salvar perfil</button>
        </form>
      </article>
    </div>
  `;
}

async function saveProfile(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());

  try {
    const result = await api("/perfil", {
      method: "PUT",
      body: JSON.stringify(data)
    });

    state.token = result.token;
    state.user = result.usuario;
    localStorage.setItem("patafeliz_token", state.token);
    localStorage.setItem("patafeliz_user", JSON.stringify(state.user));
    state.showProfile = false;
    state.profile = null;
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderView() {
  if (!canSee(state.view)) {
    state.view = "dashboard";
  }

  return {
    dashboard: renderDashboard,
    agenda: renderAgenda,
    animais: renderAnimais,
    clientes: renderClientes,
    veterinarios: renderVeterinarios,
    procedimentos: renderProcedimentos,
    prontuarios: renderProntuarios,
    lembretes: renderLembretes,
    relatorios: renderRelatorios
  }[state.view]();
}

function renderNotificationButton() {
  if (!["admin", "veterinario", "cliente"].includes(state.user.tipo_usuario)) return "";

  const pending = state.data.lembretes.filter(item => ["pendente", "em_contato"].includes(item.status));
  const high = pending.filter(item => item.prioridade === "alta").length;

  return `
    <div class="notifications">
      <button class="notification-button" onclick="toggleNotifications()" type="button" title="Notificacoes">
        <span class="bell">!</span>
        ${pending.length ? `<strong>${pending.length}</strong>` : ""}
      </button>
      ${state.showNotifications ? `
        <div class="notification-menu">
          <div class="notification-head">
            <div>
              <h3>Notificacoes</h3>
              <span>${pending.length} pendentes${high ? `, ${high} urgentes` : ""}</span>
            </div>
            <button class="btn-mini" onclick="setView('lembretes'); state.showNotifications=false; render()">Ver todos</button>
          </div>
          <div class="notification-list">
            ${pending.slice(0, 6).map(item => `
              <article class="notification-item ${item.prioridade}">
                <div>
                  <strong>${item.titulo}</strong>
                  <span>${dateOnly(item.data_prevista)}${item.animal ? ` - ${item.animal}` : ""}</span>
                </div>
                <div class="notification-actions">
                  ${state.user.tipo_usuario === "cliente" ? "" : `
                    <button onclick="setReminderStatus(${item.id_lembrete}, 'resolvido')">Resolver</button>
                    <button onclick="setReminderStatus(${item.id_lembrete}, 'ignorado')">Ignorar</button>
                  `}
                  <button onclick="deleteReminder(${item.id_lembrete})">Excluir</button>
                </div>
              </article>
            `).join("") || `<p class="empty">Nenhuma notificacao pendente.</p>`}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function toggleNotifications() {
  state.showNotifications = !state.showNotifications;
  render();
}

function setSearchQuery(value) {
  state.searchQuery = value;
  render();
}

function renderPageToolbar() {
  const searchableViews = ["agenda", "animais", "clientes", "veterinarios", "procedimentos", "prontuarios", "lembretes"];
  if (!searchableViews.includes(state.view)) return "";

  const placeholders = {
    agenda: "Buscar por animal, procedimento ou médico...",
    animais: "Buscar por nome, tutor ou espécie...",
    clientes: "Buscar por tutor, email ou cidade...",
    veterinarios: "Buscar por nome, especialidade ou CRMV...",
    procedimentos: "Buscar por procedimento ou tipo...",
    prontuarios: "Buscar por animal, médico ou diagnóstico...",
    lembretes: "Buscar por título, animal ou tutor..."
  };

  return `
    <div class="list-toolbar">
      <div class="search-field">
        <label>Buscar</label>
        <input
          class="search-input"
          type="search"
          placeholder="${placeholders[state.view] || "Buscar..."}"
          value="${state.searchQuery}"
          oninput="setSearchQuery(this.value)"
        />
      </div>
      ${state.view === "agenda" ? `<button class="btn-ghost" type="button" onclick="clearAgendaFilters()">Limpar filtros</button>` : ""}
    </div>
  `;
}

function renderDashboard() {
  const dash = state.data.dashboard || {};
  const totais = dash.totais || {};

  if (state.user.tipo_usuario === "cliente") {
    return `
      <div class="metric-grid two">
        ${metric("Animais", totais.animais || 0)}
        ${metric("Atendimentos", totais.atendimentos || 0)}
      </div>
      ${panel("Proximos atendimentos", table(["Data", "Animal", "Veterinario", "Procedimento", "Status"], (dash.proximos || []).map(item => [
        dateTime(item.inicio),
        item.animal,
        item.veterinario,
        item.procedimento,
        statusLabel(item.status)
      ])))}
    `;
  }

  if (state.user.tipo_usuario === "veterinario") {
    return `
      <div class="metric-grid two">
        ${metric("Atendimentos hoje", totais.atendimentos_hoje || 0)}
        ${metric("Agenda carregada", (dash.agenda || []).length)}
      </div>
      ${panel("Minha agenda", table(["Data", "Animal", "Tutor", "Procedimento", "Status"], (dash.agenda || []).map(item => [
        dateTime(item.inicio),
        item.animal,
        item.tutor,
        item.procedimento,
        statusLabel(item.status)
      ])))}
    `;
  }

  return `
    <div class="metric-grid">
      ${metric("Clientes", totais.clientes || 0)}
      ${metric("Animais", totais.animais || 0)}
      ${metric("Veterinarios", totais.veterinarios || 0)}
      ${metric("Atendimentos", totais.atendimentos || 0)}
      ${metric("Lembretes", totais.lembretes || 0)}
    </div>
    ${panel("Agenda recente e proxima", table(["Data", "Animal", "Tutor", "Veterinario", "Procedimento", "Status"], (dash.agenda || []).map(item => [
      dateTime(item.inicio),
      item.animal,
      item.tutor,
      item.veterinario,
      item.procedimento,
      statusLabel(item.status)
    ])))}
  `;
}

function metric(label, value) {
  return `
    <article class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function panel(title, content) {
  return `
    <section class="panel">
      <div class="panel-title"><h2>${title}</h2></div>
      ${content}
    </section>
  `;
}

function table(headers, rows) {
  if (!rows.length) return `<p class="empty">Nenhum registro encontrado.</p>`;

  return `
    <div class="table-responsive">
      <table class="table align-middle">
        <thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ""}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAgenda() {
  return `
    ${renderAgendaFilters()}
    ${renderAppointmentForm()}
    ${renderCalendar()}
    ${renderAppointmentDetails()}
  `;
}

function filteredAppointments() {
  const query = state.searchQuery.trim().toLowerCase();
  return state.data.atendimentos.filter(item => {
    const byVet = !state.agendaFilters.veterinarian || Number(item.id_veterinario) === Number(state.agendaFilters.veterinarian);
    const byDay = !state.agendaFilters.day || new Date(item.inicio).toISOString().slice(0, 10) === state.agendaFilters.day;
    const byStatus = !state.agendaFilters.status || item.status === state.agendaFilters.status;
    const matches = !query || [item.animal, item.veterinario, item.procedimento, statusLabel(item.status)].some(value => String(value || "").toLowerCase().includes(query));
    return byVet && byDay && byStatus && matches;
  });
}

function renderAgendaFilters() {
  if (state.user.tipo_usuario !== "admin") return "";

  return panel("Filtros da agenda", `
    <div class="filter-grid">
      <label>Veterinario
        <select class="form-control" onchange="setAgendaFilter('veterinarian', this.value)">
          <option value="">Todos</option>
          ${state.data.veterinarios.map(v => `
            <option value="${v.id_veterinario}" ${String(state.agendaFilters.veterinarian) === String(v.id_veterinario) ? "selected" : ""}>${v.nome}</option>
          `).join("")}
        </select>
      </label>
      <label>Dia
        <input class="form-control" type="date" value="${state.agendaFilters.day}" onchange="setAgendaFilter('day', this.value)" />
      </label>
      <label>Status
        <select class="form-control" onchange="setAgendaFilter('status', this.value)">
          <option value="">Todos</option>
          ${["aguardando_confirmacao", "confirmado", "cancelado", "realizado", "finalizado", "nao_compareceu"].map(status => `
            <option value="${status}" ${state.agendaFilters.status === status ? "selected" : ""}>${statusLabel(status)}</option>
          `).join("")}
        </select>
      </label>
      <button class="btn-ghost" type="button" onclick="clearAgendaFilters()">Limpar filtros</button>
    </div>
  `);
}

function setAgendaFilter(key, value) {
  state.agendaFilters[key] = value;

  if (key === "day" && value) {
    state.calendarDate = new Date(`${value}T12:00:00`);
  }

  render();
}

function clearAgendaFilters() {
  state.agendaFilters = { veterinarian: "", day: "" };
  render();
}

function renderCalendar() {
  const current = new Date(state.calendarDate);
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));

  const monthLabel = current.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });

  return panel("Calendario de atendimentos", `
    <div class="calendar-toolbar">
      <button class="btn-ghost" onclick="moveCalendar(-1)">Mes anterior</button>
      <strong>${monthLabel}</strong>
      <button class="btn-ghost" onclick="moveCalendar(1)">Proximo mes</button>
    </div>
    <div class="calendar-grid">
      ${["Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sab.", "Dom."].map(day => `<div class="calendar-head">${day}</div>`).join("")}
      ${days.map(day => renderCalendarDay(day, month)).join("")}
    </div>
  `);
}

function renderCalendarDay(day, activeMonth) {
  const key = day.toISOString().slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const events = filteredAppointments()
    .filter(item => new Date(item.inicio).toISOString().slice(0, 10) === key)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  return `
    <div class="calendar-cell ${day.getMonth() !== activeMonth ? "muted" : ""} ${key === todayKey ? "today" : ""}">
      <div class="calendar-date">${day.getDate()}</div>
      <div class="calendar-events">
        ${events.map(event => `
          <button class="calendar-event ${event.status}" onclick="openAppointment(${event.id_atendimento})">
            <span>${timeOnly(event.inicio)}</span>
            ${event.animal} - ${event.procedimento}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function moveCalendar(direction) {
  const next = new Date(state.calendarDate);
  next.setMonth(next.getMonth() + direction);
  state.calendarDate = next;
  render();
}

function openAppointment(id) {
  state.selectedAppointment = state.data.atendimentos.find(item => Number(item.id_atendimento) === Number(id));
  render();
}

function openAnimalFromAppointment(id) {
  const appointment = state.selectedAppointment;
  state.selectedAnimal = state.data.animais.find(item => Number(item.id_animal) === Number(id));
  state.selectedAppointment = appointment;
  render();
}

function openClientFromAppointment(id) {
  const appointment = state.selectedAppointment;
  state.selectedClient = state.data.clientes.find(item => Number(item.id_cliente) === Number(id));
  state.selectedAppointment = appointment;
  render();
}

function closeAppointment() {
  state.selectedAppointment = null;
  render();
}

function renderAppointmentDetails() {
  const item = state.selectedAppointment;
  if (!item) return "";

  let actions = "";
  if (["admin", "veterinario"].includes(state.user.tipo_usuario)) {
    actions = `
      <button class="btn-mini" onclick="changeStatus(${item.id_atendimento}, 'confirmado')">Confirmar</button>
      <button class="btn-mini" onclick="changeStatus(${item.id_atendimento}, 'realizado')">Marcar realizada</button>
      <button class="btn-mini" onclick="changeStatus(${item.id_atendimento}, 'finalizado')">Finalizar</button>
      <button class="btn-mini danger" onclick="cancelByStaff(${item.id_atendimento})">Cancelar</button>
    `;
  } else if (!["cancelado", "finalizado"].includes(item.status)) {
    actions = `<button class="btn-mini danger" onclick="cancelByClient(${item.id_atendimento})">Cancelar consulta</button>`;
  }

  return `
    <div class="modal-backdrop-app" onclick="closeAppointment()">
      <article class="appointment-modal" onclick="event.stopPropagation()">
        <div class="modal-title">
          <div>
            <span class="eyebrow-dark">${statusLabel(item.status)}</span>
            <h2>${item.animal}</h2>
          </div>
          <button class="btn-ghost" onclick="closeAppointment()">Fechar</button>
        </div>
        <div class="detail-grid">
          <div><span>Data e horario</span><strong>${dateTime(item.inicio)} ate ${timeOnly(item.fim)}</strong></div>
          <div><span>Procedimento</span><strong>${item.procedimento}</strong></div>
          <div><span>Animal</span><strong>${canOpenLinkedDetails() ? `<button class="link-button" onclick="openAnimalFromAppointment(${item.id_animal})">${item.animal}</button>` : item.animal}</strong></div>
          <div><span>Tutor</span><strong>${canOpenLinkedDetails() ? `<button class="link-button" onclick="openClientFromAppointment(${item.id_cliente})">${item.tutor}</button>` : item.tutor}</strong></div>
          <div><span>Veterinario</span><strong>${item.veterinario}</strong></div>
          <div><span>Valor</span><strong>${money(item.valor_total)}</strong></div>
          <div><span>Tipo</span><strong>${item.tipo_procedimento}</strong></div>
        </div>
        ${renderAppointmentValueForm(item)}
        ${actions ? `<div class="modal-actions">${actions}</div>` : ""}
      </article>
    </div>
    ${renderClientDetails()}
    ${renderAnimalDetails()}
  `;
}

function renderAppointmentValueForm(item) {
  if (!["admin", "veterinario"].includes(state.user.tipo_usuario)) return "";

  return `
    <form class="value-form" onsubmit="saveAppointmentValues(event, ${item.id_atendimento})">
      <div class="value-row">
        <label>Valor base
          <input class="form-control" value="${Number(item.valor_base || 0).toFixed(2)}" disabled />
        </label>
        <label>Valor adicional
          <input name="valor_adicional" class="form-control" type="number" step="0.01" min="0" value="${Number(item.valor_adicional || 0).toFixed(2)}" />
        </label>
        <label>Total
          <input class="form-control" value="${Number(item.valor_total || 0).toFixed(2)}" disabled />
        </label>
      </div>
      <label>Observacoes do atendimento
        <input name="observacoes" class="form-control" value="${item.observacoes || ""}" />
      </label>
      <button class="btn-primary-app" type="submit">Salvar valores</button>
    </form>
  `;
}

async function saveAppointmentValues(event, id) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());

  try {
    await api(`/atendimentos/${id}/valores`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    state.selectedAppointment = null;
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function canOpenLinkedDetails() {
  return ["admin", "veterinario"].includes(state.user.tipo_usuario);
}

async function cancelByStaff(id) {
  const motivo = prompt("Motivo do cancelamento:");
  if (motivo === null) return;

  try {
    await api(`/atendimentos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelado", motivo })
    });
    state.selectedAppointment = null;
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderAppointmentForm() {
  const animalOptions = state.data.animais.map(a => `<option value="${a.id_animal}">${a.nome} - ${a.tutor}</option>`).join("");
  const vetOptions = state.data.veterinarios.map(v => `<option value="${v.id_veterinario}">${v.nome}</option>`).join("");
  const procOptions = state.data.procedimentos.map(p => `<option value="${p.id_procedimento}">${p.nome} - ${p.duracao_padrao_minutos} min - ${money(p.preco_base)}</option>`).join("");

  return panel("Novo agendamento", `
    <form class="form-grid" onsubmit="saveAppointment(event)">
      <label>Animal<select name="id_animal" class="form-control" required>${animalOptions}</select></label>
      <label>Veterinario<select name="id_veterinario" class="form-control" required>${vetOptions}</select></label>
      <label>Procedimento<select name="id_procedimento" class="form-control" required>${procOptions}</select></label>
      <label>Data<input name="data" type="date" class="form-control" required /></label>
      <label>Hora<input name="hora" type="time" class="form-control" required /></label>
      <label>Observacoes<input name="observacoes" class="form-control" /></label>
      <button class="btn-primary-app" type="submit">Agendar</button>
    </form>
  `);
}

async function saveAppointment(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());

  try {
    await api("/atendimentos", { method: "POST", body: JSON.stringify(data) });
    event.target.reset();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function changeStatus(id, status) {
  try {
    await api(`/atendimentos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function cancelByClient(id) {
  const motivo = prompt("Motivo do cancelamento:");
  if (motivo === null) return;

  try {
    await api(`/atendimentos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelado", motivo })
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderAnimais() {
  const animais = filterList(state.data.animais, state.searchQuery, ["nome", "especie", "raca", "cor", "tutor"]);
  const rows = animais.map(a => [
    `<button class="link-button" onclick="openAnimal(${a.id_animal})">${a.nome}</button>`,
    a.especie,
    a.raca || "",
    a.cor || "",
    a.sexo || "",
    a.tutor || "",
    a.peso_kg ? `${a.peso_kg} kg` : "",
    state.user.tipo_usuario === "admin" ? `<button class="btn-mini" onclick="editAnimal(${a.id_animal})">Editar</button>` : ""
  ]);

  return `
    ${renderAnimalForm()}
    ${panel("Animais cadastrados", table(["Nome", "Especie", "Raca", "Cor", "Sexo", "Tutor", "Peso", "Acoes"], rows))}
    ${renderAnimalDetails()}
  `;
}

function openAnimal(id) {
  state.selectedAnimal = state.data.animais.find(item => Number(item.id_animal) === Number(id));
  render();
}

function closeAnimal() {
  state.selectedAnimal = null;
  render();
}

function formDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function renderAnimalDetails() {
  const animal = state.selectedAnimal;
  if (!animal) return "";

  const appointments = state.data.atendimentos
    .filter(item => Number(item.id_animal) === Number(animal.id_animal))
    .sort((a, b) => new Date(b.inicio) - new Date(a.inicio));

  const records = state.data.prontuarios
    .filter(item => Number(item.id_animal) === Number(animal.id_animal))
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

  return `
    <div class="modal-backdrop-app" onclick="closeAnimal()">
      <article class="animal-modal" onclick="event.stopPropagation()">
        <div class="modal-title">
          <div>
            <span class="eyebrow-dark">${animal.especie}</span>
            <h2>${animal.nome}</h2>
          </div>
          <button class="btn-ghost" onclick="closeAnimal()">Fechar</button>
        </div>

        <div class="detail-grid">
          <div><span>Tutor</span><strong>${animal.tutor || ""}</strong></div>
          <div><span>Contato</span><strong>${animal.telefone_tutor || "Nao informado"}</strong></div>
          <div><span>Raca</span><strong>${animal.raca || "Nao informada"}</strong></div>
          <div><span>Cor</span><strong>${animal.cor || "Nao informada"}</strong></div>
          <div><span>Sexo</span><strong>${animal.sexo || "Nao informado"}</strong></div>
          <div><span>Nascimento</span><strong>${animal.data_nascimento ? dateOnly(animal.data_nascimento) : "Nao informado"}</strong></div>
          <div><span>Peso</span><strong>${animal.peso_kg ? `${animal.peso_kg} kg` : "Nao informado"}</strong></div>
          <div><span>Castrado</span><strong>${animal.castrado === null || animal.castrado === undefined ? "Nao informado" : animal.castrado ? "Sim" : "Nao"}</strong></div>
          <div><span>Alergias</span><strong>${animal.alergias || "Nenhuma registrada"}</strong></div>
        </div>

        <div class="animal-section">
          <h3>Atendimentos</h3>
          ${table(["Data", "Veterinario", "Procedimento", "Status", "Valor"], appointments.map(item => [
            dateTime(item.inicio),
            item.veterinario,
            item.procedimento,
            statusLabel(item.status),
            money(item.valor_total)
          ]))}
        </div>

        <div class="animal-section">
          <h3>Prontuarios</h3>
          ${table(["Data", "Veterinario", "Procedimento", "Diagnostico", "Prescricao"], records.map(item => [
            dateTime(item.inicio),
            item.veterinario,
            item.procedimento,
            item.diagnostico || "",
            item.prescricao || item.medicacao || ""
          ]))}
        </div>
      </article>
    </div>
  `;
}

function renderAnimalForm() {
  const animal = state.editingAnimal || {};
  const clientSelect = state.user.tipo_usuario === "cliente"
    ? ""
    : `<label>Tutor<select name="id_cliente" class="form-control" required>${state.data.clientes.map(c => `<option value="${c.id_cliente}" ${Number(animal.id_cliente) === Number(c.id_cliente) ? "selected" : ""}>${c.nome}</option>`).join("")}</select></label>`;

  return panel(state.editingAnimal ? "Editar animal" : "Cadastrar animal", `
    <form class="form-grid" onsubmit="saveAnimal(event)">
      ${clientSelect}
      <label>Nome<input name="nome" class="form-control" value="${animal.nome || ""}" required /></label>
      <label>Especie<select name="especie" class="form-control">
        ${["cao", "gato", "outro"].map(value => `<option value="${value}" ${animal.especie === value ? "selected" : ""}>${value}</option>`).join("")}
      </select></label>
      <label>Raca<input name="raca" class="form-control" value="${animal.raca || ""}" /></label>
      <label>Cor<input name="cor" class="form-control" value="${animal.cor || ""}" /></label>
      <label>Sexo<select name="sexo" class="form-control">
        ${["indefinido", "macho", "femea"].map(value => `<option value="${value}" ${animal.sexo === value ? "selected" : ""}>${value}</option>`).join("")}
      </select></label>
      <label>Nascimento<input name="data_nascimento" type="date" class="form-control" value="${formDate(animal.data_nascimento)}" /></label>
      <label>Peso kg<input name="peso_kg" type="number" step="0.01" class="form-control" value="${animal.peso_kg || ""}" /></label>
      <button class="btn-primary-app" type="submit">${state.editingAnimal ? "Atualizar animal" : "Salvar animal"}</button>
      ${state.editingAnimal ? `<button class="btn-ghost" type="button" onclick="cancelAnimalEdit()">Cancelar edicao</button>` : ""}
    </form>
  `);
}

async function saveAnimal(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  try {
    if (state.editingAnimal) {
      await api(`/animais/${state.editingAnimal.id_animal}`, { method: "PUT", body: JSON.stringify(data) });
      state.editingAnimal = null;
    } else {
      await api("/animais", { method: "POST", body: JSON.stringify(data) });
    }
    event.target.reset();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function editAnimal(id) {
  state.editingAnimal = state.data.animais.find(item => Number(item.id_animal) === Number(id));
  state.selectedAnimal = null;
  render();
}

function cancelAnimalEdit() {
  state.editingAnimal = null;
  render();
}

function renderClientes() {
  const clientes = filterList(state.data.clientes, state.searchQuery, ["nome", "email", "cidade", "telefone"]);
  const rows = clientes.map(c => [
    `<button class="link-button" onclick="openClient(${c.id_cliente})">${c.nome}</button>`,
    c.email,
    c.cpf,
    c.telefone || "",
    c.cidade || "",
    c.total_animais,
    state.user.tipo_usuario === "admin" ? `<button class="btn-mini" onclick="editClient(${c.id_cliente})">Editar</button>` : ""
  ]);

  return `
    ${state.user.tipo_usuario === "admin" ? renderClientForm() : ""}
    ${panel("Tutores", table(["Nome", "Email", "CPF", "Telefone", "Cidade", "Animais", "Acoes"], rows))}
    ${renderClientDetails()}
    ${renderAnimalDetails()}
  `;
}

function renderClientForm() {
  const client = state.editingClient || {};
  return panel(state.editingClient ? "Editar tutor" : "Cadastrar tutor", `
    <form class="form-grid" onsubmit="saveClient(event)">
      <label>Nome<input name="nome" class="form-control" value="${client.nome || ""}" required /></label>
      <label>Email<input name="email" type="email" class="form-control" value="${client.email || ""}" required /></label>
      <label>CPF<input name="cpf" class="form-control" value="${client.cpf || ""}" /></label>
      <label>Telefone<input name="telefone" class="form-control" value="${client.telefone || ""}" /></label>
      <label>Rua<input name="rua" class="form-control" value="${client.rua || ""}" /></label>
      <label>Numero<input name="numero" class="form-control" value="${client.numero || ""}" /></label>
      <label>Bairro<input name="bairro" class="form-control" value="${client.bairro || ""}" /></label>
      <label>Cidade<input name="cidade" class="form-control" value="${client.cidade || ""}" /></label>
      <label>Estado<input name="estado" class="form-control" value="${client.estado || ""}" /></label>
      ${state.editingClient ? "" : `<label>Senha inicial<input name="senha" class="form-control" value="123456" /></label>`}
      <button class="btn-primary-app" type="submit">${state.editingClient ? "Atualizar tutor" : "Salvar tutor"}</button>
      ${state.editingClient ? `<button class="btn-ghost" type="button" onclick="cancelClientEdit()">Cancelar edicao</button>` : ""}
    </form>
  `);
}

async function saveClient(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  try {
    if (state.editingClient) {
      await api(`/clientes/${state.editingClient.id_cliente}`, { method: "PUT", body: JSON.stringify(data) });
      state.editingClient = null;
    } else {
      await api("/clientes", { method: "POST", body: JSON.stringify(data) });
    }
    event.target.reset();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function editClient(id) {
  state.editingClient = state.data.clientes.find(item => Number(item.id_cliente) === Number(id));
  state.selectedClient = null;
  render();
}

function cancelClientEdit() {
  state.editingClient = null;
  render();
}

function openClient(id) {
  state.selectedClient = state.data.clientes.find(item => Number(item.id_cliente) === Number(id));
  render();
}

function closeClient() {
  state.selectedClient = null;
  render();
}

function renderClientDetails() {
  const client = state.selectedClient;
  if (!client) return "";

  const animals = state.data.animais.filter(item => Number(item.id_cliente) === Number(client.id_cliente));
  const appointments = state.data.atendimentos.filter(item => Number(item.id_cliente) === Number(client.id_cliente));

  return `
    <div class="modal-backdrop-app" onclick="closeClient()">
      <article class="animal-modal" onclick="event.stopPropagation()">
        <div class="modal-title">
          <div>
            <span class="eyebrow-dark">Tutor</span>
            <h2>${client.nome}</h2>
          </div>
          <button class="btn-ghost" onclick="closeClient()">Fechar</button>
        </div>

        <div class="detail-grid">
          <div><span>Email</span><strong>${client.email || "Nao informado"}</strong></div>
          <div><span>CPF</span><strong>${client.cpf || "Nao informado"}</strong></div>
          <div><span>Telefone</span><strong>${client.telefone || "Nao informado"}</strong></div>
          <div><span>Endereco</span><strong>${[client.rua, client.numero, client.bairro, client.cidade, client.estado].filter(Boolean).join(", ") || "Nao informado"}</strong></div>
        </div>

        <div class="animal-section">
          <h3>Animais do tutor</h3>
          ${table(["Nome", "Especie", "Raca", "Cor", "Peso"], animals.map(animal => [
            `<button class="link-button" onclick="closeClient(); openAnimal(${animal.id_animal})">${animal.nome}</button>`,
            animal.especie,
            animal.raca || "",
            animal.cor || "",
            animal.peso_kg ? `${animal.peso_kg} kg` : ""
          ]))}
        </div>

        <div class="animal-section">
          <h3>Consultas marcadas</h3>
          ${table(["Data", "Animal", "Veterinario", "Procedimento", "Status"], appointments.map(item => [
            dateTime(item.inicio),
            item.animal,
            item.veterinario,
            item.procedimento,
            statusLabel(item.status)
          ]))}
        </div>
      </article>
    </div>
  `;
}

function renderVeterinarios() {
  const veterinarios = filterList(state.data.veterinarios, state.searchQuery, ["nome", "email", "crmv", "especialidade"]);
  const rows = veterinarios.map(v => [
    v.nome,
    v.email,
    v.crmv,
    v.especialidade || "",
    v.telefone || "",
    state.user.tipo_usuario === "admin" ? `<button class="btn-mini" onclick="editVet(${v.id_veterinario})">Editar</button>` : ""
  ]);

  return `
    ${state.user.tipo_usuario === "admin" ? renderVetForm() : ""}
    ${panel("Equipe veterinaria", table(["Nome", "Email", "CRMV", "Especialidade", "Telefone", "Acoes"], rows))}
  `;
}

function renderVetForm() {
  const vet = state.editingVet;
  if (!vet) return "";

  return panel("Editar veterinario", `
    <form class="form-grid" onsubmit="saveVet(event)">
      <label>Nome<input name="nome" class="form-control" value="${vet.nome || ""}" required /></label>
      <label>Email<input name="email" type="email" class="form-control" value="${vet.email || ""}" required /></label>
      <label>CRMV<input name="crmv" class="form-control" value="${vet.crmv || ""}" required /></label>
      <label>Especialidade<input name="especialidade" class="form-control" value="${vet.especialidade || ""}" /></label>
      <label>Telefone<input name="telefone" class="form-control" value="${vet.telefone || ""}" /></label>
      <label>Carga horaria<input name="carga_horaria_semanal" type="number" class="form-control" value="${vet.carga_horaria_semanal || ""}" /></label>
      <button class="btn-primary-app" type="submit">Atualizar veterinario</button>
      <button class="btn-ghost" type="button" onclick="cancelVetEdit()">Cancelar edicao</button>
    </form>
  `);
}

function editVet(id) {
  state.editingVet = state.data.veterinarios.find(item => Number(item.id_veterinario) === Number(id));
  render();
}

function cancelVetEdit() {
  state.editingVet = null;
  render();
}

async function saveVet(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  try {
    await api(`/veterinarios/${state.editingVet.id_veterinario}`, { method: "PUT", body: JSON.stringify(data) });
    state.editingVet = null;
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderProcedimentos() {
  const procedimentos = filterList(state.data.procedimentos, state.searchQuery, ["nome", "tipo", "descricao"]);
  const rows = procedimentos.map(p => [
    p.nome,
    p.tipo,
    `${p.duracao_padrao_minutos} min`,
    money(p.preco_base),
    state.user.tipo_usuario === "admin" ? `<button class="btn-mini" onclick="editProcedure(${p.id_procedimento})">Editar</button>` : ""
  ]);

  return `
    ${state.user.tipo_usuario === "admin" ? renderProcedureForm() : ""}
    ${panel("Procedimentos", table(["Nome", "Tipo", "Duracao", "Preco", "Acoes"], rows))}
  `;
}

function renderProcedureForm() {
  const proc = state.editingProcedure || {};
  return panel(state.editingProcedure ? "Editar procedimento" : "Cadastrar procedimento", `
    <form class="form-grid" onsubmit="saveProcedure(event)">
      <label>Nome<input name="nome" class="form-control" value="${proc.nome || ""}" required /></label>
      <label>Tipo<select name="tipo" class="form-control">
        ${["consulta", "vacina", "cirurgia", "exame", "retorno", "medicacao", "outro"].map(value => `<option value="${value}" ${proc.tipo === value ? "selected" : ""}>${value}</option>`).join("")}
      </select></label>
      <label>Duracao min<input name="duracao_padrao_minutos" type="number" class="form-control" value="${proc.duracao_padrao_minutos || 60}" required /></label>
      <label>Preco<input name="preco_base" type="number" step="0.01" class="form-control" value="${proc.preco_base || ""}" required /></label>
      <label>Descricao<input name="descricao" class="form-control" value="${proc.descricao || ""}" /></label>
      <button class="btn-primary-app" type="submit">${state.editingProcedure ? "Atualizar procedimento" : "Salvar procedimento"}</button>
      ${state.editingProcedure ? `<button class="btn-ghost" type="button" onclick="cancelProcedureEdit()">Cancelar edicao</button>` : ""}
    </form>
  `);
}

async function saveProcedure(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  try {
    if (state.editingProcedure) {
      await api(`/procedimentos/${state.editingProcedure.id_procedimento}`, { method: "PUT", body: JSON.stringify(data) });
      state.editingProcedure = null;
    } else {
      await api("/procedimentos", { method: "POST", body: JSON.stringify(data) });
    }
    event.target.reset();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function editProcedure(id) {
  state.editingProcedure = state.data.procedimentos.find(item => Number(item.id_procedimento) === Number(id));
  render();
}

function cancelProcedureEdit() {
  state.editingProcedure = null;
  render();
}

function renderProntuarios() {
  const prontuarios = filterList(state.data.prontuarios, state.searchQuery, ["animal", "veterinario", "procedimento", "diagnostico", "prescricao", "medicacao"]);
  const rows = prontuarios.map(p => [
    dateTime(p.inicio),
    p.animal,
    p.veterinario,
    p.procedimento,
    p.diagnostico || "",
    p.prescricao || p.medicacao || ""
  ]);

  return `
    ${["admin", "veterinario"].includes(state.user.tipo_usuario) ? renderRecordForm() : ""}
    ${panel("Prontuarios", table(["Data", "Animal", "Veterinario", "Procedimento", "Diagnostico", "Prescricao"], rows))}
  `;
}

function renderRecordForm() {
  const appointmentOptions = state.data.atendimentos
    .filter(a => state.user.tipo_usuario !== "veterinario" || a.id_veterinario === state.user.id_veterinario)
    .map(a => `<option value="${a.id_atendimento}">${dateTime(a.inicio)} - ${a.animal} - ${a.procedimento}</option>`)
    .join("");

  return panel("Salvar prontuario", `
    <form class="form-grid wide" onsubmit="saveRecord(event)">
      <label>Atendimento<select name="id_atendimento" class="form-control" required>${appointmentOptions}</select></label>
      <label>Diagnostico<input name="diagnostico" class="form-control" /></label>
      <label>Tratamento<input name="tratamento" class="form-control" /></label>
      <label>Prescricao<input name="prescricao" class="form-control" /></label>
      <label>Medicacao<input name="medicacao" class="form-control" /></label>
      <label>Observacoes clinicas<input name="observacoes_clinicas" class="form-control" /></label>
      <button class="btn-primary-app" type="submit">Salvar prontuario</button>
    </form>
  `);
}

async function saveRecord(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  try {
    await api("/prontuarios", { method: "POST", body: JSON.stringify(data) });
    event.target.reset();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderLembretes() {
  const lembretes = filterList(state.data.lembretes, state.searchQuery, ["titulo", "animal", "tutor", "telefone", "prioridade", "status"]);

  if (state.user.tipo_usuario === "cliente") {
    const rows = lembretes.map(l => [
      dateOnly(l.data_prevista),
      l.titulo,
      l.animal || "",
      l.prioridade,
      `<button class="btn-mini danger" onclick="deleteReminder(${l.id_lembrete})">Excluir</button>`
    ]);

    return panel("Meus lembretes", table(["Data", "Titulo", "Animal", "Prioridade", "Acoes"], rows));
  }

  const rows = lembretes.map(l => [
    dateOnly(l.data_prevista),
    l.titulo,
    l.animal || "",
    l.tutor || "",
    l.telefone || "",
    l.prioridade,
    l.status,
    `
      <button class="btn-mini" onclick="setReminderStatus(${l.id_lembrete}, 'em_contato')">Em contato</button>
      <button class="btn-mini" onclick="setReminderStatus(${l.id_lembrete}, 'resolvido')">Resolver</button>
      <button class="btn-mini danger" onclick="setReminderStatus(${l.id_lembrete}, 'ignorado')">Ignorar</button>
      <button class="btn-mini danger" onclick="deleteReminder(${l.id_lembrete})">Excluir</button>
    `
  ]);

  return panel("Painel de lembretes", table(["Data", "Titulo", "Animal", "Tutor", "Telefone", "Prioridade", "Status", "Acoes"], rows));
}

async function setReminderStatus(id, status) {
  try {
    await api(`/lembretes/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteReminder(id) {
  if (!confirm("Deseja excluir este lembrete?")) return;

  try {
    await api(`/lembretes/${id}`, {
      method: "DELETE"
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderRelatorios() {
  return `
    <div class="report-actions">
      <button class="btn-primary-app" onclick="loadReports()">Atualizar relatorios</button>
    </div>
    <div id="reports" class="report-grid"></div>
  `;
}

async function loadReports() {
  try {
    const [servicos, veterinarios] = await Promise.all([
      api("/relatorios/servicos"),
      state.user.tipo_usuario === "admin" ? api("/relatorios/veterinarios") : Promise.resolve([])
    ]);

    document.getElementById("reports").innerHTML = `
      ${panel("Procedimentos mais solicitados", table(["Procedimento", "Total"], servicos.map(s => [s.servico, s.total])))}
      ${state.user.tipo_usuario === "admin" ? panel("Veterinarios com mais atendimentos", table(["Veterinario", "Total"], veterinarios.map(v => [v.veterinario, v.total]))) : ""}
    `;
  } catch (error) {
    alert(error.message);
  }
}

async function refresh() {
  await loadAll();
  render();
}

async function bootstrap() {
  if (!state.token) {
    renderLogin();
    return;
  }

  try {
    await loadAll();
    render();
  } catch {
    logout();
  }
}

bootstrap();
