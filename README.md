# موقع أسعار الذهب — Gold catalog

A view-only catalog in Arabic, with an admin page for managing stock.

- `index.html`: customer catalog. Prices update every day from the gold price. Customers can filter, save favorites and send them on WhatsApp.
- `admin.html`: admin page. Add pieces with photos, grams, karat and stock. Set the WhatsApp number, the amount added per piece (default 500 QR) and an optional manual gold price.

## Price formula
The admin page offers two ways to price:
- **Today's gold price** (default): `grams × today's gram price for that karat + commission (500 QR, or a per-piece amount)`. The 24K price comes from the live world price (api.gold-api.com, USD per ounce × 3.64 ÷ 31.1035). Other karats are 24K × karat ÷ 24.
- **Fixed price**: `grams × the gram price the admin sets for that karat`. No commission is added.

Customers only see the final price. Gold gram prices stay internal.

## Setup
1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Supabase → Authentication → Users → Add user (the admin's email and password).
3. Put the project URL and publishable key in `config.js`.
4. Host the folder anywhere static (Vercel, Netlify, GitHub Pages).

When `config.js` is empty, the site runs in demo mode and keeps its data in the browser only.
