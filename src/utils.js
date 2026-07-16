export function parseLocalDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const normalized = String(value).trim();
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (iso) {
    return new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      12,
      0,
      0
    );
  }

  const br = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (br) {
    return new Date(
      Number(br[3]),
      Number(br[2]) - 1,
      Number(br[1]),
      12,
      0,
      0
    );
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateAge(value, today = new Date()) {
  const birthDate = parseLocalDate(value);
  if (!birthDate) return null;

  let age = today.getFullYear() - birthDate.getFullYear();

  const birthdayHasNotOccurred =
    today.getMonth() < birthDate.getMonth() ||
    (
      today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate()
    );

  if (birthdayHasNotOccurred) age -= 1;
  return age;
}

export function calculateTenure(value, today = new Date()) {
  const admission = parseLocalDate(value);
  if (!admission) return null;

  let years = today.getFullYear() - admission.getFullYear();
  let months = today.getMonth() - admission.getMonth();

  if (today.getDate() < admission.getDate()) months -= 1;

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    years: Math.max(years, 0),
    months: Math.max(months, 0)
  };
}

export function formatTenure(value) {
  const tenure = calculateTenure(value);
  if (!tenure) return 'Não informado';

  if (tenure.years === 0) {
    return `${tenure.months} ${tenure.months === 1 ? 'mês' : 'meses'}`;
  }

  if (tenure.months === 0) {
    return `${tenure.years} ${tenure.years === 1 ? 'ano' : 'anos'}`;
  }

  return `${tenure.years} ${tenure.years === 1 ? 'ano' : 'anos'} e ${tenure.months} ${tenure.months === 1 ? 'mês' : 'meses'}`;
}

export function formatDate(value) {
  const date = parseLocalDate(value);
  return date
    ? new Intl.DateTimeFormat('pt-BR').format(date)
    : 'Não informado';
}

export function getNextBirthday(value, today = new Date()) {
  const birthDate = parseLocalDate(value);
  if (!birthDate) return null;

  let next = new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate(),
    12
  );

  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12
  );

  if (next < current) {
    next = new Date(
      today.getFullYear() + 1,
      birthDate.getMonth(),
      birthDate.getDate(),
      12
    );
  }

  const days = Math.round((next - current) / 86400000);
  return { date: next, days };
}

export function formatNextBirthday(value) {
  const info = getNextBirthday(value);

  if (!info) return 'Não informado';
  if (info.days === 0) return 'Hoje';
  if (info.days === 1) return 'Amanhã';

  return `Em ${info.days} dias`;
}

export function isBirthdayMonth(value, today = new Date()) {
  const birthDate = parseLocalDate(value);
  return Boolean(birthDate && birthDate.getMonth() === today.getMonth());
}

export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function splitResponsibilities(value) {
  return String(value || '')
    .split(/\r?\n|;|\|/)
    .map(item => item.trim())
    .filter(Boolean);
}
