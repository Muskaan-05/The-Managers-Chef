# Module Documentation: database/

**Owner:** Developer A
**Depends on:** `.env` with a valid Supabase Postgres connection string
**Used by:** every model file, every service file that touches the database, Alembic

This directory has one job: give the rest of the app a safe, reliable way to talk to Postgres, without any other file needing to know *how* that connection works.

---

## 1. `database/base.py`

### Purpose
Defines the single shared "template" that every model (User, Task, Event, etc.) inherits from. This is what lets SQLAlchemy know "these Python classes represent database tables," and it's what Alembic reads later to figure out what tables *should* exist.

### Input
None at runtime. This file has no function calls, no parameters — it just declares one object.

### Output
A single object called `Base`, which every file in `models/` imports and inherits from.

### How to build it
```python
# database/base.py
from sqlalchemy.orm import declarative_base

Base = declarative_base()
```

That's genuinely the whole file for MVP. Optionally, add a shared mixin here if every table should have the same `created_at`/`updated_at` behavior, so you don't repeat it in every model:

```python
from sqlalchemy import Column, DateTime
from sqlalchemy.sql import func

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### How it fits with everything else
```
base.py  --defines-->  Base
                          |
                          v
models/user.py  -->  class User(Base): ...
models/task.py  -->  class Task(Base): ...
                          |
                          v
                 Base.metadata  (a registry of every table)
                          |
                          v
              migrations/ reads this to generate schema
```

If a model file forgets to inherit from this `Base`, Alembic will never see that table and it will silently not get created. This is the #1 mistake to check for if a table "doesn't exist" later.

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Import `Base` from `database/base.py` | No error; `Base` is a usable class |
| 2 | Define a throwaway model inheriting from `Base` with a `__tablename__` | It appears in `Base.metadata.tables` |
| 3 | Two different model files both import the *same* `Base` | `Base.metadata.tables` contains tables from both files (proves it's shared, not duplicated) |

---

## 2. `database/session.py`

### Purpose
Opens the actual connection to your Supabase Postgres database, and gives the rest of the app a safe, repeatable way to borrow a connection, use it, and give it back — without every route/service having to manage connections themselves.

### Input
- Reads `DATABASE_URL` (or equivalent Supabase connection string) from environment variables via `config.py`
- At call-time: nothing — routes/services just ask for a session, they don't pass connection details

### Output
- An **engine** (the thing that knows how to talk to Postgres)
- A **session factory** you can call to get a new session
- A **dependency function** (commonly called `get_db()`) that FastAPI routes/services use to receive a working session and have it automatically closed afterward

### How to build it
```python
# database/session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Why `get_db()` is written as a generator (`yield` instead of `return`):** this is a FastAPI pattern. FastAPI runs the code before `yield` when a request comes in, hands your route the session, and — no matter what happens in the route, success or error — runs the code after `yield` (closing the connection) once the request is done. This guarantees you never leak an open connection, even if the route crashes.

### How it fits with everything else
```
Incoming API request
        |
        v
FastAPI route  ---calls--->  get_db()  --gives-->  a working session
        |                                                |
        v                                                v
   calls a service function, passing the session in ----+
        |
        v
   service uses session.query(...) / session.add(...) / session.commit()
        |
        v
   route finishes  --->  get_db()'s "finally" block closes the session
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Run `session.py` directly (a tiny `if __name__ == "__main__":` block that opens a session and runs `SELECT 1`) | Returns a result with no error — proves the connection string works |
| 2 | Deliberately set `DATABASE_URL` to something invalid and try to connect | A clear, readable error is raised (not a silent hang) |
| 3 | Call `get_db()`, use the session to run a query, let the generator finish | The session's `.close()` is actually called (check via a print statement or connection pool count) |
| 4 | Open 20 sessions in a loop via `get_db()` | No "too many connections" error — proves sessions are being closed, not leaked |

---

## 3. `database/migrations/` (Alembic)

### Purpose
Keeps a version-controlled history of every change to your database schema, and is the actual mechanism that creates your tables in Supabase in the first place (and updates them later, without losing existing data).

### Input
- `Base.metadata` from `base.py` (so Alembic knows what the *code* says tables should look like)
- The current actual state of the Supabase database (so Alembic knows what to change)
- `DATABASE_URL` from config, to know which database to connect to

### Output
- Versioned Python files under `migrations/versions/`, each describing one schema change (e.g. "create users table," "add priority column to tasks")
- When run, these scripts actually create/alter tables in your live Supabase database

### How to build it (one-time setup)
```bash
# from the backend/ directory
alembic init app/database/migrations
```

Then edit two generated files:

**`alembic.ini`** — point `sqlalchemy.url` at your Supabase connection string (or better, load it from `.env` inside `env.py` so it's not hardcoded).

**`migrations/env.py`** — import your models' `Base` so Alembic can see every table:
```python
from app.database.base import Base
from app.models import user, context, context_item, task, event, commitment, meeting, decision, reminder  # noqa

target_metadata = Base.metadata
```
(This import line is easy to forget — if a new model doesn't show up in a migration, this is almost always why.)

### How to use it day-to-day
```bash
# after adding/changing a model:
alembic revision --autogenerate -m "add commitment table"

# review the generated file in migrations/versions/ — autogenerate isn't perfect

# apply it to the actual database:
alembic upgrade head

# to undo the most recent migration:
alembic downgrade -1
```

### How it fits with everything else
```
models/*.py  (inherit from Base)
        |
        v
Base.metadata  (the "should look like this" version)
        |
        v
alembic revision --autogenerate  --compares against-->  actual Supabase tables
        |
        v
generates a migration file (the "diff")
        |
        v
alembic upgrade head  --applies-->  Supabase database now matches your models
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Run `alembic upgrade head` on a fresh Supabase project | All tables from `models/` appear in the Supabase dashboard, with correct columns and types |
| 2 | Change a model (e.g. add a field to `Task`) and run `alembic revision --autogenerate` | A new migration file is generated that only contains that one field addition, nothing else |
| 3 | Run `alembic upgrade head` again with no model changes | No error, nothing happens (idempotent) |
| 4 | Run `alembic downgrade -1` after applying a migration | The most recent schema change is reverted, and earlier data is untouched |
| 5 | Two developers each add a different new table locally, then merge | Alembic should be able to apply both migrations in sequence without conflict — worth a quick manual check the first time this happens |

---

## Quick sanity checklist before moving on to `models/`

- [ ] `session.py` connects successfully when run directly
- [ ] `base.py`'s `Base` is importable with no circular import errors
- [ ] `alembic upgrade head` runs clean against a fresh Supabase database
- [ ] Adding a throwaway model and re-running `alembic revision --autogenerate` correctly picks it up
