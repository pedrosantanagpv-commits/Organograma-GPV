import { normalizeText } from './utils.js';

export function buildHierarchy(collaborators) {
  const nodes = new Map();
  const roots = [];

  collaborators.forEach(person => {
    nodes.set(person.ID, {
      ...person,
      children: []
    });
  });

  collaborators.forEach(person => {
    const node = nodes.get(person.ID);
    const manager = person.GestorID
      ? nodes.get(person.GestorID)
      : null;

    if (manager) {
      manager.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = list => {
    list.sort((a, b) => {
      const orderDifference =
        Number(a.Ordem || 0) - Number(b.Ordem || 0);

      return orderDifference ||
        String(a.NomeExibicao).localeCompare(
          String(b.NomeExibicao),
          'pt-BR'
        );
    });

    list.forEach(node => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

export function getDirectReportCount(collaborators, personId) {
  return collaborators.filter(
    person => person.GestorID === personId
  ).length;
}

export function getDescendantCount(collaborators, personId) {
  const byManager = new Map();

  collaborators.forEach(person => {
    const managerId = person.GestorID || '';

    if (!byManager.has(managerId)) {
      byManager.set(managerId, []);
    }

    byManager.get(managerId).push(person.ID);
  });

  const visit = id => {
    const children = byManager.get(id) || [];

    return children.length + children.reduce(
      (total, childId) => total + visit(childId),
      0
    );
  };

  return visit(personId);
}

export function filterWithAncestors(collaborators, filters) {
  const query = normalizeText(filters.query);
  const sector = normalizeText(filters.sector);

  if (!query && !sector) return collaborators;

  const byId = new Map(
    collaborators.map(person => [person.ID, person])
  );

  const includedIds = new Set();

  const matches = collaborators.filter(person => {
    const matchesQuery =
      !query ||
      [
        person.NomeCompleto,
        person.NomeExibicao,
        person.Cargo,
        person.Setor,
        person.Unidade
      ].some(value => normalizeText(value).includes(query));

    const matchesSector =
      !sector ||
      normalizeText(person.Setor) === sector;

    return matchesQuery && matchesSector;
  });

  matches.forEach(person => {
    let current = person;

    while (current) {
      includedIds.add(current.ID);
      current = current.GestorID
        ? byId.get(current.GestorID)
        : null;
    }
  });

  return collaborators.filter(
    person => includedIds.has(person.ID)
  );
}
