# Task Master AI - Agent Integration Guide

## Essential Commands

### Core Workflow Commands

```bash
# Project Setup
task-master init                                    # Initialize Task Master in current project
task-master parse-prd .taskmaster/docs/prd.txt      # Generate tasks from PRD document
task-master models --setup                        # Configure AI models interactively

# Daily Development Workflow
task-master list                                   # Show all tasks with status
task-master next                                   # Get next available task to work on
task-master show <id>                             # View detailed task information (e.g., task-master show 1.2)
task-master set-status --id=<id> --status=done    # Mark task complete

# Task Management
task-master add-task --prompt="description" --research        # Add new task with AI assistance
task-master expand --id=<id> --research --force              # Break task into subtasks
task-master update-task --id=<id> --prompt="changes"         # Update specific task
task-master update --from=<id> --prompt="changes"            # Update multiple tasks from ID onwards
task-master update-subtask --id=<id> --prompt="notes"        # Add implementation notes to subtask

# Analysis & Planning
task-master analyze-complexity --research          # Analyze task complexity
task-master complexity-report                      # View complexity analysis
task-master expand --all --research               # Expand all eligible tasks

# Dependencies & Organization
task-master add-dependency --id=<id> --depends-on=<id>       # Add task dependency
task-master move --from=<id> --to=<id>                       # Reorganize task hierarchy
task-master validate-dependencies                            # Check for dependency issues
task-master generate                                         # Update task markdown files (usually auto-called)
```

## Key Files & Project Structure

### Core Files

- `.taskmaster/tasks/tasks.json` - Main task data file (auto-managed)
- `.taskmaster/config.json` - AI model configuration (use `task-master models` to modify)
- `.taskmaster/docs/prd.txt` - Product Requirements Document for parsing
- `.taskmaster/tasks/*.txt` - Individual task files (auto-generated from tasks.json)
- `.env` - API keys for CLI usage

### Claude Code Integration Files

- `CLAUDE.md` - Auto-loaded context for Claude Code (this file)
- `.claude/settings.json` - Claude Code tool allowlist and preferences
- `.claude/commands/` - Custom slash commands for repeated workflows
- `.mcp.json` - MCP server configuration (project-specific)

### Directory Structure

```
project/
├── .taskmaster/
│   ├── tasks/              # Task files directory
│   │   ├── tasks.json      # Main task database
│   │   ├── task-1.md      # Individual task files
│   │   └── task-2.md
│   ├── docs/              # Documentation directory
│   │   ├── prd.txt        # Product requirements
│   ├── reports/           # Analysis reports directory
│   │   └── task-complexity-report.json
│   ├── templates/         # Template files
│   │   └── example_prd.txt  # Example PRD template
│   └── config.json        # AI models & settings
├── .claude/
│   ├── settings.json      # Claude Code configuration
│   └── commands/         # Custom slash commands
├── .env                  # API keys
├── .mcp.json            # MCP configuration
└── CLAUDE.md            # This file - auto-loaded by Claude Code
```

## MCP Integration

Task Master provides an MCP server that Claude Code can connect to. Configure in `.mcp.json`:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "your_key_here",
        "PERPLEXITY_API_KEY": "your_key_here",
        "OPENAI_API_KEY": "OPENAI_API_KEY_HERE",
        "GOOGLE_API_KEY": "GOOGLE_API_KEY_HERE",
        "XAI_API_KEY": "XAI_API_KEY_HERE",
        "OPENROUTER_API_KEY": "OPENROUTER_API_KEY_HERE",
        "MISTRAL_API_KEY": "MISTRAL_API_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "AZURE_OPENAI_API_KEY_HERE",
        "OLLAMA_API_KEY": "OLLAMA_API_KEY_HERE"
      }
    }
  }
}
```

### Essential MCP Tools

```javascript
help; // = shows available taskmaster commands
// Project setup
initialize_project; // = task-master init
parse_prd; // = task-master parse-prd

// Daily workflow
get_tasks; // = task-master list
next_task; // = task-master next
get_task; // = task-master show <id>
set_task_status; // = task-master set-status

// Task management
add_task; // = task-master add-task
expand_task; // = task-master expand
update_task; // = task-master update-task
update_subtask; // = task-master update-subtask
update; // = task-master update

// Analysis
analyze_project_complexity; // = task-master analyze-complexity
complexity_report; // = task-master complexity-report
```

## Claude Code Workflow Integration

### Standard Development Workflow

#### 1. Project Initialization

```bash
# Initialize Task Master
task-master init

# Create or obtain PRD, then parse it
task-master parse-prd .taskmaster/docs/prd.txt

# Analyze complexity and expand tasks
task-master analyze-complexity --research
task-master expand --all --research
```

If tasks already exist, another PRD can be parsed (with new information only!) using parse-prd with --append flag. This will add the generated tasks to the existing list of tasks..

#### 2. Daily Development Loop

```bash
# Start each session
task-master next                           # Find next available task
task-master show <id>                     # Review task details

# During implementation, check in code context into the tasks and subtasks
task-master update-subtask --id=<id> --prompt="implementation notes..."

# Complete tasks
task-master set-status --id=<id> --status=done
```

#### 3. Multi-Claude Workflows

For complex projects, use multiple Claude Code sessions:

```bash
# Terminal 1: Main implementation
cd project && claude

# Terminal 2: Testing and validation
cd project-test-worktree && claude

# Terminal 3: Documentation updates
cd project-docs-worktree && claude
```

### Custom Slash Commands

Create `.claude/commands/taskmaster-next.md`:

```markdown
Find the next available Task Master task and show its details.

Steps:

1. Run `task-master next` to get the next task
2. If a task is available, run `task-master show <id>` for full details
3. Provide a summary of what needs to be implemented
4. Suggest the first implementation step
```

Create `.claude/commands/taskmaster-complete.md`:

```markdown
Complete a Task Master task: $ARGUMENTS

Steps:

1. Review the current task with `task-master show $ARGUMENTS`
2. Verify all implementation is complete
3. Run any tests related to this task
4. Mark as complete: `task-master set-status --id=$ARGUMENTS --status=done`
5. Show the next available task with `task-master next`
```

## Tool Allowlist Recommendations

Add to `.claude/settings.json`:

```json
{
  "allowedTools": [
    "Edit",
    "Bash(task-master *)",
    "Bash(git commit:*)",
    "Bash(git add:*)",
    "Bash(npm run *)",
    "mcp__task_master_ai__*"
  ]
}
```

## Configuration & Setup

### API Keys Required

At least **one** of these API keys must be configured:

- `ANTHROPIC_API_KEY` (Claude models) - **Recommended**
- `PERPLEXITY_API_KEY` (Research features) - **Highly recommended**
- `OPENAI_API_KEY` (GPT models)
- `GOOGLE_API_KEY` (Gemini models)
- `MISTRAL_API_KEY` (Mistral models)
- `OPENROUTER_API_KEY` (Multiple models)
- `XAI_API_KEY` (Grok models)

An API key is required for any provider used across any of the 3 roles defined in the `models` command.

### Model Configuration

```bash
# Interactive setup (recommended)
task-master models --setup

# Set specific models
task-master models --set-main claude-3-5-sonnet-20241022
task-master models --set-research perplexity-llama-3.1-sonar-large-128k-online
task-master models --set-fallback gpt-4o-mini
```

## Task Structure & IDs

### Task ID Format

- Main tasks: `1`, `2`, `3`, etc.
- Subtasks: `1.1`, `1.2`, `2.1`, etc.
- Sub-subtasks: `1.1.1`, `1.1.2`, etc.

### Task Status Values

- `pending` - Ready to work on
- `in-progress` - Currently being worked on
- `done` - Completed and verified
- `deferred` - Postponed
- `cancelled` - No longer needed
- `blocked` - Waiting on external factors

### Task Fields

```json
{
  "id": "1.2",
  "title": "Implement user authentication",
  "description": "Set up JWT-based auth system",
  "status": "pending",
  "priority": "high",
  "dependencies": ["1.1"],
  "details": "Use bcrypt for hashing, JWT for tokens...",
  "testStrategy": "Unit tests for auth functions, integration tests for login flow",
  "subtasks": []
}
```

## Claude Code Best Practices with Task Master

### Context Management

- Use `/clear` between different tasks to maintain focus
- This CLAUDE.md file is automatically loaded for context
- Use `task-master show <id>` to pull specific task context when needed

### Iterative Implementation

1. `task-master show <subtask-id>` - Understand requirements
2. Explore codebase and plan implementation
3. `task-master update-subtask --id=<id> --prompt="detailed plan"` - Log plan
4. `task-master set-status --id=<id> --status=in-progress` - Start work
5. Implement code following logged plan
6. `task-master update-subtask --id=<id> --prompt="what worked/didn't work"` - Log progress
7. `task-master set-status --id=<id> --status=done` - Complete task

### Complex Workflows with Checklists

For large migrations or multi-step processes:

1. Create a markdown PRD file describing the new changes: `touch task-migration-checklist.md` (prds can be .txt or .md)
2. Use Taskmaster to parse the new prd with `task-master parse-prd --append` (also available in MCP)
3. Use Taskmaster to expand the newly generated tasks into subtasks. Consdier using `analyze-complexity` with the correct --to and --from IDs (the new ids) to identify the ideal subtask amounts for each task. Then expand them.
4. Work through items systematically, checking them off as completed
5. Use `task-master update-subtask` to log progress on each task/subtask and/or updating/researching them before/during implementation if getting stuck

### Git Integration

Task Master works well with `gh` CLI:

```bash
# Create PR for completed task
gh pr create --title "Complete task 1.2: User authentication" --body "Implements JWT auth system as specified in task 1.2"

# Reference task in commits
git commit -m "feat: implement JWT auth (task 1.2)"
```

### Parallel Development with Git Worktrees

```bash
# Create worktrees for parallel task development
git worktree add ../project-auth feature/auth-system
git worktree add ../project-api feature/api-refactor

# Run Claude Code in each worktree
cd ../project-auth && claude    # Terminal 1: Auth work
cd ../project-api && claude     # Terminal 2: API work
```

## Troubleshooting

### AI Commands Failing

```bash
# Check API keys are configured
cat .env                           # For CLI usage

# Verify model configuration
task-master models

# Test with different model
task-master models --set-fallback gpt-4o-mini
```

### MCP Connection Issues

- Check `.mcp.json` configuration
- Verify Node.js installation
- Use `--mcp-debug` flag when starting Claude Code
- Use CLI as fallback if MCP unavailable

### Task File Sync Issues

```bash
# Regenerate task files from tasks.json
task-master generate

# Fix dependency issues
task-master fix-dependencies
```

DO NOT RE-INITIALIZE. That will not do anything beyond re-adding the same Taskmaster core files.

## Important Notes

### AI-Powered Operations

These commands make AI calls and may take up to a minute:

- `parse_prd` / `task-master parse-prd`
- `analyze_project_complexity` / `task-master analyze-complexity`
- `expand_task` / `task-master expand`
- `expand_all` / `task-master expand --all`
- `add_task` / `task-master add-task`
- `update` / `task-master update`
- `update_task` / `task-master update-task`
- `update_subtask` / `task-master update-subtask`

### File Management

- Never manually edit `tasks.json` - use commands instead
- Never manually edit `.taskmaster/config.json` - use `task-master models`
- Task markdown files in `tasks/` are auto-generated
- Run `task-master generate` after manual changes to tasks.json

### Claude Code Session Management

- Use `/clear` frequently to maintain focused context
- Create custom slash commands for repeated Task Master workflows
- Configure tool allowlist to streamline permissions
- Use headless mode for automation: `claude -p "task-master next"`

### Multi-Task Updates

- Use `update --from=<id>` to update multiple future tasks
- Use `update-task --id=<id>` for single task updates
- Use `update-subtask --id=<id>` for implementation logging

### Research Mode

- Add `--research` flag for research-based AI enhancement
- Requires a research model API key like Perplexity (`PERPLEXITY_API_KEY`) in environment
- Provides more informed task creation and updates
- Recommended for complex technical tasks

---

## 🔒 MANDATORY CODING STANDARDS (보안 강제 준수사항)

### ⚠️ CRITICAL SECURITY RULES - ALWAYS FOLLOW

#### 1. Object Injection Prevention (필수)
```typescript
// ❌ NEVER - Object Injection 취약점
const value = obj[userInput];
config[dynamicKey] = value;

// ✅ ALWAYS - Safe property access
const safeMap = new Map();
safeMap.set(key, value);

// ✅ OR - Safe property check
if (Object.prototype.hasOwnProperty.call(obj, key)) {
  const value = obj[key];
}
```

#### 2. TypeScript Strict Rules (필수)
```typescript
// ❌ NEVER - any type forbidden
function process(data: any) { }

// ✅ ALWAYS - Use unknown with type guards
function process(data: unknown) {
  if (typeof data === 'string') {
    // Safe to use as string
  }
}

// ✅ ALWAYS - Explicit return types
function calculate(a: number, b: number): number {
  return a + b;
}
```

#### 3. Safe Property Access Pattern (필수)
```typescript
// ✅ ALWAYS use these helper methods for dynamic access
private safePropertyAccess<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key];
  }
  return undefined;
}

private safePropertySet<T extends object, K extends keyof T>(obj: T, key: K, value: unknown): void {
  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
    (obj as Record<string | number | symbol, unknown>)[key] = value;
  }
}
```

#### 4. Allowed Properties Whitelist (필수)
```typescript
// ✅ ALWAYS validate against allowed properties
const allowedProperties = new Set<keyof AnnotationStyling>([
  'line', 'fill', 'font', 'shadow', 'opacity', 'visible', 'zIndex',
  'animation', 'measurementPrecision', 'unitDisplay', 'scaleFactor'
]);

if (!allowedProperties.has(property)) {
  console.warn(`Invalid property: ${String(property)}`);
  return;
}
```

#### 5. Console Logging Rules (필수)
```typescript
// ❌ NEVER - console.log forbidden
console.log('debug info');

// ✅ ALLOWED - Only these methods
console.warn('warning message');
console.error('error message');
console.info('info message');
```

### 🛡️ PRE-COMMIT VALIDATION

These checks run automatically before every commit:
- `npm run typecheck` - Must pass with 0 errors
- `npx eslint src --max-warnings 0` - Must pass with 0 warnings
- `npm audit --audit-level=moderate` - No new moderate+ vulnerabilities
- No `console.log` usage
- No `any` types (except in tests)
- All Object[key] patterns must use safe access methods

### 📋 CODE REVIEW CHECKLIST

Before completing any task:
- [ ] All functions have explicit return types
- [ ] No `any` types used
- [ ] No `console.log` statements
- [ ] Object access uses safe methods or hasOwnProperty
- [ ] ESLint passes with 0 warnings
- [ ] TypeScript compiles with 0 errors

---

## 🎨 SHADCN/UI ENFORCEMENT RULES (강제 준수사항)

### ⚠️ MANDATORY shadcn/ui STANDARDS - ALWAYS FOLLOW

#### 1. Component Creation Rules (필수)
```typescript
// ❌ NEVER - Direct Tailwind classes without shadcn/ui structure
const Component = () => (
  <div className="bg-gray-100 border rounded p-4">
    <span className="text-sm">Content</span>
  </div>
);

// ✅ ALWAYS - Use shadcn/ui components with cn() utility
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const Component = ({ className, ...props }) => (
  <Card className={cn('bg-background/90 backdrop-blur-sm', className)} {...props}>
    <CardContent className="p-4">
      <Badge variant="secondary" className="text-xs">
        Content
      </Badge>
    </CardContent>
  </Card>
);
```

#### 2. Styling Pattern Rules (필수)
```typescript
// ❌ NEVER - Inline styles
<div style={{ zIndex: 10, display: 'none' }}>

// ❌ NEVER - Direct className strings without cn()
<div className="absolute top-4 right-4 bg-white p-2">

// ✅ ALWAYS - Use cn() utility for className composition
import { cn } from '../../lib/utils';

<div className={cn(
  'absolute top-4 right-4',
  'bg-background/90 backdrop-blur-sm',
  'border-border/50',
  isActive && 'opacity-100'
)}>
```

#### 3. UI Component Requirements (필수)
```typescript
// ✅ REQUIRED - All UI components must follow shadcn/ui patterns
// Location: src/components/ui/

// ✅ REQUIRED - Use Radix UI primitives
import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as SelectPrimitive from "@radix-ui/react-select"

// ✅ REQUIRED - ForwardRef pattern
const Component = React.forwardRef<
  React.ElementRef<typeof Primitive.Root>,
  React.ComponentPropsWithoutRef<typeof Primitive.Root>
>(({ className, ...props }, ref) => (
  <Primitive.Root
    ref={ref}
    className={cn("base-styles", className)}
    {...props}
  />
))
Component.displayName = Primitive.Root.displayName
```

#### 4. Prohibited Patterns (금지사항)
```typescript
// ❌ FORBIDDEN - Raw HTML input elements for complex controls
<input type="range" className="slider" />

// ❌ FORBIDDEN - Direct style objects
const styles = { backgroundColor: '#fff', padding: '16px' };

// ❌ FORBIDDEN - Non-shadcn component patterns
const CustomComponent = ({ children }) => {
  return <div className="custom-style">{children}</div>;
};

// ✅ REQUIRED - Use shadcn/ui components
import { Slider } from '../ui/slider';
import { Card } from '../ui/card';

const Component = ({ children, className }) => (
  <Card className={cn('default-styles', className)}>
    {children}
  </Card>
);
```

#### 5. Component File Structure (필수)
```typescript
// ✅ REQUIRED - All components must follow this structure:
/**
 * Component Name
 * Description of component purpose
 * Built with shadcn/ui components
 */

import React from 'react';
import { ComponentPrimitive } from '@radix-ui/react-component';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

interface ComponentProps {
  // Typed props
}

export const Component: React.FC<ComponentProps> = ({
  className,
  ...props
}) => {
  return (
    <Card className={cn('base-styles', className)}>
      {/* shadcn/ui components only */}
    </Card>
  );
};
```

### 🛡️ PRE-COMMIT SHADCN/UI VALIDATION

These checks run automatically before every commit:
- All UI components must use shadcn/ui patterns
- No inline styles allowed (`style={{}}`)
- No direct className strings without `cn()` utility
- All form controls must use shadcn/ui primitives
- Component files must follow shadcn/ui structure

### 📋 SHADCN/UI CODE REVIEW CHECKLIST

Before completing any UI task:
- [ ] Uses shadcn/ui components exclusively
- [ ] All className uses cn() utility function
- [ ] No inline styles present
- [ ] Follows Radix UI primitive patterns
- [ ] Component has proper forwardRef if needed
- [ ] Uses CSS variables for theming
- [ ] Accessible markup with proper ARIA attributes

### 🎯 APPROVED SHADCN/UI COMPONENTS

Only use these pre-approved shadcn/ui components:
- `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Button` with proper variants
- `Badge` with semantic variants  
- `Dialog`, `DialogContent`, `DialogHeader`
- `Select`, `SelectContent`, `SelectItem`
- `Progress` for progress indicators
- `Slider` for range controls
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`

**Any new UI components MUST be created following shadcn/ui patterns in `/src/components/ui/` directory.**

---

_This guide ensures Claude Code has immediate access to Task Master's essential functionality for agentic development workflows AND enforces critical security standards AND shadcn/ui compliance._
