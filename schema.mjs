export const modules = {
  properties: { title: 'Properties', singular: 'property', fields: { name: 'Property name', type: ['Hotel', 'Restaurant', 'Resort'], address: 'Address' } },
  guests: { title: 'Guests', singular: 'guest', fields: { name: 'Full name', email: 'Email', phone: 'Phone' }, optional: ['email', 'phone'] },
  rooms: { title: 'Rooms', singular: 'room', fields: { name: 'Room number', type: ['Standard', 'Deluxe', 'Suite'], rate: '#Nightly rate', status: ['Ready', 'Cleaning', 'Maintenance'] } },
  reservations: { title: 'Reservations', singular: 'reservation', fields: { guest: '@guests', room: '@rooms', arrival: 'Date:Arrival', departure: 'Date:Departure', status: ['Confirmed', 'Checked in', 'Checked out', 'Cancelled'] } },
  menu: { title: 'Menu', singular: 'menu item', fields: { name: 'Item name', category: ['Starter', 'Main', 'Dessert', 'Drink'], price: '#Price', status: ['Available', 'Unavailable'] } },
  orders: { title: 'Restaurant orders', singular: 'order', fields: { table: 'Table or takeaway reference', items: '*menu', status: ['New', 'Preparing', 'Ready', 'Served', 'Cancelled'] } },
  housekeeping: { title: 'Housekeeping', singular: 'task', fields: { room: '@rooms', name: 'Task', assignee: 'Assigned to', status: ['Open', 'In progress', 'Done'] }, optional: ['assignee'] },
  inventory: { title: 'Inventory', singular: 'stock item', fields: { name: 'Item name', category: 'Category', quantity: '#Quantity', unit: 'Unit', threshold: '#Reorder level' } },
  billing: { title: 'Billing', singular: 'invoice', fields: { name: 'Invoice description', source: ['Reservation', 'Restaurant', 'Other'], reference: 'Reference', amount: '#Amount', status: ['Unpaid', 'Paid', 'Void'] }, optional: ['reference'] }
};
export const fieldName = (key, value) => Array.isArray(value) ? key[0].toUpperCase() + key.slice(1) : value.startsWith('@') || value.startsWith('*') ? ({ guest: 'Guest', room: 'Room', items: 'Menu items' })[key] : value.replace(/^#|^Date:/, '');
