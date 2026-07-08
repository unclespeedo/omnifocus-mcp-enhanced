#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from 'node:module';

const { version } = createRequire(import.meta.url)('../package.json');

// Import tool definitions
import * as dumpDatabaseTool from './tools/definitions/dumpDatabase.js';
import * as addOmniFocusTaskTool from './tools/definitions/addOmniFocusTask.js';
import * as addProjectTool from './tools/definitions/addProject.js';
import * as removeItemTool from './tools/definitions/removeItem.js';
import * as editItemTool from './tools/definitions/editItem.js';
import * as moveTaskTool from './tools/definitions/moveTask.js';
import * as batchAddItemsTool from './tools/definitions/batchAddItems.js';
import * as batchRemoveItemsTool from './tools/definitions/batchRemoveItems.js';
import * as getTaskByIdTool from './tools/definitions/getTaskById.js';
import * as readTaskAttachmentTool from './tools/definitions/readTaskAttachment.js';
import * as getTodayCompletedTasksTool from './tools/definitions/getTodayCompletedTasks.js';
// Import perspective tools
import * as getInboxTasksTool from './tools/definitions/getInboxTasks.js';
import * as getFlaggedTasksTool from './tools/definitions/getFlaggedTasks.js';
import * as getForecastTasksTool from './tools/definitions/getForecastTasks.js';
import * as getTasksByTagTool from './tools/definitions/getTasksByTag.js';
// Import ultimate filter tool
import * as filterTasksTool from './tools/definitions/filterTasks.js';
// Import custom perspective tools
import * as listCustomPerspectivesTool from './tools/definitions/listCustomPerspectives.js';
import * as getCustomPerspectiveTasksTool from './tools/definitions/getCustomPerspectiveTasks.js';

// Create an MCP server
const server = new McpServer({
  name: "OmniFocus MCP",
  version
});

// Register tools
server.registerTool(
  "dump_database",
  {
    description: "Gets the current state of your OmniFocus database",
    inputSchema: dumpDatabaseTool.schema.shape
  },
  dumpDatabaseTool.handler
);

server.registerTool(
  "add_omnifocus_task",
  {
    description: "Add a new task to OmniFocus",
    inputSchema: addOmniFocusTaskTool.schema.shape
  },
  addOmniFocusTaskTool.handler
);

server.registerTool(
  "add_project",
  {
    description: "Add a new project to OmniFocus",
    inputSchema: addProjectTool.schema.shape
  },
  addProjectTool.handler
);

server.registerTool(
  "remove_item",
  {
    description: "Remove a task or project from OmniFocus",
    inputSchema: removeItemTool.schema.shape
  },
  removeItemTool.handler
);

server.registerTool(
  "edit_item",
  {
    description: "Edit a task or project in OmniFocus",
    inputSchema: editItemTool.schema.shape
  },
  editItemTool.handler
);

server.registerTool(
  "move_task",
  {
    description: "Move an existing task to a project, parent task, or inbox",
    inputSchema: moveTaskTool.schema.shape
  },
  moveTaskTool.handler
);

server.registerTool(
  "batch_add_items",
  {
    description: "Add multiple tasks or projects to OmniFocus in a single operation",
    inputSchema: batchAddItemsTool.schema.shape
  },
  batchAddItemsTool.handler
);

server.registerTool(
  "batch_remove_items",
  {
    description: "Remove multiple tasks or projects from OmniFocus in a single operation",
    inputSchema: batchRemoveItemsTool.schema.shape
  },
  batchRemoveItemsTool.handler
);


server.registerTool(
  "get_task_by_id",
  {
    description: "Get information about a specific task by ID or name",
    inputSchema: getTaskByIdTool.schema.shape
  },
  getTaskByIdTool.handler
);

server.registerTool(
  "read_task_attachment",
  {
    description: "Read a task attachment reported by get_task_by_id. Images are returned as MCP image content when possible.",
    inputSchema: readTaskAttachmentTool.schema.shape
  },
  readTaskAttachmentTool.handler
);

server.registerTool(
  "get_today_completed_tasks",
  {
    description: "Get tasks completed today - view today's accomplishments",
    inputSchema: getTodayCompletedTasksTool.schema.shape
  },
  getTodayCompletedTasksTool.handler
);

// Register perspective tools
server.registerTool(
  "get_inbox_tasks",
  {
    description: "Get tasks from OmniFocus inbox perspective",
    inputSchema: getInboxTasksTool.schema.shape
  },
  getInboxTasksTool.handler
);

server.registerTool(
  "get_flagged_tasks",
  {
    description: "Get flagged tasks from OmniFocus with optional project filtering",
    inputSchema: getFlaggedTasksTool.schema.shape
  },
  getFlaggedTasksTool.handler
);

server.registerTool(
  "get_forecast_tasks",
  {
    description: "Get tasks from OmniFocus forecast perspective (due/deferred tasks in date range)",
    inputSchema: getForecastTasksTool.schema.shape
  },
  getForecastTasksTool.handler
);

server.registerTool(
  "get_tasks_by_tag",
  {
    description: "Get tasks filtered by OmniFocus tags (labels like @home, @work, @urgent). Use this for tag-based filtering, NOT for custom perspective names. Tags are labels assigned to individual tasks.",
    inputSchema: getTasksByTagTool.schema.shape
  },
  getTasksByTagTool.handler
);

// Ultimate filter tool - The most powerful task perspective engine
server.registerTool(
  "filter_tasks",
  {
    description: "Advanced task filtering with unlimited perspective combinations - status, dates, projects, tags, search, and more",
    inputSchema: filterTasksTool.schema.shape
  },
  filterTasksTool.handler
);

// Custom perspective tools
server.registerTool(
  "list_custom_perspectives",
  {
    description: "List all custom perspectives defined in OmniFocus",
    inputSchema: listCustomPerspectivesTool.schema.shape
  },
  listCustomPerspectivesTool.handler
);

server.registerTool(
  "get_custom_perspective_tasks",
  {
    description: "Get tasks from a specific OmniFocus custom perspective by name. Use this when user refers to perspective names like 'Today's Plan', 'Daily Review', 'Weekly Projects' etc. - these are custom views created in OmniFocus, NOT tags. Supports hierarchical tree display of task relationships.",
    inputSchema: getCustomPerspectiveTasksTool.schema.shape
  },
  getCustomPerspectiveTasksTool.handler
);

// Start the MCP server
const transport = new StdioServerTransport();

// Use await with server.connect to ensure proper connection
(async function() {
  try {
    await server.connect(transport);
  } catch (err) {
    console.error(`Failed to start MCP server: ${err}`);
  }
})();

// For a cleaner shutdown if the process is terminated
