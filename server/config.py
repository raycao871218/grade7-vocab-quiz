import os
from pathlib import Path


def load_env_file(path: str = ".env") -> dict[str, str]:
    env_path = Path(path)
    if not env_path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


def get_env() -> dict[str, str]:
    file_env = load_env_file()
    return {**file_env, **os.environ}


def get_database_kwargs() -> dict[str, object]:
    env = get_env()

    if env.get("DATABASE_URL"):
        return {
            "conninfo": env["DATABASE_URL"],
        }

    return {
        "host": env.get("DB_HOST"),
        "port": int(env.get("DB_PORT", "5432")),
        "dbname": env.get("DB_NAME"),
        "user": env.get("DB_USER"),
        "password": env.get("DB_PASSWORD"),
    }


def get_vocab_list_slug() -> str:
    return get_env().get("VOCAB_LIST_SLUG", "grade7-renjiao-placement")
