// Local leaderboard rules (Ticket-04 §3). Pure: storage lives in server.js, UI in src/web.
export const MAX_ENTRIES = 10, NAME_MIN = 3, NAME_MAX = 12;
// ASCII [A-Za-z0-9_] plus Vietnamese letters (bonus): Latin-1/Extended-A/B letters used by Vietnamese and U+1EA0–U+1EF9.
const VI = 'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư';
const isNameChar = (ch) => /^[A-Za-z0-9_]$/.test(ch) || VI.includes(ch) || (ch.codePointAt(0) >= 0x1EA0 && ch.codePointAt(0) <= 0x1EF9);

export function validateName(raw) {
  const name = String(raw ?? '').normalize('NFC').trim();
  const chars = [...name];
  if (chars.length < NAME_MIN || chars.length > NAME_MAX) return { ok: false, name, error: `Tên cần ${NAME_MIN}–${NAME_MAX} ký tự` };
  if (!chars.every(isNameChar)) return { ok: false, name, error: 'Chỉ dùng chữ (có thể có dấu), số và _' };
  return { ok: true, name };
}

// ISO 8601 with the local UTC offset, e.g. 2026-11-20T16:04:05.000+07:00
export function isoLocal(date) {
  const p = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const off = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}.${p(date.getMilliseconds(), 3)}${off >= 0 ? '+' : '-'}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

// score desc; tie -> earlier achieved_at first; still tied -> earlier insertion first (stable sort)
export const sortEntries = (entries) => [...entries].sort((a, b) => (b.score - a.score) || (Date.parse(a.achieved_at) - Date.parse(b.achieved_at)));

export function makeEntry({ name, score, nights_won, achieved_at, seed }) {
  const v = validateName(name);
  if (!v.ok) throw new Error(v.error);
  if (!Number.isInteger(score) || score < 0) throw new Error('score must be an integer >= 0');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('nights_won must be 0..3');
  if (Number.isNaN(Date.parse(achieved_at)) || !/([+-]\d{2}:\d{2}|Z)$/.test(achieved_at)) throw new Error('achieved_at must be ISO 8601 with a timezone');
  return { name: v.name, score, nights_won, achieved_at, seed: Number.isFinite(seed) ? seed : null };
}

export function addEntry(entries, entry) {
  return sortEntries([...entries, makeEntry(entry)]).slice(0, MAX_ENTRIES);
}
