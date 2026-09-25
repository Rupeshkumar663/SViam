## Demo
How do we run the local voice demo? Show highlighting while the agent speaks,
direct replacement of two loops, and execution of the updated code.

## Design
Who owns the editor state? How do speech, highlights, edits, and run results refer
to the correct code version? How does the agent learn that an edit actually applied?
How do you avoid overwriting concurrent user edits? Where does code run, and how
is it isolated from the web and agent processes?

## Checks and limits
What did you test? Include code changes during a response, runs that finish out of order,
repeated actions, interruptions, and connection loss. Separate mock checks from
real voice checks. What can still fail, and why?

## AI assistance
What tools did you use, and how did you check their output?

Mark this PR ready for review in your assigned private repo. Keep main unchanged;
you do not need to merge the PR.
