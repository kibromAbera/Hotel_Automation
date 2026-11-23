# Frontdesk Hospitality Management

Frontdesk is a React and Node.js starter for hotels, resorts, and standalone restaurants. SQLite stores records on the machine running the server. Each property has its own guest records, orders, invoices, and activity log.

## Run locally

Install Node.js 22.13 or newer, then run these commands from the project folder:

```sh
npm install
npm run build
npm start
```

Open http://127.0.0.1:3001. The first run creates a sample hotel so you can try the workflows. To start with an empty database, set `HOTEL_SEED=0` before the first launch. The default database is `data/frontdesk.sqlite`. Set `HOTEL_DB` to use a different SQLite file and `PORT` to change the server port.

For frontend development, leave `npm start` running on port 3001 and run `npm run dev` in a second terminal. Vite displays the development URL.

## Daily workflows

- **Front desk:** Add guests and rooms, book a stay, and update the reservation at check-in or checkout. Overlapping bookings are rejected. Checkout changes the room to Cleaning.
- **Housekeeping:** Assign and track room tasks. Update the room to Ready when it is available again.
- **Restaurant:** Set menu prices and availability, add table or takeaway orders, and update the kitchen queue. Existing orders retain their recorded item prices.
- **Inventory and billing:** Maintain stock counts and reorder levels. Enter invoices and record their payment status manually.
- **Properties and auditing:** Add another property from Properties and switch using the sidebar. Restaurant properties show restaurant operations in place of room workflows. Activity records include timestamps, areas, and changes.

The dashboard uses Addis Ababa time and displays amounts in USD. The app listens on loopback and is intended for local evaluation. A shared installation requires staff authentication and permissions, backups, and a deployment setup. Billing records payment status without processing payments.
