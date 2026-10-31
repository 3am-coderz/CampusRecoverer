# Member 2: Core Module

The Core module provides foundational user authentication, item reporting, claim processing, notification dispatch, and lifecycle transitions.

## Ownership
- Owner: Member 2
- Mount prefixes: `/auth`, `/items`, `/claims`, `/notifications`
- Provided Ports: `CoreServicesPort`

## Security and Privacy Invariants
1. Public projection NEVER leaks `hidden_description`, `hidden_attributes`, or finder identity.
2. Finders cannot submit claims on items they reported.
3. Item transitions and claim transitions strictly call `WorkflowPort` assertions.
4. If matching service is unavailable, claims gracefully degrade to `MANUAL_REVIEW`.
5. Background cron automatically promotes verified items from `WAITING_PERIOD` to `OPEN_FOR_CLAIMS` once waiting duration elapses.
