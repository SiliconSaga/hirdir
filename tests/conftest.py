import json
from pathlib import Path

import pytest

from hirdir import config

EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "example-team.json"


@pytest.fixture
def example_data() -> dict:
    return json.loads(EXAMPLE.read_text())


@pytest.fixture
def cfg(example_data) -> config.TeamConfig:
    return config.parse(example_data)


@pytest.fixture
def workbook_file(cfg, tmp_path) -> Path:
    from hirdir import workbook

    return workbook.write(cfg, tmp_path / "example.xlsx")
