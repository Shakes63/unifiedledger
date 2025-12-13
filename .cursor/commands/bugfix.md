# bugfix

Review docs/bugs.md and keep fixing bugs until the context window is nearly full or there are no unfinished bugs left.
For each bug:
Before coding: write docs/<bug>-fix-plan.md (steps, architecture/UI fit, theme variables, strict TypeScript—no any).
Implement the first task from the plan.
Update docs/bugs.md and .cursor/rules:
Keep “New Bugs” at the top of docs/bugs.md.
For incomplete bugs: include status, what’s left, and link the plan.
For completed bugs: Bug Name [FIXED YYYY-MM-DD] - 1–2 line summary, delete the plan file, and add a small Testing Library regression test.
Commit and push changes as you go (or at least at the end if time is tight).
