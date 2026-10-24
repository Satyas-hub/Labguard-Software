# LABGUARD Production Deployment Guide

---

## 1. Database Setup (Supabase PostgreSQL)

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Execute the schema migration:
   - Copy contents of `database/migrations/01_initial_schema.sql` and run.
   - Copy contents of `database/migrations/02_indexes_and_rls.sql` and run.
   - Copy contents of `database/migrations/03_production_academic_and_enrollment.sql` and run.
4. Execute the institutional seed data:
   - Copy contents of `database/seed/01_seed_data.sql` and run.
5. Create a public bucket named `evidence` under **Storage** for ticket photo uploads.
6. Obtain your database connection string:
   `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`

---

## 2. Backend Deployment (Node.js & Express)

### Environment Variables
Configure the following environment variables in your server or container (`backend/.env`):
- `PORT`: `5000`
- `NODE_ENV`: `production`
- `JWT_SECRET`: Secure cryptographic string
- `JWT_EXPIRES_IN`: `8h`
- `OFFLINE_TOKEN_SECRET`: Secure offline token verification secret
- `SUPABASE_URL`: `https://[YOUR-PROJECT-REF].supabase.co`
- `SUPABASE_KEY`: `[YOUR-SUPABASE-SERVICE-KEY]`
- `DATABASE_URL`: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

### Building & Running
```bash
cd backend
npm install
npm run build
npm start
```

---

## 3. Windows Native Application Deployment (Lab Workstations)

1. Build the production Windows installer using the Inno Setup build pipeline:
   ```powershell
   .\installer\build_installer.ps1
   ```
2. The standalone installer is generated at `dist/LABGUARD-Setup.exe`.
3. Distribute `LABGUARD-Setup.exe` to target lab workstations or run the automated provisioning script:
   ```powershell
   .\installer\install_engine.ps1
   ```
   This provisions `%ProgramData%\LABGUARD` (`database`, `config`, `sync`, `logs`, `evidence`), registers Desktop and Start Menu shortcuts, and creates Windows Add/Remove Programs uninstall entries.
4. Configure workstation identity via the Administrative Console (`Workstation Settings`):
   - `Laboratory Code`: e.g. `LAB-01`
   - `Computer Code`: e.g. `PC-017`
   - `Central Backend URL`: e.g. `http://[SERVER-IP]:5000`
5. Windows Auto-Startup: Configured automatically via standard Windows Startup shortcuts or Windows Shell Launcher / Assigned Access policy.
