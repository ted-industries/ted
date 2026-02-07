import json
import os
import sys
from collections import Counter
from datetime import datetime

# Path to telemetry log
LOG_PATH = os.path.expandvars(r"%AppData%\com.tomlin7.ted\telemetry.jsonl")

def analyze_logs():
    if not os.path.exists(LOG_PATH):
        print(f"Log file not found at: {LOG_PATH}")
        return

    events = []
    with open(LOG_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

    if not events:
        print("No events found in log.")
        return

    print(f"\n--- Telemetry Analysis Report ---")
    print(f"Total Events Captured: {len(events)}")
    print(f"Log File Location: {LOG_PATH}\n")

    # 1. Session Stats
    sessions = set(e.get('sessionId') for e in events)
    print(f"Unique Sessions: {len(sessions)}")

    # 2. Event Types Breakdown
    event_counts = Counter(e.get('type') for e in events)
    print("\nEvent Breakdown:")
    for event_type, count in event_counts.most_common():
        print(f"  - {event_type}: {count}")

    # 3. File Activity
    file_opens = [e['payload'].get('name') for e in events if e.get('type') == 'file_open']
    if file_opens:
        print("\nMost Opened Files:")
        for file, count in Counter(file_opens).most_common(5):
            print(f"  - {file}: {count} times")

    # 4. Typing Stats
    typing_events = [e for e in events if e.get('type') == 'typing']
    total_chars_inserted = sum(len(e['payload'].get('insert', '')) for e in typing_events if e['payload'].get('type') == 'change')
    print(f"\nTyping Activity:")
    print(f"  - Total Characters Typed: {total_chars_inserted}")
    
    # 5. Command Usage
    commands = [e['payload'].get('label') for e in events if e.get('type') == 'command_executed']
    if commands:
        print("\nTop Commands Used:")
        for cmd, count in Counter(commands).most_common(5):
            print(f"  - {cmd}: {count} times")

    print(f"\n--- End of Report ---\n")
    print("Interpretation:")
    print("This data allows an AI to understand your context.")
    print("For example, seeing 'file_open: package.json' followed by 'typing' suggests you are modifying dependencies.")
    print("Seeing frequent 'command_executed: git commit' patterns allows the AI to suggest batched commits.")

if __name__ == "__main__":
    analyze_logs()
