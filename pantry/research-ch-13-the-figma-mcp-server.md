# Research: Chapter 13 — The Figma MCP Server
## Brutalist Figma + Claude

**Chapter one-line:** Connect Figma to AI coding agents through MCP so generated code uses the real design system context.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma MCP server guide. Source: https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server
2. Figma Code Connect overview. Source: https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect
3. Figma Dev Mode guide. Source: https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode
4. Figma Dev Mode code snippets. Source: https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode
5. Anthropic Claude Code overview. Source: https://docs.anthropic.com/en/docs/claude-code/overview
6. Anthropic MCP documentation. Source: https://docs.anthropic.com/
7. Model Context Protocol specification/docs.
8. Agentic AI evaluation and human-in-the-loop literature.
9. Design system governance sources.
10. Secure local tool integration guidance.

## 2. Core Concept — State of the Field

Figma's MCP server is currently documented as a way to provide design context to AI-enabled tools and code editors. Figma Help indicates it is tied to Dev Mode and available through supported plans/seats; the feature is still a moving target and should be framed as current practice, not settled infrastructure.

Code Connect improves MCP usefulness by mapping design components to real code components.

## 3. Application Domain Examples

1. Claude Code reads Figma context.
2. Code generation with and without Code Connect.
3. `FIGMA.md` as session governance.
4. Local server setup and authentication.
5. Human review of generated component.

## 4. Book's Thesis Connection

MCP is not magic design-to-code. It is a structured context layer whose quality depends on the design system and mappings underneath it.

## 5. AI Wayback Machine — Candidate Figures

1. MCP as tool/context protocol.
2. Dev Mode handoff.
3. Code Connect.
4. Agentic coding workflows.

## 6. Pedagogical Delivery Research

Run the same component request twice: generic Claude Code context versus Figma MCP plus Code Connect context.

## 7. Representation and Display Research

Checklist:

- Dev Mode/MCP prerequisites met?
- Code Connect mappings present?
- Agent authority bounded?
- Generated code compared to design system?
- Human approves before shipping?

## 8. Open Questions and Research Gaps

1. Verify current MCP setup syntax before final draft.
2. Add failure cases for large frames and missing mappings.
3. Include security/privacy boundary for local server use.
