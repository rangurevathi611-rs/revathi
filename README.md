# TrustVault

TrustVault is a multi-tenant document vault. Each company is its own organization. Files are encrypted at rest, shared only with named people, and every sign-in, view, download, share, revoke, delete, and role change is written to an append-only audit trail.

## Stack

- React (Vite) client on port 5173
- Express API on port 4000
- MongoDB database `trustvault`

## Setup

MongoDB must be running locally.

```powershell
cd server
copy .env.example .env
```

Fill in `server/.env`:

- `JWT_SECRET` and `JWT_REFRESH_SECRET`: long random strings
- `ENCRYPTION_KEY`: 32 bytes of base64

```powershell
node -e "const c=require('crypto'); console.log(c.randomBytes(32).toString('hex')); console.log(c.randomBytes(32).toString('base64'))"
```

The first line is a JWT secret. The second is `ENCRYPTION_KEY`. Use a different secret for `JWT_REFRESH_SECRET`.

```powershell
cd server
npm install
npm run seed
npm run dev
```

In a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open http://localhost:5173.

## Demo company

`npm run seed` creates Northwind Trading. The password for every demo account is `TrustVault1!`.

| Email | Role | What they can open |
| --- | --- | --- |
| owner@northwind.dev | Owner | Every company document, members, and the audit trail |
| member@northwind.dev | Member | Only documents they upload or that are shared with them |
| viewer@northwind.dev | Viewer | Q3 Board Minutes, including download |

The member account is intentionally not on the minutes, so opening that document while signed in as Miles is refused.

## Access rules

- Registering creates a company and an owner.
- Owners and admins can see every document in their company, manage members, and read the company audit log. Only an owner can appoint an admin.
- Members upload documents and share documents they own.
- Viewers see only documents granted to them.
- A grant can allow download or keep the file sealed, and it can expire.
- Queries are scoped to the signed-in company. A document id from another company is not found.
- Downloads go through the API after the access check. There is no public file URL.
- Audit events cannot be updated through the API. Deleting a document removes the encrypted file and leaves the history.

## Useful scripts

- `npm run dev` in `server` restarts the API when files change
- `npm start` in `server` runs it once
- `npm run seed` in `server` resets the Northwind demo data
- `npm run build` in `client` builds the static app
