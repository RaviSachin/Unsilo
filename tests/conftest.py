import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from unsilo import db, llm, pipeline  # noqa: E402
from unsilo.config import settings  # noqa: E402


@pytest.fixture()
def conn(tmp_path, monkeypatch):
    """Fresh database loaded with the practice fixtures, LLM switched off for deterministic tests."""
    monkeypatch.setattr(llm, "provider", lambda: "none")
    monkeypatch.setattr(settings, "reference_date_raw", "")
    monkeypatch.setattr(settings, "sandbox_email", "")
    monkeypatch.setattr(settings, "output_dir", tmp_path / "outputs")
    c = db.connect(tmp_path / "test.db")
    db.set_conn(c)
    pipeline.load_fixtures(c)
    pipeline.analyse(c)
    yield c
    c.close()
