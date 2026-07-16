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
    .filter(person =>
      String(person.Status).toLowerCase() === 'ativo'
    );

  state.config = result.data.configuracoes || {};
  state.warning = result.warning || '';
  state.source = result.source;

  state.collaborators
    .filter(person => Number(person.Nivel || 0) <= 1)
    .forEach(person => state.expanded.add(person.ID));

  renderApp();
}

function renderApp() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="site-header">
        <a class="brand" href="#" aria-label="Organograma GPV">
          <span class="brand__symbol">GPV</span>
          <span class="brand__copy">
            <strong>Organograma</strong>
            <small>GPV Associados</small>
          </span>
        </a>

        <div class="header-actions">
          <button class="icon-button" id="collapseAll" type="button">
            <span>−</span>
            Recolher
          </button>

          <button class="primary-button" id="expandAll" type="button">
            Expandir estrutura
          </button>
        </div>
      </header>

      <main>
        <section class="hero">
          <div class="hero__copy">
            <span class="section-label">Estrutura corporativa</span>
            <h1>Pessoas que fazem<br />a GPV acontecer.</h1>
            <p>
              Conheça as lideranças, os setores e os profissionais
              que conectam toda a nossa operação.
            </p>
          </div>

          <div class="metrics" id="metrics"></div>
        </section>

        ${state.warning ? `
          <div class="notice">
            <span class="notice__dot"></span>
            ${escapeHtml(state.warning)}
          </div>
        ` : ''}

        <section class="control-bar">
          <label class="search-field">
            <span class="sr-only">Buscar colaborador</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/>
            </svg>
            <input
              id="searchInput"
              type="search"
              placeholder="Busque por nome, cargo ou setor"
              value="${escapeAttribute(state.filters.query)}"
            />
          </label>

          <label class="sector-field">
            <span class="sr-only">Filtrar por setor</span>
            <select id="sectorSelect"></select>
          </label>

          <button class="clear-button" id="clearFilters" type="button">
            Limpar
          </button>
        </section>

        <section class="organization">
          <div class="organization__head">
            <div>
              <span class="section-label">Hierarquia</span>
              <h2>Estrutura da empresa</h2>
            </div>

            <div class="organization__status">
              <span class="live-dot"></span>
              ${state.source === 'api'
                ? 'Sincronizado com a planilha'
                : 'Base temporária'
              }
            </div>
          </div>

          <div class="tree-canvas" id="treeContainer"></div>
        </section>
      </main>

      <footer class="site-footer">
        <span>GPV Associados</span>
        <span>Estrutura corporativa • v${escapeHtml(state.config.VERSAO || '0.2.0')}</span>
      </footer>
    </div>

    <div class="drawer-backdrop" id="drawerBackdrop" hidden></div>
    <aside class="drawer" id="profileDrawer" aria-hidden="true"></aside>
  `;

  renderMetrics();
  renderSectorOptions();
  renderTree();
  bindEvents();
}

function renderMetrics() {
  const collaborators = state.collaborators.filter(
    person =>
      String(person.Tipo).toLowerCase() !== 'institucional'
  );

  const sectors = new Set(
    collaborators.map(person => person.Setor).filter(Boolean)
  );

  const leaders = collaborators.filter(
    person =>
      getDirectReportCount(state.collaborators, person.ID) > 0
  ).length;

  const birthdays = collaborators.filter(
    person => isBirthdayMonth(person.DataNascimento)
  ).length;

  document.querySelector('#metrics').innerHTML = [
    metric('Pessoas', collaborators.length),
    metric('Setores', sectors.size),
    metric('Lideranças', leaders),
    metric('Aniversários', birthdays)
  ].join('');
}

function metric(label, value) {
  return `
    <div class="metric">
      <strong>${value}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function renderSectorOptions() {
  const select = document.querySelector('#sectorSelect');

  const sectors = [...new Set(
    state.collaborators
      .filter(person =>
        person.Setor &&
        String(person.Tipo).toLowerCase() !== 'institucional'
      )
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
  const filtersActive = Boolean(
    state.filters.query || state.filters.sector
  );

  if (!hierarchy.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span>Sem resultados</span>
        <strong>Nenhuma pessoa encontrada.</strong>
        <p>Tente outro nome, cargo ou setor.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="org-tree">
      <ul>
        ${hierarchy
          .map(node => renderNode(node, filtersActive))
          .join('')}
      </ul>
    </div>
  `;

  bindTreeEvents(container);
  bindImageFallbacks(container);
}

function renderNode(node, filtersActive) {
  const directReports = node.children.length;
  const descendants = getDescendantCount(
    state.collaborators,
    node.ID
  );

  const expanded = filtersActive || state.expanded.has(node.ID);
  const hasChildren = directReports > 0;
  const institutional =
    String(node.Tipo).toLowerCase() === 'institucional';

  return `
    <li>
      <article
        class="person-card ${institutional ? 'person-card--institutional' : ''}"
        data-card-id="${escapeAttribute(node.ID)}"
        tabindex="0"
        role="button"
        aria-label="Abrir perfil de ${escapeAttribute(node.NomeExibicao)}"
      >
        <div class="person-card__media">
          <div class="photo-fallback">
            ${institutional
              ? '<span class="corporate-mark">GPV</span>'
              : escapeHtml(initials(node.NomeExibicao))
            }
          </div>

          ${node.FotoURL ? `
            <img
              src="${escapeAttribute(node.FotoURL)}"
              alt="Foto de ${escapeAttribute(node.NomeExibicao)}"
              loading="lazy"
            />
          ` : ''}

          <span class="level-tag">
            ${institutional
              ? 'Corporativo'
              : escapeHtml(node.Setor || 'Equipe')
            }
          </span>
        </div>

        <div class="person-card__body">
          <div>
            <h3>${escapeHtml(node.NomeExibicao)}</h3>
            <p>${escapeHtml(node.Cargo)}</p>
          </div>

          ${!institutional ? `
            <div class="person-card__footer">
              <span>
                ${directReports
                  ? `${directReports} direto${directReports === 1 ? '' : 's'}`
                  : 'Perfil individual'
                }
              </span>

              ${descendants > directReports
                ? `<span>${descendants} na estrutura</span>`
                : ''
              }
            </div>
          ` : `
            <div class="person-card__footer">
              <span>Liderança da organização</span>
            </div>
          `}
        </div>

        ${hasChildren ? `
          <button
            class="toggle-button"
            type="button"
            data-toggle-id="${escapeAttribute(node.ID)}"
            aria-expanded="${expanded}"
            title="${expanded ? 'Recolher equipe' : 'Expandir equipe'}"
          >
            ${expanded ? '−' : '+'}
          </button>
        ` : ''}
      </article>

      ${hasChildren && expanded ? `
        <ul>
          ${node.children
            .map(child => renderNode(child, filtersActive))
            .join('')}
        </ul>
      ` : ''}
    </li>
  `;
}

function bindTreeEvents(container) {
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

function bindImageFallbacks(container) {
  container.querySelectorAll('.person-card__media img').forEach(image => {
    image.addEventListener('error', () => image.remove());
  });
}

function bindEvents() {
  document.querySelector('#searchInput').addEventListener(
    'input',
    event => {
      state.filters.query = event.target.value;
      renderTree();
    }
  );

  document.querySelector('#sectorSelect').addEventListener(
    'change',
    event => {
      state.filters.sector = event.target.value;
      renderTree();
    }
  );

  document.querySelector('#clearFilters').addEventListener(
    'click',
    () => {
      state.filters.query = '';
      state.filters.sector = '';
      document.querySelector('#searchInput').value = '';
      renderSectorOptions();
      renderTree();
    }
  );

  document.querySelector('#expandAll').addEventListener(
    'click',
    () => {
      state.collaborators.forEach(person =>
        state.expanded.add(person.ID)
      );
      renderTree();
    }
  );

  document.querySelector('#collapseAll').addEventListener(
    'click',
    () => {
      state.expanded.clear();

      state.collaborators
        .filter(person => Number(person.Nivel || 0) === 0)
        .forEach(person => state.expanded.add(person.ID));

      renderTree();
    }
  );

  document.querySelector('#drawerBackdrop').addEventListener(
    'click',
    closeProfile
  );

  document.addEventListener('keydown', handleGlobalKeydown);
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') closeProfile();

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
  const responsibilities = splitResponsibilities(
    person.Responsabilidades
  );

  const manager = state.collaborators.find(
    item => item.ID === person.GestorID
  );

  drawer.innerHTML = `
    <div class="drawer__top">
      <span class="section-label">Perfil</span>
      <button
        class="drawer__close"
        id="closeDrawer"
        type="button"
        aria-label="Fechar perfil"
      >
        ×
      </button>
    </div>

    <div class="profile-cover">
      <div class="profile-cover__media">
        <div class="profile-fallback">
          ${escapeHtml(initials(person.NomeExibicao))}
        </div>

        ${person.FotoURL ? `
          <img
            src="${escapeAttribute(person.FotoURL)}"
            alt="Foto de ${escapeAttribute(person.NomeExibicao)}"
          />
        ` : ''}
      </div>

      <div class="profile-cover__content">
        <span>${escapeHtml(person.Setor || 'Corporativo')}</span>
        <h2>${escapeHtml(person.NomeExibicao)}</h2>
        <p>${escapeHtml(person.Cargo)}</p>
      </div>
    </div>

    <div class="profile-data">
      ${detailItem(
        'Idade',
        age === null ? 'Não informada' : `${age} anos`
      )}
      ${detailItem(
        'Tempo de empresa',
        formatTenure(person.DataAdmissao)
      )}
      ${detailItem(
        'Gestor direto',
        manager?.NomeExibicao || 'Liderança corporativa'
      )}
      ${detailItem(
        'Equipe abaixo',
        `${getDescendantCount(state.collaborators, person.ID)} pessoa(s)`
      )}
      ${detailItem(
        'Nascimento',
        formatDate(person.DataNascimento)
      )}
      ${detailItem(
        'Próximo aniversário',
        formatNextBirthday(person.DataNascimento)
      )}
      ${detailItem(
        'Admissão',
        formatDate(person.DataAdmissao)
      )}
      ${detailItem(
        'Unidade',
        person.Unidade || 'Não informada'
      )}
    </div>

    ${person.Email || person.Telefone ? `
      <section class="drawer-section">
        <span class="section-label">Contato</span>
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
      <section class="drawer-section">
        <span class="section-label">Sobre</span>
        <p>${escapeHtml(person.Biografia)}</p>
      </section>
    ` : ''}

    ${responsibilities.length ? `
      <section class="drawer-section">
        <span class="section-label">Responsabilidades</span>
        <ul>
          ${responsibilities
            .map(item => `<li>${escapeHtml(item)}</li>`)
            .join('')}
        </ul>
      </section>
    ` : ''}

    <div class="drawer-note">
      Informações atualizadas diretamente pelo banco de dados da empresa.
    </div>
  `;

  const profileImage = drawer.querySelector(
    '.profile-cover__media img'
  );

  if (profileImage) {
    profileImage.addEventListener(
      'error',
      () => profileImage.remove()
    );
  }

  backdrop.hidden = false;
  drawer.classList.add('drawer--open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');

  document.querySelector('#closeDrawer').addEventListener(
    'click',
    closeProfile
  );
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
    <div class="data-item">
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
