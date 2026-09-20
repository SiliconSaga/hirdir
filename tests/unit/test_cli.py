import json

import pytest

from hirdir import cli


@pytest.fixture
def config_file(example_data, tmp_path):
    path = tmp_path / "team.json"
    path.write_text(json.dumps(example_data))
    return path


def test_build_writes_the_workbook_and_reports_the_lineup(config_file, tmp_path, capsys):
    out = tmp_path / "book.xlsx"
    assert cli.main(["build", str(config_file), "-o", str(out), "--no-bake"]) == 0
    assert out.exists()
    printed = capsys.readouterr().out
    assert "youngest first" in printed
    assert "Dev" in printed


def test_build_defaults_into_the_gitignored_local_dir(config_file, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert cli.main(["build", str(config_file), "--no-bake"]) == 0
    assert (tmp_path / "local" / "team.xlsx").exists()


def test_a_broken_config_exits_with_an_error(tmp_path, capsys):
    bad = tmp_path / "bad.json"
    bad.write_text('{"team": "No players"}')
    assert cli.main(["build", str(bad), "--no-bake"]) == 2
    assert "missing 'players'" in capsys.readouterr().err


def test_a_missing_config_exits_with_an_error(tmp_path, capsys):
    assert cli.main(["build", str(tmp_path / "nope.json"), "--no-bake"]) == 2
    assert "error:" in capsys.readouterr().err
