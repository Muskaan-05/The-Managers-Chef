from datetime import datetime, timedelta


def detect_conflicts(scheduled_items):
    """
    Detect overlapping scheduled items.

    Each item must contain:
    - id
    - start_time
    - end_time
    """
    conflicts = []

    items = sorted(
        scheduled_items,
        key=lambda item: item["start_time"],
    )

    for index, item_a in enumerate(items):
        for item_b in items[index + 1:]:
            if item_b["start_time"] >= item_a["end_time"]:
                break

            overlap_start = max(
                item_a["start_time"],
                item_b["start_time"],
            )
            overlap_end = min(
                item_a["end_time"],
                item_b["end_time"],
            )

            if overlap_start < overlap_end:
                overlap_minutes = int(
                    (overlap_end - overlap_start).total_seconds() / 60
                )

                conflicts.append(
                    {
                        "event_a": item_a["id"],
                        "event_b": item_b["id"],
                        "overlap_minutes": overlap_minutes,
                    }
                )

    return conflicts


def find_free_slots(
    fixed_items,
    day_start,
    day_end,
):
    """
    Find free time slots between fixed events.
    """
    sorted_items = sorted(
        fixed_items,
        key=lambda item: item["start_time"],
    )

    free_slots = []
    current_time = day_start

    for item in sorted_items:
        start_time = max(item["start_time"], day_start)
        end_time = min(item["end_time"], day_end)

        if start_time > current_time:
            free_slots.append(
                {
                    "start_time": current_time,
                    "end_time": start_time,
                }
            )

        if end_time > current_time:
            current_time = end_time

    if current_time < day_end:
        free_slots.append(
            {
                "start_time": current_time,
                "end_time": day_end,
            }
        )

    return free_slots


def schedule_tasks(
    tasks,
    fixed_items,
    day_start,
    day_end,
):
    """
    Schedule flexible tasks into available free time.

    Tasks should contain:
    - id
    - estimated_duration
    - deadline
    - priority

    Fixed items contain:
    - id
    - start_time
    - end_time
    """
    conflicts = detect_conflicts(fixed_items)

    free_slots = find_free_slots(
        fixed_items,
        day_start,
        day_end,
    )

    priority_order = {
        "urgent": 0,
        "high": 1,
        "medium": 2,
        "low": 3,
    }

    sorted_tasks = sorted(
        tasks,
        key=lambda task: (
            task.get("deadline") or datetime.max,
            priority_order.get(
                task.get("priority", "medium"),
                2,
            ),
        ),
    )

    scheduled = []
    unscheduled = []

    for task in sorted_tasks:
        duration = task["estimated_duration"]

        task_scheduled = False

        for slot in free_slots:
            available_minutes = int(
                (slot["end_time"] - slot["start_time"]).total_seconds()
                / 60
            )

            if available_minutes < duration:
                continue

            task_start = slot["start_time"]
            task_end = task_start + timedelta(minutes=duration)

            deadline = task.get("deadline")

            if deadline is not None and task_end > deadline:
                continue

            scheduled.append(
                {
                    "task_id": task["id"],
                    "start_time": task_start,
                    "end_time": task_end,
                }
            )

            slot["start_time"] = task_end
            task_scheduled = True
            break

        if not task_scheduled:
            unscheduled.append(task["id"])

    return {
        "scheduled": scheduled,
        "conflicts": conflicts,
        "unscheduled": unscheduled,
    }