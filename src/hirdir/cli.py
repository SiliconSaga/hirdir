"""`hirdir` command line: build a team's season workbook from a config file."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import config, workbook
from .bake import BakeError, bake

DEFAULT_OUT_DIR = Path("local")  # gitignored: team configs and workbooks name children


def _out_path(cfg_path: Path, given: str | None) -> Path:
    """Default output lands in ./local/ — gitignored, alongside the configs."""
    if given:
        return Path(given)
    return DEFAULT_OUT_DIR / f"{cfg_path.stem}.xlsx"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hirdir", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build", help="generate the season workbook for one team")
    build.add_argument("config", help="team config JSON (see examples/example-team.json)")
    build.add_argument(
        "-o", "--out", help=f"output path (default: {DEFAULT_OUT_DIR}/<config>.xlsx)"
    )
    build.add_argument(
        "--no-bake",
        action="store_true",
        help="skip caching computed values (faster; previews then show blanks)",
    )

    args = parser.parse_args(argv)
    cfg_path = Path(args.config)
    try:
        cfg = config.load(cfg_path)
    except (OSError, config.ConfigError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    out = workbook.write(cfg, _out_path(cfg_path, args.out))
    lineup = ", ".join(p.name for p in cfg.players)
    print(f"wrote {out}")
    print(f"  {len(cfg.players)} players (youngest first): {lineup}")
    print(f"  {len(cfg.games)} games: {', '.join(cfg.sheet_names)}")

    if not args.no_bake:
        try:
            print(f"  cached {bake(out)} computed values for previews")
        except BakeError as exc:
            print(f"warning: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
