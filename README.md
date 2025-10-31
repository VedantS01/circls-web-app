This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Development: preview auth emails in console

While developing locally you can generate and preview Supabase auth emails (password reset / verification / magic links) without sending real email providers. Start the dev server and then POST to the dev endpoint:

Endpoint: POST /api/dev-email-log

Body JSON (example):

```json
{

  "email": "you@example.com",
  "type": "recovery",
  "redirectTo": "https://localhost:3000/after"
}
```

The endpoint is enabled only when NODE_ENV=development and will print a formatted preview of the email content (link/OTP) to the server console and return the generated properties in JSON.

## Confirm email flow & server endpoints

This project includes a small confirm-email UI and a few server endpoints to help manage programmatic flows:

- `GET /confirm-email` — client page that lets users resend confirmation email.
- `POST /api/resend-confirmation` — server endpoint that attempts to generate/send a confirmation link using the admin client (requires service role key).
- `POST /api/server/create-profile` — server-side upsert for `profiles` using the service role key. Body: `{ id, full_name, avatar_url }`.
- `POST /api/server/create-user` — server-side create user via the admin auth API. Body: `{ email, password }`.

Note: The server endpoints require `SUPABASE_SERVICE_ROLE_KEY` (or equivalent) to be set in your environment so `supabaseAdmin` is available. If it is not present the endpoints will return 501.
