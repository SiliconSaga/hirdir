import pytest

from hirdir import config


def test_players_are_ordered_youngest_first(cfg):
    assert [p.name for p in cfg.players] == [
        "Dev", "Gita", "Bjorn", "Cleo", "Hugo", "Esme", "Ada", "Finn",
    ]


def test_players_without_a_birthdate_keep_their_order_at_the_end(example_data):
    example_data["players"] = [
        {"name": "NoDob1"},
        {"name": "Young", "dob": "2022-06-28"},
        {"name": "NoDob2"},
    ]
    parsed = config.parse(example_data)
    assert [p.name for p in parsed.players] == ["Young", "NoDob1", "NoDob2"]


def test_sheet_names_are_numbered_and_within_excel_limits(cfg):
    assert cfg.sheet_names[0] == "G1 Sep20 Otters"
    assert all(len(name) <= config.MAX_SHEET_NAME for name in cfg.sheet_names)


def test_long_opponent_names_are_truncated(example_data):
    example_data["games"] = [{"date": "2026-09-20", "opponent": "T" * 60, "field": "1"}]
    assert len(config.parse(example_data).sheet_names[0]) == config.MAX_SHEET_NAME


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda d: d.pop("team"), "missing 'team'"),
        (lambda d: d.pop("players"), "missing 'players'"),
        (lambda d: d.pop("games"), "missing 'games'"),
        (lambda d: d["games"][0].update(date="not-a-date"), "not a YYYY-MM-DD date"),
        (lambda d: d["players"][0].update(dob="1970-13-45"), "not a YYYY-MM-DD date"),
        (lambda d: d["players"][0].pop("name"), "missing 'name'"),
        (lambda d: d.update(on_field=0), "'on_field' must be at least 1"),
        (lambda d: d.update(stints=0), "'stints' must be at least 1"),
    ],
)
def test_bad_configs_are_rejected_with_a_useful_message(example_data, mutate, message):
    mutate(example_data)
    with pytest.raises(config.ConfigError, match=message):
        config.parse(example_data)


def test_load_reports_invalid_json(tmp_path):
    path = tmp_path / "broken.json"
    path.write_text("{not json")
    with pytest.raises(config.ConfigError, match="not valid JSON"):
        config.load(path)
