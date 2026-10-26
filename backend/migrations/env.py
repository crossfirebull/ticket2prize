from alembic import context
from sqlalchemy import text

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.config import get_settings
from app.db import Base, make_engine

# Arbitrary constant: every API task runs migrations on boot, and this Postgres
# advisory lock makes sure only one of them does it at a time.
MIGRATION_LOCK_ID = 7_202_306


def run_migrations() -> None:
    engine = make_engine(get_settings().sqlalchemy_url)
    with engine.connect() as connection:
        is_postgres = connection.dialect.name == "postgresql"
        if is_postgres:
            connection.execute(text("SELECT pg_advisory_lock(:id)"), {"id": MIGRATION_LOCK_ID})
            connection.commit()
        try:
            context.configure(
                connection=connection,
                target_metadata=Base.metadata,
                compare_type=True,
                render_as_batch=connection.dialect.name == "sqlite",
            )
            with context.begin_transaction():
                context.run_migrations()
        finally:
            if is_postgres:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:id)"), {"id": MIGRATION_LOCK_ID}
                )
                connection.commit()


run_migrations()
