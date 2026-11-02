"""Controlled administrator provisioning tool.

Usage:
    python -m app.create_admin --email admin@emporiodamusica.com.br --name "Administrador" --password "SenhaForte123"
    python -m app.create_admin (interactive prompt)
"""

import argparse
import getpass
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def create_or_update_admin(name: str, email: str, password: str) -> None:
    """Provisions an administrator user safely in PostgreSQL."""
    db = SessionLocal()
    normalized_email = email.strip().lower()

    try:
        stmt = select(User).where(User.email == normalized_email)
        user = db.execute(stmt).scalar_one_or_none()

        if user:
            print(f"User with email '{normalized_email}' already exists.")
            user.is_admin = True
            user.name = name.strip()
            user.password_hash = hash_password(password)
            db.commit()
            print(f"[SUCCESS] User '{normalized_email}' updated with administrator privileges.")
        else:
            new_admin = User(
                name=name.strip(),
                email=normalized_email,
                password_hash=hash_password(password),
                is_admin=True,
                customer_id=None,
            )
            db.add(new_admin)
            db.commit()
            print(f"[SUCCESS] Administrator '{normalized_email}' created successfully (ID: {new_admin.id}).")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to provision administrator: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Provision an administrator account for Empório da Música.")
    parser.add_argument("--name", type=str, help="Full name of administrator")
    parser.add_argument("--email", type=str, help="Email address of administrator")
    parser.add_argument("--password", type=str, help="Password for administrator")

    args = parser.parse_args()

    name = args.name
    email = args.email
    password = args.password

    if not email:
        email = input("Administrator email: ").strip()
    if not name:
        name = input("Administrator name [Administrador]: ").strip() or "Administrador"
    if not password:
        password = getpass.getpass("Administrator password: ")

    if len(password) < 6:
        print("[ERROR] Password must be at least 6 characters.", file=sys.stderr)
        sys.exit(1)

    create_or_update_admin(name=name, email=email, password=password)


if __name__ == "__main__":
    main()

