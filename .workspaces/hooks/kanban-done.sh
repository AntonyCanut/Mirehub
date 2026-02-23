#!/bin/bash
# theOne - Kanban task completion hook (auto-generated)
[ -z "$THEONE_KANBAN_TASK_ID" ] && exit 0
[ -z "$THEONE_KANBAN_FILE" ] && exit 0

node -e "
const fs = require('fs');
const file = process.env.THEONE_KANBAN_FILE;
const taskId = process.env.THEONE_KANBAN_TASK_ID;
try {
  const tasks = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const task = tasks.find(t => t.id === taskId);
  if (task && task.status === 'WORKING') {
    task.status = 'DONE';
    task.updatedAt = Date.now();
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2), 'utf-8');
  }
} catch(e) { /* ignore */ }
"
