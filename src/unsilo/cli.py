"""Command line. Run from the repo root: python -m unsilo.cli <command>  (with src/ on PYTHONPATH)

  demo               load practice fixtures, analyse, export outputs (works offline, no keys)
  sync gmail|drive   pull live data (needs Google sign-in via the API first)
  analyse            run classification, unanswered detection, interpretation
  export             write outputs/*.json
  ask "question"     ask a question, print answer + citations
  chat               interactive question loop
"""
from __future__ import annotations

import argparse
import json
import sys

from . import db, export, pipeline
from .query.answer import ask


def _print_answer(result: dict) -> None:
    print("\n" + result["answer"])
    for c in result["citations"]:
        print(f'  - {c["source_id"]}  {c["date"][:10]}  {c["title"]}')
    print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="unsilo")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("demo")
    s = sub.add_parser("sync")
    s.add_argument("provider", choices=["gmail", "drive"])
    sub.add_parser("analyse")
    sub.add_parser("export")
    a = sub.add_parser("ask")
    a.add_argument("question")
    a.add_argument("--json", action="store_true")
    sub.add_parser("chat")
    args = parser.parse_args(argv)

    conn = db.get_conn()
    pipeline.apply_fixture_meta(conn)
    if args.cmd == "demo":
        print("Loaded:", pipeline.load_fixtures(conn))
        print("Analysed:", pipeline.analyse(conn))
        print("Wrote:", *export.write_all(conn), sep="\n  ")
    elif args.cmd == "sync":
        print(pipeline.sync(conn, args.provider))
    elif args.cmd == "analyse":
        print(json.dumps(pipeline.analyse(conn), indent=2))
    elif args.cmd == "export":
        print(*export.write_all(conn), sep="\n")
    elif args.cmd == "ask":
        result = ask(conn, args.question)
        print(json.dumps(result, indent=2)) if args.json else _print_answer(result)
    elif args.cmd == "chat":
        print("Ask anything about WhatsApp, Gmail and Drive. Empty line to quit.")
        while (q := input("> ").strip()):
            _print_answer(ask(conn, q))
    return 0


if __name__ == "__main__":
    sys.exit(main())
