---
name: javalin
description: Develop, review, debug, migrate, and test Javalin applications using the official Javalin 7 guidance for Java and Kotlin. Use for Javalin routes, handlers, validation, plugins, WebSockets, SSE, OpenAPI, JavalinTest, Javalin 6-to-7 migration, or when the user runs /javalin.
license: Apache-2.0
metadata:
  author: Javalin project
  version: "7.2.2"
  source: https://javalin.io/ai
---

# Javalin

Use the official Javalin instructions in [javalin-7.2.2-official.md](references/javalin-7.2.2-official.md) as the framework source of truth.

## Workflow

1. Inspect `pom.xml`, `build.gradle*`, source layout, and existing application setup before changing code.
2. Determine the installed Javalin major version. Apply the bundled reference directly to Javalin 7.2.2; for another version, verify changed APIs against the matching official documentation before editing.
3. Determine whether the project uses Java or Kotlin and preserve its existing language, style, dependency injection, JSON mapper, persistence, and testing conventions.
4. Open the official reference and use only the sections relevant to the task.
5. Keep HTTP handlers thin. Put domain and persistence behavior behind explicit services or repositories when the project already follows that structure.
6. Validate path, query, form, and body input at the boundary. Map failures to consistent HTTP responses without leaking internal details.
7. For Javalin 7, register routes, route handlers, and related configuration inside `Javalin.create { ... }` / `Javalin.create(config -> { ... })` through `config.routes`.
8. Use `JavalinTest` for HTTP integration behavior and the project's existing JUnit conventions for isolated units. If the `java-junit` skill is available, apply it without replacing established project conventions.
9. Run the narrowest relevant Maven or Gradle tests, then run the broader suite when practical.

## Guardrails

- Do not introduce Spring or Quarkus patterns into a Javalin application unless the project explicitly integrates them.
- Do not assume the latest Javalin API; inspect the resolved project version first.
- Do not add routes after startup when working with Javalin 7.
- Do not add `javalin-bundle` merely for convenience if the project intentionally manages Jackson, logging, or test dependencies separately.
- Preserve the project's existing error-response schema and authentication model.
- Treat the version-specific official reference as authoritative over generic Java or Kotlin advice.
