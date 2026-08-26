# Dynamic RBAC Authorization Audit Report (Phase 0)

**Date**: 2026-08-22 20:25:00 (UTC+7 / Asia/Ho_Chi_Minh)  
**Scope**: Backend API Authorization Architecture (`template-be`)  
**Status**: AUDIT COMPLETE (Pre-Implementation)

---

## 1. Executive Summary

This audit evaluates the authorization system of the backend template. Currently, the system relies on a **Fixed Role-Based Authorization** model:
- Roles (`ADMIN`, `MANAGER`, `USER`) are stored in the database, but access permissions are hard-coded in route definitions (`requireRole(ROLES.ADMIN)`).
- Adding a new role (e.g., `ACCOUNTANT`, `AUDITOR`) or reconfiguring privileges currently requires modifying source code and redeploying the backend.
- The objective is to transition to **Dynamic Role-Based Access Control (RBAC)** where:
  - Permissions represent granular business capabilities (`USER_READ`, `USER_CREATE`, `WALLET_READ`, `ROLE_UPDATE`, etc.).
  - Roles group permissions dynamically in the database (`Role` -> `RolePermission` -> `Permission`).
  - Middleware enforces permissions (`requirePermission('USER_READ')`), making authorization independent of specific role names.
  - Resource ownership checks are strictly preserved to prevent Insecure Direct Object References (IDOR).

---

## 2. Inventory of Current Authorization Artifacts

### 2.1 Current Roles
- Defined in `src/common/constants/role.constant.ts`:
  ```typescript
  export const ROLES = {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    USER: 'USER',
  } as const;
  ```
- Seeded in database via `prisma/seed.ts` into the `Role` table (`roles`).

### 2.2 Current Role Checks & Route Guards
The codebase currently uses `requireRole(...)` from `src/middlewares/role.middleware.ts`:
- `src/modules/users/user.route.ts`:
  - `GET /api/v1/users` -> `authMiddleware, requireRole(ROLES.ADMIN)`
  - `GET /api/v1/users/:id` -> `authMiddleware, requireRole(ROLES.ADMIN)`
  - `POST /api/v1/users` -> `authMiddleware, requireRole(ROLES.ADMIN)`
  - `PUT /api/v1/users/:id` -> `authMiddleware, requireRole(ROLES.ADMIN)`
  - `DELETE /api/v1/users/:id` -> `authMiddleware, requireRole(ROLES.ADMIN)`
- `src/modules/auth/auth.service.ts`:
  - Hardcodes default role on registration: `this.repository.findRoleByName(ROLES.USER)`.
  - JWT token payload creation embeds `role: user.role.name`.

### 2.3 Hard-Coded Authorization Vulnerabilities & Limitations
1. **Coupling to Role Names**: `requireRole(ROLES.ADMIN)` strictly checks `req.user.role === 'ADMIN'`. New roles cannot access any administrative features without modifying route files.
2. **Coarse-Grained Control**: A user either has all admin rights or none. It is impossible to grant read-only user inspection without granting user deletion rights.
3. **No Permission Entity in DB**: The database only contains `roles` and `users`; there are no `permissions` or `role_permissions` tables.

---

## 3. Dynamic RBAC Permission Design

We structure permissions following the `RESOURCE_ACTION` capability model:

| Resource | Action | Permission Name | Description |
| :--- | :--- | :--- | :--- |
| `USER` | `READ` | `USER_READ` | View user list and profile details |
| `USER` | `CREATE` | `USER_CREATE` | Create new user accounts (Admin) |
| `USER` | `UPDATE` | `USER_UPDATE` | Update user status and role assignments |
| `USER` | `DELETE` | `USER_DELETE` | Soft-delete user accounts |
| `USER` | `ASSIGN_ROLE` | `USER_ROLE_ASSIGN` | Assign role to users |
| `ROLE` | `READ` | `ROLE_READ` | View roles and role permissions |
| `ROLE` | `CREATE` | `ROLE_CREATE` | Create new custom roles |
| `ROLE` | `UPDATE` | `ROLE_UPDATE` | Edit role information |
| `ROLE` | `DELETE` | `ROLE_DELETE` | Delete non-system roles |
| `PERMISSION` | `READ` | `PERMISSION_READ` | View system permission catalog |
| `ROLE_PERMISSION` | `ASSIGN` | `ROLE_PERMISSION_ASSIGN` | Assign/revoke permissions to/from roles |
| `NOTIFICATION` | `READ` | `NOTIFICATION_READ` | View system notifications and logs |
| `NOTIFICATION` | `CREATE` | `NOTIFICATION_CREATE` | Send notifications to users |
| `NOTIFICATION` | `UPDATE` | `NOTIFICATION_UPDATE` | Retry failed email deliveries |
| `NOTIFICATION` | `DELETE` | `NOTIFICATION_DELETE` | Delete notification logs |
| `NOTIFICATION_TEMPLATE` | `READ` | `NOTIFICATION_TEMPLATE_READ` | View email/notification templates |
| `NOTIFICATION_TEMPLATE` | `MANAGE` | `NOTIFICATION_TEMPLATE_MANAGE` | Create and edit notification templates |
| `AUDIT_LOG` | `READ` | `AUDIT_LOG_READ` | View security and RBAC audit logs |
| `MAINTENANCE` | `READ` | `MAINTENANCE_READ` | View maintenance state and config |
| `MAINTENANCE` | `MANAGE` | `MAINTENANCE_MANAGE` | Configure maintenance windows and IPs |
| `MAINTENANCE` | `BYPASS` | `MAINTENANCE_BYPASS` | Access system during maintenance mode |
| `API_KEY` | `READ` | `API_KEY_READ` | View API keys and usages |
| `API_KEY` | `MANAGE` | `API_KEY_MANAGE` | Create and revoke API keys |
| `WEBHOOK` | `READ` | `WEBHOOK_READ` | View webhook configurations and logs |
| `WEBHOOK` | `MANAGE` | `WEBHOOK_MANAGE` | Create, test, and manage webhooks |
| `SYSTEM_CONFIG` | `READ` | `SYSTEM_CONFIG_READ` | View system configuration flags |
| `SYSTEM_CONFIG` | `MANAGE` | `SYSTEM_CONFIG_MANAGE` | Modify system configurations |
| `CRON_JOB` | `READ` | `CRON_JOB_READ` | View cron execution history |
| `CRON_JOB` | `MANAGE` | `CRON_JOB_MANAGE` | Trigger and configure scheduled jobs |
| `KEYBOARD` | `READ` | `KEYBOARD_READ` | View keyboard themes catalog |
| `KEYBOARD` | `CREATE` | `KEYBOARD_CREATE` | Create new keyboard theme |
| `KEYBOARD` | `UPDATE` | `KEYBOARD_UPDATE` | Update keyboard theme metadata |
| `KEYBOARD` | `DELETE` | `KEYBOARD_DELETE` | Delete or archive keyboard theme |
| `CATEGORY` | `READ` | `CATEGORY_READ` | View theme categories |
| `CATEGORY` | `CREATE` | `CATEGORY_CREATE` | Create new theme category |
| `CATEGORY` | `UPDATE` | `CATEGORY_UPDATE` | Edit theme category |
| `CATEGORY` | `DELETE` | `CATEGORY_DELETE` | Delete theme category |
| `COLLECTION` | `READ` | `COLLECTION_READ` | View curated collections |
| `COLLECTION` | `CREATE` | `COLLECTION_CREATE` | Create theme collection |
| `COLLECTION` | `UPDATE` | `COLLECTION_UPDATE` | Update theme collection |
| `COLLECTION` | `DELETE` | `COLLECTION_DELETE` | Delete theme collection |
| `STUDIO` | `ACCESS` | `STUDIO_ACCESS` | Access Creator Studio workspace |
| `CREATOR` | `MANAGE` | `CREATOR_MANAGE` | Review and manage creator applications |

---

## 4. Initial Role-to-Permission Mapping (Baseline Seeding)

| Role Name | Is System | Assigned Permissions |
| :--- | :--- | :--- |
| **`ADMIN`** | `true` | **ALL Permissions** (Full platform management + all capabilities) |
| **`MANAGER`** | `true` | `USER_READ`, `ROLE_READ`, `PERMISSION_READ`, `NOTIFICATION_*`, `AUDIT_LOG_READ`, `API_KEY_READ`, `WEBHOOK_READ`, `SYSTEM_CONFIG_READ`, `CRON_JOB_READ`, `KEYBOARD_READ`, `CATEGORY_*`, `COLLECTION_*`, `STUDIO_ACCESS`, `CREATOR_MANAGE` |
| **`CREATOR`** | `true` | `NOTIFICATION_READ`, `KEYBOARD_READ`, `KEYBOARD_CREATE`, `KEYBOARD_UPDATE`, `COLLECTION_*`, `STUDIO_ACCESS` |
| **`USER`** | `true` | `NOTIFICATION_READ`, `COLLECTION_*`, `STUDIO_ACCESS` |

---

## 5. Security Invariants & Protections

1. **System Roles Protection (`isSystem = true`)**:
   - The `ADMIN` and `USER` system roles cannot be deleted.
   - The `ADMIN` role must always retain `ROLE_PERMISSION_ASSIGN` to prevent permanent administrator lockout.
2. **Resource Ownership Preservation**:
   - `WALLET_READ` or `TRANSACTION_READ` only allows users to query their **own** data (`where: { userId }`).
   - Having a permission grants the *capability* to perform an action, while the service layer enforces *resource ownership*.
3. **Audit Logging**:
   - Every mutation on Roles, RolePermissions, and User Roles is captured in `AuditLog`.

---

## 6. Migration Plan

1. **Database Schema**: Add `Permission`, `RolePermission`, `AuditLog` models to `prisma/schema.prisma`. Add `isSystem` and `description` to `Role`.
2. **Database Migration**: Run `pnpm run prisma:generate` and safe migration.
3. **Idempotent Seed**: Upsert all permissions and link initial baseline permissions to `ADMIN`, `MANAGER`, and `USER`.
4. **Middleware & Caching**: Implement `requirePermission(...permissions)` middleware with in-memory TTL caching for role permissions.
5. **RBAC APIs**: Expose `/api/v1/roles`, `/api/v1/permissions`, and `/api/v1/audit-logs` modules.
6. **Refactor Existing Routes**: Replace `requireRole` with `requirePermission` in User and Auth routes.
7. **Auth / Me & Token**: Update `GET /auth/me` and login response to provide user permissions for frontend UI rendering.
8. **Automated Testing & Security Audit**: Add comprehensive unit and integration tests verifying permission grant, denial, ownership, and protection invariants.
