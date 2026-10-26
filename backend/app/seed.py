"""Load the prize catalog. Safe to run repeatedly: existing SKUs are left alone."""

import json
from importlib.resources import files

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Prize


def seed_prizes(db: Session) -> int:
    catalog = json.loads(files("app").joinpath("seed_data/prizes.json").read_text())
    existing = set(db.scalars(select(Prize.sku)))
    new = [Prize(**item) for item in catalog if item["sku"] not in existing]
    db.add_all(new)
    db.commit()
    return len(new)


if __name__ == "__main__":
    with SessionLocal() as session:
        print(f"Seeded {seed_prizes(session)} prizes")
