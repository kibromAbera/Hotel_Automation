import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { modules, fieldName } from './schema.mjs';

const database = process.env.HOTEL_DB || 'data/frontdesk.sqlite';
if (!process.env.HOTEL_DB) mkdirSync('data', { recursive: true });
const db = new DatabaseSync(database);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, property TEXT NOT NULL, body TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS records_property_kind ON records(property, kind);
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY, property TEXT, timestamp TEXT, action TEXT, area TEXT, details TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY);`);
const list = (kind, property) => db.prepare('SELECT id, body FROM records WHERE kind = ? AND property = ? ORDER BY rowid DESC').all(kind, property).map(row => ({ id: row.id, ...JSON.parse(row.body) }));
const insert = db.prepare('INSERT INTO records VALUES (?, ?, ?, ?)');
const add = (kind, property, body, id = randomUUID()) => { insert.run(id, kind, property, JSON.stringify(body)); return id; };
const audit = db.prepare('INSERT INTO activity(property,timestamp,action,area,details) VALUES (?, ?, ?, ?, ?)');
const date = offset => {
  const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const today = new Date(localDay + 'T00:00:00Z');
  today.setUTCDate(today.getUTCDate() + offset);
  return today.toISOString().slice(0, 10);
};

db.exec('BEGIN IMMEDIATE');
try {
  if (db.prepare("INSERT OR IGNORE INTO settings VALUES ('initialized')").run().changes && process.env.HOTEL_SEED !== '0') {
    const property = add('properties', '', { name: 'The Grand Meridian', type: 'Hotel', address: 'Addis Ababa' });
    const names = ['Olivia Bennett', 'James Carter', 'Sophia Williams', 'Noah Anderson', 'Emma Wilson', 'Liam Taylor'];
    const guests = names.map(name => add('guests', property, { name, email: '', phone: '' }));
    const rooms = Array.from({ length: 8 }, (_, index) => add('rooms', property, { name: String(201 + index), type: index > 4 ? 'Suite' : 'Deluxe', rate: index > 4 ? 280 : 160, status: index === 7 ? 'Cleaning' : 'Ready' }));
    names.forEach((_, index) => add('reservations', property, { guest: guests[index], room: rooms[index], arrival: date(index < 3 ? 0 : -1), departure: date(index === 5 ? 0 : 2), status: index > 2 ? 'Checked in' : 'Confirmed' }));
    const menu = [['Grilled salmon', 'Main', 24], ['Caesar salad', 'Starter', 12], ['Cappuccino', 'Drink', 5], ['Chocolate mousse', 'Dessert', 9]];
    const menuIds = menu.map(([name, category, price]) => add('menu', property, { name, category, price, status: 'Available' }));
    ['Preparing', 'New', 'Served'].forEach((status, index) => add('orders', property, { table: String(index + 4), items: [{ id: menuIds[index], quantity: 2, name: menu[index][0], price: menu[index][2] }], total: menu[index][2] * 2, status }));
    add('housekeeping', property, { room: rooms[7], name: 'Turnover clean', assignee: 'Housekeeping team', status: 'In progress' });
    add('inventory', property, { name: 'Coffee beans', category: 'Beverages', quantity: 4, unit: 'kg', threshold: 5 });
    add('billing', property, { name: 'Guest accommodation', source: 'Reservation', reference: '', amount: 1280, status: 'Paid' });
    audit.run(property, new Date().toISOString(), 'Created', 'Properties', 'Demo property initialized');
  }
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; }

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function validate(kind, input, current, records) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Expected a record.');
  const config = modules[kind];
  const body = {};
  for (const [key, type] of Object.entries(config.fields)) {
    const value = input[key];
    const label = fieldName(key, type);
    if (Array.isArray(type)) {
      if (!type.includes(value)) fail(`Select a valid ${label.toLowerCase()}.`);
      body[key] = value;
    } else if (type.startsWith('*')) {
      if (!Array.isArray(value) || !value.length || value.length > 100) fail('Add at least one menu item.');
      const ids = new Set();
      body.items = value.map(item => {
        if (!item || ids.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) fail('Enter valid quantities for distinct menu items.');
        ids.add(item.id);
        const previous = current?.items.find(row => row.id === item.id);
        const menu = records.menu.find(row => row.id === item.id && row.status === 'Available');
        if (!previous && !menu) fail('A selected menu item is unavailable.');
        return { id: item.id, quantity: item.quantity, name: (previous || menu).name, price: (previous || menu).price };
      });
      body.total = Math.round(body.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    } else if (type.startsWith('#')) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9) fail(`${label} must be a nonnegative number.`);
      body[key] = value;
    } else {
      if (typeof value !== 'string' || value.length > 240 || (!value.trim() && !config.optional?.includes(key))) fail(`Enter a valid ${label.toLowerCase()}.`);
      if (type.startsWith('@') && !records[type.slice(1)].some(row => row.id === value)) fail(`Select an existing ${label.toLowerCase()}.`);
      if (type.startsWith('Date:') && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) fail('Enter a valid date.');
      body[key] = value.trim();
    }
  }
  if (kind === 'rooms') {
    if (records.rooms.some(row => row.id !== current?.id && row.name.toLowerCase() === body.name.toLowerCase())) fail('A room with this number already exists.', 409);
    if (body.status === 'Maintenance' && records.reservations.some(row => row.room === current?.id && row.status === 'Checked in')) fail('An occupied room cannot enter maintenance.', 409);
  }
  if (kind === 'reservations') {
    if (body.arrival >= body.departure) fail('Departure must be after arrival.');
    const open = ['Confirmed', 'Checked in'];
    if (open.includes(body.status) && records.reservations.some(row => row.id !== current?.id && row.room === body.room && open.includes(row.status) && row.arrival < body.departure && row.departure > body.arrival)) fail('This room already has a reservation for those dates.', 409);
    const room = records.rooms.find(row => row.id === body.room);
    if (body.status === 'Checked in' && (current?.status !== 'Checked in' || current.room !== body.room) && (room.status !== 'Ready' || records.reservations.some(row => row.id !== current?.id && row.room === room.id && row.status === 'Checked in'))) fail('Check-in requires a ready, unoccupied room.', 409);
  }
  return body;
}

const root = resolve('dist');
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') fail('Method not allowed.', 405);
      const file = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(root + sep)) fail('File not found.', 404);
      let contents;
      try { contents = readFileSync(file); } catch { fail('File not found. Run npm run build to create the frontend.', 404); }
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      return res.end(req.method === 'HEAD' ? undefined : contents);
    }
    const properties = list('properties', '');
    const selected = url.searchParams.get('property');
    const property = properties.some(row => row.id === selected) ? selected : req.method === 'GET' || !selected ? properties[0]?.id || '' : selected;
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const records = Object.fromEntries(Object.keys(modules).filter(kind => kind !== 'properties').map(kind => [kind, list(kind, property)]));
      return send(res, 200, { properties, property, ...records, activity: db.prepare('SELECT * FROM activity WHERE property = ? ORDER BY id DESC LIMIT 500').all(property) });
    }
    const match = url.pathname.match(/^\/api\/records\/([a-z]+)(?:\/([a-f0-9-]+))?$/);
    if (!match || !Object.hasOwn(modules, match[1])) fail('Endpoint not found.', 404);
    const [, kind, id] = match;
    if ((!id && req.method !== 'POST') || (id && req.method !== 'PUT')) fail('Method not allowed.', 405);
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') fail('Send an application/json request.', 415);
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 100000) fail('Request is too large.', 413); }
    let input;
    try { input = JSON.parse(raw); } catch { fail('Invalid JSON.'); }
    db.exec('BEGIN IMMEDIATE');
    try {
      if (kind !== 'properties' && !properties.some(row => row.id === property)) fail('Select a property.');
      const scope = kind === 'properties' ? '' : property;
      const records = Object.fromEntries(Object.keys(modules).map(key => [key, list(key, key === 'properties' ? '' : property)]));
      const current = id ? records[kind].find(row => row.id === id) : null;
      if (id && !current) fail('Record not found.', 404);
      const body = validate(kind, input, current, records);
      let savedId = id;
      if (id) db.prepare('UPDATE records SET body = ? WHERE id = ?').run(JSON.stringify(body), id);
      else savedId = add(kind, scope, body);
      if (kind === 'reservations' && current?.status === 'Checked in' && (body.status !== 'Checked in' || body.room !== current.room)) {
        const { id: roomId, ...room } = records.rooms.find(row => row.id === current.room);
        db.prepare('UPDATE records SET body = ? WHERE id = ?').run(JSON.stringify({ ...room, status: 'Cleaning' }), roomId);
        audit.run(property, new Date().toISOString(), 'Updated', 'Rooms', `Room ${room.name} · Cleaning`);
      }
      const name = body.name || (body.table ? `Order · ${body.table}` : records.guests.find(row => row.id === body.guest)?.name);
      const details = [name, body.status].filter(Boolean).join(' · ');
      audit.run(kind === 'properties' ? savedId : property, new Date().toISOString(), id ? 'Updated' : 'Created', modules[kind].title, details);
      db.exec('COMMIT');
      return send(res, id ? 200 : 201, { id: savedId, ...body });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } catch (error) {
    if (!error.status) console.error(error);
    send(res, error.status || 500, { error: error.status ? error.message : 'Unexpected server error.' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer(handleRequest);
  const host = process.env.HOTEL_HOST || '127.0.0.1';
  server.listen(Number(process.env.PORT || 3001), host, () => console.log(`Frontdesk listening on ${host}:${server.address().port}`));
}
