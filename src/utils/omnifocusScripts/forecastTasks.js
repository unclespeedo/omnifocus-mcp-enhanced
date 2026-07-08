// OmniJS script to get forecast tasks from OmniFocus
(() => {
  try {
    // Read injected parameters (falls back to defaults if not injected)
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const days = args.days || 7;
    const hideCompleted = args.hideCompleted !== undefined ? args.hideCompleted : true;
    const includeDeferredOnly = args.includeDeferredOnly || false;

    // Helper function to format dates consistently
    function formatDate(date) {
      if (!date) return null;
      return date.toISOString();
    }

    // Helper function to get date without time for grouping
    function getDateKey(date) {
      if (!date) return null;
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().split('T')[0];
    }

    // Get task status enum mapping
    const taskStatusMap = {
      [Task.Status.Available]: "Available",
      [Task.Status.Blocked]: "Blocked",
      [Task.Status.Completed]: "Completed",
      [Task.Status.Dropped]: "Dropped",
      [Task.Status.DueSoon]: "DueSoon",
      [Task.Status.Next]: "Next",
      [Task.Status.Overdue]: "Overdue"
    };

    function getTaskStatus(status) {
      return taskStatusMap[status] || "Unknown";
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      tasksByDate: {}
    };

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + days);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Get all active tasks
    let allTasks = flattenedTasks;

    // Filter by completion status if needed
    if (hideCompleted) {
      allTasks = allTasks.filter(task =>
        task.taskStatus !== Task.Status.Completed &&
        task.taskStatus !== Task.Status.Dropped
      );
    }

    // Process each task to see if it falls in forecast range
    allTasks.forEach(task => {
      try {
        let shouldInclude = false;
        let taskDate = null;
        let isDue = false;

        // Check if task has due date in range or is overdue
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const dueDateDay = new Date(dueDate);
          dueDateDay.setHours(0, 0, 0, 0);

          // Due within range
          if (dueDateDay >= today && dueDateDay < endDate) {
            shouldInclude = true;
            taskDate = dueDateDay;
            isDue = true;
          }
          // Overdue (due before today)
          else if (dueDateDay < today) {
            shouldInclude = true;
            taskDate = dueDateDay;
            isDue = true;
          }
        }

        // Include flagged items under today (matching native forecast behavior)
        if (!shouldInclude && task.flagged) {
          shouldInclude = true;
          taskDate = today;
          isDue = false;
        }

        // Check if task has defer date in range (becomes available)
        if (!includeDeferredOnly && !shouldInclude) {
          if (task.deferDate && !isDue) {
            const deferDate = new Date(task.deferDate);
            deferDate.setHours(0, 0, 0, 0);

            if (deferDate >= today && deferDate < endDate) {
              shouldInclude = true;
              taskDate = deferDate;
              isDue = false;
            }
          }
        }

        if (shouldInclude && taskDate) {
          const dateKey = getDateKey(taskDate);

          if (!exportData.tasksByDate[dateKey]) {
            exportData.tasksByDate[dateKey] = [];
          }

          const taskData = {
            id: task.id.primaryKey,
            name: task.name,
            note: task.note || "",
            taskStatus: getTaskStatus(task.taskStatus),
            flagged: task.flagged,
            dueDate: formatDate(task.dueDate),
            deferDate: formatDate(task.deferDate),
            plannedDate: formatDate(task.plannedDate),
            estimatedMinutes: task.estimatedMinutes,
            projectId: task.containingProject ? task.containingProject.id.primaryKey : null,
            projectName: task.containingProject ? task.containingProject.name : null,
            inInbox: task.inInbox,
            isDue: isDue,
            tags: task.tags.map(tag => ({
              id: tag.id.primaryKey,
              name: tag.name
            }))
          };

          exportData.tasksByDate[dateKey].push(taskData);
        }
      } catch (taskError) {
        console.log(`Error processing forecast task: ${taskError}`);
      }
    });

    // Count total tasks
    const totalTasks = Object.values(exportData.tasksByDate).reduce((sum, tasks) => sum + tasks.length, 0);

    return JSON.stringify(exportData);

  } catch (error) {
    console.error(`Error in forecastTasks script: ${error}`);
    return JSON.stringify({
      success: false,
      error: `Error getting forecast tasks: ${error}`
    });
  }
})();
