# Requirements Document

## Introduction

The `acbu-backend` project uses PostgreSQL via Prisma ORM and defines 30 database models across 5 functional domains (Identity & Auth, KYC, Transactions & Payments, Payroll, and Treasury & Reserve), plus cross-cutting concerns (Audit & Observability, Investment). No visual Entity-Relationship Diagram or structured database documentation currently exists, creating a bottleneck for onboarding new engineers and conducting schema reviews.

This feature produces a comprehensive, maintainable, text-based ER diagram set using Mermaid.js and structured markdown documentation organized under the `docs/architecture/` directory. All deliverables are derived from the Prisma schema (`prisma/schema.prisma`) as the single source of truth. No source code or Prisma schema files are modified.

## Glossary

- **ERD**: Entity-Relationship Diagram — a visual representation of database tables, their fields, and the relationships between them.
- **Mermaid.js**: A text-based diagramming syntax that renders natively on GitHub and in many documentation tools.
- **Prisma**: The ORM used by `acbu-backend`; its `schema.prisma` file defines all 30 models.
- **Domain**: A logical grouping of related database models (e.g., Identity & Auth, KYC).
- **PK**: Primary key field.
- **FK**: Foreign key field that references another table's PK.
- **Cardinality**: The numeric relationship between two entities (e.g., one-to-many, one-to-one).
- **Overview_Document**: The file `docs/architecture/database-overview.md`.
- **Domain_Document**: Any of the per-domain files under `docs/architecture/domains/`.
- **Documentation_Set**: The combined set of the Overview_Document and all Domain_Documents.

## Requirements

### Requirement 1: Documentation Directory Structure

**User Story:** As a backend engineer, I want a dedicated documentation directory for database architecture, so that all ERD and schema documentation is discoverable in one place.

#### Acceptance Criteria

1. THE Documentation_Set SHALL be placed under the `docs/architecture/` directory within the repository root.
2. THE Documentation_Set SHALL include the file `docs/architecture/database-overview.md` containing at least 1 character of content.
3. THE Documentation_Set SHALL include a subdirectory `docs/architecture/domains/` containing exactly the following five markdown files and no additional ones: `auth-identity.md`, `kyc.md`, `transactions-payments.md`, `payroll.md`, `treasury-reserve.md`.
4. Each of the five domain files SHALL contain at least 1 character of content.
5. THE Documentation_Set SHALL NOT modify any file outside the `docs/architecture/` directory, including source code and `prisma/schema.prisma`.

---

### Requirement 2: Overview Document

**User Story:** As a new engineer, I want a high-level overview document, so that I can quickly understand the database technology stack, the number of models, and how they cluster into domains.

#### Acceptance Criteria

1. THE Overview_Document SHALL include an introduction section that names the database technology (PostgreSQL), the ORM (Prisma), the total number of models (30), and lists each of the 5 functional domain names (Identity & Auth, KYC, Transactions & Payments, Payroll, Treasury & Reserve).
2. THE Overview_Document SHALL include a bird's-eye Mermaid.js `erDiagram` block containing at minimum the 7 core entities (`Organization`, `User`, `Transaction`, `KycApplication`, `SalaryBatch`, `Reserve`, `AuditTrail`) and at least one labeled relationship line per directly-related entity pair using valid `erDiagram` cardinality notation.
3. THE Overview_Document SHALL render the bird's-eye diagram using only the `erDiagram` keyword so that it renders natively on GitHub.
4. THE Overview_Document SHALL include a section that describes cross-cutting concerns where, for each of `AuditTrail` and `InvestmentStrategy`, it states (a) whether the model uses FK constraints or generic UUID references to relate to other tables, and (b) which application layer or module uses the model.
5. THE Overview_Document SHALL include a maintenance guide section that maps each of the following 4 change types to the specific documentation files that must be updated: adding a model, removing a model, changing a relationship, and adding a meaningful field.

---

### Requirement 3: Domain Documents — Structure and Content

**User Story:** As an engineer reviewing a specific domain, I want a domain-scoped document with a detailed ERD and business context notes, so that I can understand the data model without reading the full schema file.

#### Acceptance Criteria

1. WHEN a Domain_Document is generated for a domain, THE Domain_Document SHALL include a prose description that covers: (a) the domain's business purpose, (b) the names of all models it contains, and (c) any cross-domain models it references.
2. WHEN a Domain_Document is generated for a domain, THE Domain_Document SHALL include a Mermaid.js `erDiagram` block covering all models that belong to that domain, with at least one labeled relationship line between each pair of related entities using valid cardinality notation.
3. WHEN a Domain_Document is generated for a domain, THE Domain_Document SHALL list the PK field and all FK fields with their referenced tables inside the `erDiagram` block as field attributes.
4. WHEN a Domain_Document is generated for a domain, THE Domain_Document SHALL omit `createdAt` / `updatedAt` fields from the `erDiagram` block unless they participate in a unique constraint.
5. WHEN a Domain_Document is generated for a domain, THE Domain_Document SHALL include business logic notes that: (a) explain the status lifecycle for each model that has a `status` field, (b) describe any unique constraints and what they enforce, and (c) for every cross-domain FK or application-layer UUID reference, name the target domain and the target entity.

---

### Requirement 4: Mermaid.js ERD Notation Standards

**User Story:** As an engineer reading the diagrams, I want consistent and correct Mermaid.js notation, so that diagrams render without errors and relationships are unambiguous.

#### Acceptance Criteria

1. THE Documentation_Set SHALL use only the `erDiagram` diagram type across all Mermaid.js blocks.
2. THE Documentation_Set SHALL represent one-to-many relationships using the `||--o{` notation.
3. THE Documentation_Set SHALL represent one-to-one relationships using the `||--||` notation.
4. THE Documentation_Set SHALL represent many-to-one relationships using the `}o--||` notation.
5. THE Documentation_Set SHALL represent zero-or-one relationships using the `||--o|` notation.
6. IF a foreign key field is nullable in `prisma/schema.prisma`, THEN THE Documentation_Set SHALL use the zero-or-one (`o|`) cardinality marker on the FK side and the mandatory (`||`) cardinality marker on the referenced entity's side.
7. THE Documentation_Set SHALL NOT include fields that have no PK, FK, or unique constraint and are not required to express a relationship (e.g., `userAgent`, `signature`, `payload`, `rateSnapshot`, `rawValues`, `validatorSignatures`) in `erDiagram` attribute lists.

---

### Requirement 5: Schema Accuracy

**User Story:** As a senior engineer conducting a schema review, I want the documentation to accurately reflect the Prisma schema, so that I can trust the diagrams without cross-referencing the raw schema file.

#### Acceptance Criteria

1. THE Documentation_Set SHALL derive all entity names, field names, field types, and relationships from `prisma/schema.prisma`; specifically, each entity name SHALL match the Prisma model name, each FK field name SHALL match the `@map` column name or field name in the schema, and each field type SHALL match the Prisma scalar type.
2. WHEN a model has a self-referential relationship (e.g., `Guardian` referencing `User` via both `userId` and `guardianUserId`), THE Domain_Document SHALL represent both relationships as distinct labeled lines — `User ||--o{ Guardian : "is ward of (userId)"` and `User ||--o{ Guardian : "is guardian of (guardianUserId)"` — using the exact relation name strings from the `@relation` annotation in `schema.prisma`.
3. WHEN a model belongs to multiple domains by reference (e.g., `Transaction` referenced from the Payroll domain via `SalaryItem.transactionId`), THE Domain_Document for the referencing domain SHALL show the cross-domain entity with a comment in the `erDiagram` block in the format `%% <EntityName> is defined in the <DomainName> domain` and a relationship line using `||--o|` or `||--||` as appropriate.
4. THE Overview_Document bird's-eye diagram SHALL show correct cardinality for all directly-related entity pairs among the 7 core entities, where `Organization ||--o{ User`, `Organization ||--o{ Transaction`, `Organization ||--o{ SalaryBatch`, `User ||--o{ Transaction`, `User ||--o{ KycApplication`, and `User ||--o{ SalaryBatch` are the required relationship lines; `Reserve` and `AuditTrail` SHALL be included as entity blocks without outbound relationship lines since they have no FK relationships to the other 5 core entities.

---

### Requirement 6: Maintainability

**User Story:** As a tech lead, I want clear maintenance guidelines, so that the documentation stays current as the schema evolves.

#### Acceptance Criteria

1. THE Overview_Document maintenance guide SHALL specify that `prisma/schema.prisma` is the single source of truth and SHALL list the following change types that require documentation updates: adding a model, removing a model, changing a relationship, adding a meaningful field (PK/FK/unique), changing a field type or name, and moving a model to a different domain.
2. THE Overview_Document maintenance guide SHALL include a table or list that maps each of the 6 change types from criterion 1 to the specific files that must be updated, so that any two engineers reading the guide reach the same conclusion about which files to edit.
3. WHEN a developer is preparing to merge a documentation PR, THE Overview_Document maintenance guide SHALL specify the following validation steps that must be completed: (a) paste each modified `erDiagram` block into the Mermaid Live Editor or GitHub preview to confirm it renders without errors, (b) verify that all FK field names in the diagram match the `@map` or field names in `schema.prisma`, and (c) verify that relationship cardinalities match the nullable/required status of FK fields in the schema.
