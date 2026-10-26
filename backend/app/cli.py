"""Admin commands, e.g. `python -m app.cli create-staff alex@example.com 'a-long-password'`."""

import argparse

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Account, Role, Wallet
from app.security import hash_password


def create_staff(email: str, password: str, name: str) -> None:
    with SessionLocal() as db:
        account = db.scalar(select(Account).where(Account.email == email.lower()))
        if account is None:
            wallet = Wallet()
            db.add(wallet)
            db.flush()
            account = Account(email=email.lower(), display_name=name, wallet_id=wallet.id)
            db.add(account)
        account.password_hash = hash_password(password)
        account.role = Role.staff
        db.commit()
        print(f"{account.email} is now staff")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    staff = sub.add_parser("create-staff", help="create a staff account, or promote one")
    staff.add_argument("email")
    staff.add_argument("password")
    staff.add_argument("--name", default="Counter Staff")
    args = parser.parse_args()
    if args.command == "create-staff":
        create_staff(args.email, args.password, args.name)


if __name__ == "__main__":
    main()
