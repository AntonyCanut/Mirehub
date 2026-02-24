#!/bin/bash
# Mirehub - Kanban task completion hook (auto-generated)
# If the task is still WORKING when Claude stops, it means Claude did NOT
# finish (interrupted). Revert to TODO so it can be re-scheduled.
# When Claude succeeds, it writes DONE itself before exiting.
[ -z "$MIREHUB_KANBAN_TASK_ID" ] && exit 0
[ -z "$MIREHUB_KANBAN_FILE" ] && exit 0

node -e "
const fs = require('fs');
const file = process.env.MIREHUB_KANBAN_FILE;
const taskId = process.env.MIREHUB_KANBAN_TASK_ID;
try {
  const tasks = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const task = tasks.find(t => t.id === taskId);
  if (task && task.status === 'WORKING') {
    task.status = 'TODO';
    task.updatedAt = Date.now();
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2), 'utf-8');
  }
} catch(e) { /* ignore */ }
"
