# LoanHarmony API — Laravel Backend

REST API backend for the LoanHarmony (LendPro) loan management system.
Sits alongside the frontend at `../loan-harmony`.

## Requirements
- PHP 8.2+
- Composer
- SQLite (default, zero-config) or MySQL/PostgreSQL

## Setup

```bash
cd loan-harmony-api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve
```

API runs at `http://localhost:8000`.

---

## Authentication

All routes except `POST /api/auth/login` require a Bearer token.

```bash
# Login
POST /api/auth/login
Body: { "email": "alex@lendpro.ph", "password": "password" }
# Returns: { "token": "...", "user": { ... } }

# Pass token in all requests:
Authorization: Bearer <token>
```

### Seeded accounts

| Email | Password | Role |
|-------|----------|------|
| alex@lendpro.ph | password | sysadmin |
| grace.sy@lendpro.ph | password | manager |
| mark.rivera@lendpro.ph | password | collector |
| accounting@lendpro.ph | password | accounting_clerk |

---

## API Reference

### Auth
| Method | URL | Notes |
|--------|-----|-------|
| POST | `/api/auth/login` | Returns token + user |
| POST | `/api/auth/logout` | Revokes current token |
| GET | `/api/auth/me` | Current user info |

### Dashboard
| Method | URL | Notes |
|--------|-----|-------|
| GET | `/api/dashboard/stats` | Counts, financials, monthly data, collector stats |

### Clients  `GET ?search= ?type= ?status= ?collector_id=`
| Method | URL |
|--------|-----|
| GET | `/api/clients` |
| POST | `/api/clients` |
| GET | `/api/clients/{id}` |
| PATCH | `/api/clients/{id}` |
| DELETE | `/api/clients/{id}` |

### Loans  `GET ?status= ?collector_id= ?client_id=`
| Method | URL |
|--------|-----|
| GET | `/api/loans` |
| POST | `/api/loans` |
| GET | `/api/loans/{id}` |
| GET | `/api/loans/{id}/schedule` |
| PATCH | `/api/loans/{id}` |
| DELETE | `/api/loans/{id}` |

**Create loan payload:**
```json
{
  "client_id": 1,
  "collector_id": 1,
  "loan_type": "new-loan",
  "principal": 10000,
  "interest": 1500,
  "service_charge": 500,
  "daily_payment": 267,
  "term_days": 45,
  "release_date": "2026-05-18"
}
```
`total_receivable`, `due_date` (Sunday-skipping), and the full schedule are auto-computed.

### Payments  `GET ?loan_id= ?client_id= ?collector_id= ?date=`
| Method | URL |
|--------|-----|
| GET | `/api/payments` |
| POST | `/api/payments` |
| GET | `/api/payments/{id}` |
| GET | `/api/payments/collector-summary?date=&collector_id=` |

Recording a payment automatically updates `loans.current_balance` and the matching schedule row.

### Collectors
| Method | URL |
|--------|-----|
| GET | `/api/collectors` |
| POST | `/api/collectors` |
| GET | `/api/collectors/{id}` |
| PATCH | `/api/collectors/{id}` |

### Reports
| Method | URL |
|--------|-----|
| GET | `/api/reports/monthly-releases` |
| GET | `/api/reports/monthly-collection` |
| GET | `/api/reports/collector-summary?month=YYYY-MM` |
| GET | `/api/reports/client-ledger?loan_id=` |
| GET | `/api/reports/audit-logs` |

---

## Database

SQLite by default — no setup needed. To use MySQL, update `.env`:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=loan_harmony
DB_USERNAME=root
DB_PASSWORD=
```

Then re-run `php artisan migrate:fresh --seed`.

---

## Connecting to the Frontend

Set the API base URL in the frontend (`../loan-harmony`) to:

```
VITE_API_URL=http://localhost:8000/api
```

CORS is pre-configured for `localhost:5173` (Vite) and `localhost:3000`.
