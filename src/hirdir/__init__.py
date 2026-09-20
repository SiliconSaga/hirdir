"""Hirðir — coaching tool for MTL youth soccer.

Phase 0 (here): printable season workbooks, one sheet per game, recording
field time as stopwatch minutes in and out.
"""

from .config import TeamConfig, load
from .workbook import build, write

__all__ = ["TeamConfig", "build", "load", "write"]
__version__ = "0.1.0"
