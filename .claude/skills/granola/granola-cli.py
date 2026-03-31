#!/usr/bin/env python3

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path


def get_cache_file():
    """Find the latest Granola cache file."""
    cache_dir = Path.home() / "Library/Application Support/Granola"
    if not cache_dir.exists():
        print(f"Error: Granola cache directory not found at {cache_dir}")
        sys.exit(1)

    cache_files = sorted(cache_dir.glob("cache-*.json"), reverse=True)
    if not cache_files:
        print("Error: No cache files found")
        sys.exit(1)

    return cache_files[0]


def load_cache():
    """Load and return the Granola cache data."""
    cache_file = get_cache_file()
    with open(cache_file, "r") as f:
        return json.load(f)


def list_meetings(limit=None):
    """List all meeting notes."""
    data = load_cache()
    docs = data["cache"]["state"]["documents"]

    meetings = sorted(docs.items(), key=lambda x: x[1]["created_at"], reverse=True)
    if limit:
        meetings = meetings[:limit]

    for doc_id, doc in meetings:
        title = doc.get("title", "Untitled")
        date = doc["created_at"][:10]
        print(f"{date} | {title} | {doc_id}")


def recent_meetings(days=7):
    """List meetings from last N days."""
    data = load_cache()
    docs = data["cache"]["state"]["documents"]

    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    recent = [(d["created_at"], d) for d in docs.values() if d["created_at"] > cutoff]

    for date, doc in sorted(recent, reverse=True):
        print(f"{date[:10]} | {doc.get('title', 'Untitled')}")


def search_titles(query):
    """Search meeting titles."""
    data = load_cache()
    docs = data["cache"]["state"]["documents"]

    query_lower = query.lower()
    for doc_id, doc in docs.items():
        title = doc.get("title", "").lower()
        if query_lower in title:
            print(f"{doc['created_at'][:10]} | {doc.get('title', 'Untitled')}")


def search_notes(query):
    """Search within note content."""
    data = load_cache()
    docs = data["cache"]["state"]["documents"]

    query_lower = query.lower()
    for doc_id, doc in docs.items():
        content = (doc.get("notes_plain", "") or doc.get("notes_markdown", "")).lower()
        if query_lower in content:
            print(f"{doc['created_at'][:10]} | {doc.get('title', 'Untitled')}")
            idx = content.find(query_lower)
            start = max(0, idx - 50)
            end = min(len(content), idx + len(query) + 50)
            print(f"  ...{content[start:end]}...")
            print()


def get_meeting(doc_id):
    """Get meeting details by ID."""
    data = load_cache()
    state = data["cache"]["state"]
    doc = state["documents"].get(doc_id)

    if not doc:
        print(f"Error: Meeting {doc_id} not found")
        return

    print(f"Title: {doc.get('title', 'Untitled')}")
    print(f"Created: {doc['created_at']}")
    print(f"Updated: {doc['updated_at']}")

    if doc.get("google_calendar_event"):
        evt = doc["google_calendar_event"]
        print(f"Start: {evt.get('start', {}).get('dateTime')}")
        print(f"End: {evt.get('end', {}).get('dateTime')}")
        attendees = [a.get("email", "") for a in evt.get("attendees", [])]
        if attendees:
            print(f"Attendees: {', '.join(attendees)}")

    print(f"\nNotes:")
    notes = doc.get("notes_plain") or doc.get("notes_markdown") or "No notes"
    print(notes)


def get_transcript(doc_id):
    """Get transcript for a meeting."""
    data = load_cache()
    transcripts = data["cache"]["state"]["transcripts"]
    segments = transcripts.get(doc_id, [])

    if not segments:
        print(f"No transcript found for {doc_id}")
        return

    for seg in segments:
        time = seg["start_timestamp"][11:19]  # Extract HH:MM:SS
        print(f"[{time}] {seg['text']}")


def show_cache_info():
    """Show cache file location and stats."""
    cache_file = get_cache_file()
    data = load_cache()

    docs = data["cache"]["state"]["documents"]
    transcripts = data["cache"]["state"]["transcripts"]

    print(f"Cache file: {cache_file}")
    print(f"Total meetings: {len(docs)}")
    print(f"Total transcripts: {len(transcripts)}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] == "help":
        print("""Usage: granola-cli <command> [args]

Commands:
  list [limit]              List all meetings
  recent [days]             List meetings from last N days (default: 7)
  search-title <query>      Search meeting titles
  search-notes <query>      Search within note content
  get <doc_id>              Get meeting details by ID
  transcript <doc_id>       Get transcript for meeting
  info                      Show cache info

Examples:
  granola-cli list 10
  granola-cli recent 3
  granola-cli search-title "Project GO"
  granola-cli get 9078c7e6-bc44-4784-a3bb-04a22e4728b3
  granola-cli transcript 9078c7e6-bc44-4784-a3bb-04a22e4728b3
""")
        return

    cmd = sys.argv[1]
    args = sys.argv[2:]

    try:
        if cmd == "list":
            limit = int(args[0]) if args else None
            list_meetings(limit)
        elif cmd == "recent":
            days = int(args[0]) if args else 7
            recent_meetings(days)
        elif cmd == "search-title":
            if not args:
                print("Error: Query required")
                sys.exit(1)
            search_titles(" ".join(args))
        elif cmd == "search-notes":
            if not args:
                print("Error: Query required")
                sys.exit(1)
            search_notes(" ".join(args))
        elif cmd == "get":
            if not args:
                print("Error: Document ID required")
                sys.exit(1)
            get_meeting(args[0])
        elif cmd == "transcript":
            if not args:
                print("Error: Document ID required")
                sys.exit(1)
            get_transcript(args[0])
        elif cmd == "info":
            show_cache_info()
        else:
            print(f"Unknown command: {cmd}")
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
