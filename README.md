# DahlCardZ (Frontend + Vercel API + Supabase)

## Setup

1. Opret Supabase-projekt og kopier:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - (valgfrit) bucket `listing-images` i Storage (public).
2. Kør SQL i Supabase (se i projektbeskrivelsen) for at oprette `listings` + RLS.
3. (Valgfrit) Markér admin-brugerens app_metadata: `{ "role": "admin" }`.
4. Opret Vercel projekt, læg hele mappen op.
5. Tilføj Vercel env vars: Supabase, Stripe, PayPal, BASE_URL.
6. Deploy.

## Brug

- **Registrering/login** via prompt (simpelt demo-ui).
- **Opret opslag** (forsiden): upload billede → insert i DB.
- **Alle opslag**: søg/filtrér/sortér/paginer.
- **Kurv & betaling**: Stripe Checkout + PayPal.
- **Admin**: `admin.html` (kræver role = admin) → slet/redigér alle opslag.
