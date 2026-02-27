#!/bin/bash
# Mirehub - Kanban task completion hook (auto-generated)
# Checks the kanban ticket status and writes the appropriate activity status.
# PENDING + CTO → auto-approve: revert to TODO (unblock CTO cycle)
# PENDING + regular → activity "waiting" (double bell in Electron)
# FAILED  → activity "failed"  (quad bell in Electron)
# WORKING → interrupted, revert to TODO (renderer handles re-launch)
# DONE    → activity "done" (already written by mirehub-activity.sh)
ACTIVITY_SCRIPT="$HOME/.mirehub/hooks/mirehub-activity.sh"

[ -z "$MIREHUB_KANBAN_TASK_ID" ] && exit 0
[ -z "$MIREHUB_KANBAN_FILE" ] && exit 0

# Read ticket status and isCtoTicket flag
read -r TICKET_STATUS IS_CTO <<< $(node -e "
const fs = require('fs');
const file = process.env.MIREHUB_KANBAN_FILE;
const taskId = process.env.MIREHUB_KANBAN_TASK_ID;
try {
  const tasks = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const task = tasks.find(t => t.id === taskId);
  if (task) process.stdout.write(task.status + ' ' + (task.isCtoTicket ? 'true' : 'false'));
} catch(e) { /* ignore */ }
")

case "$TICKET_STATUS" in
  PENDING)
    if [ "$IS_CTO" = "true" ]; then
      # CTO auto-approve: set back to TODO to unblock the CTO cycle
      node -e "
const fs = require('fs');
const file = process.env.MIREHUB_KANBAN_FILE;
const taskId = process.env.MIREHUB_KANBAN_TASK_ID;
try {
  const tasks = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const task = tasks.find(t => t.id === taskId);
  if (task && task.status === 'PENDING') {
    task.status = 'TODO';
    task.updatedAt = Date.now();
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2), 'utf-8');
  }
} catch(e) { /* ignore */ }
"
    else
      bash "$ACTIVITY_SCRIPT" waiting
    fi
    ;;
  FAILED)
    bash "$ACTIVITY_SCRIPT" failed
    ;;
  WORKING)
    # Claude was interrupted — revert to TODO
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
    ;;
esac
