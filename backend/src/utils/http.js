class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);
const forbidden = (msg = 'You do not have permission to do this') => new HttpError(403, msg);
const notFound = (msg = 'Not found') => new HttpError(404, msg);

const TASK_STATUS = ['NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PROJECT_STATUS = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const LOG_STATUS = ['WORKING', 'COMPLETED', 'BLOCKED'];
const WORK_TYPE = ['HARDWARE', 'SOFTWARE', 'GENERAL'];
const TEST_RESULT = ['NA', 'PASS', 'FAIL', 'PARTIAL'];

// Today's date in the server's local time zone (YYYY-MM-DD). toISOString() would use UTC and
// give the wrong day for part of the day in India.
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const oneOf = (v, list, name) => {
  if (!list.includes(v)) throw bad(`${name} must be one of: ${list.join(', ')}`);
  return v;
};
const dateOrNull = (v, name) => {
  if (v === undefined || v === null || v === '') return null;
  if (!isDate(v)) throw bad(`${name} must be a valid date (YYYY-MM-DD)`);
  return v;
};
const num = (v, name, { min = 0, max = 100000 } = {}) => {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || Number.isNaN(n) || n < min || n > max) {
    throw bad(`${name} must be a number between ${min} and ${max}`);
  }
  return n;
};
const str = (v, name, { required = false, max = 255 } = {}) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw bad(`${name} is required`);
  if (s.length > max) throw bad(`${name} is too long`);
  return s || null;
};
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');

module.exports = {
  HttpError, bad, forbidden, notFound,
  TASK_STATUS, PRIORITY, PROJECT_STATUS, LOG_STATUS, WORK_TYPE, TEST_RESULT, todayLocal,
  isDate, oneOf, dateOrNull, num, str, isEmail
};
