import os
from dataclasses import dataclass


def _required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is not set")
    return value


@dataclass(frozen=True)
class Config:
    database_url: str
    rabbitmq_url: str
    gemini_api_key: str
    # Cheap, search-capable model for retrieval; stronger model for synthesis.
    # gemini-2.5-pro is the recommended synthesis override where cost allows.
    search_model: str
    synthesis_model: str

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            database_url=_required("DATABASE_URL"),
            rabbitmq_url=_required("RABBITMQ_URL"),
            gemini_api_key=_required("GEMINI_API_KEY"),
            search_model=os.environ.get("MESH_SEARCH_MODEL", "gemini-2.5-flash"),
            synthesis_model=os.environ.get("MESH_SYNTHESIS_MODEL", "gemini-2.5-flash"),
        )
