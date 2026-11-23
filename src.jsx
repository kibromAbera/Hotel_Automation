import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownLeft, ArrowUpRight, BedDouble, Building2, CalendarDays, ChevronDown, ClipboardList, Grid2X2, Hotel, Menu as MenuIcon, Package, Plus, Receipt, Search, Sparkles, Users, Utensils, Wallet, X } from 'lucide-react';
import { modules, fieldName } from './schema.mjs';
import './style.css';

const navigation = [
  ['Workspace', [['overview', 'Overview', Grid2X2], ['reservations', 'Reservations', CalendarDays], ['guests', 'Guests', Users], ['rooms', 'Rooms', BedDouble], ['housekeeping', 'Housekeeping', Sparkles]]],
  ['Restaurant', [['orders', 'Restaurant orders', Utensils], ['menu', 'Menu', ClipboardList], ['inventory', 'Inventory', Package]]],
  ['Management', [['billing', 'Billing', Receipt], ['activity', 'Activity log', Activity], ['properties', 'Properties', Building2]]]
];
const money = amount => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const displayDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Addis_Ababa', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');
function Badge({ status }) { return <span className={'badge ' + statusClass(status)}>{status}</span>; }
async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function App() {
  const [page, setPage] = useState('overview');
  const [state, setState] = useState(null);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [sidebar, setSidebar] = useState(false);
  const [switching, setSwitching] = useState(false);
  const load = async property => {
    const data = await request('/api/state' + (property ? '?property=' + encodeURIComponent(property) : ''));
    localStorage.setItem('frontdesk-property', data.property);
    setState(data);
  };
  useEffect(() => { load(localStorage.getItem('frontdesk-property')).catch(error => setFailure(error.message)); }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(timeout);
  }, [notice]);
  const go = target => { setPage(target); setSearch(''); setSidebar(false); };
  const open = (kind, row) => setDialog({ kind, row });
  const property = state?.properties.find(row => row.id === state.property);
  const restaurant = property?.type === 'Restaurant';
  const active = modules[page];
  const title = active?.title || (page === 'activity' ? 'Activity log' : 'Overview');
  const label = (key, value) => state?.[key]?.find(row => row.id === value)?.name || '—';
  const chooseProperty = async id => {
    setSwitching(true);
    setFailure('');
    try { await load(id); go('overview'); } catch (error) { setFailure(error.message); } finally { setSwitching(false); }
  };
  const save = async (kind, row, body) => {
    const result = await request('/api/records/' + kind + (row ? '/' + row.id : '') + '?property=' + encodeURIComponent(state.property), {
      method: row ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setDialog(null);
    setNotice(row ? 'Changes saved' : 'Record added');
    try { await load(kind === 'properties' && !row ? result.id : state.property); }
    catch (error) { setFailure('Saved successfully. Refresh to reload the records. ' + error.message); }
  };
  const format = (key, value, type) => {
    if (key === 'status') return <Badge status={value}/>;
    if (type?.startsWith?.('@')) return label(type.slice(1), value);
    if (key === 'items') return value.map(item => item.name + ' × ' + item.quantity).join(', ');
    if (['rate', 'price', 'amount', 'total'].includes(key)) return money(value);
    return value === '' ? '—' : value;
  };

  return <div className="layout">
    <aside className={sidebar ? 'sidebar shown' : 'sidebar'}>
      <div className="brand"><span className="brand-icon"><Hotel size={22}/></span><div>Frontdesk<small>Hospitality management</small></div></div>
      <div className="property"><Building2 size={19}/><label><span>Current property</span><select aria-label="Current property" disabled={!state?.properties.length || switching} value={state?.property || ''} onChange={event => chooseProperty(event.target.value)}>{!property && <option value="">Select a property</option>}{state?.properties.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><ChevronDown size={15}/></div>
      <nav>{navigation.map(([group, entries]) => <div className="nav-group" key={group}><div className="nav-label">{group}</div>{entries.filter(([key]) => !restaurant || !['rooms', 'reservations', 'housekeeping'].includes(key)).map(([key, name, Icon]) => <button key={key} className={page === key ? 'nav-item selected' : 'nav-item'} onClick={() => go(key)}><Icon size={18}/>{name}</button>)}</div>)}</nav>
      <div className="staff"><span className="avatar">FD</span><div>Frontdesk workspace<small>{property?.type || 'Hospitality operations'}</small></div></div>
    </aside>
    <main>
      <header className="topbar"><div><button className="icon-button mobile-toggle" aria-label="Toggle navigation" onClick={() => setSidebar(!sidebar)}><MenuIcon size={22}/></button><span>Workspace</span><span className="crumb">/</span><strong>{title}</strong></div><div className="today"><CalendarDays size={17}/>{displayDay}</div></header>
      <div className="content">
        {failure && <p role="alert" className="error">{failure}</p>}
        {!state && !failure && <p role="status">Loading workspace…</p>}
        {state && page === 'overview' && (property ? <Dashboard state={state} property={property} restaurant={restaurant} label={label} go={go} open={open}/> : <div className="panel empty"><h1>Set up your first property</h1><p>Add a hotel, resort, or restaurant to start managing operations.</p><button className="primary" onClick={() => open('properties')}><Plus size={18}/> Add property</button></div>)}
        {state && active && <>
          <div className="heading"><div><h1>{title}</h1><p>{page === 'properties' ? 'Manage your hotels, resorts, and restaurants.' : property?.name || 'Choose a property to manage its records.'}</p></div><button className="primary" disabled={!property && page !== 'properties'} onClick={() => open(page)}><Plus size={18}/> Add {active.singular}</button></div>
          <div className="panel records"><div className="table-tools"><label className="search"><Search size={18}/><input aria-label={'Search ' + title.toLowerCase()} placeholder={'Search ' + title.toLowerCase() + '…'} value={search} onChange={event => setSearch(event.target.value)}/></label></div>
          <div className="scroll"><table><thead><tr>{Object.entries(active.fields).map(([key, type]) => <th key={key}>{fieldName(key, type)}</th>)}{page === 'orders' && <th>Total</th>}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {state[page].filter(row => Object.entries(active.fields).map(([key, type]) => type?.startsWith?.('@') ? label(type.slice(1), row[key]) : JSON.stringify(row[key])).join(' ').toLowerCase().includes(search.toLowerCase().trim())).map(row => <tr key={row.id}>{Object.entries(active.fields).map(([key, type]) => <td key={key}>{format(key, row[key], type)}</td>)}{page === 'orders' && <td>{money(row.total)}</td>}<td><button className="text-button" onClick={() => open(page, row)}>Edit</button></td></tr>)}
          </tbody></table></div>
          {!state[page].length && <p className="empty">No {title.toLowerCase()} yet.</p>}</div>
        </>}
        {state && page === 'activity' && <><div className="heading"><div><h1>Activity log</h1><p>Recent changes for {property?.name || 'the current property'}.</p></div></div><div className="panel scroll"><table><thead><tr><th>Time</th><th>Action</th><th>Area</th><th>Details</th></tr></thead><tbody>{state.activity.map(row => <tr key={row.id}><td>{new Date(row.timestamp).toLocaleString(undefined, { timeZone: 'Africa/Addis_Ababa' })}</td><td>{row.action}</td><td>{row.area}</td><td>{row.details}</td></tr>)}</tbody></table>{!state.activity.length && <p className="empty">No activity yet.</p>}</div></>}
      </div>
    </main>
    {dialog && <Editor {...dialog} state={state} close={() => setDialog(null)} save={save}/>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}

function Dashboard({ state, property, restaurant, label, go, open }) {
  const arrivals = state.reservations.filter(row => row.arrival === day && row.status === 'Confirmed');
  const departures = state.reservations.filter(row => row.departure === day && row.status === 'Checked in');
  const occupied = state.reservations.filter(row => row.status === 'Checked in').length;
  const occupancy = state.rooms.length ? Math.round(occupied * 100 / state.rooms.length) : 0;
  const orders = state.orders.filter(row => ['New', 'Preparing', 'Ready'].includes(row.status));
  const paid = state.billing.filter(row => row.status === 'Paid').reduce((sum, row) => sum + row.amount, 0);
  const lowStock = state.inventory.filter(row => row.quantity <= row.threshold);
  const stats = [
    ...(restaurant ? [[Utensils, 'Open orders', orders.length, 'In the restaurant queue', 'purple'], [Users, 'Guests', state.guests.length, 'Guest directory', 'green'], [Package, 'Low stock', lowStock.length, 'At or below reorder level', 'orange']] : [[BedDouble, 'Occupancy', occupancy + '%', occupied + ' of ' + state.rooms.length + ' rooms occupied', 'purple'], [ArrowDownLeft, 'Expected arrivals', arrivals.length, 'Due to check in today', 'green'], [ArrowUpRight, 'Expected departures', departures.length, 'Due to check out today', 'orange']]),
    [Wallet, 'Paid invoices', money(paid), 'Total recorded payments', 'blue']
  ];
  const bookings = [...arrivals, ...departures];
  return <>
    <section className="hero"><div className="hero-art" aria-hidden="true"/><div className="hero-body"><div className="hero-property"><Building2 size={16}/>{property.name}</div><h1>Operations overview</h1><p>{restaurant ? 'Keep track of orders, inventory, and payments.' : 'Keep track of arrivals, rooms, and restaurant service.'}</p><button onClick={() => open(restaurant ? 'orders' : 'reservations')}><Plus size={18}/>{restaurant ? 'New order' : 'New reservation'}</button></div><Hotel className="hero-icon" size={176} strokeWidth={0.9} aria-hidden="true"/></section>
    <div className="stats">{stats.map(([Icon, name, value, subtitle, color]) => <div className="stat panel" key={name}><span className={'stat-icon ' + color}><Icon size={21}/></span><div className="stat-label">{name}</div><strong>{value}</strong><small>{subtitle}</small></div>)}</div>
    <div className="dashboard-grid">
      {!restaurant && <section className="panel"><div className="panel-heading"><div><h2>Today’s front desk</h2><p>Expected arrivals and departures</p></div><button className="text-button" onClick={() => go('reservations')}>View reservations</button></div><div className="scroll"><table><thead><tr><th>Guest</th><th>Room</th><th>Status</th></tr></thead><tbody>{bookings.map(row => <tr key={row.id}><td><button className="guest-link" onClick={() => open('reservations', row)}>{label('guests', row.guest)}</button></td><td>{label('rooms', row.room)}</td><td><Badge status={row.status}/></td></tr>)}</tbody></table></div>{!bookings.length && <p className="empty">No arrivals or departures scheduled for today.</p>}</section>}
      <section className="panel"><div className="panel-heading"><div><h2>Restaurant queue</h2><p>{orders.length} active {orders.length === 1 ? 'order' : 'orders'}</p></div><button className="text-button" onClick={() => go('orders')}>View orders</button></div>{orders.slice(0, 5).map(row => <div className="queue" key={row.id}><span className="stat-icon purple"><Utensils size={17}/></span><div><button className="guest-link" onClick={() => open('orders', row)}>{/^\d+$/.test(row.table) ? 'Table ' + row.table : row.table}</button><small>{row.items.map(item => item.name + ' × ' + item.quantity).join(', ')}</small></div><Badge status={row.status}/></div>)}{!orders.length && <p className="empty">No active orders.</p>}</section>
      {restaurant && <section className="panel"><div className="panel-heading"><div><h2>Stock to reorder</h2><p>Items at or below their reorder level</p></div><button className="text-button" onClick={() => go('inventory')}>View inventory</button></div>{lowStock.map(row => <div className="queue" key={row.id}><span className="stat-icon orange"><Package size={17}/></span><div><button className="guest-link" onClick={() => open('inventory', row)}>{row.name}</button><small>{row.quantity} {row.unit} remaining</small></div></div>)}{!lowStock.length && <p className="empty">Stock levels are above their reorder points.</p>}</section>}
    </div>
  </>;
}

function Editor({ kind, row, state, close, save }) {
  const config = modules[kind];
  const modal = useRef(null);
  const [values, setValues] = useState(() => Object.fromEntries(Object.entries(config.fields).map(([key, type]) => [key, row?.[key] ?? (Array.isArray(type) ? type[0] : type.startsWith('*') ? [] : '')])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = modal.current;
    element.showModal();
    return () => element.close();
  }, []);
  const set = (key, value) => setValues(old => ({ ...old, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try { await save(kind, row, values); } catch (issue) { setError(issue.message); setBusy(false); }
  };
  return <dialog ref={modal} className="editor" aria-labelledby="editor-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}><div className="editor-heading"><h2 id="editor-title">{row ? 'Edit' : 'Add'} {config.singular}</h2><button className="icon-button" aria-label="Close editor" disabled={busy} onClick={close}><X size={22}/></button></div><form onSubmit={submit}><div className="fields">{Object.entries(config.fields).map(([key, type]) => {
    const name = fieldName(key, type);
    if (typeof type === 'string' && type.startsWith('*')) {
      const items = [...new Map([...state.menu.filter(item => item.status === 'Available'), ...values.items].map(item => [item.id, item])).values()];
      return <fieldset key={key}><legend>{name}</legend>{items.length ? items.map(item => <label className="quantity" key={item.id}>{item.name}<input aria-label={'Quantity for ' + item.name} type="number" min="0" max="999" step="1" value={values.items.find(value => value.id === item.id)?.quantity ?? 0} onChange={event => { const quantity = Number(event.target.value); set(key, [...values.items.filter(value => value.id !== item.id), ...(quantity ? [{ id: item.id, quantity, name: item.name, price: item.price }] : [])]); }}/></label>) : <p>Add an available menu item before creating an order.</p>}</fieldset>;
    }
    const choices = Array.isArray(type) ? type.map(value => ({ id: value, name: value })) : type.startsWith('@') ? state[type.slice(1)] : null;
    return <label key={key}>{name}{choices ? <select required value={values[key]} onChange={event => set(key, event.target.value)}>{!Array.isArray(type) && <option value="">Select {name.toLowerCase()}</option>}{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select> :
      <input required={!config.optional?.includes(key)} maxLength={240} type={type.startsWith('#') ? 'number' : type.startsWith('Date:') ? 'date' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} min={type.startsWith('#') ? 0 : undefined} step={type.startsWith('#') ? '0.01' : undefined} value={values[key]} onChange={event => set(key, type.startsWith('#') && event.target.value !== '' ? Number(event.target.value) : event.target.value)}/>}</label>;
  })}</div>{error && <p className="error" role="alert">{error}</p>}<div className="editor-actions"><button type="button" className="secondary" onClick={close} disabled={busy}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save ' + config.singular}</button></div></form></dialog>;
}

createRoot(document.getElementById('root')).render(<App/>);
