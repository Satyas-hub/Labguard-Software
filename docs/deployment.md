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

## 2. Backend Deployment (Java Spring Boot)

### Environment Variables
Configure the following environment variables in your server or container:
- `SPRING_DATASOURCE_URL`: `jdbc:postgresql://db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?sslmode=require`
- `SPRING_DATASOURCE_USERNAME`: `postgres`
- `SPRING_DATASOURCE_PASSWORD`: `[YOUR-DB-PASSWORD]`
- `JWT_SECRET`: 256-bit secure hex key (e.g. `404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970`)

### Building & Running with Docker
```bash
cd backend
docker build -t labguard-backend:latest .
docker run -d -p 8080:8080 \
  -e SPRING_DATASOURCE_URL="jdbc:postgresql://..." \
  -e SPRING_DATASOURCE_USERNAME="postgres" \
  -e SPRING_DATASOURCE_PASSWORD="..." \
  labguard-backend:latest
```

---

## 3. Windows Native Application Deployment (Lab Workstations)

1. Build the standalone self-contained release binary:
   ```powershell
   .\scripts\build_executables.ps1
   ```
2. The standalone single-file binary is generated at `dist/LABGUARD.exe` (and copied to the root).
3. Distribute `LABGUARD.exe` to target lab workstations or run:
   ```powershell
   .\scripts\install_labguard.ps1
   ```
   This automatically installs the application to `%LOCALAPPDATA%\Programs\LabGuard`, creates Start Menu and Desktop shortcuts, and registers with Windows Add/Remove Programs.
4. Configure workstation identity inside `LABGUARD.exe` via the Administrator Console (`Workstation Settings` tab):
   - `Laboratory Code`: e.g. `LAB-03`
   - `Computer Code`: e.g. `PC-017`
   - `Central Backend URL`: e.g. `https://api.yourinstitution.edu`
5. Windows Auto-Startup: Configured automatically via standard Windows Startup shortcuts or Windows Shell Launcher / Assigned Access policy.
