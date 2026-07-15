import './styles.css';
import { loadBootstrap } from './api.js';
import {
  buildHierarchy,
  filterWithAncestors,
  getDescendantCount,
  getDirectReportCount
} from './tree.js';
import {
  calculateAge,
  formatDate,
  formatNextBirthday,
  formatTenure,
  initials,
  isBirthdayMonth,
  splitResponsibilities
} from './utils.js';

const state = {
  collaborators: [],
  config: {},
  expanded: new Set(),
  filters: {
    query: '',
    sector: ''
  },
  selected: null,
  warning: '',
  source: ''
};

const app = document.querySelector('#app');

bootstrap();

async function bootstrap() {
  const result = await loadBootstrap();

  state.collaborators = (result.data.colaboradores || [])
    .filter(person => String(person.Status).toLowerCase() === 'ativo');

  state.config = result.data.configuracoes || {};
  state.warning = result.warning || '';
  state.source = result.source;

  state.collaborators
    .filter(person => Number(person.Nivel || 0) <= 1)
    .forEach(person => state.expanded.add(person.ID));

  renderApp();
}

function renderApp() {
  const title = state.config.TITULO_SISTEMA || 'Organograma GPV';
  const subtitle =
    state.config.SUBTITULO_SISTEMA ||
    'Estrutura corporativa e equipes';

  app.innerHTML = `
    <div class="page-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand__mark">GPV</div>
          <div>
            <span class="eyebrow">Estrutura corporativa</span>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>

        <div class="topbar__actions">
          <button class="button button--ghost" id="collapseAll" type="button">
            Recolher
          </button>
          <button class="button button--dark" id="expandAll" type="button">
            Expandir tudo
          </button>
        </div>
      </header>

      <main>
        ${state.warning ? `
          <div class="notice">
            <strong>Aviso:</strong> ${escapeHtml(state.warning)}
          </div>
        ` : ''}

        <section class="stats" id="stats"></section>

        <section class="toolbar" aria-label="Filtros do organograma">
          <label class="search">
            <span>Buscar</span>
            <input
              id="searchInput"
              type="search"
              placeholder="Nome, cargo, setor ou unidade"
              value="${escapeAttribute(state.filters.query)}"
            />
          </label>

          <label class="select-field">
            <span>Setor</span>
            <select id="sectorSelect"></select>
          </label>

          <button class="button button--light" id="clearFilters" type="button">
            Limpar filtros
          </button>
        </section>

        <section class="organization-panel">
          <div class="organization-panel__header">
            <div>
              <span class="eyebrow">Organograma</span>
              <h2>Hierarquia da empresa</h2>
            </div>
            <span class="source-badge">
              ${state.source === 'api' ? 'Dados da planilha' : 'Base local'}
            </span>
          </div>

          <div class="tree-scroll" id="treeContainer"></div>
        </section>
      </main>

      <footer class="footer">
        <span>GPV Associados</span>
        <span>Organograma v${escapeHtml(state.config.VERSAO || '0.1.0')}</span>
      </footer>
    </div>

    <div class="drawer-backdrop" id="drawerBackdrop" hidden></div>
    <aside class="drawer" id="profileDrawer" aria-hidden="true"></aside>
  `;

  renderStats();
  renderSectorOptions();
  renderTree();
  bindEvents();
}

function renderStats() {
  const realCollaborators = state.collaborators.filter(
    person => String(person.Tipo).toLowerCase() !== 'institucional'
  );

  const sectors = new Set(
    realCollaborators.map(person => person.Setor).filter(Boolean)
  );

  const leaders = realCollaborators.filter(
    person => getDirectReportCount(state.collaborators, person.ID) > 0
  ).length;

  const birthdays = realCollaborators.filter(
    person => isBirthdayMonth(person.DataNascimento)
  ).length;

  document.querySelector('#stats').innerHTML = `
    ${statCard('Colaboradores', realCollaborators.length, 'Pessoas ativas na estrutura')}
    ${statCard('Setores', sectors.size, 'Áreas representadas')}
    ${statCard('Lideranças', leaders, 'Gestores com equipe direta')}
    ${statCard('Aniversários', birthdays, 'Neste mês')}
  `;
}

function statCard(label, value, helper) {
  return `
    <article class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
      <small>${escapeHtml(helper)}</small>
    </article>
  `;
}

function renderSectorOptions() {
  const select = document.querySelector('#sectorSelect');
  const sectors = [...new Set(
    state.collaborators
      .filter(person => person.Setor && person.Tipo !== 'institucional')
      .map(person => person.Setor)
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  select.innerHTML = `
    <option value="">Todos os setores</option>
    ${sectors.map(sector => `
      <option
        value="${escapeAttribute(sector)}"
        ${sector === state.filters.sector ? 'selected' : ''}
      >
        ${escapeHtml(sector)}
      </option>
    `).join('')}
  `;
}

function renderTree() {
  const container = document.querySelector('#treeContainer');

  const filtered = filterWithAncestors(
    state.collaborators,
    state.filters
  );

  const hierarchy = buildHierarchy(filtered);

  if (!hierarchy.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Nenhum colaborador encontrado.</strong>
        <p>Ajuste a busca ou limpe os filtros.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="org-tree">
      <ul>
        ${hierarchy.map(node => renderNode(node)).join('')}
      </ul>
    </div>
  `;

  container.querySelectorAll('[data-card-id]').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('[data-toggle-id]')) return;
      openProfile(card.dataset.cardId);
    });
  });

  container.querySelectorAll('[data-toggle-id]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      toggleNode(button.dataset.toggleId);
    });
  });
}

function renderNode(node) {
  const directReports = node.children.length;
  const descendants = getDescendantCount(state.collaborators, node.ID);
  const isExpanded = state.expanded.has(node.ID);
  const hasChildren = directReports > 0;
  const isInstitutional =
    String(node.Tipo).toLowerCase() === 'institucional';

  return `
    <li>
      <article
        class="person-card ${isInstitutional ? 'person-card--institutional' : ''}"
        data-card-id="${escapeAttribute(node.ID)}"
        tabindex="0"
        role="button"
        aria-label="Abrir perfil de ${escapeAttribute(node.NomeExibicao)}"
      >
        <div class="avatar ${node.FotoURL ? 'avatar--photo' : ''}">
          ${node.FotoURL
            ? `<img src="${escapeAttribute(node.FotoURL)}" alt="" loading="lazy" />`
            : `<span>${escapeHtml(initials(node.NomeExibicao))}</span>`
          }
        </div>

        <div class="person-card__content">
          <span class="person-card__sector">
            ${escapeHtml(node.Setor || 'Corporativo')}
          </span>
          <h3>${escapeHtml(node.NomeExibicao)}</h3>
          <p>${escapeHtml(node.Cargo)}</p>

          ${!isInstitutional ? `
            <div class="person-card__meta">
              ${directReports
                ? `<span>${directReports} direto${directReports === 1 ? '' : 's'}</span>`
                : '<span>Equipe individual</span>'
              }
              ${descendants > directReports
                ? `<span>${descendants} na estrutura</span>`
                : ''
              }
            </div>
          ` : ''}
        </div>

        ${hasChildren ? `
          <button
            class="toggle-button"
            type="button"
            data-toggle-id="${escapeAttribute(node.ID)}"
            aria-expanded="${isExpanded}"
            title="${isExpanded ? 'Recolher equipe' : 'Expandir equipe'}"
          >
            ${isExpanded ? '−' : '+'}
          </button>
        ` : ''}
      </article>

      ${hasChildren && isExpanded ? `
        <ul>
          ${node.children.map(child => renderNode(child)).join('')}
        </ul>
      ` : ''}
    </li>
  `;
}

function bindEvents() {
  document.querySelector('#searchInput').addEventListener('input', event => {
    state.filters.query = event.target.value;
    renderTree();
  });

  document.querySelector('#sectorSelect').addEventListener('change', event => {
    state.filters.sector = event.target.value;
    renderTree();
  });

  document.querySelector('#clearFilters').addEventListener('click', () => {
    state.filters.query = '';
    state.filters.sector = '';
    document.querySelector('#searchInput').value = '';
    renderSectorOptions();
    renderTree();
  });

  document.querySelector('#expandAll').addEventListener('click', () => {
    state.collaborators.forEach(person => state.expanded.add(person.ID));
    renderTree();
  });

  document.querySelector('#collapseAll').addEventListener('click', () => {
    state.expanded.clear();
    state.collaborators
      .filter(person => Number(person.Nivel || 0) === 0)
      .forEach(person => state.expanded.add(person.ID));
    renderTree();
  });

  document.querySelector('#drawerBackdrop').addEventListener('click', closeProfile);

  document.addEventListener('keydown', handleGlobalKeydown);
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    closeProfile();
  }

  const card = event.target.closest?.('[data-card-id]');

  if (card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openProfile(card.dataset.cardId);
  }
}

function toggleNode(id) {
  if (state.expanded.has(id)) {
    state.expanded.delete(id);
  } else {
    state.expanded.add(id);
  }

  renderTree();
}

function openProfile(id) {
  const person = state.collaborators.find(item => item.ID === id);
  if (!person) return;

  state.selected = person;

  const drawer = document.querySelector('#profileDrawer');
  const backdrop = document.querySelector('#drawerBackdrop');
  const age = calculateAge(person.DataNascimento);
  const responsibilities = splitResponsibilities(person.Responsabilidades);
  const manager = state.collaborators.find(
    item => item.ID === person.GestorID
  );

  drawer.innerHTML = `
    <div class="drawer__header">
      <span class="eyebrow">Perfil do colaborador</span>
      <button class="drawer__close" id="closeDrawer" type="button">×</button>
    </div>

    <div class="profile-hero">
      <div class="avatar avatar--large ${person.FotoURL ? 'avatar--photo' : ''}">
        ${person.FotoURL
          ? `<img src="${escapeAttribute(person.FotoURL)}" alt="" />`
          : `<span>${escapeHtml(initials(person.NomeExibicao))}</span>`
        }
      </div>

      <div>
        <span>${escapeHtml(person.Setor || 'Corporativo')}</span>
        <h2>${escapeHtml(person.NomeExibicao)}</h2>
        <p>${escapeHtml(person.Cargo)}</p>
      </div>
    </div>

    <div class="profile-grid">
      ${detailItem('Idade', age === null ? 'Não informada' : `${age} anos`)}
      ${detailItem('Nascimento', formatDate(person.DataNascimento))}
      ${detailItem('Próximo aniversário', formatNextBirthday(person.DataNascimento))}
      ${detailItem('Tempo de empresa', formatTenure(person.DataAdmissao))}
      ${detailItem('Admissão', formatDate(person.DataAdmissao))}
      ${detailItem('Unidade', person.Unidade || 'Não informada')}
      ${detailItem('Gestor direto', manager?.NomeExibicao || 'Liderança corporativa')}
      ${detailItem(
        'Equipe abaixo',
        `${getDescendantCount(state.collaborators, person.ID)} colaborador(es)`
      )}
    </div>

    ${person.Email || person.Telefone ? `
      <section class="profile-section">
        <h3>Contato</h3>
        ${person.Email
          ? `<a href="mailto:${escapeAttribute(person.Email)}">${escapeHtml(person.Email)}</a>`
          : ''
        }
        ${person.Telefone
          ? `<a href="tel:${escapeAttribute(person.Telefone)}">${escapeHtml(person.Telefone)}</a>`
          : ''
        }
      </section>
    ` : ''}

    ${person.Biografia ? `
      <section class="profile-section">
        <h3>Sobre</h3>
        <p>${escapeHtml(person.Biografia)}</p>
      </section>
    ` : ''}

    ${responsibilities.length ? `
      <section class="profile-section">
        <h3>Responsabilidades</h3>
        <ul class="responsibility-list">
          ${responsibilities.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>
    ` : ''}

    <div class="profile-note">
      Os dados pessoais e profissionais são administrados diretamente na planilha.
    </div>
  `;

  backdrop.hidden = false;
  drawer.classList.add('drawer--open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');

  document.querySelector('#closeDrawer').addEventListener('click', closeProfile);
}

function closeProfile() {
  const drawer = document.querySelector('#profileDrawer');
  const backdrop = document.querySelector('#drawerBackdrop');

  if (!drawer || !backdrop) return;

  drawer.classList.remove('drawer--open');
  drawer.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;
  document.body.classList.remove('no-scroll');
  state.selected = null;
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
